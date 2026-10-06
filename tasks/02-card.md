# Task: Route swipes on card back through the snap pager

**Agent:** `mobile/card` (subagent, Space Bunny Free)
**Files:** `src/ui/card/card.css` (ONLY)
**Wave:** 1 (parallel with bouquet)

## Exact changes

### card.css — make card back swipes go through pager
1. In `#card-back` rule (around line 274): add `pointer-events: none`
   ```css
   #card-back {
     overflow: clip;
     overscroll-behavior: auto;
     pointer-events: none;   /* ADD THIS */
   }
   ```

2. Re-enable interactivity for buttons/links inside card back (add new rule after `#card-back`):
   ```css
   #card-back .card-back__btn,
   #card-back .accounts__row .btn {
     pointer-events: auto;
   }
   ```
   These are the "Cómo llegar", Google Calendar, Apple/Outlook calendar, and gift account buttons — they must stay tappable.

3. Verify the wish panel (`#wish-panel`) and dock (`.card-dock`) are untouched (they're separate overlays, not inside `#card-back`).

## Constraints
- Product: no global menu/dock; `--ease-out` respected; `prefers-reduced-motion` honored.
- Do NOT touch `cardUi.js`, `card.html`, or any JS — CSS only.
- The pager contract (`goToSection`, `snapCurrentPage`, `getFlying`) is already defined by wave 0; you rely on it by name only.
- Free model: `opencode-go/space-bunny-free` (unlimited).
- No-cross-file rule: only `src/ui/card/card.css`.

## Commit message
`feat(mobile): route swipes on card back through the snap pager`

## Self-check
- `npm run build` passes
- Only `src/ui/card/card.css` changed
- Buttons/links on card back still clickable in browser