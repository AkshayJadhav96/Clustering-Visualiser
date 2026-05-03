#include <stdio.h>
#include <stdlib.h>
#include "io.h"
#include "kmeans.h"

/**
 * Usage: elbow <input_csv> <output_json> <k_max> <max_iter> <threads>
 * Writes JSON: { "status": "success", "curve": [ {"k":1,"wcss":...}, ... ] }
 */
int main(int argc, char *argv[]) {
    if (argc < 6) {
        fprintf(stderr,
                "Usage: %s <input_file> <output_file> <k_max> <max_iter> <threads>\n",
                argv[0]);
        return 1;
    }

    const char *input_file = argv[1];
    const char *output_file = argv[2];
    int k_max = atoi(argv[3]);
    int max_iter = atoi(argv[4]);
    int num_threads = atoi(argv[5]);

    if (k_max < 1 || max_iter < 1 || num_threads < 1) {
        fprintf(stderr, "k_max, max_iter, and threads must be positive\n");
        return 1;
    }

    Dataset *data = read_csv(input_file);
    if (!data) {
        fprintf(stderr, "Failed to read dataset\n");
        return 1;
    }

    int n = data->n_points;
    if (k_max > n) {
        k_max = n;
    }

    FILE *fp = fopen(output_file, "w");
    if (!fp) {
        perror("elbow: output file");
        free_dataset(data);
        return 1;
    }

    fprintf(fp, "{\n  \"status\": \"success\",\n  \"curve\": [\n");

    for (int k = 1; k <= k_max; k++) {
        double wcss = kmeans_compute_wcss(data, k, max_iter, num_threads);
        if (wcss < 0.0) {
            fclose(fp);
            free_dataset(data);
            fprintf(stderr, "kmeans_compute_wcss failed for k=%d\n", k);
            return 1;
        }
        fprintf(fp, "    {\"k\": %d, \"wcss\": %.12g}%s\n", k, wcss, (k < k_max) ? "," : "");
    }

    fprintf(fp, "  ]\n}\n");
    fclose(fp);
    free_dataset(data);
    return 0;
}
