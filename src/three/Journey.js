import * as THREE from "three"

const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10)

/**
 * El recorrido de la cámara. Cada parada ancla una pose (posición + punto
 * de mira) a una posición de scroll en píxeles. Entre dos paradas la cámara
 * sigue una curva Catmull-Rom y avanza con `smootherstep` (aplicado
 * `plateau` veces): más pasadas = más tiempo quieta sobre la parada, como
 * cuando se queda frente a una foto.
 *
 * Una parada: { y, pos: Vector3, look: Vector3, plateau?: number, photo?: number }
 */
export class Journey {
  constructor() {
    this.stops = []
    this.posCurve = null
    this.lookCurve = null
    /** Posición fraccionaria actual en la lista de paradas (0 .. n - 1) */
    this.q = 0
    /** Índice de la parada de la foto 0, o -1 */
    this.photoFirst = -1
  }

  set(defs) {
    const stops = []
    for (const def of defs) {
      const prev = stops[stops.length - 1]
      // Dos paradas en el mismo píxel (p. ej. por el tope del scroll) sobran
      if (prev && def.y <= prev.y + 1) continue
      stops.push(def)
    }
    this.stops = stops
    this.photoFirst = stops.findIndex((s) => s.photo === 0)
    if (stops.length >= 2) {
      this.posCurve = new THREE.CatmullRomCurve3(stops.map((s) => s.pos), false, "centripetal")
      this.lookCurve = new THREE.CatmullRomCurve3(stops.map((s) => s.look), false, "centripetal")
    } else {
      this.posCurve = this.lookCurve = null
    }
  }

  /** Escribe en `outPos` y `outLook` la pose de la cámara para un scroll dado */
  pose(y, outPos, outLook) {
    const stops = this.stops
    const n = stops.length
    if (n === 0) return false
    if (n === 1 || !this.posCurve) {
      outPos.copy(stops[0].pos)
      outLook.copy(stops[0].look)
      this.q = 0
      return true
    }

    let q
    if (y <= stops[0].y) q = 0
    else if (y >= stops[n - 1].y) q = n - 1
    else {
      let i = 0
      while (i < n - 2 && y >= stops[i + 1].y) i++
      let e = (y - stops[i].y) / (stops[i + 1].y - stops[i].y)
      for (let k = 0; k < (stops[i].plateau ?? 1); k++) e = smootherstep(e)
      q = i + e
    }
    this.q = q

    const t = q / (n - 1)
    this.posCurve.getPoint(t, outPos)
    this.lookCurve.getPoint(t, outLook)
    return true
  }
}
