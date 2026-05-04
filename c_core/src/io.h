#ifndef IO_H
#define IO_H

#include <stdio.h>

typedef struct {
    int n_points;
    int dim;
    float **points;
} Dataset;

Dataset* read_csv(const char *filename);
void free_dataset(Dataset *data);
void write_json_output(FILE *fp, float ***history, int iterations, int k, int dim, int *labels, int n_points);

#endif
