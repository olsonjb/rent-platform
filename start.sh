#!/bin/bash
# ============================================
# Auto PM Ralph Army — Quick Start
# ============================================
# Usage: Copy this entire directory into your rent-platform repo root,
# then run the orchestrator with Claude Code.
#
# Setup:
#   1. cd rent-platform
#   2. cp -r /path/to/ralph-army/* .
#   3. claude --dangerously-skip-permissions
#   4. Then tell Claude: "Read CLAUDE.md and begin executing the roadmap."
#
# Or run individual ralphs manually:
#   claude --dangerously-skip-permissions
#   /ralph-loop:ralph-loop "$(cat prompts/t01-cicd.md)" --max-iterations 40 --completion-promise "TASK_COMPLETE"
#
# ============================================

# Manual single-task execution examples:

# Wave 1 (run in parallel — open 3 terminal tabs)
# Tab 1:
#   cd rent-platform && git checkout -b ralph/t01-cicd
#   claude --dangerously-skip-permissions
#   /ralph-loop:ralph-loop "$(cat prompts/t01-cicd.md)" --max-iterations 40 --completion-promise "TASK_COMPLETE"

# Tab 2:
#   cd rent-platform && git checkout -b ralph/t02-test-infra
#   claude --dangerously-skip-permissions
#   /ralph-loop:ralph-loop "$(cat prompts/t02-test-infra.md)" --max-iterations 50 --completion-promise "TASK_COMPLETE"

# Tab 3:
#   cd rent-platform && git checkout -b ralph/t03-observability
#   claude --dangerously-skip-permissions
#   /ralph-loop:ralph-loop "$(cat prompts/t03-observability.md)" --max-iterations 40 --completion-promise "TASK_COMPLETE"

# After each ralph completes, review with:
#   claude -p "You are a [DevOps Engineer|QA Architect|SRE]. $(cat reviewers/review-template.md)
#   
#   Task requirements:
#   $(cat prompts/tXX-name.md)
#   
#   Review the changes on this branch vs main."

echo "Ralph Army prompt files are ready in ./prompts/"
echo "Review template is at ./reviewers/review-template.md"
echo "Orchestrator instructions are in ./CLAUDE.md"
echo ""
echo "To start the orchestrator:"
echo "  cd rent-platform"
echo "  claude --dangerously-skip-permissions"
echo "  Then say: 'Read CLAUDE.md and begin executing the roadmap starting with Wave 1.'"
echo ""
echo "To run a single ralph manually:"
echo "  git checkout -b ralph/t01-cicd"
echo '  /ralph-loop:ralph-loop "$(cat prompts/t01-cicd.md)" --max-iterations 40 --completion-promise "TASK_COMPLETE"'
