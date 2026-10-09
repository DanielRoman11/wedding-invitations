/**
 * Scroll por páginas en dispositivos táctiles.
 *
 * Desactiva el scroll de inercia del navegador sobre el canvas y convierte
 * cada deslizamiento vertical en un salto decidido a la página siguiente o
 * anterior. Así el recorrido en móvil se siente igual de "fijo" que en
 * escritorio con scroll-snap.
 */
export class ScrollSnap {
  constructor({ getPhase, getLocked, getPageCount, getCurrentPage, getFlying, goToPage }) {
    this.getPhase = getPhase
    this.getLocked = getLocked
    this.getPageCount = getPageCount
    this.getCurrentPage = getCurrentPage
    this.getFlying = getFlying
    this.goToPage = goToPage

    this.swipe = null

    this.SWIPE_THRESHOLD = 56
    this.FLICK_THRESHOLD = 30
    this.VELOCITY_THRESHOLD = 0.55
  }

  bind() {
    this._onTouchStart = this.#onTouchStart.bind(this)
    this._onTouchMove = this.#onTouchMove.bind(this)
    this._onTouchEnd = this.#onTouchEnd.bind(this)
    this._onTouchCancel = this.#reset.bind(this)

    window.addEventListener("touchstart", this._onTouchStart, { passive: true })
    window.addEventListener("touchmove", this._onTouchMove, { passive: false })
    window.addEventListener("touchend", this._onTouchEnd, { passive: true })
    window.addEventListener("touchcancel", this._onTouchCancel, { passive: true })
  }

  unbind() {
    window.removeEventListener("touchstart", this._onTouchStart)
    window.removeEventListener("touchmove", this._onTouchMove)
    window.removeEventListener("touchend", this._onTouchEnd)
    window.removeEventListener("touchcancel", this._onTouchCancel)
  }

  /** La UI HTML vive sobre el canvas: no interceptamos sus gestos. */
  #isOverUi(target) {
    return target?.closest && !!target.closest(".stage, .home-btn, #hint, #loader")
  }

  #onTouchStart(e) {
    if (e.touches.length !== 1) return this.#reset()
    if (this.getPhase() !== "open" || this.getLocked() || this.getFlying() || this.#isOverUi(e.target)) {
      return this.#reset()
    }

    const t = e.touches[0]
    this.swipe = {
      id: t.identifier,
      x: t.clientX,
      y: t.clientY,
      time: performance.now(),
      axis: null,
    }
  }

  #onTouchMove(e) {
    if (!this.swipe) return
    if (this.getPhase() !== "open" || this.getLocked() || this.getFlying() || e.touches.length !== 1) {
      return this.#reset()
    }

    const t = [...e.touches].find((touch) => touch.identifier === this.swipe.id)
    if (!t) return this.#reset()

    const dx = t.clientX - this.swipe.x
    const dy = t.clientY - this.swipe.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    if (!this.swipe.axis && Math.max(absX, absY) >= 16) {
      if (absY > absX * 1.2) this.swipe.axis = "y"
      else if (absX > absY * 1.2) this.swipe.axis = "x"
    }
    if (this.swipe.axis === "y" && e.cancelable) e.preventDefault()
  }

  #onTouchEnd(e) {
    const swipe = this.swipe
    if (!swipe) return
    const t = [...e.changedTouches].find((touch) => touch.identifier === swipe.id)
    this.#reset()
    if (!t || this.getPhase() !== "open" || this.getLocked() || this.getFlying()) return

    const dy = swipe.y - t.clientY
    const dx = swipe.x - t.clientX
    const dt = performance.now() - swipe.time

    if (swipe.axis === "x" || Math.abs(dy) <= Math.abs(dx) * 1.2) return

    const velocity = dy / Math.max(1, dt)
    const distance = Math.abs(dy)
    const decisive =
      distance >= this.SWIPE_THRESHOLD ||
      (distance >= this.FLICK_THRESHOLD && Math.abs(velocity) >= this.VELOCITY_THRESHOLD)
    if (!decisive) return

    const dir = Math.sign(dy)
    const page = this.getCurrentPage()
    const next = Math.max(0, Math.min(this.getPageCount() - 1, page + dir))
    if (next !== page) this.goToPage(next)
  }

  #reset() {
    this.swipe = null
  }
}
