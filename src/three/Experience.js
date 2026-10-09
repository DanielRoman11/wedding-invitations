import * as THREE from "three"
import gsap from "gsap"
import { palette } from "../config.js"
import { loadPhotoImages } from "../photos.js"
import { Envelope } from "./Envelope.js"
import { Journey } from "./Journey.js"
import { Fireworks } from "./Fireworks.js"
import { Petals, LightMotes, SparkleBurst, Dust } from "./particles.js"
import { Garden } from "./Garden.js"
import { CARD_REST, STAGES } from "./world.js"
import { CardSection } from "./sections/CardSection.js"
import { RingsSection } from "./sections/RingsSection.js"
import { BouquetSection } from "./sections/BouquetSection.js"
import { ArchSection } from "./sections/ArchSection.js"
import { ScrollSnap } from "./ScrollSnap.js"

const TAP_MAX_MOVE = 8 // px: más que esto ya es un arrastre
const TAP_MAX_TIME = 600 // ms
const SWIPE_TO_OPEN = 28 // px de deslizamiento que abren el sobre
const FIREWORK_COLORS = [palette.gold, palette.caramel, palette.blush, palette.sage, 0xb9a5d6]

/**
 * Orquesta la escena. El scroll de la página solo cambia de SECCIÓN:
 *
 *   fase "sealed"  → sobre flotando bajo un foco; el scroll está bloqueado
 *   fase "opening" → coreografía de apertura; la tarjeta queda frente a la cámara
 *   fase "open"    → cuatro anclas HTML; `Journey` vuela de una a otra
 *                    y cada sección (carta, anillos, ramo) gestiona su interacción
 *
 * callbacks: onOpenStart, onOpened, onStage(i)
 */
export class Experience {
  constructor(canvas, guest, callbacks = {}) {
    this.canvas = canvas
    this.guest = guest
    this.callbacks = callbacks
    this.phase = "sealed"
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    this.clock = new THREE.Clock()
    this.pointer = new THREE.Vector2(0, 0)
    this.parallax = new THREE.Vector2(0, 0)
    this.raycaster = new THREE.Raycaster()
    this.petalPointer = null
    this.pointerIsDown = false
    this.tapInfo = null
    this.swipeStartY = null
    this.dragSection = null
    this.dragLast = null
    this.dragMoved = false

    this.smoothY = 0
    this._stage = -1
    this._pageStages = [0]
    this._pageScrollYs = [0]
    this.sections = null
    this.ctx = null
    this.journey = new Journey()
    this._pos = new THREE.Vector3()
    this._look = new THREE.Vector3()

    // Pager state
    this._page = 0
    this._pageTarget = null
    this._flying = false
    this._scrollProxy = { y: 0 }
    this._scrollTween = null
    this._stageListeners = new Set()

    this.#initRenderer()
    this.#initLights()
    this.#initObjects()
    this.#bindEvents()
    this.#initScrollSnap()

    this.renderer.setAnimationLoop(() => this.#tick())
  }

  /** Índice de la sección activa (0 carta, 1 anillos, 2 ramo, 3 arco) */
  get stage() {
    return Math.max(0, this._stage)
  }

  #fitCameraZ() {
    const halfEnvelope = 1.7 * 1.35 // mitad del ancho del sobre + margen
    const fovRad = THREE.MathUtils.degToRad(this.camera.fov / 2)
    const aspect = window.innerWidth / window.innerHeight
    const needed = halfEnvelope / (Math.tan(fovRad) * aspect)
    return Math.max(7.2, needed)
  }

  /** Distancia a la que la tarjeta ocupa ~64 % del alto (o 80 % del ancho) */
  #cardDistance() {
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    return Math.max(2.1 / (2 * tanH * 0.64), 1.66 / (2 * tanH * this.camera.aspect * 0.8))
  }

  /* ---------------------------------------------------------- */

  #initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 160)
    this.baseZ = this.#fitCameraZ()
    this.camera.position.set(0, 0.25, this.baseZ)
    this.camera.lookAt(0, 0.25, 0)

    this.scene = new THREE.Scene()
    this.scene.add(this.camera)
    this.scene.background = new THREE.Color(palette.sky)
    // Niebla: el horizonte y el jardín lejano se funden en bruma cálida de tarde
    this.scene.fog = new THREE.FogExp2(palette.skyDeep, 0.012)
  }

  #initLights() {
    // Luz de cielo: bruma cálida arriba, salvia rebotada del césped abajo
    this.scene.add(new THREE.HemisphereLight(palette.haze, palette.sage, 1.0))

    // Sol de tarde desde arriba a la derecha, sin sombras; su objetivo sigue a la cámara
    const sun = new THREE.DirectionalLight(palette.spotlight, 1.5)
    sun.position.set(14, 22, 8)
    this.scene.add(sun)
    this.scene.add(sun.target)
    this.sun = sun
    this._sunOffset = new THREE.Vector3(14, 22, 8)

    // Foco con sombra del sobre sellado: la luz cálida del "escenario"
    const spot = new THREE.SpotLight(palette.spotlight, 22, 30, 0.5, 0.5, 1.4)
    spot.position.set(2.5, 7, 4)
    spot.castShadow = true
    spot.shadow.mapSize.set(1024, 1024)
    spot.shadow.bias = -0.0002
    this.scene.add(spot)
    this.scene.add(spot.target)
    this.spot = spot

    // Relleno caramelo suave desde atrás a la izquierda
    const rim = new THREE.DirectionalLight(palette.rim, 0.55)
    rim.position.set(-6, 3, -5)
    this.scene.add(rim)

    // Toque cálido frontal para separar el sobre del fondo
    const fill = new THREE.PointLight(palette.haze, 2.5, 12, 1.8)
    fill.position.set(0, -0.5, 5)
    this.scene.add(fill)
    this.fill = fill

    // Antorcha de la cámara, más tenue de día
    const torch = new THREE.PointLight(palette.ivory, 6, 22, 1.6)
    torch.position.set(0.6, 1.2, 1.5)
    this.camera.add(torch)
  }

  #initObjects() {
    // Suelo apenas insinuado para recibir una sombra suave del sobre
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48),
      new THREE.ShadowMaterial({ opacity: 0.2, color: palette.espresso }),
    )
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.y = -3.1
    this.floor.receiveShadow = true
    this.scene.add(this.floor)

    this.garden = new Garden()
    this.scene.add(this.garden.group)

    this.motes = new LightMotes()
    this.scene.add(this.motes.points)

    this.dust = new Dust()
    this.scene.add(this.dust.points)

    this.petals = new Petals(120)
    this.scene.add(this.petals.mesh)

    this.sparkles = new SparkleBurst()
    this.scene.add(this.sparkles.points)

    this.fireworks = new Fireworks()

    this.envelope = new Envelope(this.guest.name)
    this.scene.add(this.envelope.group)

    // Las fotos se descargan desde el principio; con ellas se crean las secciones
    this.ready = loadPhotoImages().then((images) => {
      this.ctx = {
        scene: this.scene,
        camera: this.camera,
        canvas: this.canvas,
        pointer: this.pointer,
        raycaster: this.raycaster,
        reducedMotion: this.reducedMotion,
        images,
        guest: this.guest,
        fx: { sparkles: this.sparkles, petals: this.petals, fireworks: this.fireworks },
      }
      this.sections = {
        card: new CardSection(this.ctx, { card: this.envelope.card }),
        rings: new RingsSection(this.ctx),
        bouquet: new BouquetSection(this.ctx),
        arch: new ArchSection(this.ctx),
      }
      this.sections.card.on("wish", (wish) => this.sections.arch.addWish(wish))
      // Dentro de un anillo o con el papel de deseos abierto, la página no scrollea
      const locks = { rings: false, card: false }
      const applyLock = () =>
        document.documentElement.classList.toggle("is-modal", locks.rings || locks.card)
      this.sections.rings.on("scrolllock", (v) => {
        locks.rings = Boolean(v)
        applyLock()
      })
      this.sections.rings.on("enter", () => {
        const hint = document.getElementById("scroll-hint")
        if (hint) hint.classList.add("is-hidden")
      })
      this.sections.rings.on("exit", () => {
        this.#updateScrollHint(this._stage)
      })
      this.sections.card.on("scrolllock", (v) => {
        locks.card = Boolean(v)
        applyLock()
      })
      return images.length
    })
  }

  #list() {
    return this.sections
      ? [this.sections.card, this.sections.rings, this.sections.bouquet, this.sections.arch]
      : []
  }

  /* ------------------------ recorrido ------------------------ */

  /**
   * Lee dónde quedó cada ancla en la página y fija las paradas de la cámara
   * (una por sección). Hay que llamarla cuando cambie el diseño.
   */
  refreshJourney() {
    const list = this.#list()
    if (!list.length) return

    // Cada `.sec` es una página de scroll de 100svh y declara a qué sección
    // pertenece (data-stage). La carta tiene varias: frente, reverso y una por
    // hoja del reverso (el scroll voltea la carta y luego pasa las hojas).
    const poses = list.map((section) => section.cameraStop())
    const spacers = [...document.querySelectorAll(".sec")]
    this._pageStages = spacers.map((el) => Number(el.dataset.stage))
    this._pageScrollYs = spacers.map((el) => Math.max(0, el.getBoundingClientRect().top + window.scrollY))

    const defs = []
    spacers.forEach((el, i) => {
      const pose = poses[Number(el.dataset.stage)]
      if (!pose) return
      defs.push({
        y: this._pageScrollYs[i],
        pos: pose.pos,
        look: pose.look,
        plateau: window.matchMedia("(pointer: coarse)").matches ? 1 : 2,
      })
    })
    this.journey.set(defs)
    if (!this._flying) this._page = this.#nearestPage(window.scrollY)
  }

  /** Sube a la sección i con scroll suave */
  goToSection(i) {
    const index = Math.min(STAGES - 1, Math.max(0, i))
    // La carta ocupa varias páginas: se busca la primera de la sección pedida
    const page = Math.max(0, (this._pageStages ?? []).indexOf(index))
    this.#snapToPage(page, true)
  }

  /** Navega a una página específica del recorrido */
  goToPage(page) {
    this.#snapToPage(page, true)
  }

  /** Retorna el número total de páginas */
  getPageCount() {
    return (this._pageStages ?? []).length || 1
  }

  /** Retorna el número de páginas de la carta (stage 0) */
  getCardPageCount() {
    const stages = this._pageStages ?? []
    let count = 0
    for (const stage of stages) {
      if (stage === 0) count++
      else break
    }
    return count
  }

  #snapToPage(page, allowInterrupt = false) {
    const n = this._pageScrollYs.length || 1
    const p = Math.max(0, Math.min(n - 1, page))
    if (this._flying) {
      if (!allowInterrupt) return
      this._scrollTween?.kill()
      this._scrollTween = null
      this._pageTarget = null
      this._flying = false
      document.documentElement.classList.remove("is-paging")
    } else {
      this._page = this.#nearestPage(window.scrollY)
    }

    const targetY = this._pageScrollYs[p] ?? 0
    const currentPage = this.#nearestPage(window.scrollY)
    if (p === currentPage && Math.abs(window.scrollY - targetY) < 1) {
      this._page = currentPage
      return
    }

    this._pageTarget = p
    this._flying = true
    document.documentElement.classList.add("is-paging")
    this._scrollTween?.kill()
    this._scrollProxy.y = window.scrollY
    const isMobile = window.matchMedia("(pointer: coarse)").matches
    this._scrollTween = gsap.to(this._scrollProxy, {
      y: targetY,
      duration: this.reducedMotion ? 0.4 : isMobile ? 0.75 : 0.55,
      ease: "power2.inOut",
      onUpdate: () => window.scrollTo(0, Math.round(this._scrollProxy.y)),
      onComplete: () => {
        window.scrollTo(0, targetY)
        this._page = p
        this._pageTarget = null
        this._flying = false
        this._scrollTween = null
        document.documentElement.classList.remove("is-paging")
      },
    })
  }

  #pagePosition(y) {
    const points = this._pageScrollYs
    const last = points.length - 1
    if (last <= 0 || y <= points[0]) return 0
    if (y >= points[last]) return last

    let low = 0
    let high = last
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2)
      if (y < points[middle]) high = middle
      else low = middle
    }

    const span = points[high] - points[low]
    return span > 0 ? low + (y - points[low]) / span : high
  }

  #nearestPage(y) {
    return Math.min(this._pageScrollYs.length - 1, Math.max(0, Math.round(this.#pagePosition(y))))
  }

  /** Devuelve la página actual o el destino del vuelo en curso. */
  snapCurrentPage() {
    return this._pageTarget ?? this._page
  }

  /** True mientras un tween de scroll está en curso. */
  getFlying() {
    return this._flying
  }

  #initScrollSnap() {
    this.snap = new ScrollSnap({
      getPhase: () => this.phase,
      getLocked: () => document.documentElement.classList.contains("is-modal"),
      getPageCount: () => (this._pageStages ?? []).length || 1,
      getCurrentPage: () => this.snapCurrentPage(),
      getFlying: () => this.getFlying(),
      goToPage: (page) => this.#snapToPage(page),
    })
    this.snap.bind()
  }

  #setStage(next, force = false) {
    if (next === this._stage && !force) return
    const list = this.#list()
    const old = this._stage
    this._stage = next
    if (old >= 0 && old !== next) list[old]?.deactivate()
    list[next]?.activate()
    document.documentElement.dataset.stage = String(next)
    for (let i = 0; i < STAGES; i++) {
      document.getElementById(`stage-${i}`)?.classList.toggle("is-active", i === next)
    }
    this.#updateScrollHint(next)
    this.callbacks.onStage?.(next)
    this._stageListeners.forEach((cb) => cb(next))
  }

  #updateScrollHint(stage) {
    const hint = document.getElementById("scroll-hint")
    if (!hint) return
    
    const textEl = hint.querySelector(".scroll-hint__text")
    if (!textEl) return
    
    if (stage === 3) {
      hint.classList.add("is-hidden")
      return
    }
    
    hint.classList.remove("is-hidden")
    
    const texts = ["Desliza abajo", "Desliza abajo", "Desliza abajo", ""]
    textEl.textContent = texts[stage] || "Continúa"
  }

  onStageChange(callback) {
    this._stageListeners.add(callback)
    return () => this._stageListeners.delete(callback)
  }

  /* ------------------------- eventos ------------------------- */

  #setPointer(e) {
    this.pointer.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    )
  }

  #hitsEnvelope() {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    return this.raycaster.intersectObject(this.envelope.group, true).length > 0
  }

  #activeSection() {
    return this.#list()[this.stage] ?? null
  }

  #pickActive() {
    const section = this.#activeSection()
    if (!section) return null
    this.raycaster.setFromCamera(this.pointer, this.camera)
    return section.pick()
  }

  #bindEvents() {
    window.addEventListener("resize", () => this.#onResize())

    window.addEventListener("pointermove", (e) => {
      this.#setPointer(e)
      // El ratón aparta pétalos al pasar; el dedo solo mientras toca
      if (e.pointerType === "mouse" || this.pointerIsDown) {
        this.petalPointer = { x: this.pointer.x, y: this.pointer.y }
      }

      if (this.dragSection && this.dragLast) {
        const dx = e.clientX - this.dragLast.x
        const dy = e.clientY - this.dragLast.y
        const now = performance.now()
        if (this.tapInfo && Math.hypot(e.clientX - this.tapInfo.x, e.clientY - this.tapInfo.y) > TAP_MAX_MOVE) {
          this.dragMoved = true
        }
        // Velocidad suavizada en px/s para el final del arrastre
        const dt = Math.max(1, now - this.dragLast.t) / 1000
        this.dragLast.vx = this.dragLast.vx * 0.6 + (dx / dt) * 0.4
        this.dragLast.x = e.clientX
        this.dragLast.y = e.clientY
        this.dragLast.t = now
        this.dragSection.pointerMove(dx, dy)
        return
      }

      if (e.pointerType === "mouse" && !this.pointerIsDown && e.target === this.canvas) {
        let cursor = "default"
        if (this.phase === "sealed") {
          cursor = this.#hitsEnvelope() ? "pointer" : "default"
        } else if (this.phase === "open") {
          const section = this.#activeSection()
          if (section) cursor = section.cursorFor(this.#pickActive())
        }
        this.canvas.style.cursor = cursor
      }
    })

    window.addEventListener("pointerdown", (e) => {
      if (e.target !== this.canvas) return
      this.#setPointer(e)
      this.pointerIsDown = true
      this.tapInfo = { x: e.clientX, y: e.clientY, time: performance.now() }
      this.dragMoved = false
      if (this.phase === "sealed") {
        if (this.#hitsEnvelope()) this.#openSequence()
        else if (!this.reducedMotion) this.petals?.gust(this.pointer.x, this.pointer.y, this.camera, 0.9)
      } else if (this.phase === "open") {
        const section = this.#activeSection()
        if (section?.pointerDown()) {
          this.dragSection = section
          this.dragLast = { x: e.clientX, y: e.clientY, t: performance.now(), vx: 0 }
        }
      }
    })

    const end = (e) => {
      this.pointerIsDown = false
      if (e.pointerType !== "mouse") this.petalPointer = null
    }
    const endDrag = () => {
      const section = this.dragSection
      if (!section) return false
      const vx = this.dragLast?.vx ?? 0
      this.dragSection = null
      this.dragLast = null
      section.pointerUp(vx)
      return true
    }

    window.addEventListener("pointerup", (e) => {
      end(e)
      const tap = this.tapInfo
      this.tapInfo = null
      endDrag()
      if (!tap || this.phase !== "open" || e.target !== this.canvas) return
      const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y)
      const isTap = moved <= TAP_MAX_MOVE && performance.now() - tap.time <= TAP_MAX_TIME
      if (!isTap || this.dragMoved) return
      this.#setPointer(e)
      this.#onTap()
    })
    window.addEventListener("pointercancel", (e) => {
      end(e)
      this.tapInfo = null
      endDrag()
    })

    // El sobre también se abre "con el scroll": rueda, deslizar o teclas
    window.addEventListener(
      "wheel",
      (e) => {
        if (this.phase === "sealed" && e.deltaY > 4) this.#openSequence()
      },
      { passive: true },
    )
    window.addEventListener(
      "touchstart",
      (e) => {
        this.swipeStartY = e.touches[0]?.clientY ?? null
      },
      { passive: true },
    )
    window.addEventListener(
      "touchmove",
      (e) => {
        if (this.phase !== "sealed" || this.swipeStartY === null) return
        if (this.swipeStartY - e.touches[0].clientY > SWIPE_TO_OPEN) this.#openSequence()
      },
      { passive: true },
    )
    window.addEventListener("keydown", (e) => {
      if (this.phase === "sealed") {
        if (["ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
          e.preventDefault()
          this.#openSequence()
        }
        return
      }
      if (this.phase === "open") {
        const target = e.target
        const typing =
          target instanceof HTMLElement &&
          (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        if (typing) return
        if (this.#activeSection()?.keyDown(e.key)) e.preventDefault()
      }
    })
  }

  #onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.baseZ = this.#fitCameraZ()
    if (this.phase === "sealed") this.camera.position.z = this.baseZ
    const targetPage = this._flying ? this._pageTarget : null
    if (this._flying) {
      this._scrollTween?.kill()
      this._scrollTween = null
      this._pageTarget = null
      this._flying = false
      document.documentElement.classList.remove("is-paging")
    }
    this.refreshJourney()
    if (targetPage !== null) this.#snapToPage(targetPage)
  }

  /* -------------------- toques tras abrir -------------------- */

  #onTap() {
    const section = this.#activeSection()
    if (!section) return
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hit = section.pick()
    if (hit !== null) {
      section.tap(hit)
      return
    }
    if (!this.reducedMotion) this.petals?.gust(this.pointer.x, this.pointer.y, this.camera, 1)
  }

  /* ------------------- API para la interfaz ------------------ */

  /** Fuegos artificiales y ráfaga de pétalos */
  celebrate() {
    if (this.reducedMotion) return
    for (let i = 0; i < 7; i++) {
      gsap.delayedCall(i * 0.42, () => {
        this.fireworks.launch(FIREWORK_COLORS[i % FIREWORK_COLORS.length])
      })
    }
    this.petals?.gust(0, 0.1, this.camera, 2)
    this.sections?.bouquet.celebrate?.()
  }

  /* ---------------------- apertura --------------------------- */

  async #openSequence() {
    if (this.phase !== "sealed") return
    this.phase = "opening"
    this.callbacks.onOpenStart?.()
    if (!this.reducedMotion) this.petals?.gust(0, 0, this.camera, 1.4)

    await this.ready

    const fast = this.reducedMotion
    const restZ = CARD_REST.z + this.#cardDistance()

    // La cámara se acerca UNA vez y se detiene frente a la tarjeta.
    const dolly = new Promise((resolve) => {
      gsap.to(this.camera.position, {
        x: 0,
        y: CARD_REST.y,
        z: restZ,
        duration: fast ? 0.01 : 2.6,
        delay: fast ? 0 : 0.9,
        ease: "power2.inOut",
        onComplete: resolve,
      })
    })

    const envelope = this.envelope.open(this.scene, {
      cardRest: CARD_REST,
      fast,
      onSealBurst: (pos) => {
        if (!fast) this.sparkles.burst(pos)
      },
      onLanded: (pos) => {
        if (!fast) this.sparkles.burst(pos)
      },
    })

    await Promise.all([dolly, envelope])
    this.#mountCard()

    // La escena del sobre ya no hace falta (la tarjeta sigue visible: es de la sección carta)
    this.spot.castShadow = false
    this.floor.visible = false
    this.envelope.group.visible = false

    this.smoothY = window.scrollY
    this.phase = "open"
    this.refreshJourney()
    this.canvas.style.cursor = "default"
    this.#setStage(0, true)
    this.#updateScrollHint(0)
    this.sections.card.prepare()
    this.callbacks.onOpened?.()
  }

  /** La tarjeta se autoilumina; la sección carta gestiona su opacidad si quiere */
  #mountCard() {
    const card = this.envelope.card
    card.material.forEach((m) => {
      m.transparent = false
      if (!m.map) return
      m.emissive.set(0xffffff)
      m.emissiveMap = m.map
      m.emissiveIntensity = 0.35
      m.needsUpdate = true
    })
    card.castShadow = false
  }

  #updateJourney(delta, elapsed) {
    const k = this.reducedMotion || this._flying ? 1 : 1 - Math.exp(-delta * 6.5)
    this.smoothY += (window.scrollY - this.smoothY) * k

    const stages = this._pageStages ?? []
    const position = this.#pagePosition(this.smoothY)
    const page = Math.min(stages.length - 1, Math.max(0, Math.round(position)))
    if (!this._flying) this._page = page
    this.#setStage(stages[page] ?? 0)

    const card = this.sections.card
    card.setFlipProgress(Math.min(1, Math.max(0, position)))
    card.setSheetPos(Math.max(0, position - 1))

    const section = this.#activeSection()
    if (section?.overrideCamera(this.camera)) {
      this.parallax.set(0, 0)
    } else if (this.journey.pose(this.smoothY, this._pos, this._look)) {
      const gain = this.reducedMotion ? 0 : (section?.parallaxGain ?? 1)
      this.parallax.lerp(this.pointer, 1 - Math.exp(-delta * 3))
      this.camera.position.set(
        this._pos.x + this.parallax.x * 0.32 * gain,
        this._pos.y + this.parallax.y * 0.18 * gain,
        this._pos.z,
      )
      this.camera.lookAt(this._look)
    }

    for (const s of this.#list()) s.update(elapsed, delta)
  }

  #tick() {
    const delta = Math.min(this.clock.getDelta(), 0.05)
    const elapsed = this.clock.getElapsedTime()

    if (this.phase === "sealed") {
      this.envelope.setPointer(this.pointer.x, this.pointer.y)
      this.envelope.update(elapsed)
    } else if (this.phase === "open") {
      this.#updateJourney(delta, elapsed)
    }

    // Los motas de luz y el polvo acompañan a la cámara; el polvo además da paralaje
    this.sun.position.copy(this.camera.position).add(this._sunOffset)
    this.sun.target.position.copy(this.camera.position)
    this.garden.update(elapsed, delta, this.camera.position)
    this.motes.points.position.copy(this.camera.position)
    this.motes.update(elapsed)
    this.dust.update(elapsed, this.camera.position)
    this.petals?.update(elapsed, delta, this.camera, this.petalPointer)
    this.sparkles.update(delta)
    this.fireworks.update(delta)

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this._scrollTween?.kill()
    document.documentElement.classList.remove("is-paging")
    this.snap?.unbind()
    for (const s of this.#list()) s.dispose()
    this.envelope.dispose()
    this.fireworks.dispose()
    this.petals?.dispose()
    this.garden.dispose()
    this.motes.dispose()
    this.dust.dispose()
    this.sparkles.dispose()
    this.renderer.dispose()
  }
}
