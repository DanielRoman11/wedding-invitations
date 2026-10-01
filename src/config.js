/**
 * CONFIGURACIÓN DE LA BODA
 * ------------------------------------------------------------------
 * Edita estos datos y la página entera se actualiza:
 * sobre 3D, invitación, cuenta regresiva, botones y anillo de fotos.
 */

export const wedding = {
  // Novios
  groom: "Daniel",
  bride: "Geraldine",
  groomFullName: "Daniel Mora Roman",
  brideFullName: "Geraldine Rubiano",
  monogram: "D & G", // Iniciales del sello de cera

  // Fecha de la boda (formato ISO: AAAA-MM-DDTHH:MM:SS, hora local)
  dateISO: "2026-11-15T16:00:00",
  dateLabel: "15 de noviembre de 2026",
  timeLabel: "4:00 p. m.",

  // Lugar (edita cuando tengas el sitio confirmado)
  venueName: "Valle Arriba Centro de Eventos",
  venueAddress: "Colombia",
  // URL de Google Maps del lugar
  mapsUrl: "https://maps.app.goo.gl/mnXqUoL6u26jpjUk8",

  // RSVP: número de WhatsApp (código de país + número, solo dígitos)
  whatsapp: "573506192178",

  // Dress code
  dressCode: "Etiqueta rigurosa",

  // Mensaje que acompaña al nombre del invitado
  invitationMessage:
    "Tenemos el honor de invitarte a celebrar el día en que unimos nuestras vidas. Tu presencia es el mejor regalo.",
};

/**
 * Itinerario del día. Sale en el segundo anillo, después del versículo.
 * EDITA ESTOS HORARIOS: son de muestra.
 */
export const schedule = [
  {
    time: "4:00 p. m.",
    title: "Ceremonia",
    note: "Por favor llega 20 minutos antes",
  },
  { time: "5:00 p. m.", title: "Cóctel de bienvenida", note: "" },
  { time: "6:30 p. m.", title: "Cena", note: "" },
  { time: "8:30 p. m.", title: "Fiesta y baile", note: "" },
];

/**
 * Nuestra historia: 5 paneles dentro del primer anillo, cada uno con una foto
 * (en el orden de `photos`) y este texto. EDITA ESTOS TEXTOS: son de muestra.
 */
export const story = [
  { date: "Cuándo", title: "Nos conocimos", text: "Cuenta aquí cómo y dónde se conocieron." },
  { date: "Cuándo", title: "Nuestra primera cita", text: "Ese día en que supimos que algo especial empezaba." },
  { date: "Cuándo", title: "Lo que nos une", text: "Aquello que hizo que cada día juntos fuera mejor que el anterior." },
  { date: "Cuándo", title: "La propuesta", text: "El momento en que dijimos que sí para siempre." },
  { date: "15 nov 2026", title: "Nuestra boda", text: "Y ahora queremos celebrarlo contigo." },
];

/**
 * Versículo del segundo anillo (anillo de compromiso), versión Nueva Biblia Viva.
 * Es UN solo panel de introducción; después el anillo continúa con el itinerario.
 */
export const verse = {
  version: "NBV",
  reference: "Cantares 8:6-7",
  // Los dos versículos van juntos en un solo panel
  parts: [
    "Grábame como un sello sobre tu corazón. Llévame como un tatuaje en tu brazo, porque fuerte como la muerte es el amor, y tenaz como llama divina es el fuego ardiente del amor.",
    "¡Nada puede apagar las llamas del amor! ¡Nada, ni las inundaciones ni las aguas abundantes del mar podrán ahogarlo! Si alguien tratara de comprarlo con todo cuanto tiene sólo lograría que le despreciaran.",
  ],
};

/** Etiquetas de los dos anillos */
export const ringLabels = {
  story: "Nuestra historia",
  promise: "Promesa y gran día",
};

/**
 * Detalles prácticos para los invitados (se muestran como lista).
 * Borra o agrega líneas libremente.
 */
export const practicalNotes = [
  "Habrá parqueadero en el lugar del evento.",
  "Por favor confirma tu asistencia antes de la fecha límite.",
];

/**
 * Lluvia de sobres.
 * `accounts` se muestra con un botón "Copiar" por cada cuenta.
 * Ejemplo: { label: "Nequi", value: "3001234567", holder: "Nombre Apellido" }
 */
export const gifts = {
  title: "Lluvia de sobres",
  message:
    "Tu presencia es nuestro mejor regalo. Si deseas obsequiarnos algo más, nos hará muy felices una lluvia de sobres para empezar juntos nuestra nueva vida.",
  accounts: [],
};

/** Formulario de RSVP */
export const rsvp = {
  maxPeople: 6, // máximo de personas que puede indicar un invitado (incluyéndose)
};

/** Para agregar la boda al calendario del invitado */
export const calendar = {
  utcOffset: "-05:00", // Colombia (sin horario de verano)
  durationHours: 8,
};

/** Farol inicial de los novios, siempre presente en el cielo de deseos */
export const coupleWish = {
  name: "Daniel & Geraldine",
  message: "Escribe tu deseo y mándalo al cielo junto al nuestro.",
};

/**
 * Nombre usado cuando la URL NO trae ?name=
 * Ejemplo sin parámetro:  https://tusitio.com/
 * Ejemplo con parámetro:  https://tusitio.com/?name=Pepe%20Perez
 */
export const fallbackGuest = "Querido invitado";

/**
 * Fotos. Acompañan a los paneles (no son una galería aparte): las 5 primeras
 * van en la historia, la 6.ª en el versículo, las 4 siguientes en el itinerario
 * y las demás cuelgan del ramo. Si hay menos, se reutilizan en orden.
 * Ya están optimizadas en public/photos/ (1600px, webp, ~170 KB cada una).
 * Para cambiar fotos: deja las nuevas ahí y edita esta lista.
 * Elige entre 6 y 16; con más el anillo se vuelve apretado.
 * Si una ruta no existe, esa foto se ignora sola (no rompe el anillo).
 */
export const photos = [
  "photos/foto-01.webp",
  "photos/foto-02.webp",
  "photos/foto-03.webp",
  "photos/foto-04.webp",
  "photos/foto-05.webp",
  "photos/foto-06.webp",
  "photos/foto-10.webp",
  "photos/foto-11.webp",
  "photos/foto-12.webp",
  "photos/foto-13.webp",
  "photos/foto-14.webp",
  "photos/foto-15.webp",
  "photos/foto-16.webp",
  "photos/foto-17.webp",
];

/** Cantidad de tarjetas de muestra si `photos` está vacío */
export const placeholderPhotoCount = 8;

/**
 * Paleta "café con leche y turquesa" usada por la escena 3D (THREE entiende hex).
 * Día claro: el fondo es un turquesa pálido que se vuelve crema, el café espresso
 * hace de tinta y el dorado reluciente queda como acento ceremonial (anillos, filos).
 */
export const palette = {
  // Escena: tarde dorada en un jardín de bodas (cafés, crema, salvia)
  sky: 0xf6ead8, // Cielo crema cálido
  skyDeep: 0xefdcc0, // Niebla / horizonte: crema un punto más profundo
  haze: 0xfff3df, // Bruma cálida en los roces de luz
  spotlight: 0xfff1d6, // Luz de sol cálida
  rim: 0xc9956b, // Luz de relleno caramelo
  paper: 0xfaf2e3, // Papel del sobre y tarjeta
  paperInner: 0xf2e6cf, // Papel interior (bordes)
  gold: 0xc08a54, // Caramelo bronceado (anillos, filos, listón)
  seal: 0x7a3b2b, // Cera rojo café del sello
  petal: 0xe9b8a4, // Pétalos rosa durazno

  // Gama café
  espresso: 0x3e2b20,
  mocha: 0x6b4a36,
  caramel: 0xb98558,
  latte: 0xd8bd9a,
  cream: 0xf7efe3,
  ivory: 0xfff8ec,
  blush: 0xe8b9a8,

  // Jardín
  sage: 0x9caf88,
  leaf: 0x5f7a4e,
  grass: 0x8fa86b,
  grassDeep: 0x6f8a52,
  trunk: 0x6b4a36,
};
