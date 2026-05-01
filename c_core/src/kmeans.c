#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include "kmeans.h"

float euclidean_distance(float *a, float *b, int dim) {
    float sum = 0.0;
    for (int i = 0; i < dim; i++) {
        float diff = a[i] - b[i];
        sum += diff * diff;
    }
    return sqrt(sum);
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



void run_kmeans(Dataset *data, int k, int max_iter,
float ****history, int *iterations_done,
int **final_labels){

    int n = data->n_points;
    int dim = data->dim;

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

    for (int iter = 0; iter < max_iter; iter++) {

        // Reset sums and counts
        for (int i = 0; i < k; i++) {
            count[i] = 0;
            for (int j = 0; j < dim; j++) {
                sum[i][j] = 0.0;
            }
        }

        // 🔹 Step 1: Assign points
        for (int i = 0; i < n; i++) {
            float min_dist = 1e9;
            int best_cluster = 0;

            for (int j = 0; j < k; j++) {
                float dist = euclidean_distance(data->points[i], centroids[j], dim);

                if (dist < min_dist) {
                    min_dist = dist;
                    best_cluster = j;
                }
            }

            labels[i] = best_cluster;

            // Add to sum
            count[best_cluster]++;
            for (int d = 0; d < dim; d++) {
                sum[best_cluster][d] += data->points[i][d];
            }
        }

        // 🔹 Step 2: Update centroids
        for (int j = 0; j < k; j++) {
            if (count[j] == 0) continue;

            for (int d = 0; d < dim; d++) {
                centroids[j][d] = sum[j][d] / count[j];
            }
        }

        // 🔹 Step 3: Store centroids in history
        for (int j = 0; j < k; j++) {
            for (int d = 0; d < dim; d++) {
                hist[iter][j][d] = centroids[j][d];
            }
        }
    }

    // 🔹 Print result (temporary)
    // printf("Final Centroids:\n");
    // for (int j = 0; j < k; j++) {
    //     for (int d = 0; d < dim; d++) {
    //         printf("%.2f ", centroids[j][d]);
    //     }
    //     printf("\n");
    // }

    // Free memory
    for (int i = 0; i < k; i++) {
        free(centroids[i]);
        free(sum[i]);
    }

    *history = hist;
    *iterations_done = max_iter;
    *final_labels = labels;

    free(centroids);
    free(sum);
    free(count);
}
