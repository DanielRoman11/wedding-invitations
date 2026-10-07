import * as THREE from "three"
import gsap from "gsap"
import { Section } from "./Section.js"
import { palette } from "../../config.js"
import { createWishPaperTexture, createCardBackTexture } from "../textures.js"
import { polaroidTexture } from "../Panels.js"
import { photoAt } from "../../photos.js"
import { CARD_REST, CARD_W, CARD_H, SHEET_LIFT } from "../world.js"

const PAPER_W = 1.5
const PAPER_H = 1.9
const PAPER_DEPTH = 0.95
const HINT_EVERY = 3.5
const SHAKE_EVERY = 2
const POLAROID_W = 0.46
const POLAROID_H = 0.54

/**
 * Fotos pequeñas que vuelan alrededor de la carta, como si salieran del sobre.
 * Las 2 del frente se ven al abrir la carta; las 3 del reverso (siempre las
 * mismas) aparecen mientras se pasan las hojas. `photo` es el índice en `images`.
 */
const FLOATERS = [
  { group: "front", photo: 8 },
  { group: "front", photo: 16 },
  { group: "back", photo: 13 },
  { group: "back", photo: 14 },
  { group: "back", photo: 15 },
]

/** Posiciones (x, y, giro) en el plano de la carta; en vertical van sobre ella */
const HOMES = {
  landscape: {
    front: [[-1.3, 0.55, 0.2], [1.32, 0.62, -0.18]],
    back: [[-1.3, 0.72, -0.16], [1.3, 0.78, 0.2], [-1.22, -0.62, 0.14]],
  },
  portrait: {
    front: [[-0.62, 1.4, 0.18], [0.66, 1.34, -0.2]],
    back: [[-0.8, 1.44, -0.16], [0.02, 1.52, 0.1], [0.82, 1.4, 0.2]],
  },
}

/**
 * Sección 0: la carta (frente y reverso), el papel de deseos que asoma detrás
 * y el papel de deseos. Todo el estado animable vive en objetos simples que
 * gsap interpola; `update` los vuelca a las mallas cada frame.
 */
export class CardSection extends Section {
  constructor(ctx, { card }) {
    super(ctx)
    this.card = card
    this.cardMaterials = Array.isArray(card.material) ? card.material : [card.material]
    this.cardMaterials.forEach((m) => (m.transparent = true))

    this.active = true
    this.prepared = false
    this._flipped = false
    this._flipP = 0
    this._sheetPos = 0
    this.sheets = []
    this._paperOpen = false
    this._paperTarget = false
    this._busy = false
    this._everFlipped = false
    this._idleT = 0
    this._shakeT = 0
    this._tilt = { x: 0, y: 0 }
    this._rect = { left: 0, top: 0, width: 0, height: 0 }
    this._tweens = []

    this.cs = { wobble: 0, fade: 1, back: 0 }
    this.ps = {
      open: 0,
      opacity: 0,
      shakeZ: 0,
      shakeY: 0,
      flyY: 0,
      flyZ: 0,
      flyScale: 1,
    }
    this.paperRest = { x: 1.45, y: -0.25, rz: -0.14 }
    this.#buildPaper()
    this.#buildFloaters()
  }

  #buildFloaters() {
    this.floatIn = { t: 0 }
    this.mode = "landscape"
    const geo = new THREE.PlaneGeometry(POLAROID_W, POLAROID_H)
    this.floaterGeo = geo
    this.floaters = []
    const counts = { front: 0, back: 0 }
    FLOATERS.forEach((def, i) => {
      const texture = polaroidTexture(photoAt(this.ctx.images, def.photo))
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        toneMapped: false,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geo, material)
      mesh.visible = false
      this.ctx.scene.add(mesh)
      this.floaters.push({
        mesh,
        texture,
        group: def.group,
        slot: counts[def.group]++,
        phase: i * 1.9,
        speed: 0.5 + (i % 3) * 0.12,
        home: new THREE.Vector3(),
        turn: 0,
      })
    })
    this.#placeFloaters()
  }

  #placeFloaters() {
    for (const f of this.floaters) {
      const [x, y, turn] = HOMES[this.mode][f.group][f.slot]
      f.home.set(x, y, 0.38)
      f.turn = turn
    }
  }

  #buildPaper() {
    this.paperClosedTex = createWishPaperTexture(true)
    this.paperOpenTex = createWishPaperTexture(false)
    this.paperBackTex = createWishPaperTexture(false)

    const face = (map) =>
      new THREE.MeshStandardMaterial({
        map,
        emissiveMap: map,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.22,
        roughness: 0.9,
        transparent: true,
        opacity: 0,
      })
    this.paperFront = face(this.paperClosedTex)
    const paperBack = face(this.paperBackTex)
    const edge = new THREE.MeshStandardMaterial({
      color: palette.paperInner,
      emissive: new THREE.Color(palette.paperInner),
      emissiveIntensity: 0.12,
      roughness: 0.9,
      transparent: true,
      opacity: 0,
    })
    this.paperMaterials = [edge, this.paperFront, paperBack]
    this.paper = new THREE.Mesh(new THREE.BoxGeometry(PAPER_W, PAPER_H, 0.02), [
      edge,
      edge,
      edge,
      edge,
      this.paperFront,
      paperBack,
    ])
    this.paper.visible = false
    this.paper.rotation.set(0, -0.08, -0.16)
    this.ctx.scene.add(this.paper)
  }
  get isFlipped() {
    return this._flipped
  }

  get isPaperOpen() {
    return this._paperOpen
  }

  get overlayRect() {
    return this.#computeRect(this.#distance())
  }

  #distance() {
    const cam = this.ctx.camera
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)
    return Math.max(CARD_H / (2 * tanH * 0.64), CARD_W / (2 * tanH * cam.aspect * 0.8))
  }

  #computeRect(dist) {
    const cam = this.ctx.camera
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)
    const ppu = window.innerHeight / (2 * tanH * dist)
    const width = CARD_W * ppu
    const height = CARD_H * ppu
    return {
      left: (window.innerWidth - width) / 2,
      top: (window.innerHeight - height) / 2,
      width,
      height,
    }
  }

  cameraStop() {
    const cam = this.ctx.camera
    const dist = this.#distance()
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)

    const halfVisible = dist * tanH * cam.aspect * 0.94
    this.paperRest =
      cam.aspect < 0.85
        ? { x: 0.3, y: -1.55, rz: -0.1 }
        : { x: Math.min(1.45, halfVisible - PAPER_W / 2 + 0.2), y: -0.25, rz: -0.14 }

    const mode = cam.aspect < 0.85 ? "portrait" : "landscape"
    if (mode !== this.mode) {
      this.mode = mode
      this.#placeFloaters()
    }

    this._rect = this.#computeRect(dist)
    this.emit("layout", this._rect)
    return {
      pos: new THREE.Vector3(0, CARD_REST.y, CARD_REST.z + dist),
      look: new THREE.Vector3(0, CARD_REST.y, CARD_REST.z),
    }
  }

  prepare() {
    if (this.prepared) return
    this.prepared = true
    this.paper.visible = true
    this.#track(
      gsap.to(this.ps, {
        opacity: 1,
        duration: this.ctx.reducedMotion ? 0.01 : 0.9,
        ease: "power2.out",
      }),
    )
    this._idleT = 0
    this._shakeT = 0

    this.#track(
      gsap.to(this.floatIn, {
        t: 1,
        duration: this.ctx.reducedMotion ? 0.01 : 1.8,
        delay: this.ctx.reducedMotion ? 0 : 0.4,
        ease: "none",
      }),
    )
  }

  /** Los deseos ahora terminan en el arco de la última escena. */
  setWishes() {}

  launchWish(wish) {
    this.emit("wish", wish)
  }

  setFlipProgress(p) {
    this._flipP = p
    const flipped = p >= 0.97
    if (flipped !== this._flipped) {
      this._flipped = flipped
      if (flipped) this.#burst()
      this.emit("flip", flipped)
    }
    if (p > 0.01) this._everFlipped = true
    this.#syncGain()
  }

  animateFlip(target) {
    if (this._busy) return
    this._busy = true
    const targetP = target ? 1 : 0
    this.#track(
      gsap.to(this, {
        _flipP: targetP,
        duration: 0.35,
        ease: "power2.inOut",
        onUpdate: () => this.setFlipProgress(this._flipP),
        onComplete: () => {
          this._busy = false
        },
      }),
    )
  }

  setSheetPos(v) {
    if (Math.abs(v - this._sheetPos) < 0.0005) return
    this._sheetPos = v
    this.emit("sheetpos", v)
  }

  get sheetPos() {
    return this._sheetPos
  }

  /**
   * El reverso tiene `n` hojas: la carta es la primera y las demás se apilan
   * detrás, apenas desalineadas como un fajo. El scroll las va levantando una
   * a una (sube la de arriba y deja ver la siguiente).
   */
  setSheetCount(n) {
    if (this.sheets.length || n < 2) return
    this.sheetTexture = createCardBackTexture()
    this.sheetGeo = new THREE.BoxGeometry(CARD_W, CARD_H, 0.02)
    const edge = new THREE.MeshStandardMaterial({
      color: palette.paperInner,
      emissive: new THREE.Color(palette.paperInner),
      emissiveIntensity: 0.4,
      roughness: 0.9,
      transparent: true,
      opacity: 0,
    })
    this.sheetEdge = edge
    for (let k = 1; k < n; k++) {
      const face = new THREE.MeshStandardMaterial({
        map: this.sheetTexture,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: this.sheetTexture,
        emissiveIntensity: 0.35,
        roughness: 0.9,
        transparent: true,
        opacity: 0,
      })
      const mesh = new THREE.Mesh(this.sheetGeo, [edge, edge, edge, edge, face, face])
      mesh.visible = false
      this.ctx.scene.add(mesh)
      const side = k % 2 ? 1 : -1
      this.sheets.push({ mesh, face, k, offX: side * 0.012 * Math.min(k, 3), rotZ: side * 0.006 * Math.min(k, 3) })
    }
  }

  #burst() {
    const fx = this.ctx.fx?.sparkles
    if (!fx || this.ctx.reducedMotion) return
    fx.burst(this.card.getWorldPosition(new THREE.Vector3()))
  }

  /* -------------------------------------------------------------- Papel */

  openPaper() {
    if (!this.prepared || this._busy || this._paperTarget) return
    this._busy = true
    this._paperTarget = true
    this.emit("scrolllock", true)
    this.#syncGain()
    this.paperFront.map = this.paperOpenTex
    this.paperFront.emissiveMap = this.paperOpenTex
    this.paperFront.needsUpdate = true
    const d = this.ctx.reducedMotion ? 0.01 : 0.9
    this.#track(gsap.to(this.ps, { open: 1, duration: d, ease: "power3.inOut" }))
    this.#track(gsap.to(this.cs, { fade: 0, back: 0.9, duration: d, ease: "power2.inOut" }))
    this.#track(
      gsap.delayedCall(d, () => {
        this._busy = false
        this._paperOpen = true
        this.emit("paper", true)
      }),
    )
  }

  closePaper() {
    if (!this._paperTarget || this._busy) return
    this._busy = true
    this._paperTarget = false
    this._paperOpen = false
    this.emit("paper", false)
    const d = this.ctx.reducedMotion ? 0.01 : 0.8
    this.#track(
      gsap.to(this.ps, {
        open: 0,
        duration: d,
        ease: "power3.inOut",
        onComplete: () => {
          this.#setPaperFace(true)
        },
      }),
    )
    this.#track(gsap.to(this.cs, { fade: 1, back: 0, duration: d, ease: "power2.inOut" }))
    this.#track(
      gsap.delayedCall(d, () => {
        this._busy = false
        this.emit("scrolllock", false)
        this.#syncGain()
      }),
    )
  }

  /** El papel vuela hacia arriba como un farol, la carta vuelve y el papel reaparece */
  releasePaper() {
    if (!this._paperTarget) return
    const fast = this.ctx.reducedMotion
    this._busy = true
    this._paperTarget = false
    this._paperOpen = false
    this.emit("paper", false)
    const k = fast ? 0.01 : 1
    const ps = this.ps

    this.#track(gsap.to(this.cs, { fade: 1, back: 0, duration: 0.9 * k, ease: "power2.inOut" }))

    const tl = gsap.timeline()
    this._tweens.push(tl)
    tl.to(ps, { flyY: 5, flyZ: -2, flyScale: 0.45, duration: 1.4 * k, ease: "power2.in" }, 0)
    tl.to(ps, { opacity: 0, duration: 0.7 * k, ease: "power1.in" }, 0.7 * k)
    tl.call(
      () => {
        ps.open = 0
        ps.flyY = 0
        ps.flyZ = 0
        ps.flyScale = 1
        this.#setPaperFace(true)
      },
      null,
      1.45 * k,
    )
    tl.to(ps, { opacity: 1, duration: 0.8 * k, ease: "power2.out" }, 1.5 * k)
    tl.call(
      () => {
        this._busy = false
        this.emit("scrolllock", false)
        this.#syncGain()
      },
      null,
      1.7 * k,
    )
  }

  #setPaperFace(closed) {
    const map = closed ? this.paperClosedTex : this.paperOpenTex
    this.paperFront.map = map
    this.paperFront.emissiveMap = map
    this.paperFront.needsUpdate = true
  }

  #shake() {
    const s = this.ps
    gsap
      .timeline()
      .to(s, { shakeZ: 0.1, shakeY: 0.06, duration: 0.1, ease: "power1.out" })
      .to(s, { shakeZ: -0.08, shakeY: 0, duration: 0.12, ease: "power1.inOut" })
      .to(s, { shakeZ: 0.05, shakeY: 0.03, duration: 0.1, ease: "power1.inOut" })
      .to(s, { shakeZ: 0, shakeY: 0, duration: 0.2, ease: "power2.out" })
  }

  #hint() {
    const s = this.cs
    gsap
      .timeline()
      .to(s, { wobble: 0.25, duration: 0.35, ease: "sine.inOut" })
      .to(s, { wobble: -0.2, duration: 0.5, ease: "sine.inOut" })
      .to(s, { wobble: 0, duration: 0.35, ease: "sine.inOut" })
  }

  /* ---------------------------------------------------------- Interacción */

  #hitList() {
    const list = []
    if (!this.prepared || this._paperTarget) return list
    if (this.paper.visible) list.push(this.paper)
    return list
  }

  pick() {
    const list = this.#hitList()
    if (!list.length) return null
    const hit = this.ctx.raycaster.intersectObjects(list, false)[0]
    if (!hit) return null
    return { kind: "paper", object: hit.object }
  }

  tap(hit) {
    if (!hit) return
    if (hit.kind === "paper") this.openPaper()
  }

  cursorFor(hit) {
    return hit ? "pointer" : "default"
  }

  #syncGain() {
    // Con la carta girada o el papel abierto, la UI HTML se alinea al rect: sin paralaje
    this.parallaxGain = this._flipP > 0.01 || this._paperTarget ? 0 : 1
  }

  /* ------------------------------------------------------------ Ciclo */

  activate() {
    this.active = true
    this._idleT = 0
    this._shakeT = 0
  }

  deactivate() {
    this.active = false
  }

  update(elapsed, delta) {
    const cs = this.cs
    const ps = this.ps
    const rm = this.ctx.reducedMotion
    const resting = this._flipP < 0.01 && !this._paperTarget

    // Pistas periódicas
    if (this.prepared && this.active && !rm && !this._busy) {
      if (resting && !this._everFlipped) {
        this._idleT += delta
        if (this._idleT >= HINT_EVERY) {
          this._idleT = 0
          this.#hint()
        }
      }
      if (resting) {
        this._shakeT += delta
        if (this._shakeT >= SHAKE_EVERY) {
          this._shakeT = 0
          this.#shake()
        }
      } else this._shakeT = 0
    }

    // Inclinación leve hacia el puntero (solo en reposo)
    const p = this.ctx.pointer
    const k = resting && !rm ? 1 : 0
    this._tilt.x += ((-p.y * 0.07 * k) - this._tilt.x) * Math.min(1, delta * 5)
    this._tilt.y += ((p.x * 0.12 * k) - this._tilt.y) * Math.min(1, delta * 5)

    if (this.prepared) {
      // La hoja de arriba (la carta) sube con el scroll y deja ver la siguiente
      const lift = THREE.MathUtils.clamp(this._sheetPos, 0, 1)
      this.card.position.set(
        CARD_REST.x,
        CARD_REST.y + lift * SHEET_LIFT,
        CARD_REST.z - cs.back + lift * 0.5,
      )
      // Giro con el scroll: arranca y termina suave
      const angle = THREE.MathUtils.smootherstep(this._flipP, 0, 1) * Math.PI
      this.card.rotation.set(this._tilt.x - lift * 0.45, angle + cs.wobble + this._tilt.y, 0)
      const cardOpacity = cs.fade * (1 - THREE.MathUtils.smoothstep(lift, 0.6, 1))
      this.card.visible = cardOpacity > 0.01
      this.cardMaterials.forEach((m) => (m.opacity = cardOpacity))
      this.#updateSheets()
    }

    // Papel
    const t = ps.open
    const dist = this.#distance()
    const ratio = (dist + PAPER_DEPTH) / dist // misma presencia en pantalla estando más atrás
    const baseX = CARD_REST.x + this.paperRest.x * ratio
    const bob = Math.sin(elapsed * 1.3) * 0.015 * (1 - t)
    this.paper.position.set(
      THREE.MathUtils.lerp(baseX, 0, t),
      THREE.MathUtils.lerp(CARD_REST.y + this.paperRest.y * ratio, CARD_REST.y, t) + ps.shakeY + ps.flyY + bob,
      THREE.MathUtils.lerp(CARD_REST.z - PAPER_DEPTH, CARD_REST.z + 0.12, t) + ps.flyZ,
    )
    this.paper.rotation.set(0, THREE.MathUtils.lerp(-0.08, 0, t), THREE.MathUtils.lerp(this.paperRest.rz, 0, t) + ps.shakeZ)
    this.paper.scale.setScalar(THREE.MathUtils.lerp(ratio, 1.1, t) * ps.flyScale)
    const op = ps.opacity
    this.paperMaterials.forEach((m) => (m.opacity = op))
    this.paper.visible = this.prepared && op > 0.005

    this.#updateFloaters(elapsed)
  }

  /** Las hojas de atrás: asoman como un fajo y, una a una, quedan arriba y se van */
  #updateSheets() {
    const s = this._sheetPos
    const shown = THREE.MathUtils.smoothstep(this._flipP, 0.3, 0.9) * this.cs.fade
    for (const sheet of this.sheets) {
      const { mesh, k } = sheet
      const lift = THREE.MathUtils.clamp(s - k, 0, 1)
      // 1 cuando ya es la hoja de arriba (la de encima se fue), 0 mientras está tapada
      const top = THREE.MathUtils.smoothstep(s - (k - 1), 0, 1)
      const gone = 1 - THREE.MathUtils.smoothstep(lift, 0.6, 1)
      const opacity = shown * gone
      mesh.visible = this.prepared && opacity > 0.01
      if (!mesh.visible) continue
      mesh.position.set(
        CARD_REST.x + sheet.offX * (1 - top),
        CARD_REST.y + lift * SHEET_LIFT,
        CARD_REST.z - 0.02 * k * (1 - top) + lift * 0.5,
      )
      // Mismo giro que el reverso de la carta: se ve la cara que mira a la cámara
      mesh.rotation.set(-lift * 0.45, 0, sheet.rotZ * (1 - top))
      sheet.face.opacity = opacity
      this.sheetEdge.opacity = opacity
    }
  }

  /** Las fotos del frente se despiden al girar y las del reverso llegan volando */
  #updateFloaters(elapsed) {
    const p = this._flipP
    const front = 1 - THREE.MathUtils.smoothstep(p, 0.05, 0.45)
    const back = THREE.MathUtils.smoothstep(p, 0.55, 0.95)
    const free = this.cs.fade // con el papel abierto la carta se va y ellas también

    for (const f of this.floaters) {
      const base = f.group === "front" ? front : back
      // Entrada escalonada al abrir la carta
      const arrive = THREE.MathUtils.smoothstep(this.floatIn.t, f.slot * 0.18, f.slot * 0.18 + 0.7)
      const w = base * arrive * free
      const mesh = f.mesh
      mesh.visible = this.prepared && w > 0.01
      if (!mesh.visible) continue

      const k = THREE.MathUtils.smootherstep(w, 0, 1)
      const t = elapsed * f.speed + f.phase
      const bobX = Math.sin(t) * 0.07
      const bobY = Math.cos(t * 1.3) * 0.09
      // Desde el centro de la carta (el sobre) hasta su lugar
      mesh.position.set(
        THREE.MathUtils.lerp(CARD_REST.x, CARD_REST.x + f.home.x, k) + bobX,
        THREE.MathUtils.lerp(CARD_REST.y, CARD_REST.y + f.home.y, k) + bobY,
        CARD_REST.z + f.home.z * k,
      )
      mesh.rotation.set(0, 0, f.turn * k + Math.sin(t * 0.8) * 0.06 + (1 - k) * 1.2)
      mesh.scale.setScalar(0.25 + 0.75 * k)
      mesh.material.opacity = Math.min(1, w * 1.4)
    }
  }

  /* ---------------------------------------------------------- Utilidad */

  #track(tween) {
    this._tweens.push(tween)
    return tween
  }

  #killTweens() {
    this._tweens.forEach((t) => t.kill())
    this._tweens = []
    gsap.killTweensOf(this.cs)
    gsap.killTweensOf(this.ps)
  }

  dispose() {
    this.#killTweens()
    for (const sheet of this.sheets) {
      this.ctx.scene.remove(sheet.mesh)
      sheet.face.dispose()
    }
    this.sheetEdge?.dispose()
    this.sheetGeo?.dispose()
    this.sheetTexture?.dispose()
    for (const f of this.floaters) {
      this.ctx.scene.remove(f.mesh)
      f.mesh.material.dispose()
      f.texture.dispose()
    }
    this.floaterGeo.dispose()
    this.ctx.scene.remove(this.paper)
    this.paper.geometry.dispose()
    this.paperMaterials.forEach((m) => m.dispose())
    this.paperClosedTex.dispose()
    this.paperOpenTex.dispose()
    this.paperBackTex.dispose()
  }
}
