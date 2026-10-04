import * as THREE from "three"
import gsap from "gsap"
import { palette } from "../config.js"
import {
  createEnvelopeFrontTexture,
  createFlapTexture,
  createWaxSealTexture,
  createCardFrontTexture,
  createCardBackTexture,
  normalizeUVs,
} from "./textures.js"

const W = 3.4 // ancho del sobre
const H = 2.3 // alto del sobre
const D = 0.12 // grosor
const FLAP_H = H * 0.68 // caída de la solapa

/**
 * El sobre sellado con el nombre del invitado.
 * Flota y reacciona al puntero hasta que lo tocan;
 * entonces se rompe el sello, abre la solapa y entrega la tarjeta.
 */
export class Envelope {
  constructor(guestName) {
    this.group = new THREE.Group()
    this.opened = false
    this._parallax = { x: 0, y: 0 }
    this._baseY = 0

    this.#build(guestName)
  }

  #build(guestName) {
    const paper = new THREE.MeshStandardMaterial({
      color: palette.paper,
      roughness: 0.85,
      metalness: 0.0,
    })
    const paperEdge = new THREE.MeshStandardMaterial({
      color: palette.paperInner,
      roughness: 0.9,
    })

    // ---------------- Cuerpo del sobre ----------------
    const frontTex = createEnvelopeFrontTexture(guestName)
    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.85,
    })
    const bodyGeo = new THREE.BoxGeometry(W, H, D)
    // [+x, -x, +y, -y, +z (frente), -z]
    const body = new THREE.Mesh(bodyGeo, [
      paperEdge,
      paperEdge,
      paperEdge,
      paperEdge,
      frontMat,
      paper,
    ])
    body.castShadow = true
    body.receiveShadow = true
    body.name = "envelope-body"
    this.group.add(body)
    this.body = body

    // ---------------- Solapa (pivote en el borde superior) ----------------
    const flapShape = new THREE.Shape()
    flapShape.moveTo(-W / 2, 0)
    flapShape.lineTo(W / 2, 0)
    flapShape.quadraticCurveTo(W * 0.2, -FLAP_H * 0.86, 0, -FLAP_H)
    flapShape.quadraticCurveTo(-W * 0.2, -FLAP_H * 0.86, -W / 2, 0)

    const flapGeo = new THREE.ExtrudeGeometry(flapShape, {
      depth: 0.025,
      bevelEnabled: false,
      curveSegments: 24,
    })
    normalizeUVs(flapGeo)
    const flapMat = new THREE.MeshStandardMaterial({
      map: createFlapTexture(),
      roughness: 0.85,
    })
    const flapMesh = new THREE.Mesh(flapGeo, flapMat)
    flapMesh.castShadow = true

    this.flap = new THREE.Group()
    this.flap.position.set(0, H / 2, D / 2 + 0.015)
    this.flap.add(flapMesh)
    this.group.add(this.flap)

    // ---------------- Sello de cera (en la punta de la solapa) ----------------
    const sealGeo = new THREE.CylinderGeometry(0.3, 0.32, 0.06, 40)
    const sealMat = new THREE.MeshStandardMaterial({
      map: createWaxSealTexture(),
      roughness: 0.45,
      metalness: 0.05,
    })
    this.seal = new THREE.Mesh(sealGeo, sealMat)
    this.seal.rotation.x = Math.PI / 2
    // Hijo de la solapa: si el sello sobreviviera a la apertura,
    // giraría con ella de forma natural (pero estalla primero).
    this.seal.position.set(0, -H * 0.42, 0.05)
    this.seal.castShadow = true
    this.flap.add(this.seal)

    // ---------------- Tarjeta interior (portrait, guardada acostada) ----------------
    const cardW = 1.66
    const cardH = 2.1
    const cardGeo = new THREE.BoxGeometry(cardW, cardH, 0.035)
    const cardFront = new THREE.MeshStandardMaterial({
      map: createCardFrontTexture(guestName),
      roughness: 0.85,
    })
    const cardBack = new THREE.MeshStandardMaterial({
      map: createCardBackTexture(),
      roughness: 0.85,
    })
    const cardEdge = new THREE.MeshStandardMaterial({
      color: palette.paperInner,
      roughness: 0.9,
    })
    // [+x, -x, +y, -y, +z (frente), -z (dorso)]
    this.card = new THREE.Mesh(cardGeo, [
      cardEdge,
      cardEdge,
      cardEdge,
      cardEdge,
      cardFront,
      cardBack,
    ])
    this.card.castShadow = true
    // Guardada "acostada" dentro del sobre, sin asomarse
    this.card.rotation.z = Math.PI / 2
    this.card.position.set(0, -0.02, 0)
    this.group.add(this.card)

    // Todo el grupo empieza levemente girado para dar volumen
    this.group.rotation.y = -0.16
  }

  /** Puntero NDC suavizado para el parallax del reposo */
  setPointer(nx, ny) {
    if (this.opened) return
    this._parallax.x = nx
    this._parallax.y = ny
  }

  update(elapsed) {
    if (this.opened) return
    // Respiración: flotación + balanceo + parallax hacia el puntero
    this.group.position.y = this._baseY + Math.sin(elapsed * 0.9) * 0.06
    this.group.rotation.z = Math.sin(elapsed * 0.6) * 0.02

    const targetY = -0.16 + this._parallax.x * 0.22
    const targetX = this._parallax.y * -0.1
    this.group.rotation.y += (targetY - this.group.rotation.y) * 0.05
    this.group.rotation.x += (targetX - this.group.rotation.x) * 0.05
  }

/**
   * Coreografía de apertura (~3.5 s). La tarjeta que sale del sobre ES la
   * invitación: se queda en `cardRest` y es lo único que sobrevive; el sobre
   * cae y se desvanece. Devuelve una promesa que resuelve al terminar.
   * @param {THREE.Scene} scene
   * @param {object} opts
   * @param {(worldPos: THREE.Vector3) => void} [opts.onSealBurst]
   * @param {(worldPos: THREE.Vector3) => void} [opts.onLanded] la tarjeta ya está en su sitio
   * @param {THREE.Vector3} opts.cardRest pose final de la tarjeta en el mundo
   * @param {boolean} [opts.fast] movimiento reducido: todo casi instantáneo
   */
  open(scene, { onSealBurst, onLanded, cardRest, fast = false }) {
    if (this.opened) return Promise.resolve()
    this.opened = true

    // La tarjeta pasa a la escena conservando su pose: acostada, dentro del
    // sobre (Rz primero, luego el giro del sobre: igual que como estaba).
    scene.attach(this.card)
    this.card.rotation.set(0, this.group.rotation.y, Math.PI / 2, "XYZ")

    const sealWorld = new THREE.Vector3()
    this.seal.getWorldPosition(sealWorld)

    const fadeMats = [...this.body.material, this.flap.children[0].material]
    fadeMats.forEach((m) => (m.transparent = true))

    const tl = gsap.timeline()

    // 1. El sello se rompe en destellos
    tl.to(this.seal.scale, {
      x: 0.01,
      y: 0.01,
      z: 0.01,
      duration: 0.35,
      ease: "back.in(2.2)",
      onStart: () => onSealBurst?.(sealWorld),
    })
    tl.set(this.seal, { visible: false })

    // 2. La solapa se abre hacia atrás
    tl.to(this.flap.rotation, { x: Math.PI * 0.96, duration: 1.0, ease: "power3.inOut" })

    // 3. La tarjeta asoma por arriba y se endereza
    tl.to(this.card.position, { y: 1.75, duration: 1.2, ease: "power3.out" }, "-=0.5")
    tl.to(this.card.rotation, { z: 0, duration: 1.0, ease: "power3.out" }, "<")

    // 4. La tarjeta pasa al frente y se asienta donde se leerá, mientras el
    //    sobre cae y se desvanece detrás de ella.
    tl.addLabel("land", "+=0.05")
    tl.to(this.card.position, {
      x: cardRest.x,
      y: cardRest.y,
      z: cardRest.z,
      duration: 1.3,
      ease: "power3.inOut",
    }, "land")
    tl.to(this.card.rotation, { x: 0, y: 0, z: 0, duration: 1.3, ease: "power3.inOut" }, "land")
    tl.to(this.group.position, { y: this.group.position.y - 3.2, duration: 1.5, ease: "power2.in" }, "land")
    fadeMats.forEach((m) => tl.to(m, { opacity: 0, duration: 1.0, ease: "power1.in" }, "land+=0.25"))
    tl.call(() => onLanded?.(this.card.position.clone()))
    tl.set(this.group, { visible: false })

    if (fast) tl.timeScale(8)
    return new Promise((resolve) => tl.eventCallback("onComplete", resolve))
  }

  dispose() {
    this.group.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => {
          m.map?.dispose()
          m.dispose()
        })
      }
    })
  }
}
