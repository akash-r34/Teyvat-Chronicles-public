#!/usr/bin/env bash
set -euo pipefail

echo "=== System Recovery Script ==="

echo "1. Deleting potentially corrupted SQLite database files..."
rm -f data/teyvat.db
rm -f data/teyvat.db-wal
rm -f data/teyvat.db-shm
rm -f data/teyvat.db-journal
echo "   Database files removed."

echo "2. Refetching audio assets..."
# Use the existing package.json script or run the script directly
bash scripts/fetch_audio.sh
echo "   Audio fetched successfully."

echo "=== Recovery Complete ==="
echo "You can now restart the dev server to start fresh."
