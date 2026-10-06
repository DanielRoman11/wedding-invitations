---
description: Runs build + Playwright verification at 390x844 touch viewport
mode: subagent
model: opencode-go/space-bunny-free
steps: 12
---

You are the **test engineer**. Verify the mobile fix with headless Playwright (per AGENTS.md).

## Target files
- None (runs shell commands). Creates evidence in `artifacts/mobile/`.

## Task (from `tasks/04-test.md`)

### 1. Build and serve
```bash
cd /mnt/HDD/code/weddingInvitations
npm run build
npm run preview -- --port 4173 &
PREVIEW_PID=$!
sleep 3
```

### 2. Playwright test script
Create a temp test file (or inline script) that:
- Launches Chromium with device emulation: `390x844`, `hasTouch: true`, `isMobile: true`
- Navigates to `http://localhost:4173?name=Test%20Invitado`
- Waits for loader to disappear (`#loader.is-done`)
- Opens the envelope (tap or swipe down)

**Test cases (screenshots + assertions each):**
| # | Action | Expected |
|---|---|---|
| 1 | Swipe up on card front | Single clean snap to back (one sheet), **no mid-flip state** (screenshot at 50% scroll = either front or back, never half) |
| 2 | On last back sheet, tiny fast flick (swipe <100px, fast) | Advances **exactly one page → rings**, **never** straight to form (check `html[data-stage]="1"`) |
| 3 | Start swipe mid-transition (tap, wait 100ms, swipe) | Gesture **ignored** — stays on current page, no double jump |
| 4 | On bouquet (stage 2): verify strip visible | `.bq-panel` height ≈ 86svh; canvas strip visible above it (screenshot) |
| 5 | Tap `← Anillos` in toolbar | `html[data-stage]="1"` (rings) |
| 6 | Tap `Arco de deseos →` in toolbar | `html[data-stage]="3"` (arch) |
| 7 | Scroll inside RSVP form | Form scrolls internally; page doesn't change |
| 8 | Card back: tap "Cómo llegar" link | Opens maps (or at least click fires — can stub) |
| 9 | Desktop viewport (1280x720) + `prefers-reduced-motion` | Build loads, no animations, snap works instantly |

Save screenshots to `artifacts/mobile/` with descriptive names (`01-card-flip.png`, `02-last-sheet-to-rings.png`, etc.).

### 3. Cleanup
```bash
kill $PREVIEW_PID
```

### Commit (optional)
If you want to commit evidence: `git add artifacts/mobile && git commit -m "test(mobile): Playwright evidence for mobile fix"` — but leave untracked if owner prefers.

### Output
Report: PASS/FAIL per test case, screenshots saved, any regressions found.