#include <stdio.h>
#include <stdlib.h>
#include "io.h"
#include "kmeans.h"

int main(int argc, char *argv[]) {
    if (argc < 5) {
        printf("Usage: %s <file> <k> <max_iter> <threads>\n", argv[0]);
        return 1;
    }

    char *filename = argv[1];
    int k = atoi(argv[2]);
    int max_iter = atoi(argv[3]);
    int num_threads = atoi(argv[4]);

    float ***history;
    int iterations_done;
    int *labels;

    Dataset *data = read_csv(filename);
    if (!data) return 1;

    run_kmeans(data, k, max_iter, &history, &iterations_done, &labels,num_threads);

    print_json_output(history, iterations_done, k, data->dim, labels, data->n_points);
    
    for (int i = 0; i < iterations_done; i++) {
        for (int j = 0; j < k; j++) {
            free(history[i][j]);
        }
        free(history[i]);
        }
    free(history);

    free(labels);
    free_dataset(data);
    return 0;
}
