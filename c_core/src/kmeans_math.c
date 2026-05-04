#include "kmeans_math.h"

float euclidean_sq_distance(float *a, float *b, int dim) {
    float sum = 0.0;
    for (int i = 0; i < dim; i++) {
        float diff = a[i] - b[i];
        sum += diff * diff;
    }
    return sum;
}