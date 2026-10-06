# Product

## Register

brand

## Users

Invitados a la boda de Daniel Mora Roman y Geraldine Rubiano (15 de noviembre de 2026).
Abren un enlace personalizado desde su celular (`?name=Nombre Apellido`).
El trabajo a realizar: descubrir que están invitados, sentirse nombrados y especiales,
conocer fecha, lugar y detalles, y confirmar asistencia.

## Product Purpose

Invitación de boda digital inmersiva en tres objetos 3D, uno por sección de scroll,
puestos en un jardín de bodas en una tarde dorada (el fondo 3D: `Garden.js` y `GardenProps.js`).
El invitado abre un sobre 3D sellado con su nombre y el scroll lo lleva de objeto en objeto:

1. La carta: frente con la invitación y reverso con lugar, cómo llegar, calendario y notas.
   Detrás hay un papel que se sacude para invitar a mandar un deseo, y un cielo de faroles.
2. Los anillos: dos anillos de bronce dorado entrelazados. Al tocar uno, la cámara entra por su
   abertura y se arrastra para girar un carrusel de paneles con foto y texto: la historia
   de la pareja, un versículo y el itinerario del día. Las fotos acompañan, no son una galería.
3. El ramo de novia: se arrastra, y su panel trae vestimenta, cuenta regresiva y RSVP.

No hay menús ni dock: el scroll cambia de objeto y el toque o arrastre interactúa con él.
Éxito: el invitado siente asombro al abrir el sobre, explora los tres objetos y confirma asistencia.

## Brand Personality

Romántico, ceremonial, alegre. Tres palabras: luminoso, cálido, festivo.
Emociones buscadas: asombro, calidez, expectativa.

## Tema visual

Tarde dorada en un jardín de bodas: tema claro y alegre, en gama café (espresso,
mocha, caramelo, latte) sobre cremas y marfil, con salvia y blush como toques de jardín.
El fondo 3D es un jardín (cielo crema, niebla cálida, césped, setos, árboles, arco floral,
guirnaldas de luces, mariposas), construido en `src/three/Garden.js` y `src/three/GardenProps.js`.
Las superficies del overlay son crema o papel marfil con borde café; los botones primarios
son mocha con texto marfil.

## Anti-references

Nada de plantillas genéricas de boda bootstrap, nada de carruseles planos 2D, nada de menús o docks de navegación,
nada de pastel rosa/nude de catálogo, nada de glassmorphism decorativo,
nada de estética editorial-minimalista de revista.

## Design Principles

1. El sobre es el ritual: la apertura es el momento cumbre, y la tarjeta que sale de él es la invitación.
   Cada sección es un objeto con su propio gesto; las fotos viven dentro de paneles como complemento.
2. El nombre del invitado manda: aparece en el sobre, en el mensaje y en el RSVP.
3. La escena respira: la cámara, los pétalos y las luces siempre tienen vida sutil.
4. Una sola coreografía, no mil efectos: elegir pocos movimientos y pulirlos.
5. Legible antes que decorativo: los datos de la boda se leen sin esfuerzo.

## Accessibility & Inclusion

- `prefers-reduced-motion`: desactiva paralaje, vuelos de cámara y fuegos
  artificiales; el ambiente suave (anillos, ramo, polaroids, jardín, pétalos)
  sigue animándose siempre.
- Contraste de texto >= 4.5:1 en todo el overlay.
- Interacción por toque y mouse; hit areas generosas en móvil.
