#!/bin/zsh

# File containing PIDs
PID_FILE="pids.txt"

if [[ -s "$PID_FILE" ]]; then
    while read -r pid; do
        kill -9 $pid 2>/dev/null
        # Remove echo statements to disable all output
    done < "$PID_FILE"

    rm "$PID_FILE" 2>/dev/null
    # Uncomment the next line if you need a final confirmation (for debugging)
    echo "All processes have been attempted to be killed and PID file removed." > /dev/null
else
    # Uncomment the next line if you need a message for an empty or missing PID file (for debugging)
    echo "PID file does not exist or is empty. No action taken." > /dev/null
fi
