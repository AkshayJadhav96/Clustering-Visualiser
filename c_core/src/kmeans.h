#ifndef KMEANS_H
#define KMEANS_H

#include "io.h"

void run_kmeans(Dataset *data, int k, int max_iter,
float ****history, int *iterations_done,
int **final_labels,int num_threads);

/**
 * Run Lloyd k-means (same init + threading as run_kmeans) without history.
 * Returns total within-cluster sum of squared distances (WCSS / inertia), or -1.0 on failure.
 */
double kmeans_compute_wcss(Dataset *data, int k, int max_iter, int num_threads);

typedef struct {
    Dataset *data;
    float **centroids;

    int start;
    int end;

    int k;
    int dim;

    int *labels;

    float **local_sum;
    int *local_count;

} ThreadArgs;

#endif
