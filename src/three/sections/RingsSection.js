import * as THREE from "three"
import gsap from "gsap"
import { Section } from "./Section.js"
import { Rings, RING_RADIUS, PANEL_WORLD_H, PANEL_WORLD_W } from "../Rings.js"
import { RINGS_Z, RINGS_Y } from "../world.js"

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/**
 * Sección 1: dos anillos de oro entrelazados. Tocar uno hace volar la cámara
 * a su interior, donde se arrastra para girar el carrusel de paneles.
 */
export class RingsSection extends Section {
  constructor(ctx) {
    super(ctx)
    this.rings = new Rings(ctx.images)
    this.group = this.rings.group
    this.group.position.z = RINGS_Z
    this.group.position.y = RINGS_Y
    ctx.scene.add(this.group)

    // Luz propia y acotada: no afecta a las otras secciones
    this.light = new THREE.PointLight(0xfff1d6, 22, 46, 1.4)
    this.light.position.set(0, 9 + RINGS_Y, RINGS_Z + 14)
    this.fill = new THREE.PointLight(0xffe2c0, 9, 30, 1.4)
    this.fill.position.set(0, RINGS_Y, RINGS_Z)
    ctx.scene.add(this.light, this.fill)

    this._inside = null
    this._flying = false
    this._t = 0
    this._tween = null
    this._plan = null
    this._startQuat = new THREE.Quaternion()
    this._vd = 4
    this._k = 0.001
    this._lastPanel = -1
    this._portrait = false
  }

  get insideIndex() {
    return this._inside
  }

  get _tanH() {
    return Math.tan(THREE.MathUtils.degToRad(this.ctx.camera.fov / 2))
  }

  cameraStop() {
    const aspect = this.ctx.camera.aspect
    const tanH = this._tanH
    const portrait = aspect < 0.85
    this._portrait = portrait
    this.rings.setPortrait(portrait)
    let dh
    let elev = 0.5
    if (portrait) {
      dh = (RING_RADIUS + 1.5) / (tanH * aspect)
      elev = 0.85
    } else {
      // Ancho del conjunto (21 + holgura) y alto del anillo inclinado
      dh = Math.max(16, (1.5 * RING_RADIUS + 2) / (tanH * aspect), (RING_RADIUS + 2.2) / tanH)
    }
    const len = Math.hypot(elev, 0.9)
    return {
      pos: new THREE.Vector3(0, RINGS_Y + (dh * elev) / len, RINGS_Z + (dh * 0.9) / len),
      look: new THREE.Vector3(0, RINGS_Y, RINGS_Z),
    }
  }

  pick() {
    if (this._inside !== null || this._flying) return null
    const i = this.rings.hitTest(this.ctx.raycaster)
    return i >= 0 ? i : null
  }

  tap(hit) {
    if (typeof hit === "number") this.enter(hit)
  }

  cursorFor(hit) {
    return hit === null || hit === undefined ? "default" : "pointer"
  }

  enter(i) {
    if (this._inside !== null || this._flying || (i !== 0 && i !== 1)) return
    const { camera, reducedMotion } = this.ctx
    const tanH = this._tanH
    const aspect = camera.aspect
    this._vd = clamp(
      Math.max(PANEL_WORLD_H / (2 * tanH * 0.8), PANEL_WORLD_W / (2 * tanH * aspect * 0.9)),
      3.2,
      RING_RADIUS - 0.6,
    )
    // Ganancia 4x: un deslizamiento de dedo corto basta para pasar de panel
    this._k = (4 * 2 * tanH * aspect * this._vd) / (window.innerWidth * RING_RADIUS)
    this._plan = this.rings.planEnter(i, camera.position.clone(), this._vd)
    this.rings.showPanel(i, 0)
    this._startQuat.copy(camera.quaternion)
    this._inside = i
    this._lastPanel = -1
    this.emit("enter", i)
    this.emit("scrolllock", true)
    this._fly(1, reducedMotion ? 0.01 : 2.2, () => this._emitPanel(true))
  }

  exit(instant = false) {
    if (this._inside === null) return
    this.emit("exit", null)
    this.emit("scrolllock", false)
    if (instant || this.ctx.reducedMotion) {
      this._tween?.kill()
      this._release()
      return
    }
    this._fly(0, 2.2 * Math.max(0.35, this._t), () => this._release())
  }

  _fly(to, duration, done) {
    this._tween?.kill()
    this._flying = true
    const state = { t: this._t }
    this._tween = gsap.to(state, {
      t: to,
      duration,
      ease: "power2.inOut",
      onUpdate: () => (this._t = state.t),
      onComplete: () => {
        this._t = to
        this._flying = false
        this._tween = null
        done()
      },
    })
  }

  _release() {
    this._inside = null
    this._plan = null
    this._flying = false
    this._t = 0
    this._lastPanel = -1
  }

  _emitPanel(force = false) {
    if (this._inside === null) return
    const k = this.rings.activeIndex(this._inside)
    if (!force && k === this._lastPanel) return
    this._lastPanel = k
    const info = this.rings.panelInfo(this._inside, k)
    this.emit("panel", {
      ring: this._inside,
      index: k,
      count: info.count,
      title: info.title,
      text: info.text,
    })
  }

  step(dir) {
    if (this._inside === null || this._flying) return
    this.rings.stepPanel(this._inside, dir)
    this._emitPanel()
  }

  overrideCamera(camera) {
    if (this._inside === null || !this._plan) return false
    camera.position.copy(this._plan.curve.getPoint(this._t))
    camera.quaternion.copy(this._startQuat).slerp(this._plan.quat, this._t)
    return true
  }

  keyDown(key) {
    if (this._inside === null) return false
    if (key === "ArrowLeft") this.step(-1)
    else if (key === "ArrowRight") this.step(1)
    else if (key === "Escape") this.exit()
    else return false
    return true
  }

  pointerDown() {
    return this._inside !== null && !this._flying
  }

  pointerMove(dx) {
    if (this._inside === null || this._flying) return
    this.rings.drag(this._inside, dx * this._k)
    this._emitPanel()
  }

  pointerUp(vx) {
    if (this._inside === null || this._flying) return
    const v = clamp(vx * this._k, -6, 6)
    this.rings.settle(this._inside, v)
    this._emitPanel()
  }

  update(elapsed, delta) {
    this.rings.update(delta, this._inside)
    if (this._inside === null) {
      this.emit("labels", this.rings.labelAnchors(this.ctx.camera, window.innerWidth, window.innerHeight))
    }
    this.parallaxGain = this._inside === null ? 1 : 0
  }

  deactivate() {
    this.exit(true)
  }

  dispose() {
    this._tween?.kill()
    this.ctx.scene.remove(this.group, this.light, this.fill)
    this.rings.dispose()
  }
}
