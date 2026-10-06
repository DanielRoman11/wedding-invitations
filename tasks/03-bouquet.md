# Task: Bouquet sheet at 86svh + step toolbar

**Agent:** `mobile/bouquet` (subagent, LongCat 2.5 Preview Free)
**Files:** `src/ui/bouquet/bouquet.html`, `src/ui/bouquet/bouquet.css`, `src/ui/bouquet/bouquetUi.js`
**Wave:** 1 (parallel with card)

## Exact changes

### bouquet.html — add sticky step toolbar (mobile only)
Inside `.bq-panel__scroll`, **before** `<header class="bq-head">`, insert:
```html
<div class="bq-steps" aria-label="Continuar el recorrido" hidden>
  <button type="button" id="bq-prev" class="bq-step">← Anillos</button>
  <button type="button" id="bq-next" class="bq-step bq-step--next">Arco de deseos →</button>
</div>
```

### bouquet.css — portrait sheet height + toolbar styling
In the existing portrait block `@media (max-aspect-ratio: 85/100)`:

1. Reduce sheet height:
   ```css
   .bq-panel { height: 86svh; }   /* was 92svh */
   ```

2. Show the toolbar on mobile portrait:
   ```css
   .bq-steps {
     display: flex;
     justify-content: space-between;
     gap: 0.5rem;
     padding: 0.5rem var(--bq-pad);
     position: sticky;
     top: 0;
     z-index: 10;
     background: var(--paper);
     border-bottom: 1px solid var(--gold-line-soft);
     pointer-events: auto;
   }
   .bq-steps[hidden] { display: none; }
   ```

3. Toolbar buttons styled like rings HUD chips:
   ```css
   .bq-step {
     flex: 1;
     min-height: 44px;
     padding: 0.5rem 0.75rem;
     font: 600 0.85rem var(--font-body);
     color: var(--ink);
     background: var(--surface-solid);
     border: 1px solid var(--gold-line-strong);
     border-radius: 999px;
     box-shadow: 0 4px 12px -6px oklch(0.4 0.06 60 / 0.35);
     cursor: pointer;
     transition: transform 180ms var(--ease-out), background-color 180ms ease;
   }
   .bq-step:active { transform: scale(0.97); }
   .bq-step:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
   @media (hover: hover) and (pointer: fine) {
     .bq-step:hover { background: oklch(0.6 0.08 65 / 0.16); }
   }
   ```

4. Update `.bq-hint` copy (mobile portrait):
   ```css
   .bq-hint::before { content: "Arrastra el ramo · desliza arriba para seguir"; }
   ```

5. Keep `overscroll-behavior: contain` on `.bq-panel__scroll`.
6. Landscape (`@media (min-aspect-ratio: 85/100)`): toolbar stays hidden.

### bouquetUi.js — wire buttons + reset scroll on activation
1. After `const $ = (id) => host.querySelector(...)` (around line 16), add:
   ```js
   const prevBtn = $("#bq-prev")
   const nextBtn = $("#bq-next")
   const stepsEl = host.querySelector(".bq-steps")
   ```

2. In the `watch` interval (around line 78), inside `if (active && !wasActive)`:
   ```js
   stepsEl.hidden = false
   requestAnimationFrame(() => stepsEl.classList.add("is-on"))
   host.querySelector(".bq-panel__scroll").scrollTop = 0
   ```

3. Click handlers (after the `watch` interval, around line 87):
   ```js
   prevBtn.addEventListener("click", () => experience.goToSection(1))
   nextBtn.addEventListener("click", () => experience.goToSection(3))
   ```

4. Add fade-in for toolbar in CSS (optional, can just use `hidden`):
   ```css
   .bq-steps { opacity: 0; transform: translateY(-8px); transition: opacity 300ms var(--ease-out), transform 300ms var(--ease-out); }
   .bq-steps.is-on { opacity: 1; transform: none; }
   ```

## Constraints
- Product: no global menu/dock; this is **contextual step nav** (same pattern as rings HUD), not a global dock.
- `--ease-out: cubic-bezier(0.23,1,0.32,1)` for transitions.
- `prefers-reduced-motion` respected (transitions drop to 1ms).
- Does NOT depend on pager internals — `experience.goToSection` already exists and wave 0 made it cancel in-flight swipes.
- Free model: `opencode-go/longcat-2.5-preview-free` (unlimited).
- No-cross-file rule: only the three bouquet files.

## Commit message
`feat(mobile): bouquet sheet with peek and step toolbar`

## Self-check
- `npm run build` passes
- Only the three bouquet files changed
- Toolbar visible only on portrait mobile; landscape unchanged
- `bq-prev` → rings, `bq-next` → arch work from anywhere in the form
- Form still scrolls internally; strip of 3D bouquet visible above sheet