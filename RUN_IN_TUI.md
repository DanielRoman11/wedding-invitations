# Run the mobile fix in OpenCode TUI (free models work here)

## 1. Open the project in TUI
```bash
cd /mnt/HDD/code/weddingInvitations && opencode
```

## 2. In the TUI, launch the orchestrator agent
Type:
```
/agent mobile/orchestrator
```
Then prompt it:
```
Read the plan at .opencode/plan/mobile-multiagent-orchestration.md and execute wave 0 (pager).
```

The orchestrator will:
- Spawn `mobile/pager` subagent with `tasks/01-pager.md`
- Wait for completion, verify build
- Then you can ask it to run wave 1, etc.

## 3. Or run waves manually in TUI
```
/agent mobile/pager
```
Prompt: `Execute tasks/01-pager.md`

Then after it finishes:
```
/agent mobile/card
```
Prompt: `Execute tasks/02-card.md`

```
/agent mobile/bouquet
```
Prompt: `Execute tasks/03-bouquet.md`

(These two can run in parallel — open two TUI tabs or run sequentially)

Then:
```
/agent mobile/test
```
Prompt: `Execute tasks/04-test.md`

```
/agent mobile/review
```
Prompt: `Execute tasks/05-review.md`

## Why TUI?
The free models (`longcat-2.5-preview-free`, `space-bunny-free`) are **only available within the OpenCode TUI** — they don't work via `opencode run` CLI. The paid model (`deepseek-v4-flash`) hit your Go usage limit.

## All files are ready
- Agents: `.opencode/agents/mobile/*.md` (6 agents, free models)
- Tasks: `tasks/01-pager.md` … `05-review.md`
- Plan: `.opencode/plan/mobile-multiagent-orchestration.md`
- Script: `scripts/mobile-orchestrate.sh` (for future CLI runs with paid model)