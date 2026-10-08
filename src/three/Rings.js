import * as THREE from "three"
import { palette, story, verse, schedule, ringLabels } from "../config.js"
import { photoAt } from "../photos.js"
import {
  storyPanel,
  versePanel,
  schedulePanel,
  bandTexture,
  innerBandTexture,
  PANEL_W,
  PANEL_H,
} from "./Panels.js"

export const RING_RADIUS = 7
const BAND_H = 3.8
const BAND_T = 0.18
export const PANEL_WORLD_H = 2.7
export const PANEL_WORLD_W = (PANEL_WORLD_H * PANEL_W) / PANEL_H
const SEGMENTS = 96
const TILT_A = -0.14
const TILT_B = 0.7

/**
 * Dos anillos de bronce caramelo entrelazados (como alianzas). Cada uno es una banda
 * abierta con paneles (foto + texto) colgando de su cara interior, como un
 * carrusel: la cámara entra por la abertura, se pone en el centro y el
 * invitado gira el anillo arrastrando.
 */
export class Rings {
  constructor(images) {
    this.group = new THREE.Group()
    this.assembly = new THREE.Group()
    this.group.add(this.assembly)
    this.rings = []
    this.disposables = []

    const storyPhotos = [
      photoAt(images, 0),
      [photoAt(images, 1), photoAt(images, 2)],
      photoAt(images, 3),
      photoAt(images, 4),
      photoAt(images, 5),
    ]
    const storyPanels = story.map((step, i) =>
      ({ texture: storyPanel(storyPhotos[i], step, i, story.length), title: step.title, text: step.text }),
    )
    const versePanels = [
      {
        texture: versePanel(photoAt(images, 11), verse),
        title: verse.reference,
        text: verse.parts.join(" "),
      },
    ]
    const schedulePhotoIndexes = [15, 16, 17, 14]
    const schedulePanels = schedule.map((row, i) => ({
      texture: schedulePanel(photoAt(images, schedulePhotoIndexes[i]), row, i, schedule.length),
      title: `${row.time} ${row.title}`,
      text: row.note || "",
    }))

    this.#addRing(-RING_RADIUS / 2, TILT_A, ringLabels.story, storyPanels)
    this.#addRing(RING_RADIUS / 2, TILT_B, ringLabels.promise, [...versePanels, ...schedulePanels])
    this.hitMeshes = this.rings.flatMap((r) => r.hit)
  }

  #addRing(x, tilt, label, panels) {
    const index = this.rings.length
    const group = new THREE.Group()
    group.position.x = x
    group.rotation.x = tilt
    this.assembly.add(group)

    const spin = new THREE.Group()
    group.add(spin)

    const outerTex = bandTexture(label)
    const innerTex = innerBandTexture()
    this.disposables.push(outerTex, innerTex)

    const outerMat = new THREE.MeshStandardMaterial({
      map: outerTex,
      metalness: 0.3,
      roughness: 0.3,
      emissive: palette.gold,
      emissiveMap: outerTex,
      emissiveIntensity: 0.18,
    })
    const innerMat = new THREE.MeshStandardMaterial({
      map: innerTex,
      metalness: 0.3,
      roughness: 0.34,
      emissive: palette.gold,
      emissiveMap: innerTex,
      emissiveIntensity: 0.22,
      side: THREE.BackSide,
    })
    const rimMat = new THREE.MeshStandardMaterial({
      color: palette.caramel,
      metalness: 0.35,
      roughness: 0.2,
      emissive: palette.mocha,
      emissiveIntensity: 0.3,
    })
    this.disposables.push(outerMat, innerMat, rimMat)

    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(RING_RADIUS + BAND_T, RING_RADIUS + BAND_T, BAND_H, SEGMENTS, 1, true),
      outerMat,
    )
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(RING_RADIUS, RING_RADIUS, BAND_H, SEGMENTS, 1, true),
      innerMat,
    )
    const rimGeo = new THREE.TorusGeometry(RING_RADIUS + BAND_T / 2, BAND_T / 2 + 0.02, 14, SEGMENTS)
    this.disposables.push(outer.geometry, inner.geometry, rimGeo)
    const rimTop = new THREE.Mesh(rimGeo, rimMat)
    const rimBottom = new THREE.Mesh(rimGeo, rimMat)
    rimTop.rotation.x = rimBottom.rotation.x = Math.PI / 2
    rimTop.position.y = BAND_H / 2
    rimBottom.position.y = -BAND_H / 2
    spin.add(outer, inner, rimTop, rimBottom)

    const n = panels.length
    const step = (Math.PI * 2) / n
    const planeGeo = new THREE.PlaneGeometry(PANEL_WORLD_W, PANEL_WORLD_H)
    this.disposables.push(planeGeo)
    panels.forEach((panel, k) => {
      const a = -k * step
      const mat = new THREE.MeshBasicMaterial({ map: panel.texture, toneMapped: false })
      this.disposables.push(mat, panel.texture)
      const mesh = new THREE.Mesh(planeGeo, mat)
      const r = RING_RADIUS - 0.1
      mesh.position.set(Math.sin(a) * r, 0, Math.cos(a) * r)
      mesh.rotation.y = a + Math.PI
      spin.add(mesh)
    })

    const ring = {
      index,
      group,
      spin,
      panels,
      step,
      angle: Math.random() * Math.PI * 2,
      target: 0,
      alpha: 0,
      hit: [outer, inner, rimTop, rimBottom],
    }
    ring.target = ring.angle
    for (const m of ring.hit) m.userData.ringIndex = index
    this.rings.push(ring)
  }

  setPortrait(portrait) {
    this.assembly.rotation.y = portrait ? Math.PI / 2 : 0
  }

  hitTest(raycaster) {
    const hit = raycaster.intersectObjects(this.hitMeshes, false)[0]
    return hit ? hit.object.userData.ringIndex : -1
  }

  labelAnchors(camera, width, height) {
    const v = new THREE.Vector3()
    const center = new THREE.Vector3()
    const axis = new THREE.Vector3()
    const toCam = new THREE.Vector3()
    return this.rings.map((ring) => {
      ring.group.updateWorldMatrix(true, false)
      ring.group.getWorldPosition(center)
      axis.set(0, 1, 0).transformDirection(ring.group.matrixWorld)
      toCam.copy(camera.position).sub(center)
      toCam.addScaledVector(axis, -toCam.dot(axis)).normalize()
      v.copy(center).addScaledVector(toCam, RING_RADIUS + BAND_T).addScaledVector(axis, BAND_H / 2)
      v.project(camera)
      return {
        x: ((v.x + 1) / 2) * width,
        y: ((1 - v.y) / 2) * height,
        visible: v.z < 1,
      }
    })
  }

  /**
   * Plan de entrada a un anillo: pasa por la abertura (sobre el eje), baja
   * hasta el centro y mira hacia la pared del lado por el que se llegó.
   * Devuelve la curva de posición y la orientación final de la cámara.
   */
  planEnter(index, fromPos, viewDistance) {
    const ring = this.rings[index]
    ring.group.updateWorldMatrix(true, false)
    const center = ring.group.getWorldPosition(new THREE.Vector3())
    const axis = new THREE.Vector3(0, 1, 0).transformDirection(ring.group.matrixWorld)

    const p = fromPos.clone().sub(center)
    p.addScaledVector(axis, -p.dot(axis))
    if (p.lengthSq() < 1e-4) p.set(1, 0, 0).addScaledVector(axis, -axis.x)
    p.normalize()

    const innerPos = center.clone().addScaledVector(p, RING_RADIUS - viewDistance)
    const entry = center.clone().addScaledVector(axis, BAND_H / 2 + 3.2)
    const look = center.clone().addScaledVector(p, RING_RADIUS)

    const m = new THREE.Matrix4().lookAt(innerPos, look, axis)
    const quat = new THREE.Quaternion().setFromRotationMatrix(m)

    // α: dirección de p en el marco local del anillo (para saber qué panel mira)
    const local = p.clone().transformDirection(new THREE.Matrix4().copy(ring.group.matrixWorld).invert())
    ring.alpha = Math.atan2(local.x, local.z)

    return {
      curve: new THREE.CatmullRomCurve3([fromPos.clone(), entry, innerPos], false, "centripetal"),
      quat,
      look,
    }
  }

  /** Gira el anillo para que el panel `k` quede frente a la cámara */
  showPanel(index, k, instant = true) {
    const ring = this.rings[index]
    const target = ring.alpha + k * ring.step
    ring.target = target
    if (instant) ring.angle = target
  }

  activeIndex(index) {
    const ring = this.rings[index]
    const n = ring.panels.length
    const k = Math.round((ring.target - ring.alpha) / ring.step)
    return ((k % n) + n) % n
  }

  panelInfo(index, k) {
    const ring = this.rings[index]
    return { ...ring.panels[k], count: ring.panels.length }
  }

  /** Arrastre: `dAngle` en radianes (positivo = el contenido va a la derecha) */
  drag(index, dAngle) {
    const ring = this.rings[index]
    ring.target -= dAngle
    const k = Math.round((ring.target - ring.alpha) / ring.step)
    ring.target = ring.alpha + Math.max(0, Math.min(ring.panels.length - 1, k)) * ring.step
    ring.angle = ring.target
  }

  /** Suelta el anillo en el panel más cercano (con un empujón de inercia) */
  settle(index, velocity = 0) {
    const ring = this.rings[index]
    const k = Math.round((ring.target - velocity * 0.18 - ring.alpha) / ring.step)
    const bounded = Math.max(0, Math.min(ring.panels.length - 1, k))
    ring.target = ring.alpha + bounded * ring.step
  }

  /** Avanza (+1) o retrocede (-1) un panel */
  stepPanel(index, dir) {
    const ring = this.rings[index]
    const k = Math.round((ring.target - ring.alpha) / ring.step) + dir
    const bounded = Math.max(0, Math.min(ring.panels.length - 1, k))
    ring.target = ring.alpha + bounded * ring.step
  }

  update(delta, inside) {
    this.rings.forEach((ring, i) => {
      if (inside === null) {
        // En reposo cada anillo gira despacio, en sentidos contrarios
        ring.target += delta * 0.1 * (i === 0 ? 1 : -1)
        ring.angle = ring.target
      } else {
        ring.angle += (ring.target - ring.angle) * (1 - Math.exp(-delta * 9))
      }
      ring.spin.rotation.y = ring.angle
    })
  }

  dispose() {
    for (const d of this.disposables) d.dispose()
  }
}
