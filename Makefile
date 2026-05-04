CC = gcc
CFLAGS = -Wall -O2 -I c_core/include
LDFLAGS = -lm -lpthread
SRC = $(filter-out c_core/src/main.c c_core/src/elbow.c, $(wildcard c_core/src/*.c))
OBJ = $(SRC:.c=.o)

build: c_core/bin/kmeans c_core/bin/elbow

c_core/bin/kmeans: c_core/src/main.o $(OBJ)
	$(CC) $^ -o $@ $(LDFLAGS)

c_core/bin/elbow: c_core/src/elbow.o $(OBJ)
	$(CC) $^ -o $@ $(LDFLAGS)

c_core/src/%.o: c_core/src/%.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f c_core/src/*.o c_core/bin/*

install:
	cd backend && uv sync
	cd clustering-frontend && npm install

dev-backend:
	cd backend && uv run app.py

dev-frontend:
	cd clustering-frontend && npm run dev
