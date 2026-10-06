---
description: Rewrites the snap pager with committed-page + single cancellable GSAP tween + flight lock
mode: subagent
model: opencode-go/space-bunny-free
steps: 20
---

You are the **pager engineer**. Fix the root cause of pain points #1 and #2.

## Target files (ONLY these)
- `src/three/ScrollSnap.js`
- `src/three/Experience.js`

## Task (from `tasks/01-pager.md`)

### Experience.js — add pager state and rewrite #snapToPage
1. Add private fields (after line ~50 where state lives):
   ```js
   this._page = 0              // committed current page
   this._pageTarget = null     // page we're flying to (or null)
   this._flying = false        // true while a scroll tween is running
   this._scrollProxy = { y: 0 } // GSAP target proxy
   ```

2. Rewrite `#snapToPage(page)` to:
   - Clamp `page` to `0 .. (n-1)` where `n = (this._pageStages??[]).length || 1`
   - If `this._flying && page === this._pageTarget` → return (no-op)
   - Set `this._pageTarget = page; this._flying = true`
   - Kill any previous `_scrollTween` (store it on `this`)
   - `this._scrollProxy.y = window.scrollY`
   - GSAP tween: `gsap.to(this._scrollProxy, { y: page * innerHeight, duration: this.reducedMotion ? 0.01 : 0.55, ease: "power2.inOut", onUpdate: () => window.scrollTo(0, Math.round(this._scrollProxy.y)), onComplete: () => { this._page = page; this._pageTarget = null; this._flying = false; this._scrollTween = null; } })`
   - Store tween on `this._scrollTween`

3. `goToSection(i)` routes through the same `#snapToPage` (so it cancels in-flight swipes cleanly).

4. Expose two new public methods (add after `#snapToPage`):
   ```js
   snapCurrentPage() { return this._pageTarget ?? this._page }
   getFlying() { return this._flying }
   ```

5. Document the new public API in a comment at the top of `ScrollSnap.js` (see below).

### ScrollSnap.js — use committed page, ignore gestures while flying
1. `getCurrentPage` callback → return `experience.snapCurrentPage()` (committed/target page, not `Math.round(scrollY/vh)`).
2. In `#onTouchStart`: also bail when `this.getFlying()` → ignore new gestures mid-transition.
3. Keep ±1 page rule (`next = page + dir`) so a gesture always advances exactly one page.
4. Keep `#isOverUi`, `is-modal` lock, reduced-motion instant behavior unchanged.

### Do NOT change
- Any section/UI file (`src/ui/*`, `src/three/sections/*`)
- The journey/camera logic (`#updateJourney` reads `window.scrollY` as today — that's correct)

### Commit message
`feat(mobile): snap pager with committed page and flight lock`

### Self-check before finishing
- `npm run build` passes
- The new methods `snapCurrentPage()` and `getFlying()` exist on `Experience` instances
- No other files touched