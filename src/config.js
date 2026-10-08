export const wedding = {
  groom: "Daniel",
  bride: "Geraldine",
  groomFullName: "Daniel Mora",
  brideFullName: "Geraldine Rubiano",
  monogram: "G & D",
  dateISO: "2026-11-15T16:00:00",
  dateLabel: "15 de noviembre de 2026",
  timeLabel: "4:30 p. m.",
  venueName: "Valle Arriba Centro de Eventos",
  venueAddress: "Colombia",
  mapsUrl: "https://maps.app.goo.gl/mnXqUoL6u26jpjUk8",
  whatsapp: "573506192178",
  dressCode: "Etiqueta rigurosa",
  invitationMessage:
    "Tenemos el honor de invitarte a celebrar el día en que unimos nuestras vidas. Tu presencia es el mejor regalo.",
};

export const schedule = [
  {
    time: "4:30 p. m.",
    title: "Ceremonia",
    note: "Por favor llega 20 minutos antes",
  },
  { time: "5:00 p. m.", title: "Cóctel de bienvenida", note: "" },
  { time: "6:30 p. m.", title: "Cena", note: "" },
  { time: "8:30 p. m.", title: "Fiesta y baile", note: "" },
];

export const story = [
  { date: "2016", title: "Nos conocimos", text: "Nos conocimos en el colegio interamericano en el año 2016 cuando estábamos en noveno" },
  { date: "2017", title: "Nuestra primera cita", text: "Salimos al cine y a comer 😋" },
  { date: "2017", title: "Lo que nos une", text: "Desde un principio Dios ha sido el centro de nuestra relación, por eso le servimos juntos" },
  { date: "2026", title: "La propuesta", text: "El momento en que dijimos que sí para siempre." },
  { date: "15 nov 2026", title: "Nuestra boda", text: "Y ahora queremos celebrarlo contigo." },
];

export const verse = {
  version: "NBV",
  reference: "Cantares 8:6-7",
  parts: [
    "Grábame como un sello sobre tu corazón. Llévame como un tatuaje en tu brazo, porque fuerte como la muerte es el amor, y tenaz como llama divina es el fuego ardiente del amor.",
    "¡Nada puede apagar las llamas del amor! ¡Nada, ni las inundaciones ni las aguas abundantes del mar podrán ahogarlo! Si alguien tratara de comprarlo con todo cuanto tiene sólo lograría que le despreciaran.",
  ],
};

export const ringLabels = {
  story: "Nuestra historia",
  promise: "Itinerario de boda",
};

export const practicalNotes = [
  "Parqueadero disponible en el lugar.",
  "Confirma tu asistencia antes de la fecha límite.",
  "Sin blanco, el color esta reservado para la novia",
  "Sin beige, ni negro o colores similares, queremos que sea un momento alegre",
];

export const gifts = {
  title: "Lluvia de sobres",
  message:
    "Tu presencia es nuestro mejor regalo. Si deseas obsequiarnos algo más, nos hará muy felices una lluvia de sobres para empezar juntos nuestra nueva vida.",
  accounts: [
    {
      label: "BreB",
      qr: "assets/qr-breb.webp",
      text: "3506192178",
    },
  ],
};

export const calendar = {
  utcOffset: "-05:00", // Colombia (sin horario de verano)
  durationHours: 8,
};

export const coupleWish = {
  name: "Geraldine & Daniel",
  message: "Deja tu deseo en nuestro arco junto al nuestro.",
};

export const fallbackGuest = "Querido invitado";

export const photos = {
  history: [
    "photos/history-1.webp",
    "photos/history-2.webp",
    "photos/history-3.webp",
    "photos/history-4.webp",
    "photos/history-5.webp",
    "photos/history-6.webp",
  ],
  general: [
    "photos/foto-01.webp",
    "photos/foto-02.webp",
    "photos/foto-03.webp",
    "photos/foto-04.webp",
    "photos/foto-05.webp",
    "photos/foto-06.webp",
    "photos/foto-07.webp",
    "photos/foto-08.webp",
    "photos/foto-09.webp",
    "photos/foto-10.webp",
    "photos/foto-11.webp",
    "photos/foto-12.webp",
  ],
};

export const placeholderPhotoCount = 8;

/**
 * Paleta café usada por la escena 3D (THREE entiende hex).
 * Tarde dorada: el fondo crema se vuelve salvia, el café espresso hace de tinta
 * y el caramelo dorado queda como acento ceremonial (anillos, filos, listón).
 */
export const palette = {
  sky: 0xf6ead8,
  skyDeep: 0xefdcc0,
  haze: 0xfff3df,
  spotlight: 0xfff1d6,
  rim: 0xc9956b,
  paper: 0xfaf2e3,
  paperInner: 0xf2e6cf,
  gold: 0xc08a54,
  seal: 0x7a3b2b,
  petal: 0xe9b8a4,

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
