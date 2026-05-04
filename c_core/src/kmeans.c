#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <pthread.h>
#include <float.h>
#include <time.h>
#include "kmeans.h"
#include "kmeans_init.h"
#include "kmeans_math.h"


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

    float **centroids = kmeans_init_centroids(data, k, num_threads);
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

double kmeans_compute_wcss(Dataset *data, int k, int max_iter, int num_threads) {
    if (!data || data->n_points < 1 || data->dim < 1 || max_iter < 1) {
        return -1.0;
    }

    int n = data->n_points;
    int dim = data->dim;
    if (k > n) k = n;
    if (k < 1) return -1.0;

    if (num_threads < 1) num_threads = 1;

    pthread_t *threads = malloc((size_t)num_threads * sizeof(pthread_t));
    ThreadArgs *args = malloc((size_t)num_threads * sizeof(ThreadArgs));
    if (!threads || !args) {
        free(threads);
        free(args);
        return -1.0;
    }

    float **centroids = kmeans_init_centroids(data, k, num_threads);
    if (!centroids) {
        free(threads);
        free(args);
        return -1.0;
    }

    int *labels = malloc((size_t)n * sizeof(int));
    float **sum = malloc((size_t)k * sizeof(float *));
    int *count = malloc((size_t)k * sizeof(int));
    if (!labels || !sum || !count) {
        for (int i = 0; i < k; i++) free(centroids[i]);
        free(centroids);
        free(labels);
        free(sum);
        free(count);
        free(threads);
        free(args);
        return -1.0;
    }

    for (int i = 0; i < k; i++) {
        sum[i] = calloc((size_t)dim, sizeof(float));
        if (!sum[i]) {
            for (int j = 0; j < i; j++) free(sum[j]);
            for (int j = 0; j < k; j++) free(centroids[j]);
            free(centroids);
            free(labels);
            free(sum);
            free(count);
            free(threads);
            free(args);
            return -1.0;
        }
    }

    for (int t = 0; t < num_threads; t++) {
        args[t].local_sum = malloc((size_t)k * sizeof(float *));
        args[t].local_count = calloc((size_t)k, sizeof(int));
        if (!args[t].local_sum || !args[t].local_count) {
            for (int tt = 0; tt <= t; tt++) {
                if (args[tt].local_sum) {
                    for (int j = 0; j < k; j++) free(args[tt].local_sum[j]);
                    free(args[tt].local_sum);
                }
                free(args[tt].local_count);
            }
            for (int i = 0; i < k; i++) {
                free(centroids[i]);
                free(sum[i]);
            }
            free(centroids);
            free(labels);
            free(sum);
            free(count);
            free(threads);
            free(args);
            return -1.0;
        }
        for (int j = 0; j < k; j++) {
            args[t].local_sum[j] = calloc((size_t)dim, sizeof(float));
            if (!args[t].local_sum[j]) {
                for (int tt = 0; tt <= t; tt++) {
                    for (int jj = 0; jj < k; jj++) free(args[tt].local_sum[jj]);
                    free(args[tt].local_sum);
                    free(args[tt].local_count);
                }
                for (int i = 0; i < k; i++) {
                    free(centroids[i]);
                    free(sum[i]);
                }
                free(centroids);
                free(labels);
                free(sum);
                free(count);
                free(threads);
                free(args);
                return -1.0;
            }
        }
    }

    int chunk = n / num_threads;
    if (chunk == 0) chunk = 1;

    for (int iter = 0; iter < max_iter; iter++) {
        for (int i = 0; i < k; i++) {
            count[i] = 0;
            for (int j = 0; j < dim; j++) {
                sum[i][j] = 0.0f;
            }
        }

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
                    args[t].local_sum[j][d] = 0.0f;
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
                float new_val = sum[j][d] / (float)count[j];
                if (fabsf(new_val - centroids[j][d]) > 1e-6f) {
                    converged = 0;
                }
                centroids[j][d] = new_val;
            }
        }

        if (converged) {
            break;
        }
    }

    double wcss = 0.0;
    for (int i = 0; i < n; i++) {
        float min_d = FLT_MAX;
        for (int j = 0; j < k; j++) {
            float d = euclidean_sq_distance(data->points[i], centroids[j], dim);
            if (d < min_d) min_d = d;
        }
        wcss += (double)min_d;
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
    free(centroids);
    free(labels);
    free(sum);
    free(count);
    free(threads);
    free(args);

    return wcss;
}
