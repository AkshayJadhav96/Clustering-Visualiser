#ifndef KMEANS_INIT_H
#define KMEANS_INIT_H

#include "io.h"

float **init_centroids_kmeans_pp(Dataset *data, int k, int num_threads);
float **init_centroids_first_k(Dataset *data, int k);

/** K-means++ with fallback to first-k points; returns NULL on total failure. */
float **kmeans_init_centroids(Dataset *data, int k, int num_threads);

#endif
