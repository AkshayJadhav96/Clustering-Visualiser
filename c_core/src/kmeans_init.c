#include "kmeans_init.h"
#include "kmeans_math.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <pthread.h>
#include <float.h>
#include <time.h>

typedef struct {
    Dataset *data;
    float **centroids;
    int num_existing;
    int dim;
    int start;
    int end;
    float *min_dist_sq;
} KMeansPPDistArgs;

void *kmeans_pp_min_dist_chunk(void *arg) {
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

void rng_seed_once(void) {
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
int weighted_random_index(const float *weights, int n) {
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

void parallel_min_sq_distances(Dataset *data, float **centroids, int num_existing, int dim,
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
float **init_centroids_kmeans_pp(Dataset *data, int k, int num_threads) {
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
float **init_centroids_first_k(Dataset *data, int k) {
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

float **kmeans_init_centroids(Dataset *data, int k, int num_threads) {
    float **c = init_centroids_kmeans_pp(data, k, num_threads);
    if (!c) {
        c = init_centroids_first_k(data, k);
    }
    return c;
}
