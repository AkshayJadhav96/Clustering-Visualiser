#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <pthread.h>
#include <float.h>
#include <time.h>
#include "kmeans.h"

float euclidean_sq_distance(float *a, float *b, int dim) {
    float sum = 0.0;
    for (int i = 0; i < dim; i++) {
        float diff = a[i] - b[i];
        sum += diff * diff;
    }
    return sum;
}

/* ---------- K-means++ init: threaded min squared-distance to existing centroids ---------- */

typedef struct {
    Dataset *data;
    float **centroids;
    int num_existing;
    int dim;
    int start;
    int end;
    float *min_dist_sq;
} KMeansPPDistArgs;

static void *kmeans_pp_min_dist_chunk(void *arg) {
    KMeansPPDistArgs *a = (KMeansPPDistArgs *)arg;

    for (int i = a->start; i < a->end; i++) {
        float min_d = FLT_MAX;
        for (int j = 0; j < a->num_existing; j++) {
            float d = euclidean_sq_distance(a->data->points[i], a->centroids[j], a->dim);
            if (d < min_d) min_d = d;
        }
        a->min_dist_sq[i] = min_d;
    }

    return NULL;
}

static void rng_seed_once(void) {
    static int seeded = 0;
    if (seeded) return;
    struct timespec ts;
    if (clock_gettime(CLOCK_REALTIME, &ts) == 0) {
        unsigned seed = (unsigned)(ts.tv_sec ^ (ts.tv_nsec * 1103515245u));
        srand(seed);
    } else {
        srand((unsigned)time(NULL));
    }
    seeded = 1;
}

/** Pick index i with probability weights[i] / sum(weights). Falls back to uniform if sum ~ 0. */
static int weighted_random_index(const float *weights, int n) {
    double total = 0.0;
    for (int i = 0; i < n; i++) {
        double w = (double)weights[i];
        if (isfinite(w) && w > 0.0) total += w;
    }

    if (total <= 1e-30 || !isfinite(total)) {
        int idx = (int)((double)rand() / ((double)RAND_MAX + 1.0) * n);
        if (idx >= n) idx = n - 1;
        if (idx < 0) idx = 0;
        return idx;
    }

    double r = ((double)rand() / (double)RAND_MAX) * total;
    double acc = 0.0;
    for (int i = 0; i < n; i++) {
        double w = (double)weights[i];
        if (!isfinite(w) || w <= 0.0) continue;
        acc += w;
        if (acc >= r) return i;
    }
    return n - 1;
}

static void parallel_min_sq_distances(Dataset *data, float **centroids, int num_existing, int dim,
                                      float *min_dist_sq, int num_threads) {
    int n = data->n_points;

    if (num_threads < 2 || n == 0) {
        KMeansPPDistArgs one = {data, centroids, num_existing, dim, 0, n, min_dist_sq};
        kmeans_pp_min_dist_chunk(&one);
        return;
    }

    pthread_t threads[num_threads];
    KMeansPPDistArgs args[num_threads];

    for (int t = 0; t < num_threads; t++) {
        args[t].data = data;
        args[t].centroids = centroids;
        args[t].num_existing = num_existing;
        args[t].dim = dim;
        args[t].min_dist_sq = min_dist_sq;
        args[t].start = (int)((long long)t * n / num_threads);
        args[t].end = (int)((long long)(t + 1) * n / num_threads);
        pthread_create(&threads[t], NULL, kmeans_pp_min_dist_chunk, &args[t]);
    }

    for (int t = 0; t < num_threads; t++) {
        pthread_join(threads[t], NULL);
    }
}

/**
 * K-means++ initialization: first centroid = random point; each next centroid sampled with
 * probability proportional to squared distance to nearest existing centroid.
 * Uses num_threads to parallelize distance computations each round.
 */
static float **init_centroids_kmeans_pp(Dataset *data, int k, int num_threads) {
    rng_seed_once();

    int n = data->n_points;
    int dim = data->dim;

    float **centroids = malloc(k * sizeof(float *));
    if (!centroids) return NULL;

    for (int i = 0; i < k; i++) {
        centroids[i] = malloc(dim * sizeof(float));
        if (!centroids[i]) {
            for (int j = 0; j < i; j++) free(centroids[j]);
            free(centroids);
            return NULL;
        }
    }

    float *min_dist_sq = malloc(n * sizeof(float));
    if (!min_dist_sq) {
        for (int i = 0; i < k; i++) free(centroids[i]);
        free(centroids);
        return NULL;
    }

    int first = 0;
    if (n > 0) {
        first = (int)((double)rand() / ((double)RAND_MAX + 1.0) * n);
        if (first >= n) first = n - 1;
        if (first < 0) first = 0;
    }
    for (int d = 0; d < dim; d++) {
        centroids[0][d] = data->points[first][d];
    }

    for (int t = 1; t < k; t++) {
        parallel_min_sq_distances(data, centroids, t, dim, min_dist_sq, num_threads);
        int chosen = weighted_random_index(min_dist_sq, n);
        for (int d = 0; d < dim; d++) {
            centroids[t][d] = data->points[chosen][d];
        }
    }

    free(min_dist_sq);
    return centroids;
}

/** Fallback if K-means++ allocation fails (same behavior as original). */
static float **init_centroids_first_k(Dataset *data, int k) {
    float **centroids = malloc(k * sizeof(float *));
    if (!centroids) return NULL;
    for (int i = 0; i < k; i++) {
        centroids[i] = malloc(data->dim * sizeof(float));
        if (!centroids[i]) {
            for (int j = 0; j < i; j++) free(centroids[j]);
            free(centroids);
            return NULL;
        }
        for (int j = 0; j < data->dim; j++) {
            centroids[i][j] = data->points[i][j];
        }
    }
    return centroids;
}

void *assign_points(void *arg) {
    ThreadArgs *args = (ThreadArgs *)arg;

    for (int i = args->start; i < args->end; i++) {
        float min_dist = FLT_MAX;
        int best_cluster = 0;

        for (int j = 0; j < args->k; j++) {
            float dist = euclidean_sq_distance(args->data->points[i], args->centroids[j], args->dim);

            if (dist < min_dist) {
                min_dist = dist;
                best_cluster = j;
            }
        }

        args->labels[i] = best_cluster;

        args->local_count[best_cluster]++;
        for (int d = 0; d < args->dim; d++) {
            args->local_sum[best_cluster][d] += args->data->points[i][d];
        }
    }

    return NULL;
}

void run_kmeans(Dataset *data, int k, int max_iter, float ****history, int *iterations_done,
                int **final_labels, int num_threads) {

    pthread_t threads[num_threads];
    ThreadArgs args[num_threads];

    int final_iter = max_iter;
    int n = data->n_points;
    int dim = data->dim;
    if (k > n) k = n;

    if (num_threads < 1) num_threads = 1;

    float **centroids = init_centroids_kmeans_pp(data, k, num_threads);
    if (!centroids) {
        centroids = init_centroids_first_k(data, k);
    }
    if (!centroids) {
        *history = NULL;
        *iterations_done = 0;
        *final_labels = NULL;
        return;
    }

    int *labels = malloc(n * sizeof(int));

    float **sum = malloc(k * sizeof(float *));
    int *count = malloc(k * sizeof(int));

    float ***hist = malloc(max_iter * sizeof(float **));

    for (int i = 0; i < max_iter; i++) {
        hist[i] = malloc(k * sizeof(float *));
        for (int j = 0; j < k; j++) {
            hist[i][j] = malloc(dim * sizeof(float));
        }
    }

    for (int i = 0; i < k; i++) {
        sum[i] = calloc(dim, sizeof(float));
    }

    for (int t = 0; t < num_threads; t++) {
        args[t].local_sum = malloc(k * sizeof(float *));
        args[t].local_count = calloc(k, sizeof(int));

        for (int j = 0; j < k; j++) {
            args[t].local_sum[j] = calloc(dim, sizeof(float));
        }
    }

    for (int iter = 0; iter < max_iter; iter++) {

        for (int i = 0; i < k; i++) {
            count[i] = 0;
            for (int j = 0; j < dim; j++) {
                sum[i][j] = 0.0;
            }
        }

        int chunk = n / num_threads;
        if (chunk == 0) chunk = 1;

        for (int t = 0; t < num_threads; t++) {
            args[t].data = data;
            args[t].centroids = centroids;
            args[t].k = k;
            args[t].dim = dim;
            args[t].labels = labels;

            args[t].start = t * chunk;
            args[t].end = (t == num_threads - 1) ? n : (t + 1) * chunk;

            for (int j = 0; j < k; j++) {
                args[t].local_count[j] = 0;
                for (int d = 0; d < dim; d++) {
                    args[t].local_sum[j][d] = 0.0;
                }
            }

            pthread_create(&threads[t], NULL, assign_points, &args[t]);
        }

        for (int t = 0; t < num_threads; t++) {
            pthread_join(threads[t], NULL);
        }

        for (int t = 0; t < num_threads; t++) {
            for (int j = 0; j < k; j++) {

                count[j] += args[t].local_count[j];

                for (int d = 0; d < dim; d++) {
                    sum[j][d] += args[t].local_sum[j][d];
                }
            }
        }

        int converged = 1;

        for (int j = 0; j < k; j++) {
            if (count[j] == 0) continue;

            for (int d = 0; d < dim; d++) {
                float new_val = sum[j][d] / count[j];
                if (fabs(new_val - centroids[j][d]) > 1e-6) {
                    converged = 0;
                }

                centroids[j][d] = new_val;
            }
        }

        for (int j = 0; j < k; j++) {
            for (int d = 0; d < dim; d++) {
                hist[iter][j][d] = centroids[j][d];
            }
        }

        if (converged) {
            final_iter = iter + 1;
            break;
        }
    }

    for (int t = 0; t < num_threads; t++) {
        for (int j = 0; j < k; j++) {
            free(args[t].local_sum[j]);
        }
        free(args[t].local_sum);
        free(args[t].local_count);
    }

    for (int i = 0; i < k; i++) {
        free(centroids[i]);
        free(sum[i]);
    }

    *history = hist;
    *iterations_done = final_iter;
    *final_labels = labels;

    free(centroids);
    free(sum);
    free(count);
}
