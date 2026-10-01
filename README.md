# Invitación de boda 3D · Daniel & Geraldine

Invitación digital personalizada con un **sobre 3D sellado con cera** que el
invitado abre con un toque (o deslizando). Al abrirlo, el scroll cambia entre
tres secciones, cada una un objeto 3D en un jardín de bodas en una tarde dorada:

1. **Carta**: frente con la invitación y reverso con lugar, calendario y notas.
   Un papel detrás de la carta permite mandar un deseo al cielo de faroles.
2. **Anillos**: tocar un anillo lleva la cámara dentro; se arrastra para girar
   paneles con la historia, el versículo y el itinerario.
3. **Ramo**: arrastrable, con vestimenta, cuenta regresiva y confirmación (RSVP).

## Uso rápido

```bash
npm install
npm run dev        # desarrollo en http://localhost:5173
npm run build      # genera dist/ listo para subir a cualquier hosting
npm run preview    # sirve el build para probarlo
```

## Personalizar los enlaces por invitado

Cada invitado recibe una URL con su nombre:

```
https://tusitio.com/?name=Pepe%20Perez
https://tusitio.com/?name=Maria+Jose
```

- El nombre aparece **impreso en el sobre 3D**, en la tarjeta, en el mensaje
  de la invitación y en el texto de WhatsApp del botón de confirmación.
- Si la URL no trae `?name=`, se usa el texto de respaldo definido en
  `src/config.js` (`fallbackGuest`, por defecto "Querido invitado").
- Los espacios van como `%20` o `+`. Tildes y ñ funcionan sin problema.

Tip: genera la lista de enlaces con cualquier hoja de cálculo. Si los nombres
están en la columna A:

```
="https://tusitio.com/?name=" & SUSTITUIR(A2; " "; "+")
```

## Qué editar antes de publicar

Todo se configura en **`src/config.js`**:

| Dato | Dónde |
| --- | --- |
| Nombres, monograma, fecha y hora | `wedding.*` |
| Nombre y dirección del lugar | `wedding.venueName`, `venueAddress` |
| Enlace de Google Maps | `wedding.mapsUrl` |
| WhatsApp para confirmaciones | `wedding.whatsapp` (código país + número, solo dígitos) |
| Dress code y mensaje | `wedding.dressCode`, `invitationMessage` |
| Historia (5 paneles del anillo 0) | `story` (x5) |
| Versículo (Cantares 8:6-7) | `verse` |
| Itinerario (4 paneles del anillo 1) | `schedule` |
| Texto sin nombre en la URL | `fallbackGuest` |
| Colores de la escena 3D (cielo, jardín, anillos, sello, pétalos) | `palette` |

## Fotos como complemento de los paneles

Las fotos acompañan el texto de los paneles de los anillos y del ramo; no hay galería aparte. Ya están en `public/photos/`: 15 archivos `foto-NN.webp`,
optimizados a 1600 px del lado largo y quality 82 (unos 170 KB cada una,
~2.5 MB en total, frente a 496 MB de los originales).

La lista se edita en `src/config.js`:

```js
export const photos = [
  "photos/foto-01.webp",
  // ... las que tengas en public/photos/
]
```

Para cambiar o quitar fotos:

1. Deja los archivos nuevos en `public/photos/` (webp o jpg, ideal vertical 2:3).
2. Edita la lista `photos`. Con una por panel (unas 11 entre historia, versículo e itinerario) se ve mejor;
   si hay menos, se repiten. Si la lista queda vacía, se muestran tarjetas de muestra.

Si vuelves a subir fotos originales muy pesadas, optimízalas antes:

```bash
python3 - <<'PY'
from PIL import Image, ImageOps
import glob, os
for f in sorted(glob.glob("origenales/*.jpg")):
    im = ImageOps.exif_transpose(Image.open(f))
    w, h = im.size
    s = 1600 / max(w, h)
    if s < 1:
        im = im.resize((round(w*s), round(h*s)), Image.LANCZOS)
    im.convert("RGB").save("public/photos/" + os.path.basename(f)[:-4] + ".webp",
                           "WEBP", quality=82, method=5)
PY
```

El script respeta la orientación EXIF, que es lo que suele desalinear las fotos
de celular al redimensionarlas a ciegas.

## Despliegue

`npm run build` produce `dist/` estático. Funciona en:

- **Netlify / Vercel**: arrastra la carpeta `dist` o conecta el repo.
- **GitHub Pages**: sube el contenido de `dist` a la rama `gh-pages`.
- **Cualquier hosting compartido**: sube `dist` por FTP al public_html.

La base es relativa (`./`), así que funciona también en subcarpetas.

## Paleta

Tema claro en gama café, tarde dorada en un jardín. En `src/config.js`, `palette`
controla todos los colores 3D (hex numéricos para Three.js); los colores del
overlay HTML son los tokens OKLCH de `:root` en `src/style.css`.

| Rol | Color |
| --- | --- |
| Cremas y marfil | `cream` 0xf7efe3, `ivory` 0xfff8ec, `sky` 0xf6ead8 |
| Cafés | `espresso` 0x3e2b20, `mocha` 0x6b4a36, `caramel` 0xb98558, `latte` 0xd8bd9a |
| Acentos | `gold` 0xc08a54 (caramelo bronceado), `seal` 0x7a3b2b, `blush` 0xe8b9a8 |
| Jardín | `sage` 0x9caf88, `leaf` 0x5f7a4e, `grass` 0x8fa86b |

## Detalles técnicos

- Vite + Three.js + GSAP, sin framework.
- Texturas del sobre, la tarjeta y las fotos de muestra se dibujan en canvas
  en tiempo de ejecución: el nombre del invitado queda renderizado en 3D.
- Respeta `prefers-reduced-motion` (sin pétalos ni autorrotación).
- Tipografías: Marcellus (títulos), Pinyon Script (caligrafía), Mulish (texto).
