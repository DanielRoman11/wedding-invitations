/**
 * Fuegos artificiales 2D sobre un <canvas> transparente a pantalla completa.
 * Sustituye al sistema 3D de puntos: los cohetes suben desde abajo, dejan una
 * estela y estallan en un anillo de destellos que caen con gravedad y arrastre.
 *
 * El cielo es claro (tarde dorada), así que se dibuja con mezcla normal y
 * colores saturados; la estela se consigue desvaneciendo el fotograma anterior
 * con "destination-out", de modo que la escena 3D de debajo siempre se ve.
 */

const VARIETY = {
  gold: [217, 163, 74],
  caramel: [185, 133, 88],
  bronze: [192, 138, 84],
  blush: [232, 168, 156],
  rose: [233, 184, 164],
  sage: [156, 175, 136],
  plum: [185, 165, 214],
}

const VARIETY_LIST = Object.values(VARIETY)

const hexToRgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
const rand = (a, b) => a + Math.random() * (b - a)

export class Fireworks {
  constructor() {
    this.canvas = document.createElement("canvas")
    this.canvas.setAttribute("aria-hidden", "true")
    this.canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:15;"
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext("2d")

    this.rockets = []
    this.sparks = []
    this.flashes = []

    this._w = 0
    this._h = 0
    this._linger = 0
    this._drawn = false

    this._onResize = () => this.#resize()
    window.addEventListener("resize", this._onResize)
    this.#resize()
  }

  #resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this._w = window.innerWidth
    this._h = window.innerHeight
    this.canvas.width = Math.round(this._w * dpr)
    this.canvas.height = Math.round(this._h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /** Lanza un cohete que estallará en la parte alta del cielo */
  launch(hex) {
    this.rockets.push({
      x: this._w * rand(0.3, 0.7),
      y: this._h + 10,
      vx: rand(-0.06, 0.06) * this._w,
      vy: -this._h * rand(0.7, 1),
      color: hexToRgb(hex),
      explodeY: this._h * rand(0.12, 0.34),
    })
  }

  #explode(x, y, color) {
    const count = 120
    const shell = rand(0.12, 0.24) * this._h
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const speed = shell * rand(0.7, 1.15)
      const life = rand(0.9, 1.9)
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life,
        max: life,
        size: rand(1.2, 2.4),
        color: Math.random() < 0.72 ? color : VARIETY_LIST[(Math.random() * VARIETY_LIST.length) | 0],
      })
    }
    this.flashes.push({ x, y, r: rand(6, 14), life: 0.32, max: 0.32, color })
  }

  #stepRockets(dt) {
    const { ctx } = this
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i]
      const px = r.x
      const py = r.y
      r.x += r.vx * dt
      r.y += r.vy * dt
      r.vy += 320 * dt // el cohete frena al subir

      // Estela
      ctx.strokeStyle = rgba(r.color, 0.55)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(r.x, r.y)
      ctx.stroke()

      // Cabeza brillante
      ctx.fillStyle = rgba(r.color, 0.95)
      ctx.beginPath()
      ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2)
      ctx.fill()

      if (r.y <= r.explodeY || r.y < -20) {
        this.#explode(r.x, r.y, r.color)
        this.rockets.splice(i, 1)
      }
    }
  }

  #stepSparks(dt) {
    const { ctx } = this
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]
      s.life -= dt
      if (s.life <= 0) {
        this.sparks.splice(i, 1)
        continue
      }
      s.vx *= 1 - 1.7 * dt
      s.vy *= 1 - 1.7 * dt
      s.vy += 420 * dt
      s.x += s.vx * dt
      s.y += s.vy * dt

      const a = Math.min(1, (s.life / s.max) * 1.3)
      // Halo suave
      ctx.globalAlpha = a * 0.28
      ctx.fillStyle = rgba(s.color, 1)
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * 2.4, 0, Math.PI * 2)
      ctx.fill()
      // Núcleo
      ctx.globalAlpha = a
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  #stepFlashes(dt) {
    const { ctx } = this
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]
      f.life -= dt
      if (f.life <= 0) {
        this.flashes.splice(i, 1)
        continue
      }
      const t = f.life / f.max
      const r = f.r + (1 - t) * 46
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r)
      g.addColorStop(0, rgba(f.color, 0.85 * t))
      g.addColorStop(1, rgba(f.color, 0))
      ctx.fillStyle = g
      ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2)
    }
  }

  update(dt) {
    const has = this.rockets.length || this.sparks.length || this.flashes.length
    if (has) {
      this._linger = 0.9
      this._drawn = true
    } else if (!this._drawn) {
      return
    }

    dt = Math.min(dt, 0.05)
    this._linger -= dt
    if (!has && this._linger <= 0) {
      this.ctx.clearRect(0, 0, this._w, this._h)
      this._drawn = false
      return
    }

    const { ctx, _w: w, _h: h } = this

    // Desvanece el fotograma anterior para dejar estelas suaves
    ctx.globalCompositeOperation = "destination-out"
    ctx.fillStyle = "rgba(0,0,0,0.22)"
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = "source-over"

    this.#stepRockets(dt)
    this.#stepSparks(dt)
    this.#stepFlashes(dt)
  }

  dispose() {
    window.removeEventListener("resize", this._onResize)
    this.canvas.remove()
    this.rockets.length = 0
    this.sparks.length = 0
    this.flashes.length = 0
  }
}
