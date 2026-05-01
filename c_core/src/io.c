#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "io.h"

// Count number of columns in first row
int count_columns(char *line) {
    int count = 1;
    for (int i = 0; line[i]; i++) {
        if (line[i] == ',') count++;
    }
    return count;
}

Dataset* read_csv(const char *filename) {
    FILE *fp = fopen(filename, "r");
    if (!fp) {
        perror("Error opening file");
        return NULL;
    }

    char buffer[1024];
    int n_points = 0;
    int dim = 0;

    // -------- PASS 1: Count rows and columns --------
    while (fgets(buffer, sizeof(buffer), fp)) {
        if (n_points == 0) {
            dim = count_columns(buffer);
        }
        n_points++;
    }

    rewind(fp);

    // -------- Allocate Dataset --------
    Dataset *data = malloc(sizeof(Dataset));
    data->n_points = n_points;
    data->dim = dim;

    data->points = malloc(n_points * sizeof(float*));
    for (int i = 0; i < n_points; i++) {
        data->points[i] = malloc(dim * sizeof(float));
    }

    // -------- PASS 2: Parse values --------
    int i = 0;
    while (fgets(buffer, sizeof(buffer), fp)) {
        char *token = strtok(buffer, ",");

        int j = 0;
        while (token != NULL && j < dim) {
            data->points[i][j] = atof(token);
            token = strtok(NULL, ",");
            j++;
        }
        i++;
    }

    fclose(fp);
    return data;
}

void free_dataset(Dataset *data) {
    for (int i = 0; i < data->n_points; i++) {
        free(data->points[i]);
    }
    free(data->points);
    free(data);
}

void write_json_output(FILE* fp,float ***history, int iterations, int k, int dim, int *labels, int n_points){

    fprintf(fp,"{\n");
    fprintf(fp,"\"status\": \"success\",\n");
    fprintf(fp,"\"iterations\": %d,\n", iterations);

    // 🔹 History
    fprintf(fp,"\"history\": [\n");

    for (int iter = 0; iter < iterations; iter++) {
        fprintf(fp,"  { \"centroids\": [");

        for (int j = 0; j < k; j++) {
            fprintf(fp,"[");

            for (int d = 0; d < dim; d++) {
                fprintf(fp,"%.6f", history[iter][j][d]);
                if (d < dim - 1) fprintf(fp,",");
            }

            fprintf(fp,"]");
            if (j < k - 1) fprintf(fp,",");
        }

        fprintf(fp,"] }");

        if (iter < iterations - 1) fprintf(fp,",");
        fprintf(fp,"\n");
    }

    fprintf(fp,"],\n");

    // 🔹 Final clusters
    fprintf(fp,"\"final_clusters\": [");

    for (int i = 0; i < n_points; i++) {
        fprintf(fp,"%d", labels[i]);
        if (i < n_points - 1) fprintf(fp,",");
    }

    fprintf(fp,"]\n");

    fprintf(fp,"}\n");
}
