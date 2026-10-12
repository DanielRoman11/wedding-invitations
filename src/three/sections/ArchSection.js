import * as THREE from "three"
import gsap from "gsap"
import { coupleWish } from "../../config.js"
import { ARCH_Z } from "../world.js"
import { Section } from "./Section.js"

/** Alto y ancho totales del arco floral (postes de y=-4 a la corona en y≈5.7) */
const ARCH_H = 10
const ARCH_W = 9
const ARCH_CENTER_Y = 0.8
const ARCH_FRONT_Z = 1.3
const CARD_W = 1.8
const CARD_H = 0.92
const CARD_DEPTH = 0.06
const NOTE_COLUMNS = 4
const NOTE_STEP_X = 2.2
const NOTE_STEP_Y = 1.65
const NOTE_Z = ARCH_FRONT_Z + CARD_DEPTH / 2 + 0.5

function disposeCard(card) {
  card.mesh.geometry.dispose()
  new Set(Array.isArray(card.mesh.material) ? card.mesh.material : [card.mesh.material]).forEach((material) => {
    material.map?.dispose()
    material.dispose()
  })
  card.hitMesh.geometry.dispose()
  card.hitMesh.material.dispose()
}

function messageTexture(wish) {
  const canvas = document.createElement("canvas")
  canvas.width = 1024
  canvas.height = 528
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#fef0c8"
  ctx.fillRect(20, 20, 984, 488)
  ctx.strokeStyle = "#d4a44a"
  ctx.lineWidth = 8
  ctx.strokeRect(32, 32, 960, 464)
  ctx.fillStyle = "#7a5a1e"
  ctx.font = "700 44px Mulish, sans-serif"
  ctx.fillText(wish.name || "Un invitado", 76, 108)
  ctx.font = "40px Mulish, sans-serif"
  // Ajuste de líneas: reduce acumula palabras y abre una línea nueva al pasar de 870px
  const lines = String(wish.message || "")
    .split(/\s+/)
    .reduce((acc, word) => {
      const last = acc.length ? acc[acc.length - 1] : ""
      const next = last ? `${last} ${word}` : word
      if (last && ctx.measureText(next).width > 870) acc.push(word)
      else if (last) acc[acc.length - 1] = next
      else acc.push(word)
      return acc
    }, [])
  lines.slice(0, 4).forEach((line, i) => ctx.fillText(line, 76, 200 + i * 62))
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Última escena: las palabras quedan colgadas del arco floral de la boda. */
export class ArchSection extends Section {
  constructor(ctx) {
    super(ctx)
    this.group = new THREE.Group()
    this.group.position.z = ARCH_Z
    this.cards = []
    this.active = false
    this.selected = null
    this.returning = false
    this.zoomTarget = new THREE.Vector3()
    this.zoomPosition = new THREE.Vector3()
    this.baseCameraPosition = new THREE.Vector3()
    this.baseCameraLook = new THREE.Vector3()
    ctx.scene.add(this.group)
    this.setWishes([coupleWish])
  }

  cameraStop() {
    const { camera } = this.ctx
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    // Distancia para que quepa el arco completo: manda el alto en horizontal
    // y el ancho en pantallas verticales
    const dist = Math.max(
      8,
      ARCH_H / (0.94 * 2 * tan),
      ARCH_W / (0.94 * 2 * tan * camera.aspect),
    )
    const pos = new THREE.Vector3(0, ARCH_CENTER_Y, ARCH_Z + dist)
    const look = new THREE.Vector3(0, ARCH_CENTER_Y, ARCH_Z)
    this.baseCameraPosition.copy(pos)
    this.baseCameraLook.copy(look)
    return { pos, look }
  }

  setWishes(wishes) {
    const current = this.cards.map((card) => card.wish)
    const all = [coupleWish, ...(Array.isArray(wishes) ? wishes : []), ...current]
    this.cards.forEach((card) => {
      this.group.remove(card.mesh)
      disposeCard(card)
    })
    this.cards = []
    all.forEach((wish) => this.#createCard(wish, false))
    this.#layoutCards()
  }

  addWish(wish, animate = true) {
    if (!this.#createCard(wish, animate)) return
    this.#layoutCards()
  }

  #createCard(wish, animate) {
    if (!wish?.message) return
    if (this.cards.some((card) => card.wish.message === wish.message && card.wish.name === wish.name)) return
    const texture = messageTexture(wish)
    const side = new THREE.MeshBasicMaterial({ color: 0xfef0c8, toneMapped: false })
    const front = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false })
    const back = new THREE.MeshBasicMaterial({ color: 0xfef0c8, toneMapped: false })
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(CARD_W, CARD_H, CARD_DEPTH),
      [side, side, side, side, front, back],
    )
    // Zona de toque más grande que la tarjeta: en móvil es difícil atinar
    const hitMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * 1.08, CARD_H * 1.12),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    )
    mesh.add(hitMesh)
    const i = this.cards.length
    const angle = i * 2.39996323
    mesh.rotation.z = Math.sin(angle) * 0.12
    mesh.scale.setScalar(animate ? 0.01 : 1)
    this.group.add(mesh)
    this.cards.push({
      mesh,
      hitMesh,
      wish,
      baseY: ARCH_CENTER_Y,
      baseRot: mesh.rotation.z,
      // Vaivén propio de cada tarjeta: fase, velocidad y amplitud al azar
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.9,
      ampY: 0.03 + Math.random() * 0.05,
      ampRot: 0.04 + Math.random() * 0.07,
    })
    if (animate) gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: "back.out(1.5)" })
    return true
  }

  #layoutCards() {
    const count = this.cards.length
    const rows = Math.max(1, Math.ceil(count / NOTE_COLUMNS))
    const baseCount = Math.floor(count / rows)
    const extraRows = count % rows
    let index = 0

    for (let row = 0; row < rows; row++) {
      const rowCount = baseCount + (row < extraRows ? 1 : 0)
      const y = ARCH_CENTER_Y + ((rows - 1) / 2 - row) * NOTE_STEP_Y

      for (let column = 0; column < rowCount; column++) {
        const card = this.cards[index++]
        card.mesh.position.set((column - (rowCount - 1) / 2) * NOTE_STEP_X, y, NOTE_Z)
        card.baseY = y
      }
    }
  }

  activate() { this.active = true }
  deactivate() {
    this.active = false
    this.returning = false
    gsap.killTweensOf(this.ctx.camera.position)
    this.selected = null
  }

  pick() {
    if (!this.active) return null
    return this.ctx.raycaster.intersectObjects(this.cards.map((card) => card.hitMesh), false)[0] ?? null
  }

  cursorFor(hit) {
    return hit ? "pointer" : "default"
  }

  /** Distancia de zoom para que la tarjeta se lea bien en cualquier pantalla.
   *  En móvil manda el ancho: la tarjeta debe ocupar casi todo el viewport. */
  #zoomDistance() {
    const cam = this.ctx.camera
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    return Math.max(2.2, CARD_W / (2 * tan * cam.aspect * 0.88), CARD_H / (2 * tan * 0.7))
  }

  tap(hit) {
    const card = this.cards.find((item) => item.hitMesh === hit?.object)
    // Tocar fuera de una tarjeta (o la misma otra vez) sale del zoom
    if (!card || this.selected === card) {
      this.exitZoom()
      return
    }
    this.selected = card
    this.returning = false
    this.emit("zoom", card)
    card.mesh.getWorldPosition(this.zoomTarget)
    this.zoomPosition
      .copy(this.zoomTarget)
      .add(new THREE.Vector3(0, 0, this.#zoomDistance()))
    gsap.to(this.ctx.camera.position, {
      x: this.zoomPosition.x,
      y: this.zoomPosition.y,
      z: this.zoomPosition.z,
      duration: this.ctx.reducedMotion ? 0.01 : 1.15,
      ease: "power3.out",
    })
  }

  /** Sale del zoom y devuelve la cámara a la vista completa del arco */
  exitZoom() {
    if (!this.selected) return
    this.selected = null
    this.returning = true
    gsap.killTweensOf(this.ctx.camera.position)
    this.emit("zoom", null)
  }

  overrideCamera(camera) {
    if (!this.active) return false
    if (this.selected) {
      this.selected.mesh.getWorldPosition(this.zoomTarget)
      camera.lookAt(this.zoomTarget)
      return true
    }
    if (this.returning) {
      // Vuelo suave de regreso; el núcleo retoma el control al llegar
      camera.position.lerp(this.baseCameraPosition, this.ctx.reducedMotion ? 1 : 0.1)
      camera.lookAt(this.baseCameraLook)
      if (camera.position.distanceTo(this.baseCameraPosition) < 0.05) this.returning = false
      return true
    }
    return false
  }

  keyDown(key) {
    if (key !== "Escape" || !this.selected) return false
    this.exitZoom()
    return true
  }

  update(elapsed) {
    if (!this.active) return
    this.group.rotation.y = Math.sin(elapsed * 0.18) * 0.035
    // Cada mensaje se mece a su ritmo, como colgado de un hilo.
    // El que se está leyendo se queda quieto.
    this.cards.forEach((card) => {
      if (card === this.selected) {
        card.mesh.position.y = card.baseY
        card.mesh.rotation.z = card.baseRot
        return
      }
      card.mesh.position.y = card.baseY + Math.sin(elapsed * card.speed + card.phase) * card.ampY
      card.mesh.rotation.z = card.baseRot + Math.sin(elapsed * card.speed * 0.8 + card.phase * 1.7) * card.ampRot
    })
  }

  dispose() {
    this.ctx.scene.remove(this.group)
    this.cards.forEach(disposeCard)
  }
}
