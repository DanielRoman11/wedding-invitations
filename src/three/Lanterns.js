import * as THREE from "three"
import gsap from "gsap"

/** Farol de papel de día, caramelo y crema con halo suave, dibujado en canvas */
function createLanternTexture() {
  const w = 128
  const h = 160
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")

  // Halo
  const halo = ctx.createRadialGradient(64, 88, 6, 64, 88, 64)
  halo.addColorStop(0, "rgba(233,184,150,0.35)")
  halo.addColorStop(1, "rgba(233,184,150,0)")
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, w, h)

  // Cuerda
  ctx.strokeStyle = "rgba(107,74,54,0.85)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(64, 14)
  ctx.lineTo(64, 38)
  ctx.stroke()

  // Cuerpo abombado
  const body = new Path2D()
  body.moveTo(46, 42)
  body.lineTo(82, 42)
  body.bezierCurveTo(100, 62, 100, 110, 82, 128)
  body.lineTo(46, 128)
  body.bezierCurveTo(28, 110, 28, 62, 46, 42)
  body.closePath()

  const fill = ctx.createLinearGradient(0, 42, 0, 128)
  fill.addColorStop(0, "#fff8ec")
  fill.addColorStop(0.55, "#f0c9a2")
  fill.addColorStop(1, "#c98f62")
  ctx.fillStyle = fill
  ctx.fill(body)

  // Luz interior
  const glow = ctx.createRadialGradient(64, 88, 2, 64, 88, 34)
  glow.addColorStop(0, "rgba(255,250,238,0.95)")
  glow.addColorStop(1, "rgba(255,236,208,0)")
  ctx.fillStyle = glow
  ctx.fill(body)

  // Costillas del papel
  ctx.save()
  ctx.clip(body)
  ctx.strokeStyle = "rgba(107,74,54,0.28)"
  ctx.lineWidth = 1.2
  for (const x of [50, 64, 78]) {
    ctx.beginPath()
    ctx.moveTo(x, 42)
    ctx.quadraticCurveTo(x + (x - 64) * 0.7, 85, x, 128)
    ctx.stroke()
  }
  ctx.restore()

  // Tapas doradas
  ctx.fillStyle = "#8a5a3c"
  ctx.fillRect(44, 38, 40, 6)
  ctx.fillRect(44, 126, 40, 6)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * Faroles de los deseos. Cada deseo de un invitado es un farol que
 * flota alrededor del anillo; al tocarlo se lee el mensaje.
 */
export class Lanterns {
  constructor() {
    this.group = new THREE.Group()
    this.group.visible = false
    this.items = []
    this.ambient = [] // faroles decorativos: dan vida al cielo aunque haya pocos deseos
    this.radius = 6
    this.texture = createLanternTexture()
  }

  setRadius(r) {
    this.radius = r
  }

  /** Posición de reposo del farol número i: espiral dorada, sin choques */
  #slot(i) {
    const angle = i * 2.39996323
    const t = (i * 0.6180339) % 1
    const r = this.radius * (0.3 + 0.62 * t)
    const y = 2.7 + ((i * 0.381966) % 1) * 2.3
    // z relativa al grupo: siempre entre -13 y -1, nunca delante de la carta
    return new THREE.Vector3(Math.cos(angle) * r, y, -7 + Math.sin(angle) * r * 0.9)
  }

  #create(wish, index) {
    const material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      fog: false,
    })
    const sprite = new THREE.Sprite(material)
    const slot = this.#slot(index)
    sprite.position.copy(slot)
    sprite.scale.setScalar(0.001)
    sprite.userData = {
      kind: "lantern",
      wish,
      slot,
      phase: Math.random() * Math.PI * 2,
      size: THREE.MathUtils.randFloat(0.85, 1.1),
      busy: true,
    }
    this.group.add(sprite)
    this.items.push(sprite)
    return sprite
  }

  /** Carga inicial de faroles, con aparición escalonada */
  populate(wishes, { animate = true } = {}) {
    this.group.visible = true
    wishes.forEach((wish) => {
      const sprite = this.#create(wish, this.items.length)
      const size = sprite.userData.size
      const order = this.items.length - 1
      gsap.to(sprite.scale, {
        x: size * 0.95,
        y: size * 1.19,
        z: 1,
        duration: animate ? 0.9 : 0.01,
        delay: animate ? 0.4 + order * 0.07 : 0,
        ease: "back.out(1.6)",
        onComplete: () => (sprite.userData.busy = false),
      })
    })
  }

  /** Faroles de fondo, tenues y sin mensaje: suben despacio por el cielo */
  addAmbient(count, { animate = true } = {}) {
    this.group.visible = true
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.texture,
          transparent: true,
          opacity: THREE.MathUtils.randFloat(0.35, 0.65),
          depthWrite: false,
          fog: false,
        }),
      )
      const size = THREE.MathUtils.randFloat(0.6, 1.1)
      sprite.position.set(
        THREE.MathUtils.randFloatSpread(26),
        THREE.MathUtils.randFloat(-1, 10),
        THREE.MathUtils.randFloat(-14, 0),
      )
      sprite.scale.set(size * 0.95, size * 1.19, 1)
      sprite.userData = {
        phase: Math.random() * Math.PI * 2,
        rise: animate ? THREE.MathUtils.randFloat(0.08, 0.22) : 0,
      }
      this.group.add(sprite)
      this.ambient.push(sprite)
    }
  }

  /** Un deseo recién enviado sube desde abajo de la cámara hasta su lugar */
  launch(wish, camera) {
    this.group.visible = true
    const sprite = this.#create(wish, this.items.length)
    const { slot, size } = sprite.userData

    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    const start = camera.position
      .clone()
      .addScaledVector(fwd, 5)
      .addScaledVector(up, -2.6)
    this.group.worldToLocal(start)
    sprite.position.copy(start)

    gsap.to(sprite.scale, { x: size * 0.95, y: size * 1.19, z: 1, duration: 0.8, ease: "back.out(1.6)" })
    gsap.to(sprite.position, {
      x: slot.x,
      y: slot.y,
      z: slot.z,
      duration: 3.6,
      ease: "power2.out",
      onComplete: () => (sprite.userData.busy = false),
    })
    return sprite
  }

  /** Latido al tocarlo */
  pulse(sprite) {
    const { size } = sprite.userData
    gsap.fromTo(
      sprite.scale,
      { x: size * 1.3, y: size * 1.6 },
      { x: size * 0.95, y: size * 1.19, duration: 0.6, ease: "elastic.out(1, 0.5)" },
    )
  }

  update(elapsed, delta) {
    if (!this.group.visible) return
    // Vaivén suave (no giro continuo) para que el cielo nunca invada el frente
    this.group.rotation.y = Math.sin(elapsed * 0.05) * 0.06
    for (const a of this.ambient) {
      a.position.y += a.userData.rise * delta
      if (a.position.y > 11) a.position.y = -1
      a.position.x += Math.sin(elapsed * 0.3 + a.userData.phase) * 0.15 * delta
    }
    for (const s of this.items) {
      if (s.userData.busy) continue
      const { slot, phase } = s.userData
      s.position.y = slot.y + Math.sin(elapsed * 0.6 + phase) * 0.18
    }
  }

  dispose() {
    this.texture.dispose()
    for (const s of [...this.items, ...this.ambient]) s.material.dispose()
  }
}
