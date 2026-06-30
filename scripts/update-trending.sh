#!/usr/bin/env bash
set -euo pipefail

# Fetch the current GitHub trending page and merge it into today's snapshot
# (public/data/<date>.json). This collects banners and refreshes star/fork
# counts locally without touching git.
#
#   ./update-trending.sh             # fetch + merge only (run twice daily)
#   ./update-trending.sh --publish   # fetch + merge, then commit & push once daily
#
# Splitting fetch from publish lets us scrape multiple times a day to gather
# all repo banner URLs while only updating the remote repo (and triggering a
# GitHub Pages deploy) once per day.

PUBLISH=0
for a in "$@"; do
	case "$a" in
		--publish) PUBLISH=1 ;;
		-h|--help)
			echo "usage: $0 [--publish]"
			exit 0
			;;
		*) echo "unknown arg: $a" >&2; exit 2 ;;
	esac
done

# Define log file
LOGFILE="/home/linux-falko/Dev/ghnews/update-trending.log"

# Set up logging redirection
if [[ -t 1 ]]; then
    # Running interactively: output to terminal AND file
    exec > >(tee -a "$LOGFILE") 2>&1
else
    # Running non-interactively (e.g., a timer): output directly to logfile
    exec >> "$LOGFILE" 2>&1
fi

echo ""
echo "=== Started at $(date '+%Y-%m-%d %H:%M:%S') (publish=$PUBLISH) ==="

# Don't let a fetch and a publish run overlap each other (they share the
# same data file + git index).
LOCKFILE="/home/linux-falko/Dev/ghnews/.update.lock"
exec 9>"$LOCKFILE"
if ! flock -n 9; then
    echo "▶ Another update is already running; skipping."
    exit 0
fi

# Load NVM and node environment dynamically
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
    nvm use --silent default >/dev/null 2>&1 || nvm use --silent node >/dev/null 2>&1 || true
fi

# Ensure pnpm is in PATH
export PATH="$HOME/.local/share/pnpm:$PATH"

cleanup_handler() {
    local exit_code=$?
    echo ""
    if [ "$exit_code" -eq 0 ]; then
        echo "✅ Done! (Success)"
    else
        echo "❌ Script exited with status $exit_code"
        if command -v notify-send >/dev/null 2>&1; then
            notify-send -u critical "ghnews Trending Update Failed" "The trending scrape exited with code $exit_code. Check update-trending.log for details." >/dev/null 2>&1 || true
        fi
    fi
    echo "=== Finished at $(date '+%Y-%m-%d %H:%M:%S') ==="
    echo ""
}
trap cleanup_handler EXIT

echo "▶ Scraping github.com/trending (merges into today's snapshot)..."
cd /home/linux-falko/Dev/ghnews
pnpm fetch-trending

if [[ "$PUBLISH" -ne 1 ]]; then
    echo "▶ Fetch-only run; skipping commit/push."
    exit 0
fi

echo ""
echo "▶ Checking for changes to commit..."
git add public/data/$(date '+%Y-%m-%d').json public/data/index.json

if ! git diff --staged --quiet; then
    echo "▶ Committing updated data file..."
    git commit -m "data: refresh trending $(date '+%Y-%m-%d')"

    echo ""
    echo "▶ Pushing to remote..."
    git push
else
    echo "▶ No changes to commit. Everything is up to date."
fi
