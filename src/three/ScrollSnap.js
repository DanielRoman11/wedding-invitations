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

    this.swipeStartY = null
    this.swipeStartX = null
    this.swipeStartT = null

    this.SWIPE_THRESHOLD = 46 // px: con esto basta un movimiento corto
    this.VELOCITY_THRESHOLD = 0.42 // px/ms
  }

  bind() {
    this._onTouchStart = this.#onTouchStart.bind(this)
    this._onTouchMove = this.#onTouchMove.bind(this)
    this._onTouchEnd = this.#onTouchEnd.bind(this)

    window.addEventListener("touchstart", this._onTouchStart, { passive: true })
    window.addEventListener("touchmove", this._onTouchMove, { passive: false })
    window.addEventListener("touchend", this._onTouchEnd, { passive: true })
  }

  unbind() {
    window.removeEventListener("touchstart", this._onTouchStart)
    window.removeEventListener("touchmove", this._onTouchMove)
    window.removeEventListener("touchend", this._onTouchEnd)
  }

  /** La UI HTML vive sobre el canvas: no interceptamos sus gestos. */
  #isOverUi(target) {
    return target?.closest && !!target.closest(".stage, .home-btn, #hint, #loader")
  }

  #onTouchStart(e) {
    const t = e.touches[0]
    if (!t) return
    if (this.getPhase() !== "open") return
    if (this.getLocked()) return
    if (this.getFlying()) return
    if (this.#isOverUi(e.target)) return

    this.swipeStartY = t.clientY
    this.swipeStartX = t.clientX
    this.swipeStartT = performance.now()
  }

  #onTouchMove(e) {
    if (this.getPhase() !== "open") return
    if (this.swipeStartY === null) return
    if (this.getLocked()) {
      this.swipeStartY = null
      return
    }
    // Evita el scroll nativo con inercia: nosotros decidimos cuándo cambiar de página.
    e.preventDefault()
  }

  #onTouchEnd(e) {
    if (this.getPhase() !== "open") return
    const t = e.changedTouches[0]
    if (!t) return

    const startY = this.swipeStartY
    const startX = this.swipeStartX
    const startT = this.swipeStartT
    this.swipeStartY = null
    this.swipeStartX = null
    this.swipeStartT = null

    if (startY === null || this.getLocked()) return

    const dy = startY - t.clientY
    const dx = startX - t.clientX
    const dt = performance.now() - startT

    // Ignora gestos claramente horizontales.
    if (Math.abs(dx) > Math.abs(dy) * 1.4) return

    const velocity = dy / Math.max(1, dt)
    const decisive = Math.abs(dy) > this.SWIPE_THRESHOLD || Math.abs(velocity) > this.VELOCITY_THRESHOLD
    if (!decisive) return

    const dir = Math.sign(dy)
    const page = this.getCurrentPage()
    const next = Math.max(0, Math.min(this.getPageCount() - 1, page + dir))
    if (next !== page) this.goToPage(next)
  }
}
