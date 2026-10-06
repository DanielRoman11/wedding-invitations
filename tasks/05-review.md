# Task: Read-only diff review of waves 0–3

**Agent:** `mobile/review` (subagent, LongCat 2.5 Preview Free)
**Files:** None (read-only). Permissions: edit DENY, shell DENY.
**Wave:** 3 (serial)

## Exact steps

### 1. Get the full diff
```bash
git diff HEAD~4..HEAD --stat
git diff HEAD~4..HEAD
```
(Adjust commit count if different — look for commits: `feat(mobile): snap pager...`, `feat(mobile): route swipes...`, `feat(mobile): bouquet sheet...`, `test(mobile): ...`)

### 2. Review against acceptance checklist

| # | Checklist item | Verify in diff |
|---|---|---|
| 1 | Card front → back: single clean snap | `Experience.js` has `_flying` lock, single GSAP tween; `ScrollSnap.js` uses committed page |
| 2 | Last sheet tiny flick → rings (not form) | Same pager fix; ±1 page rule enforced |
| 3 | Bouquet sheet 86svh + toolbar | `bouquet.css` height 86svh; `.bq-steps` toolbar; `bouquetUi.js` wires buttons |
| 4 | `Arco de deseos →` reaches arch | `goToSection(3)` called from toolbar |
| 5 | Card-back links still tappable | `card.css` `#card-back .card-back__btn { pointer-events: auto }` |
| 6 | Desktop + reduced-motion unchanged | No changes to desktop CSS; `@media (prefers-reduced-motion)` blocks untouched |
| 7 | Build green | Check no syntax errors in diff |

### 3. Additional review criteria
- **No-cross-file rule**: pager files ≠ card files ≠ bouquet files. Flag any worker that touched outside its scope.
- **Product constraints**: 
  - Theme tokens in `src/style.css :root` unchanged
  - `--ease-out: cubic-bezier(0.23,1,0.32,1)` used for new transitions
  - No global menu/dock introduced (toolbar is contextual, inside bouquet sheet)
  - `prefers-reduced-motion` respected in new CSS
- **Code quality**: no `console.log`, no commented-out code, consistent style with surrounding code.
- **Accessibility**: new buttons have `aria-label`, ≥44px hit area, focus-visible outlines.

### 4. Output format (report to orchestrator)

```
## Review findings (wave 0–3)

### HIGH (blocks merge)
- file:line — description

### MEDIUM (should fix)
- file:line — description

### LOW (nitpick)
- file:line — description

### PASS
- Checklist items 1–7 all satisfied
```

If HIGH findings exist → merge blocked, return to orchestrator with specific file:line fixes needed.
If only MEDIUM/LOW → merge can proceed with notes.

### 5. Do NOT
- Edit any file
- Run any shell command
- Modify the plan or agent definitions