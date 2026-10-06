import * as THREE from "three"
import { Section } from "./Section.js"
import { Bouquet } from "../Bouquet.js"
import { BOUQUET_Z } from "../world.js"

/** Altura y ancho del ramo en unidades de mundo (con tallos y polaroids) */
const BOUQUET_H = 4.5
const BOUQUET_W = 6.2
/** Centro vertical del ramo respecto a su origen (la cúpula arriba, tallos abajo) */
const CENTER_Y = -0.95
/** Distancia de cámara a la sección bajo la cual se actualiza */
const NEAR = 40

const LOOK_Y = 0.3

/**
 * Sección 3: el ramo de novia. Se coloca a un lado del panel HTML (izquierda
 * en horizontal, arriba en vertical) y se arrastra para girarlo.
 */
export class BouquetSection extends Section {
  constructor(ctx) {
    super(ctx)
    this.bouquet = new Bouquet(ctx.images)
    this.group = this.bouquet.group
    this.group.position.set(0, 0, BOUQUET_Z)
    ctx.scene.add(this.group)

    // Luz cálida propia, delante y arriba del ramo, más un relleno durazno
    this.warm = new THREE.PointLight(0xffedd4, 7, 22, 1.5)
    this.warm.position.set(2.5, 4, BOUQUET_Z + 5)
    this.rim = new THREE.PointLight(0xf2c4a6, 3, 18, 1.6)
    this.rim.position.set(-4, 1, BOUQUET_Z - 3)
    ctx.scene.add(this.warm, this.rim)

    this.mode = "landscape"
    this.active = false
    this.dragging = false
    this.timers = []
    this._v = new THREE.Vector3()
    this._basePos = new THREE.Vector3()
  }

  cameraStop() {
    const { camera } = this.ctx
    const aspect = camera.aspect
    const landscape = aspect >= 0.85
    this.mode = landscape ? "landscape" : "portrait"

    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const frac = landscape ? 0.62 : 0.5
    let scale = 1
    let dist = BOUQUET_H / (frac * 2 * tanH)

    // En pantallas angostas el ancho (con las polaroids) manda
    const visW = 2 * dist * tanH * aspect
    const regionW = landscape ? visW * 0.42 : visW
    const maxW = regionW * 0.94
    if (BOUQUET_W > maxW) scale = maxW / BOUQUET_W
    // Se achica y se acerca la cámara para que siga ocupando la fracción pedida del alto
    if (scale < 1) dist = (BOUQUET_H * scale) / (frac * 2 * tanH)
    dist = Math.max(dist, 6)

    const visH = 2 * dist * tanH
    const visWidth = visH * aspect
    const targetX = landscape ? -0.27 * visWidth : 0
    // Centro de la región superior en vertical: 23% desde arriba
    const targetY = landscape ? LOOK_Y : LOOK_Y + 0.24 * visH
    this.group.scale.setScalar(scale)
    this._basePos.set(targetX, targetY - CENTER_Y * scale, BOUQUET_Z)
    this.group.position.copy(this._basePos)
    this.warm.position.set(this._basePos.x + 2.5, this._basePos.y + 4, BOUQUET_Z + 5)
    this.rim.position.set(this._basePos.x - 4, this._basePos.y + 1, BOUQUET_Z - 3)

    this.emit("layout", { mode: this.mode })
    return {
      pos: new THREE.Vector3(0, LOOK_Y, BOUQUET_Z + dist),
      look: new THREE.Vector3(0, LOOK_Y, BOUQUET_Z),
    }
  }

  activate() {
    this.active = true
  }

  deactivate() {
    this.active = false
    this.dragging = false
    this.bouquet.release()
    this.timers.length = 0
  }

  #near() {
    return this.active || this.ctx.camera.position.distanceTo(this.group.position) < NEAR
  }

  update(elapsed, delta) {
    if (!this.#near()) return
    this.bouquet.update(elapsed, delta)

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i]
      t.at -= delta
      if (t.at <= 0) {
        this.timers.splice(i, 1)
        t.fn()
      }
    }
  }

  pick() {
    if (!this.#near()) return null
    const hit = this.ctx.raycaster.intersectObject(this.bouquet.pickTarget, false)[0]
    return hit ?? null
  }

  cursorFor(hit) {
    return hit ? "grab" : "default"
  }

  tap(hit) {
    const { fx, camera } = this.ctx
    const point = hit?.point ?? this.group.getWorldPosition(this._v)
    fx.sparkles?.burst(point)
    if (!this.ctx.reducedMotion) {
      const ndc = point.clone().project(camera)
      fx.petals?.gust(ndc.x, ndc.y, camera, 0.7)
    }
  }

  pointerDown() {
    if (!this.#near()) return false
    this.dragging = true
    return true
  }

  pointerMove(dx) {
    if (!this.dragging) return
    this.bouquet.drag(dx * 0.012)
  }

  pointerUp() {
    if (!this.dragging) return
    this.dragging = false
    this.bouquet.release()
  }

  /** Lluvia de pétalos desde lo alto del ramo y destellos */
  celebrate() {
    const { fx, camera } = this.ctx
    const top = new THREE.Vector3(0, 1.8 * this.group.scale.y, 0).add(this.group.position)
    const burst = (dx, dy, strength) => {
      const p = top.clone().add(new THREE.Vector3(dx, dy, 0))
      fx.sparkles?.burst(p)
      if (!this.ctx.reducedMotion) {
        const ndc = p.clone().project(camera)
        fx.petals?.gust(ndc.x, ndc.y, camera, strength)
      }
    }
    burst(0, 0, 1.6)
    if (this.ctx.reducedMotion) return
    const s = this.group.scale.x
    const plan = [
      [0.4, -1.2 * s, 0.6 * s, 1.2],
      [0.8, 1.3 * s, 0.2 * s, 1.2],
      [1.3, 0, 1.2 * s, 1.5],
      [1.9, -0.8 * s, 0.4 * s, 1],
    ]
    for (const [at, dx, dy, strength] of plan) {
      this.timers.push({ at, fn: () => burst(dx, dy, strength) })
    }
  }

  dispose() {
    this.timers.length = 0
    this.ctx.scene.remove(this.group, this.warm, this.rim)
    this.bouquet.dispose()
  }
}
