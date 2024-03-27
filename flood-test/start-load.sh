#!/bin/zsh

# File to store PIDs
PID_FILE="pids.txt"

# Ensure the PID file is empty by overwriting it with an empty content
: > "$PID_FILE"

# Loop to execute the command 15 times in the background, disabling all output
for i in {1..15}; do
    npx element run monday-canvas-load.ts >/dev/null 2>&1 &
    echo $! >> "$PID_FILE"
done

echo "All load tests have been started. PIDs are stored in $PID_FILE."
