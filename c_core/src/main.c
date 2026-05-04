#include <stdio.h>
#include <stdlib.h>
#include "io.h"
#include "kmeans.h"

int main(int argc, char *argv[]) {
    if (argc < 5) {
        printf("Usage: %s <input_file> <output_file> <k> <max_iter> <threads>\n", argv[0]);
        return 1;
    }

    char *input_file = argv[1];
    char *output_file = argv[2];
    int k = atoi(argv[3]);
    int max_iter = atoi(argv[4]);
    int num_threads = atoi(argv[5]);

    float ***history;
    int iterations_done;
    int *labels;

    Dataset *data = read_csv(input_file);
    if (!data) return 1;

    run_kmeans(data, k, max_iter, &history, &iterations_done, &labels,num_threads);

    // print_json_output(history, iterations_done, k, data->dim, labels, data->n_points);
    FILE *fp = fopen(output_file,"w");
    if (!fp) {
        perror("Error opening output file");
        return 1;
    }

    write_json_output(fp, history, iterations_done, k, data->dim, labels, data->n_points);

    fclose(fp);
    
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
