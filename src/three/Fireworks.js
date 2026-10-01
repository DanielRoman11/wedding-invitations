import * as THREE from "three"
import { palette } from "../config.js"

/** Colores de apoyo que se mezclan con el del disparo */
const CONFETTI = [palette.blush, palette.caramel, palette.ivory, palette.sage, 0xb9a5d6]

/**
 * Estallido de confeti y pétalos de celebración (al confirmar asistencia).
 * Un único buffer circular de partículas con color propio; cada
 * `launch` dispara una esfera de confeti que cae con gravedad.
 * Mezcla normal: de día los destellos aditivos se borran.
 */
export class Fireworks {
  constructor() {
    this.max = 1200
    this.cursor = 0
    this.positions = new Float32Array(this.max * 3)
    this.colors = new Float32Array(this.max * 3)
    this.lifes = new Float32Array(this.max)
    this.velocities = new Float32Array(this.max * 3)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3))
    geo.setAttribute("aColor", new THREE.BufferAttribute(this.colors, 3))
    geo.setAttribute("aLife", new THREE.BufferAttribute(this.lifes, 1))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      // Mezcla normal: sobre el cielo claro las chispas sumadas se borrarían
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aLife;
        varying vec3 vColor;
        varying float vLife;
        void main() {
          vColor = aColor;
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (2.2 + 3.6 * aLife) * (110.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vLife;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          // Confeti con borde duro y un borde más oscuro para leerse sobre crema
          float a = smoothstep(0.5, 0.38, d) * clamp(vLife * 1.5, 0.0, 1.0);
          float edge = smoothstep(0.3, 0.46, d);
          gl_FragColor = vec4(mix(vColor, vColor * 0.78, edge), a);
        }
      `,
    })

    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    this.points.visible = false
    this.active = false
  }

  /** Una explosión en `origin` (mundo) del color hex dado */
  launch(origin, hex, count = 80) {
    const color = new THREE.Color(hex)
    const dir = new THREE.Vector3()
    for (let n = 0; n < count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % this.max

      dir.set(
        THREE.MathUtils.randFloatSpread(2),
        THREE.MathUtils.randFloatSpread(2),
        THREE.MathUtils.randFloatSpread(2),
      ).normalize()
      const speed = THREE.MathUtils.randFloat(2.2, 5.2)

      this.positions.set([origin.x, origin.y, origin.z], i * 3)
      this.velocities.set([dir.x * speed, dir.y * speed, dir.z * speed], i * 3)
      // Mayoría del color del disparo; el resto, confeti de la paleta cálida
      const tint = Math.random() < 0.55 ? color : new THREE.Color(CONFETTI[(Math.random() * CONFETTI.length) | 0])
      this.colors.set([tint.r, tint.g, tint.b], i * 3)
      this.lifes[i] = THREE.MathUtils.randFloat(0.8, 1.1)
    }
    this.active = true
    this.points.visible = true
  }

  update(delta) {
    if (!this.active) return
    let alive = false
    for (let i = 0; i < this.max; i++) {
      if (this.lifes[i] <= 0) continue
      alive = true
      this.lifes[i] -= delta * 0.4
      const k = i * 3
      this.velocities[k] *= 1 - delta * 0.9
      this.velocities[k + 1] = this.velocities[k + 1] * (1 - delta * 0.9) - 4.2 * delta
      this.velocities[k + 2] *= 1 - delta * 0.9
      this.positions[k] += this.velocities[k] * delta
      this.positions[k + 1] += this.velocities[k + 1] * delta
      this.positions[k + 2] += this.velocities[k + 2] * delta
      if (this.lifes[i] < 0) this.lifes[i] = 0
    }
    const geo = this.points.geometry
    geo.attributes.position.needsUpdate = true
    geo.attributes.aLife.needsUpdate = true
    geo.attributes.aColor.needsUpdate = true
    if (!alive) {
      this.active = false
      this.points.visible = false
    }
  }

  dispose() {
    this.points.geometry.dispose()
    this.points.material.dispose()
  }
}
