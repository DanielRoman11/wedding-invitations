import * as THREE from "three"
import { palette } from "../config.js"

/**
 * Pétalos de rosa cayendo con vaivén, usando InstancedMesh
 * (una sola draw call). Se reciclan al llegar al suelo.
 */
/** Textura canvas con forma de pétalo (transparente por fuera) */
function createPetalTexture() {
  const s = 64
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = s
  const ctx = canvas.getContext("2d")

  const grad = ctx.createRadialGradient(s * 0.5, s * 0.62, 4, s * 0.5, s * 0.5, s * 0.52)
  grad.addColorStop(0, "#ffffff")
  grad.addColorStop(0.6, "#f4ece4")
  grad.addColorStop(1, "#dcc9bb")

  // Forma de pétalo: punta arriba, redondeado abajo
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(s * 0.5, s * 0.06)
  ctx.bezierCurveTo(s * 0.86, s * 0.3, s * 0.92, s * 0.62, s * 0.68, s * 0.86)
  ctx.bezierCurveTo(s * 0.56, s * 0.97, s * 0.44, s * 0.97, s * 0.32, s * 0.86)
  ctx.bezierCurveTo(s * 0.08, s * 0.62, s * 0.14, s * 0.3, s * 0.5, s * 0.06)
  ctx.closePath()
  ctx.fill()

  // Nervadura
  ctx.strokeStyle = "rgba(255,255,255,0.45)"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(s * 0.5, s * 0.12)
  ctx.quadraticCurveTo(s * 0.52, s * 0.5, s * 0.5, s * 0.88)
  ctx.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Variedad de color dentro de la gama del tema (cafés, durazno, crema y salvia)
const PETAL_COLORS = [
  palette.petal,
  palette.blush,
  palette.caramel,
  palette.ivory,
  palette.latte,
  palette.sage,
  palette.gold,
  palette.blush,
  palette.cream,
  palette.petal,
]

export class Petals {
  constructor(count = 90) {
    this.count = count
    const geo = new THREE.PlaneGeometry(0.17, 0.145, 3, 2)
    // Curvatura suave del pétalo
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      pos.setZ(i, Math.sin((x / 0.17) * Math.PI) * 0.02 - y * y * 0.4)
    }
    geo.computeVertexNormals()

    // Material básico con alfa: pétalos luminosos con forma real
    const mat = new THREE.MeshBasicMaterial({
      map: createPetalTexture(),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })

    this.mesh = new THREE.InstancedMesh(geo, mat, count)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false

    // Tinte por instancia: durazno, blush y crema, con leve variación de luz
    if (count > 0) {
      // La textura es casi blanca y el color de la gama la tiñe
      const tones = PETAL_COLORS
      const color = new THREE.Color()
      for (let i = 0; i < count; i++) {
        color.setHex(tones[i % tones.length]).offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.08)
        this.mesh.setColorAt(i, color)
      }
      this.mesh.instanceColor.needsUpdate = true
    }

    // Los pétalos viven alrededor de la cámara: si ella viaja, se reciclan
    this.center = new THREE.Vector3(0, 0.25, 9)
    this.data = []
    for (let i = 0; i < count; i++) {
      this.data.push(this.#spawn(true))
    }

    this._dummy = new THREE.Object3D()
    this._view = new THREE.Vector3()
    this._right = new THREE.Vector3()
    this._up = new THREE.Vector3()
  }

  /** Base de la cámara (derecha y arriba en el mundo) para empujar en pantalla */
  #cameraBasis(camera) {
    camera.updateMatrixWorld()
    const e = camera.matrixWorld.elements
    this._right.set(e[0], e[1], e[2])
    this._up.set(e[4], e[5], e[6])
    return Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  }

  /** Posición de un pétalo en coordenadas de pantalla (-1..1) y su profundidad */
  #toScreen(p, camera, tanH, out) {
    this._view.set(p.x + p.ox, p.y + p.oy, p.z + p.oz).applyMatrix4(camera.matrixWorldInverse)
    const depth = -this._view.z
    if (depth < 0.1) return false
    out.x = this._view.x / (depth * tanH * camera.aspect)
    out.y = this._view.y / (depth * tanH)
    return true
  }

  /**
   * Ráfaga: todos los pétalos cercanos a un punto de pantalla salen
   * despedidos y en remolino. `strength` ~ 1 para un toque normal.
   */
  gust(ndcX, ndcY, camera, strength = 1) {
    const tanH = this.#cameraBasis(camera)
    const at = { x: 0, y: 0 }
    const reach = 1.1
    for (const p of this.data) {
      if (!this.#toScreen(p, camera, tanH, at)) continue
      const dx = (at.x - ndcX) * camera.aspect
      const dy = at.y - ndcY
      const d = Math.hypot(dx, dy) || 0.001
      if (d > reach) continue
      const f = (1 - d / reach) ** 1.5 * strength
      const swirl = THREE.MathUtils.randFloat(-0.8, 0.8)
      const px = dx / d - (dy / d) * swirl
      const py = dy / d + (dx / d) * swirl + 0.45
      p.vx += (this._right.x * px + this._up.x * py) * f * 9
      p.vy += (this._right.y * px + this._up.y * py) * f * 9
      p.vz += (this._right.z * px + this._up.z * py) * f * 9
    }
  }

  #spawn(anywhere = false) {
    return {
      ox: 0,
      oy: 0,
      oz: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      x: this.center.x + THREE.MathUtils.randFloatSpread(22),
      y:
        this.center.y +
        (anywhere ? THREE.MathUtils.randFloat(-5, 8) : THREE.MathUtils.randFloat(6, 9)),
      // Siempre al frente de la cámara, nunca pegados a ella
      z: this.center.z - THREE.MathUtils.randFloat(8, 30),
      fallSpeed: THREE.MathUtils.randFloat(0.35, 0.8),
      swayAmp: THREE.MathUtils.randFloat(0.3, 0.9),
      swayFreq: THREE.MathUtils.randFloat(0.5, 1.2),
      phase: Math.random() * Math.PI * 2,
      rotSpeed: new THREE.Vector3(
        THREE.MathUtils.randFloat(-1.4, 1.4),
        THREE.MathUtils.randFloat(-1.4, 1.4),
        THREE.MathUtils.randFloat(-1.4, 1.4),
      ),
      scale: THREE.MathUtils.randFloat(0.7, 1.35),
    }
  }

  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {{x:number,y:number}|null} pointer puntero en pantalla (-1..1) o null
   */
  update(elapsed, delta, camera, pointer) {
    if (camera) this.center.copy(camera.position)
    const d = this._dummy
    const damp = Math.exp(-1.7 * delta)
    const reach = 0.3
    let tanH = 0
    const at = { x: 0, y: 0 }
    if (camera && pointer) tanH = this.#cameraBasis(camera)

    for (let i = 0; i < this.count; i++) {
      const p = this.data[i]
      p.y -= p.fallSpeed * delta
      const dz = this.center.z - (p.z + p.oz)
      if (p.y + p.oy < this.center.y - 7 || dz < 4 || dz > 36) {
        Object.assign(p, this.#spawn(dz < 4 || dz > 36))
      }

      // El puntero aparta los pétalos que tiene cerca
      if (tanH && this.#toScreen(p, camera, tanH, at)) {
        const dx = (at.x - pointer.x) * camera.aspect
        const dy = at.y - pointer.y
        const dist = Math.hypot(dx, dy)
        if (dist < reach) {
          const push = (1 - dist / reach) ** 2 * 30 * delta
          const px = dx / (dist || 1)
          const py = dy / (dist || 1)
          p.vx += (this._right.x * px + this._up.x * py) * push
          p.vy += (this._right.y * px + this._up.y * py) * push
          p.vz += (this._right.z * px + this._up.z * py) * push
        }
      }
      p.ox += p.vx * delta
      p.oy += p.vy * delta
      p.oz += p.vz * delta
      p.vx *= damp
      p.vy *= damp
      p.vz *= damp

      d.position.set(
        p.x + p.ox + Math.sin(elapsed * p.swayFreq + p.phase) * p.swayAmp,
        p.y + p.oy,
        p.z + p.oz + Math.cos(elapsed * p.swayFreq * 0.8 + p.phase) * p.swayAmp * 0.4,
      )
      d.rotation.set(
        elapsed * p.rotSpeed.x + p.phase,
        elapsed * p.rotSpeed.y,
        elapsed * p.rotSpeed.z,
      )
      d.scale.setScalar(p.scale)
      d.updateMatrix()
      this.mesh.setMatrixAt(i, d.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  set visible(v) {
    this.mesh.visible = v
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}

/**
 * Motas de luz flotando alrededor de la cámara: el aire de la escena de día,
 * con parpadeo por fase. Brillo animado con un shader mínimo de tamaño/atenuación.
 * Sobre fondo claro van con mezcla normal y crema dorado: si además sumaran luz,
 * desaparecerían contra el cielo crema.
 */
export class LightMotes {
  constructor(count = 260) {
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Cúpula alrededor de la escena
      const r = THREE.MathUtils.randFloat(24, 46)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(THREE.MathUtils.randFloat(-0.15, 1))
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) - 2
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      phases[i] = Math.random() * Math.PI * 2
      sizes[i] = THREE.MathUtils.randFloat(1.2, 4.2)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1))
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float twinkle = 0.4 + 0.6 * sin(uTime * 1.4 + aPhase);
          vAlpha = twinkle;
          gl_PointSize = aSize * twinkle * (120.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float a = smoothstep(0.5, 0.0, d) * vAlpha * 0.9;
          gl_FragColor = vec4(1.0, 0.93, 0.78, a);
        }
      `,
    })

    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
  }

  update(elapsed) {
    this.points.material.uniforms.uTime.value = elapsed
  }

  dispose() {
    this.points.geometry.dispose()
    this.points.material.dispose()
  }
}

/**
 * Estallido de destellos dorados (el sello de cera al romperse).
 * Partículas puntuales con gravedad y vida corta. Sobre el cielo crema
 * van con mezcla normal: sumadas se perderían contra el fondo claro.
 */
export class SparkleBurst {
  constructor() {
    this.max = 140
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.max * 3), 3))
    geo.setAttribute("aLife", new THREE.BufferAttribute(new Float32Array(this.max), 1))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute float aLife;
        varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp((3.5 + 5.0 * aLife) * (120.0 / -mv.z), 3.0, 36.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vLife;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float star = smoothstep(0.5, 0.0, d);
          // Cruz brillante
          star += smoothstep(0.05, 0.0, abs(uv.x)) * smoothstep(0.5, 0.0, abs(uv.y)) * 0.6;
          star += smoothstep(0.05, 0.0, abs(uv.y)) * smoothstep(0.5, 0.0, abs(uv.x)) * 0.6;
          float a = clamp(star, 0.0, 1.0) * vLife;
          // Halo caramelo con núcleo marfil: se lee sobre fondo claro
          float halo = smoothstep(0.5, 0.1, d) * 0.45 * vLife;
          vec3 core = mix(vec3(0.75, 0.5, 0.24), vec3(1.0, 0.97, 0.88), smoothstep(0.35, 0.0, d));
          gl_FragColor = vec4(core, clamp(a + halo, 0.0, 1.0));
        }
      `,
    })

    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    this.points.visible = false

    this.velocities = new Float32Array(this.max * 3)
    this.lifes = new Float32Array(this.max)
    this.active = false
  }

  burst(worldPos) {
    const pos = this.points.geometry.attributes.position
    for (let i = 0; i < this.max; i++) {
      pos.setXYZ(i, worldPos.x, worldPos.y, worldPos.z)
      const dir = new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(2),
        THREE.MathUtils.randFloatSpread(2),
        THREE.MathUtils.randFloatSpread(2),
      ).normalize()
      const speed = THREE.MathUtils.randFloat(1.2, 3.4)
      this.velocities[i * 3] = dir.x * speed
      this.velocities[i * 3 + 1] = dir.y * speed
      this.velocities[i * 3 + 2] = dir.z * speed
      this.lifes[i] = THREE.MathUtils.randFloat(0.7, 1)
    }
    pos.needsUpdate = true
    this.active = true
    this.points.visible = true
  }

  update(delta) {
    if (!this.active) return
    const pos = this.points.geometry.attributes.position
    const life = this.points.geometry.attributes.aLife
    let anyAlive = false
    for (let i = 0; i < this.max; i++) {
      if (this.lifes[i] <= 0) {
        life.setX(i, 0)
        continue
      }
      anyAlive = true
      this.lifes[i] -= delta * 0.9
      this.velocities[i * 3 + 1] -= 2.4 * delta // gravedad
      pos.setXYZ(
        i,
        pos.getX(i) + this.velocities[i * 3] * delta,
        pos.getY(i) + this.velocities[i * 3 + 1] * delta,
        pos.getZ(i) + this.velocities[i * 3 + 2] * delta,
      )
      life.setX(i, Math.max(this.lifes[i], 0))
    }
    pos.needsUpdate = true
    life.needsUpdate = true
    if (!anyAlive) {
      this.active = false
      this.points.visible = false
    }
  }

  dispose() {
    this.points.geometry.dispose()
    this.points.material.dispose()
  }
}

/**
 * Polen dorado y motas marfil en suspensión, con mezcla normal para verse sobre fondo claro. Las partículas están fijas en el mundo y se
 * repiten en una caja que envuelve a la cámara: al viajar, el paralaje
 * transmite velocidad y profundidad sin importar qué tan lejos llegue.
 */
export class Dust {
  constructor(count = 520, size = new THREE.Vector3(34, 18, 60)) {
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = Math.random() * size.x
      positions[i * 3 + 1] = Math.random() * size.y
      positions[i * 3 + 2] = Math.random() * size.z
      phases[i] = Math.random() * Math.PI * 2
      sizes[i] = THREE.MathUtils.randFloat(0.8, 2.4)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1))
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uSize: { value: size.clone() },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aSize;
        uniform vec3 uCam;
        uniform vec3 uSize;
        uniform float uTime;
        varying float vAlpha;
        varying float vTone;
        void main() {
          vTone = fract(aPhase * 0.37);
          vec3 p = position;
          p.y += sin(uTime * 0.25 + aPhase) * 0.4;
          p.x += cos(uTime * 0.2 + aPhase * 1.7) * 0.3;
          vec3 rel = mod(p - uCam + uSize * 0.5, uSize) - uSize * 0.5;
          // La caja se adelanta a la cámara: hay más polvo por delante
          rel.z -= uSize.z * 0.22;
          float edge = max(abs(rel.x) / uSize.x, max(abs(rel.y) / uSize.y, abs(rel.z + uSize.z * 0.22) / uSize.z));
          float fade = (1.0 - smoothstep(0.38, 0.5, edge)) * smoothstep(1.2, 4.0, length(rel));
          float twinkle = 0.6 + 0.4 * sin(uTime * 1.1 + aPhase * 3.0);
          vAlpha = fade * twinkle;
          vec4 mv = modelViewMatrix * vec4(uCam + rel, 1.0);
          gl_PointSize = clamp(aSize * (110.0 / -mv.z), 1.5, 9.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying float vTone;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.15, d) * vAlpha * 0.85;
          // Polen: caramelo dorado y motas marfil
          vec3 col = mix(vec3(0.85, 0.62, 0.3), vec3(1.0, 0.97, 0.88), step(0.55, vTone));
          gl_FragColor = vec4(col, a);
        }
      `,
    })

    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
  }

  update(elapsed, cameraPosition) {
    this.points.material.uniforms.uTime.value = elapsed
    this.points.material.uniforms.uCam.value.copy(cameraPosition)
  }

  dispose() {
    this.points.geometry.dispose()
    this.points.material.dispose()
  }
}
