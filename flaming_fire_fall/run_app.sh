#!/bin/bash
# NASA Microgravity Flammability Explorer Runner
cd "$(dirname "$0")"
export PATH="/Users/simanto/Library/Python/3.14/bin:$PATH"

if [ "$1" == "--demo" ]; then
    echo "Running Killer Demo via CLI..."
    python3 cli_explorer.py --demo
elif [ "$1" == "--metrics" ]; then
    echo "Displaying Model Validation Metrics..."
    python3 cli_explorer.py --metrics
else
    echo "Starting NASA Flammability Explorer Streamlit App..."
    python3 -m streamlit run app.py --server.port 8501 --server.headless true
fi

