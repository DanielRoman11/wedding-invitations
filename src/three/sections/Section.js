/**
 * Base de las tres secciones 3D (carta, anillos, ramo). Es un emisor de
 * eventos mínimo más los ganchos que `Experience` llama. Las subclases
 * sobrescriben lo que necesiten; todo tiene un valor por defecto inofensivo.
 *
 * Contexto (`ctx`) que recibe cada sección:
 *   scene, camera, canvas        escena compartida
 *   pointer                      THREE.Vector2 con el puntero en NDC (se actualiza solo)
 *   raycaster                    THREE.Raycaster reutilizable
 *   reducedMotion                boolean (prefers-reduced-motion)
 *   images                       HTMLImageElement[] de las fotos (usar photoAt)
 *   guest                        { name, isFallback }
 *   fx                           { sparkles, petals, fireworks } efectos compartidos
 */
export class Section {
  constructor(ctx) {
    this.ctx = ctx
    this._listeners = new Map()
    /** 0 = la cámara no se mueve con el puntero, 1 = paralaje normal */
    this.parallaxGain = 1
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set())
    this._listeners.get(event).add(fn)
    return () => this._listeners.get(event).delete(fn)
  }

  emit(event, payload) {
    this._listeners.get(event)?.forEach((fn) => fn(payload))
  }

  /**
   * Pose de cámara de la sección en reposo, para el tamaño de pantalla actual.
   * Se llama en cada resize. También es donde la sección recoloca sus objetos
   * según la orientación (vertical u horizontal).
   * @returns {{ pos: THREE.Vector3, look: THREE.Vector3 }}
   */
  cameraStop() {
    throw new Error("cameraStop() no implementado")
  }

  /** La cámara llegó a esta sección (stage activo) */
  activate() {}

  /** La cámara salió de esta sección: debe dejar todo en su estado inicial */
  deactivate() {}

  /** Cada frame, SOLO mientras la sección está activa o visible. `camera` ya está posada. */
  update(elapsed, delta) {}

  /**
   * Cada frame para las secciones que quieren tomar el control de la cámara
   * (p. ej. volar al interior de un anillo). Devuelve true si la posó.
   */
  overrideCamera(camera) {
    return false
  }

  /** Objeto tocable bajo `this.ctx.raycaster` (ya apuntado al puntero). null si nada. */
  pick() {
    return null
  }

  /** Toque (sin arrastre) sobre lo que devolvió `pick()` */
  tap(hit) {}

  /** Cursor sugerido para el hit actual: "pointer" | "grab" | "default" */
  cursorFor(hit) {
    return hit ? "pointer" : "default"
  }

  /** Empieza un arrastre en el canvas. Devuelve true si la sección lo reclama. */
  pointerDown() {
    return false
  }

  /** `dx`, `dy` en px desde el último movimiento */
  pointerMove(dx, dy) {}

  /** Fin del arrastre; `vx` en px/s */
  pointerUp(vx) {}

  /** Teclas de flecha cuando la sección está activa */
  keyDown(key) {
    return false
  }

  dispose() {}
}
