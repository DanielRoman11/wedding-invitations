# AGENTS.md

## Proyecto

Invitación de boda digital 3D de Daniel Mora Roman y Geraldine Rubiano
(15 de noviembre de 2026). Sitio estático personalizado por URL: `?name=Invitado`
cambia el nombre impreso en el sobre 3D, la tarjeta, el mensaje y el RSVP;
sin el parámetro se usa `fallbackGuest` de `src/config.js`.

Tema claro café: tarde dorada en un jardín de bodas (cremas, espresso, mocha,
caramelo, salvia). Los tokens CSS viven en `:root` de `src/style.css` (OKLCH) y los
colores 3D en `palette` de `src/config.js`.

Ver `PRODUCT.md` para el contexto de diseño (registro brand, paleta,
personalidad, principios y anti-referencias del proyecto).

## Stack y comandos

- Vite 7 + Three.js + GSAP. JavaScript ES modules, sin framework, sin TypeScript.
- `npm run dev` · `npm run build` · `npm run preview`
- No hay tests; la verificación es visual (build + screenshots headless con
  playwright-core contra el preview).

## Concepto

El scroll solo cambia de SECCIÓN: tres páginas de 100svh con scroll-snap
mandatory. Cada sección es un objeto 3D con su propia interacción y la cámara
vuela de uno a otro (en -z). Las fotos son complemento dentro de paneles.

| Sección   | z   | Objeto                                                        | Interacción                                                                |
| --------- | --- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 0 Carta   | 0   | Carta con frente y reverso, papel de deseos, cielo de faroles | Girar la carta, tocar el papel, leer faroles                               |
| 1 Anillos | -44 | Dos anillos de bronce dorado entrelazados                     | Tocar uno, la cámara entra y se arrastra para girar el carrusel de paneles |
| 2 Ramo    | -88 | Ramo de novia arrastrable                                     | Panel HTML con vestimenta, cuenta regresiva y RSVP                         |

## Estructura

```
index.html                 # DOM: canvas, loader, pista, #journey (#sec-0..2), #stage-0..2
src/config.js              # ÚNICO archivo que edita el dueño (datos boda, historia, versículo, itinerario, fotos, paleta)
src/guest.js               # Parseo/limpieza/capitalización de ?name=
src/api.js                 # RSVP y deseos (envío y lectura)
src/photos.js              # loadPhotoImages(), photoAt(images, i)
src/main.js                # Bootstrap: fuentes, Experience, init de las tres UI
src/style.css              # Solo estilos globales (variables, loader, hint, botones, formularios, .panel, .stage)
src/ui/overlay.js          # Pista inicial (showHint/hideHint)
src/ui/forms.js            # initRsvpForm / initWishForm (las llaman las UI de sección)
src/ui/content.js          # Contenido de config.js para las UI
src/ui/card/               # card.html, card.css, cardUi.js: UI de la sección 0
src/ui/rings/              # rings.html, rings.css, ringsUi.js: UI de la sección 1
src/ui/bouquet/            # bouquet.html, bouquet.css, bouquetUi.js: UI de la sección 2
src/three/world.js         # Constantes: STAGES, CARD_REST, CARD_W/H, RINGS_Z, BOUQUET_Z, LANTERN_CENTER
src/three/Garden.js        # Fondo: cielo, suelo, sendero, colinas, luz de sol (compone GardenProps)
src/three/GardenProps.js   # Árboles, setos, arco floral, flores, guirnaldas, sillas, mariposas
src/three/Experience.js    # Núcleo: renderer, escena, luces, fases, vuelos de cámara, sections
src/three/ScrollSnap.js    # Scroll por páginas en táctil (un swipe = siguiente página)
src/three/sections/        # Section.js (clase base), CardSection, RingsSection, BouquetSection
src/three/Envelope.js      # Sobre y tarjeta; open() deja la tarjeta en CARD_REST
src/three/Rings.js         # Anillos y paneles giratorios
src/three/Bouquet.js       # Ramo de novia
src/three/Panels.js        # Pintores de canvas de los paneles foto + texto
src/three/Lanterns.js      # Faroles de deseos y ambientales
src/three/Fireworks.js     # Fuegos artificiales
src/three/particles.js     # Pétalos, polen, sparkles
src/three/textures.js      # Texturas canvas (sobre, sello, tarjeta, papel, placeholders)
```

## Contrato de secciones y UI

- Cada sección 3D extiende `Section` (`src/three/sections/Section.js`) y
  expone métodos y eventos (`on`/`emit`). `experience.sections` es
  `{ card, rings, bouquet }` y existe tras `await experience.ready`.
  - `CardSection`: `flip() openPaper() closePaper() releasePaper() setWishes()
launchWish() prepare()`; getters `isFlipped isPaperOpen overlayRect`;
    eventos `flip paper lantern layout`.
  - `RingsSection`: `enter(i) exit() step(dir)`; getter `insideIndex`; eventos
    `labels enter exit panel scrolllock`.
  - `BouquetSection`: `celebrate()`; evento `layout`.
- Cada UI exporta `initCardUi({ section, guest, experience })`,
  `initRingsUi({ section, experience })` o `initBouquetUi({ section, guest,
experience })`. `main.js` las llama UNA vez tras `await experience.ready`.
  Cada una importa su HTML con `?raw` y su CSS, e inyecta el HTML en su
  `#stage-N` antes de buscar nodos. Los estilos de una UI viven en su carpeta,
  no en `style.css`.
- `initRsvpForm` e `initWishForm` las llaman las UI de sección, no `main.js`.

## Convenciones

- Fases de la escena: `sealed` → `opening` → `open` (en `Experience`).
- Scroll: tres anclas `#sec-0..2` (100svh, `scroll-snap-align: start`,
  `scroll-snap-stop: always`) que son solo espaciadores. El núcleo fija
  `html[data-stage]` y la clase `is-active` en el `#stage-N` correspondiente.
  En táctil `ScrollSnap` desactiva la inercia del navegador sobre el canvas
  (`touch-action: none`) y salta a la página siguiente/anterior con un solo
  gesto, igual de "fijo" que en escritorio.
- `.stage` es `position: fixed`, `pointer-events: none`, invisible salvo
  `.is-active` (transición 400ms con `--ease-out`). Los hijos interactivos
  ponen `pointer-events: auto`.
- Antes de abrir el sobre el scroll está bloqueado (`html.is-locked`). Cuando
  una sección emite `scrolllock` (dentro de un anillo), el núcleo alterna
  `html.is-modal`: sin scroll y con `touch-action: none` en el canvas.
- Los paneles HTML sobre el 3D se alinean con `overlayRect` de `CardSection`
  (rectángulo en pantalla de la carta o papel en reposo).
- El nombre del invitado se dibuja en texturas canvas: por eso `main.js`
  espera `document.fonts.ready` ANTES de crear la escena.
- Animaciones UI: curvas `--ease-out: cubic-bezier(0.23,1,0.32,1)`; entradas
  escalonadas 70ms; todo lo animable es transform/opacity.
- `prefers-reduced-motion` en la escena 3D desactiva solo lo intenso (paralaje,
  vuelos de cámara, fuegos, explosión de pétalos): el ambiente suave
  (autorrotación de anillos y ramo, polaroids, jardín, pétalos, polen, vaivén
  de los mensajes) suena SIEMPRE; sin él el sitio se ve congelado en móvil.
- Sin envmap: materiales "metálicos" deben usar metalness bajo o se ven negros.
- Las fotos usan `MeshBasicMaterial` con `toneMapped: false` (color real, sin luces).
- El mundo es largo (hasta z ~ -88 y más): el jardín cubre z +12 a -130; polen y pétalos siguen a la cámara. Fondo claro: sin blending aditivo.
- Tokens CSS: `--bg --bg-deep --surface --surface-solid --surface-border --ink --muted --primary --accent --accent-deep --paper --paper-ink --shadow-text` (halo claro). Líneas sobre papel: `--gold-line*` (caramelo). Botón primario mocha con `--on-accent`.
- Base de Vite relativa (`./`) para desplegar en cualquier subcarpeta.
- Sin `any` ni guiones dobles o largos en texto en lenguaje natural.
