#include <stdio.h>
#include <stdlib.h>
#include "io.h"
#include "kmeans.h"

int main(int argc, char *argv[]) {
    if (argc < 4) {
        printf("Usage: %s <file> <k> <max_iter>\n", argv[0]);
        return 1;
    }

    char *filename = argv[1];
    int k = atoi(argv[2]);
    int max_iter = atoi(argv[3]);

    float ***history;
    int iterations_done;
    int *labels;

    Dataset *data = read_csv(filename);
    if (!data) return 1;

    run_kmeans(data, k, max_iter, &history, &iterations_done, &labels);

    print_json_output(history, iterations_done, k, data->dim, labels, data->n_points);

    free_dataset(data);
    return 0;
}
