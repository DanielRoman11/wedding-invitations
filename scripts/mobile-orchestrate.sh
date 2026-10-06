#!/usr/bin/env bash
# scripts/mobile-orchestrate.sh
# Scripted orchestration for the mobile fix waves.
# Usage: ./scripts/mobile-orchestrate.sh [wave]
#   wave 0 = pager only
#   wave 1 = card + bouquet (parallel)
#   wave 2 = test
#   wave 3 = review
#   (default: all waves sequentially)

set -euo pipefail

ROOT="/mnt/HDD/code/weddingInvitations"
cd "$ROOT"

AGENTS_DIR=".opencode/agents/mobile"
TASKS_DIR="tasks"

run_agent() {
  local agent_id=$1
  local task_file=$2
  local session_id="ses_${agent_id//\//_}"
  echo ">>> Launching $agent_id with $task_file (session: $session_id)"
  opencode run \
    --agent "$agent_id" \
    --session "$session_id" \
    --format json \
    "$(cat "$task_file")"
}

case "${1:-all}" in
  0|pager)
    run_agent mobile/pager "$TASKS_DIR/01-pager.md"
    ;;
  1|card)
    run_agent mobile/card "$TASKS_DIR/02-card.md"
    ;;
  1|bouquet)
    run_agent mobile/bouquet "$TASKS_DIR/03-bouquet.md"
    ;;
  1|card-bouquet|1-parallel)
    # Launch both in background
    run_agent mobile/card "$TASKS_DIR/02-card.md" &
    PID_CARD=$!
    run_agent mobile/bouquet "$TASKS_DIR/03-bouquet.md" &
    PID_BOUQUET=$!
    wait $PID_CARD
    wait $PID_BOUQUET
    ;;
  2|test)
    run_agent mobile/test "$TASKS_DIR/04-test.md"
    ;;
  3|review)
    run_agent mobile/review "$TASKS_DIR/05-review.md"
    ;;
  all)
    echo "=== Wave 0: Pager ==="
    run_agent mobile/pager "$TASKS_DIR/01-pager.md"
    echo "=== Wave 1: Card + Bouquet (parallel) ==="
    run_agent mobile/card "$TASKS_DIR/02-card.md" &
    PID_CARD=$!
    run_agent mobile/bouquet "$TASKS_DIR/03-bouquet.md" &
    PID_BOUQUET=$!
    wait $PID_CARD
    wait $PID_BOUQUET
    echo "=== Wave 2: Test ==="
    run_agent mobile/test "$TASKS_DIR/04-test.md"
    echo "=== Wave 3: Review ==="
    run_agent mobile/review "$TASKS_DIR/05-review.md"
    echo "=== All waves complete ==="
    ;;
  *)
    echo "Usage: $0 [0|pager|1|card|bouquet|card-bouquet|2|test|3|review|all]"
    exit 1
    ;;
esac