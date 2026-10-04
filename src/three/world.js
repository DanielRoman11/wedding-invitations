import * as THREE from "three"

/** Disposición del mundo: cuatro objetos en fila a lo largo de -z */
export const STAGES = 4 // 0 carta, 1 anillos, 2 ramo, 3 arco de deseos

/** Pose de reposo de la tarjeta (la que sale del sobre) */
export const CARD_REST = new THREE.Vector3(0, 0.2, 0.6)
export const CARD_W = 1.66
export const CARD_H = 2.1

/** Centro de cada objeto en el mundo */
export const CARD_Z = 0
export const RINGS_Z = -44
/**
 * Altura del centro de los anillos. El segundo anillo va inclinado y su borde
 * baja unos 6 unidades; el suelo está en y=-4, así que se eleva para que no
 * quede enterrado en el césped.
 */
export const RINGS_Y = 2.8
export const BOUQUET_Z = -88
export const ARCH_Z = -124

/** Cuánto sube (en unidades) cada hoja del reverso al irse con el scroll */
export const SHEET_LIFT = 3.8
