# Task: Snap pager with committed page + flight lock

**Agent:** `mobile/pager` (subagent, Space Bunny Free)
**Files:** `src/three/ScrollSnap.js`, `src/three/Experience.js`
**Wave:** 0 (serial, contract-founding)

## Exact changes

### Experience.js — add pager state and rewrite #snapToPage
1. Add private fields (after line ~50 where state lives):
   ```js
   this._page = 0              // committed current page
   this._pageTarget = null     // page we're flying to (or null)
   this._flying = false        // true while a scroll tween is running
   this._scrollProxy = { y: 0 } // GSAP target proxy
   this._scrollTween = null     // current GSAP tween (for killing)
   ```

2. Rewrite `#snapToPage(page)`:
   - Clamp `page` to `0 .. (n-1)` where `n = (this._pageStages??[]).length || 1`
   - If `this._flying && page === this._pageTarget` → return (no-op)
   - Set `this._pageTarget = page; this._flying = true`
   - Kill any previous `_scrollTween`: `this._scrollTween?.kill()`
   - `this._scrollProxy.y = window.scrollY`
   - GSAP tween:
     ```js
     this._scrollTween = gsap.to(this._scrollProxy, {
       y: page * innerHeight,
       duration: this.reducedMotion ? 0.01 : 0.55,
       ease: "power2.inOut",
       onUpdate: () => window.scrollTo(0, Math.round(this._scrollProxy.y)),
       onComplete: () => {
         this._page = page
         this._pageTarget = null
         this._flying = false
         this._scrollTween = null
       }
     })
     ```

3. `goToSection(i)` routes through the same `#snapToPage` (cancels in-flight swipes cleanly).

4. Expose two new public methods (add after `#snapToPage`):
   ```js
   snapCurrentPage() { return this._pageTarget ?? this._page }
   getFlying() { return this._flying }
   ```

### ScrollSnap.js — use committed page, ignore gestures while flying
1. Constructor receives `getFlying` callback (add to constructor params).
2. `getCurrentPage` callback → return `experience.snapCurrentPage()`.
3. In `#onTouchStart`: also bail when `this.getFlying()` → ignore new gestures mid-transition.
4. Keep ±1 page rule (`next = page + dir`) so a gesture always advances exactly one page.
5. Keep `#isOverUi`, `is-modal` lock, reduced-motion instant behavior unchanged.

### Do NOT change
- Any section/UI file (`src/ui/*`, `src/three/sections/*`)
- The journey/camera logic (`#updateJourney` reads `window.scrollY` as today — that's correct)

### Commit message
`feat(mobile): snap pager with committed page and flight lock`

## Constraints
- Product: light café theme tokens in `src/style.css :root`; `--ease-out: cubic-bezier(0.23,1,0.32,1)`; no global menu/dock; legible before decorative; `prefers-reduced-motion` honored.
- Free model: `opencode-go/space-bunny-free` (unlimited).
- No-cross-file rule: only the two target files.