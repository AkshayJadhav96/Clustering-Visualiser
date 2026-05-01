#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include<pthread.h>
#include<float.h>
#include "kmeans.h"

float euclidean_sq_distance(float *a, float *b, int dim) {
    float sum = 0.0;
    for (int i = 0; i < dim; i++) {
        float diff = a[i] - b[i];
        sum += diff * diff;
    }
    return sum;
}

float** init_centroids(Dataset *data, int k) {
    float **centroids = malloc(k * sizeof(float*));

    for (int i = 0; i < k; i++) {
        centroids[i] = malloc(data->dim * sizeof(float));

        for (int j = 0; j < data->dim; j++) {
            centroids[i][j] = data->points[i][j]; // first k points
        }
    }

    return centroids;
}

void* assign_points(void *arg) {
    ThreadArgs *args = (ThreadArgs*)arg;

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

void run_kmeans(Dataset *data, int k, int max_iter,
float ****history, int *iterations_done,
int **final_labels,int num_threads){

    pthread_t threads[num_threads];
    ThreadArgs args[num_threads];

    int final_iter = max_iter;
    int n = data->n_points;
    int dim = data->dim;
    if(k>n) k = n;

    float **centroids = init_centroids(data, k);

    int *labels = malloc(n * sizeof(int));

    // Temporary arrays for update
    float **sum = malloc(k * sizeof(float*));
    int *count = malloc(k * sizeof(int));

    float ***hist = malloc(max_iter * sizeof(float**));

    for (int i = 0; i < max_iter; i++) {
        hist[i] = malloc(k * sizeof(float*));
        for (int j = 0; j < k; j++) {
            hist[i][j] = malloc(dim * sizeof(float));
        }
    }

    for (int i = 0; i < k; i++) {
        sum[i] = calloc(dim, sizeof(float));
    }

    for (int t = 0; t < num_threads; t++) {
        args[t].local_sum = malloc(k * sizeof(float*));
        args[t].local_count = calloc(k, sizeof(int));

        for (int j = 0; j < k; j++) {
            args[t].local_sum[j] = calloc(dim, sizeof(float));
        }
    }

    for (int iter = 0; iter < max_iter; iter++) {

        // Reset sums and counts
        for (int i = 0; i < k; i++) {
            count[i] = 0;
            for (int j = 0; j < dim; j++) {
                sum[i][j] = 0.0;
            }
        }

        int chunk = n / num_threads;

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

        // merge all threads
        for (int t = 0; t < num_threads; t++) {
            for (int j = 0; j < k; j++) {

                count[j] += args[t].local_count[j];

                for (int d = 0; d < dim; d++) {
                    sum[j][d] += args[t].local_sum[j][d];
                }
            }
        }

        int converged = 1;

        // 🔹 Step 2: Update centroids
        for (int j = 0; j < k; j++) {
            if (count[j] == 0) continue;

            for (int d = 0; d < dim; d++) {
                float new_val = sum[j][d] / count[j];
                if (fabs(new_val - centroids[j][d]) > 1e-4) {
                    converged = 0;
                }

                centroids[j][d] = new_val;
            }
        }
        
        // 🔹 Step 3: Store centroids in history
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

    // Free memory
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
