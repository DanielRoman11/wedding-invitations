import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { palette } from "../config.js"
import { photoAt } from "../photos.js"
import { polaroidTexture } from "./Panels.js"

const FLOWERS = 26
const LAYERS = [
  // pétalos, radio (xz), altura (y), giro inicial, brillo del tono
  { n: 5, rad: 0.2, hgt: 1.0, turn: 0, shade: 0.78 },
  { n: 5, rad: 0.38, hgt: 0.92, turn: 0.55, shade: 0.86 },
  { n: 5, rad: 0.56, hgt: 0.8, turn: 1.1, shade: 0.94 },
  { n: 5, rad: 0.76, hgt: 0.66, turn: 1.7, shade: 1 },
  { n: 5, rad: 0.98, hgt: 0.52, turn: 2.3, shade: 1.05 },
]
const FLOWER_COLORS = [palette.blush, 0xf2c4a6, palette.cream, 0xd9b48f, 0xe9b8c4, 0xc9b6e0, palette.petal, 0xf7e3cf]
const POLAROIDS = 4
const WRAP_TOP = -0.3

/** Radio del cono de papel a la altura `y` (para ajustar el listón) */
const wrapRadius = (y) => THREE.MathUtils.lerp(0.2, 1.25, THREE.MathUtils.clamp((y + 2.15) / (WRAP_TOP + 2.15), 0, 1) ** 0.9)

/**
 * Pétalo de rosa: un tramo ancho de una copa (superficie de revolución) con
 * el borde superior curvo y la boca abierta hacia afuera. Cinco por capa
 * forman un anillo; las capas anidadas dan la roseta. Los colores de vértice
 * oscurecen la base (oclusión falsa, sin envmap).
 */
function petalGeometry() {
  const geo = new THREE.PlaneGeometry(2, 1, 6, 5)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const SPAN = 0.78
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) // -1..1
    const v = pos.getY(i) + 0.5 // 0..1
    const ang = u * SPAN
    const r = 0.5 + 0.55 * v ** 1.7
    const y = v * (1 - 0.34 * u * u)
    pos.setXYZ(i, Math.sin(ang) * r, y, Math.cos(ang) * r)
    const edge = 1 - 0.14 * Math.max(0, Math.abs(u) - 0.8) / 0.2 * v
    const c = (0.58 + 0.42 * v) * edge
    colors.set([c, c, c], i * 3)
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

/** Hoja: elipse puntiaguda con degradado de base a punta */
function leafGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.36, 0.1, 0.34, 0.45, 0, 0.8)
  s.bezierCurveTo(-0.34, 0.45, -0.36, 0.1, 0, 0)
  const geo = new THREE.ShapeGeometry(s, 8)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    // Nervadura central hundida y punta caída
    pos.setZ(i, Math.abs(x) * 0.9 - y * y * 0.22)
    const c = 0.55 + 0.45 * Math.min(1, y / 0.8)
    colors.set([c, c, c], i * 3)
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

/** Lazo: una gota de listón que se abre desde el nudo */
function loopGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.2, 0.42, 0.75, 0.5, 0.78, 0.1)
  s.bezierCurveTo(0.8, -0.28, 0.25, -0.4, 0, 0)
  const geo = new THREE.ShapeGeometry(s, 8)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / 0.8) * Math.PI) * 0.12)
  geo.computeVertexNormals()
  return geo
}

/**
 * Ramo de novia: rosas en cúpula (cada una son capas de pétalos, todas en un
 * solo InstancedMesh), florecillas de relleno, hojas, envoltorio de papel,
 * listón mocha con lazo y polaroids con fotos que giran a su alrededor.
 */
export class Bouquet {
  constructor(images) {
    this.group = new THREE.Group() // posición/escala en la escena
    this.body = new THREE.Group() // gira con el arrastre
    this.group.add(this.body)
    this.spin = { angle: 0, velocity: 0, dragging: false }
    this.polaroids = []
    this.disposables = []

    this.#buildFlowers()
    this.#buildFiller()
    this.#buildLeaves()
    this.#buildWrap()
    this.#buildPolaroids(images)
    this.#buildPickTarget()
  }

  /** Malla invisible y barata para el raycast (esfera de la cúpula y cono) */
  #buildPickTarget() {
    const mat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    const dome = new THREE.SphereGeometry(1.6, 10, 8)
    dome.translate(0, 0.2, 0)
    const cone = new THREE.CylinderGeometry(1.3, 0.2, 2.2, 10, 1, true)
    cone.translate(0, -1.4, 0)
    const merged = mergeGeometries([dome, cone])
    this.pickTarget = new THREE.Mesh(merged, mat)
    this.group.add(this.pickTarget)
    this.disposables.push(mat, dome, cone, merged)
  }

  #buildFlowers() {
    const geo = petalGeometry()
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      side: THREE.DoubleSide,
      vertexColors: true,
      emissive: 0xd07888,
      emissiveIntensity: 0.3,
    })
    this.disposables.push(geo, mat)

    const perFlower = LAYERS.reduce((n, l) => n + l.n, 0)
    const mesh = new THREE.InstancedMesh(geo, mat, FLOWERS * perFlower)
    mesh.frustumCulled = false

    const m = new THREE.Matrix4()
    const flower = new THREE.Matrix4()
    const rot = new THREE.Matrix4()
    const sc = new THREE.Matrix4()
    const color = new THREE.Color()
    const up = new THREE.Vector3(0, 1, 0)
    const q = new THREE.Quaternion()
    const normal = new THREE.Vector3()
    const pos = new THREE.Vector3()
    const dome = 1.45
    let i = 0

    for (let f = 0; f < FLOWERS; f++) {
      // Cúpula en espiral áurea: la primera queda arriba y el resto la rodean
      const t = (f + 0.5) / FLOWERS
      const phi = Math.acos(1 - Math.sqrt(t) * 0.86) // 0 .. ~82° desde el eje
      const theta = f * 2.39996
      normal.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta))
      const size = THREE.MathUtils.lerp(0.58, 0.46, t) * THREE.MathUtils.randFloat(0.94, 1.06)
      q.setFromUnitVectors(up, normal)
      pos.copy(normal).multiplyScalar(dome)
      pos.y -= 0.45
      flower.compose(pos, q, new THREE.Vector3(size, size, size))

      const base = new THREE.Color(FLOWER_COLORS[(f * 5) % FLOWER_COLORS.length])
      LAYERS.forEach((layer) => {
        for (let p = 0; p < layer.n; p++) {
          // Cada capa gira respecto a la anterior para que los pétalos se solapen en espiral
          const a = (p / layer.n) * Math.PI * 2 + layer.turn + f * 0.7
          rot.makeRotationY(a)
          sc.makeScale(layer.rad, layer.hgt, layer.rad)
          m.copy(flower).multiply(rot).multiply(sc)
          mesh.setMatrixAt(i, m)
          // Pétalos del centro más intensos, los de afuera más claros
          color.copy(base).multiplyScalar(layer.shade)
          mesh.setColorAt(i, color)
          i++
        }
      })
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor.needsUpdate = true
    this.body.add(mesh)
  }

  /** Florecillas blancas y de agua entre las rosas (un solo InstancedMesh) */
  #buildFiller() {
    const geo = new THREE.IcosahedronGeometry(0.045, 0)
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x8a7a5a, emissiveIntensity: 0.15 })
    this.disposables.push(geo, mat)
    const count = 90
    const mesh = new THREE.InstancedMesh(geo, mat, count)
    mesh.frustumCulled = false
    const m = new THREE.Matrix4()
    const color = new THREE.Color()
    const tints = [palette.ivory, 0xe3d6f0, palette.cream, 0xf3d9e0]
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - Math.random() * 0.97)
      const theta = Math.random() * Math.PI * 2
      const r = 1.7 + Math.random() * 0.3
      const s = THREE.MathUtils.randFloat(0.7, 1.5)
      m.compose(
        new THREE.Vector3(Math.sin(phi) * Math.cos(theta) * r, Math.cos(phi) * r - 0.45, Math.sin(phi) * Math.sin(theta) * r),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0)),
        new THREE.Vector3(s, s, s),
      )
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, color.set(tints[i % tints.length]))
    }
    this.body.add(mesh)
  }

  #buildLeaves() {
    const geo = leafGeometry()
    const mat = new THREE.MeshStandardMaterial({
      color: 0x78a05f,
      roughness: 0.55,
      side: THREE.DoubleSide,
      vertexColors: true,
      emissive: 0x3a5a2a,
      emissiveIntensity: 0.15,
    })
    this.disposables.push(geo, mat)

    const count = 20
    const mesh = new THREE.InstancedMesh(geo, mat, count)
    mesh.frustumCulled = false
    const m = new THREE.Matrix4()
    const e = new THREE.Euler()
    const q = new THREE.Quaternion()
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (i % 2) * 0.17
      const outer = i % 2 === 0
      // Elevación sobre la horizontal: las exteriores caen, las interiores se alzan
      e.set(Math.PI / 2 - (outer ? 0.2 : 0.7), a, 0, "YXZ")
      q.setFromEuler(e)
      const s = outer ? THREE.MathUtils.randFloat(1.1, 1.4) : THREE.MathUtils.randFloat(0.95, 1.2)
      const rad = outer ? 1.05 : 0.8
      m.compose(new THREE.Vector3(Math.sin(a) * rad, WRAP_TOP + (outer ? 0.0 : 0.12), Math.cos(a) * rad), q, new THREE.Vector3(s, s, s))
      mesh.setMatrixAt(i, m)
    }
    this.body.add(mesh)
  }

  #buildWrap() {
    // Envoltorio: cono de papel con borde ondulado, y una capa de papel de seda rosado detrás
    const cone = (rTop, yTop, ruffle) => {
      const pts = []
      for (let k = 0; k <= 10; k++) {
        const y = THREE.MathUtils.lerp(-2.15, yTop, k / 10)
        pts.push(new THREE.Vector2(wrapRadius(y) * (rTop / 1.25), y))
      }
      const geo = new THREE.LatheGeometry(pts, 40)
      const pos = geo.attributes.position
      for (let k = 0; k < pos.count; k++) {
        const x = pos.getX(k)
        const y = pos.getY(k)
        const z = pos.getZ(k)
        const w = THREE.MathUtils.smoothstep(y, yTop - 0.6, yTop)
        const ang = Math.atan2(z, x)
        const f = 1 + Math.sin(ang * 6) * ruffle * w
        pos.setXYZ(k, x * f, y + Math.sin(ang * 6 + 1.3) * 0.07 * w * (ruffle / 0.06), z * f)
      }
      geo.computeVertexNormals()
      return geo
    }
    const paperMat = new THREE.MeshStandardMaterial({
      color: 0xd2ac7e,
      roughness: 0.85,
      side: THREE.DoubleSide,
      emissive: 0x6b4a36,
      emissiveIntensity: 0.12,
    })
    const tissueMat = new THREE.MeshStandardMaterial({
      color: 0xf0d6cc,
      roughness: 0.9,
      side: THREE.DoubleSide,
      emissive: 0x7a5048,
      emissiveIntensity: 0.12,
    })
    const paperGeo = cone(1.25, WRAP_TOP - 0.05, 0.05)
    const tissueGeo = cone(1.4, WRAP_TOP + 0.1, 0.09)
    const wrap = new THREE.Mesh(paperGeo, paperMat)
    const tissue = new THREE.Mesh(tissueGeo, tissueMat)
    tissue.rotation.y = 0.4

    // Tallos asomando por abajo
    const stemMat = new THREE.MeshStandardMaterial({ color: palette.grassDeep, roughness: 0.7, emissive: 0x2a3a1e, emissiveIntensity: 0.15 })
    const stemGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.9, 12)
    const stems = new THREE.Mesh(stemGeo, stemMat)
    stems.position.y = -2.6

    // Listón mocha con nudo, lazo y colas
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: palette.mocha,
      roughness: 0.4,
      metalness: 0.1,
      emissive: palette.mocha,
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
    })
    const by = -1.6
    const br = wrapRadius(by)
    const ribbonGeo = new THREE.CylinderGeometry(br + 0.08, br - 0.01, 0.3, 32, 1, true)
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat)
    ribbon.position.y = by
    const loopGeo = loopGeometry()
    const bowZ = br + 0.08
    const loopR = new THREE.Mesh(loopGeo, ribbonMat)
    const loopL = new THREE.Mesh(loopGeo, ribbonMat)
    loopR.position.set(0.03, by, bowZ)
    loopR.scale.setScalar(0.7)
    loopL.scale.setScalar(0.7)
    loopL.position.set(-0.03, by, bowZ)
    loopR.rotation.z = 0.28
    loopL.rotation.set(0, Math.PI, -0.28)
    const knotGeo = new THREE.SphereGeometry(0.11, 12, 10)
    const knot = new THREE.Mesh(knotGeo, ribbonMat)
    knot.position.set(0, by, bowZ + 0.03)
    const tailGeo = new THREE.PlaneGeometry(0.17, 0.85, 1, 4)
    const tp = tailGeo.attributes.position
    for (let k = 0; k < tp.count; k++) tp.setZ(k, Math.sin(tp.getY(k) * 4) * 0.04)
    tailGeo.translate(0, -0.42, 0)
    tailGeo.computeVertexNormals()
    const tailL = new THREE.Mesh(tailGeo, ribbonMat)
    const tailR = new THREE.Mesh(tailGeo, ribbonMat)
    tailL.position.set(-0.04, by - 0.02, bowZ)
    tailR.position.set(0.04, by - 0.02, bowZ)
    tailL.rotation.z = -0.22
    tailR.rotation.z = 0.2

    this.body.add(tissue, wrap, stems, ribbon, loopL, loopR, knot, tailL, tailR)
    this.disposables.push(paperMat, tissueMat, paperGeo, tissueGeo, stemMat, stemGeo, ribbonMat, ribbonGeo, loopGeo, knotGeo, tailGeo)
  }

  #buildPolaroids(images) {
    const geo = new THREE.PlaneGeometry(1, 1.17)
    this.disposables.push(geo)
    for (let i = 0; i < POLAROIDS; i++) {
      const tex = polaroidTexture(photoAt(images, 10 + i))
      const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide })
      this.disposables.push(tex, mat)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.userData = { phase: (i / POLAROIDS) * Math.PI * 2, y: -0.6 + (i % 2) * 1.6 }
      this.group.add(mesh)
      this.polaroids.push(mesh)
    }
  }

  /** Arrastre horizontal: `dAngle` en radianes */
  drag(dAngle) {
    this.spin.angle += dAngle
    this.spin.velocity = dAngle
    this.spin.dragging = true
  }

  release() {
    this.spin.dragging = false
  }

  update(elapsed, delta, still) {
    const s = this.spin
    if (!s.dragging) {
      s.angle += s.velocity
      s.velocity *= Math.exp(-delta * 3)
      if (!still) s.angle += delta * 0.25
    }
    this.body.rotation.y = s.angle
    this.body.rotation.z = still ? 0 : Math.sin(elapsed * 0.6) * 0.03

    // Las polaroids orbitan despacio y siempre dan la cara
    for (const p of this.polaroids) {
      const { phase, y } = p.userData
      const a = phase + (still ? 0 : elapsed * 0.22)
      p.position.set(Math.sin(a) * 2.9, y + (still ? 0 : Math.sin(elapsed * 0.8 + phase) * 0.08), Math.cos(a) * 2.9)
      p.rotation.set(0, a, Math.sin(phase) * 0.1)
      const s2 = 0.72
      p.scale.setScalar(s2)
    }
  }

  dispose() {
    for (const d of this.disposables) d.dispose()
  }
}
