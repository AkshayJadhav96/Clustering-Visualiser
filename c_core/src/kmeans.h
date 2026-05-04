#ifndef KMEANS_H
#define KMEANS_H

#include "kmeans_init.h"
#include "kmeans_math.h"
#include "io.h"


void *assign_points(void *arg);
void run_kmeans(Dataset *data, int k, int max_iter,
float ****history, int *iterations_done,
int **final_labels,int num_threads);

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
