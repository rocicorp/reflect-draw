# Load Testing Replidraw

This is a simple load test based on k6 (k6.io).

To run:

1. [Install k6](https://k6.io/docs/getting-started/installation/)
2. `k6 run --vus=20 --duration=60s --e ROOM_ID=r1`

The `--vus` flag controls the number of users that will be simulated. For each user, the script will create a number of shapes (default: 1 shape per user). and move them continuously. You can control the number of shapes per-user with the `SHAPES_PER_CLIENT` env var.
