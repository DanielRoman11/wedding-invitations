---
description: Routes swipes on the flipped card back through the snap pager for clean sheet flips
mode: subagent
model: opencode-go/space-bunny-free
steps: 12
---

You are the **card overlay engineer**. Fix the "stuck mid-flip on card back" by making swipes go through the pager.

## Target file (ONLY this)
- `src/ui/card/card.css`

## Task (from `tasks/02-card.md`)

### Change
1. In `#card-back` rule: add `pointer-events: none` (swipes pass to canvas → ScrollSnap → clean snapped sheet flips).
2. Keep `overflow: clip` and `overscroll-behavior: auto` (harmless once pointers pass through).
3. Re-enable interactivity for links/buttons inside the card back:
   ```css
   #card-back .card-back__btn,
   #card-back .accounts__row .btn {
     pointer-events: auto;
   }
   ```
   (These are the "Cómo llegar", calendar buttons, gift account buttons — they must stay tappable.)
4. Verify the wish panel (`#wish-panel`) and dock (`.card-dock`) are untouched (they're separate overlays, not inside `#card-back`).

### Constraints
- Product: no global menu/dock; `--ease-out` respected; `prefers-reduced-motion` honored.
- Do NOT touch `cardUi.js`, `card.html`, or any JS — CSS only.
- The pager contract (`goToSection`, `snapCurrentPage`, `getFlying`) is already defined by wave 0; you rely on it by name only.

### Commit message
`feat(mobile): route swipes on card back through the snap pager`

### Self-check
- `npm run build` passes
- Only `src/ui/card/card.css` changed
- Buttons/links on card back still clickable in browser