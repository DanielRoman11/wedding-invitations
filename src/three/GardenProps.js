import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { palette } from "../config.js";

/**
 * Utilería del jardín de bodas: árboles, setos, arco floral, macizos de
 * flores, sillas, guirnaldas de luces, mariposas, abejas y pétalos.
 * Todo es InstancedMesh o geometría fusionada con colores por vértice
 * (unas 20 llamadas de dibujo en total). El suelo y el cielo los hace Garden.
 */

const GROUND_Y = -4;

/** Generador pseudoaleatorio determinista (el jardín se ve igual siempre) */
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20261115);
const rand = (min, max) => min + (max - min) * rng();
const pick = (list) => list[Math.floor(rng() * list.length)];

/** Color derivado de la paleta con un ajuste HSL */
function shade(hex, dh = 0, ds = 0, dl = 0) {
  return new THREE.Color(hex).offsetHSL(dh, ds, dl);
}

/** Prepara una geometría para fusionar: sin índice, sin uv, con color por vértice */
function prep(geometry, color) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute("uv");
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Aplica posición, rotación y escala a una geometría ya preparada */
function placed(geometry, position, rotation, scale) {
  const m = new THREE.Matrix4().compose(
    position,
    new THREE.Quaternion().setFromEuler(rotation ?? new THREE.Euler()),
    scale ?? new THREE.Vector3(1, 1, 1),
  );
  geometry.applyMatrix4(m);
  return geometry;
}

/** Deforma una esfera para que la copa parezca orgánica, no perfecta */
function jitter(geometry, amount) {
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k =
      1 +
      amount *
        (Math.sin(v.x * 3.1 + 1.3) * Math.cos(v.y * 2.7 + 0.4) +
          0.7 * Math.sin(v.z * 4.3 + v.x * 1.9));
    pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Zonas libres del contrato: devuelve true si (x, z) con radio r choca */
function blocked(x, z, r) {
  if (Math.hypot(x, z) < 12 + r) return true;
  if (Math.hypot(x, z + 44) < 18 + r) return true;
  if (Math.hypot(x, z + 88) < 10 + r) return true;
  // Cielo de faroles detrás de la carta
  if (Math.abs(x) < 16 + r && z < -4 + r && z > -34 - r) return true;
  // Corredor central
  if (Math.abs(x) < 5.4 + r) return true;
  return false;
}

export class GardenProps {
  constructor({ reducedMotion = false } = {}) {
    this.reducedMotion = reducedMotion;
    this.group = new THREE.Group();
    this.group.name = "GardenProps";
    this._dummy = new THREE.Object3D();
    this._geometries = [];
    this._materials = [];
    this._textures = [];
    this._fliers = [];

    // Colores derivados de la paleta
    this.lavender = shade(palette.blush, 0.68, -0.14, -0.02);
    this.flowerColors = [
      new THREE.Color(palette.blush),
      new THREE.Color(palette.cream),
      new THREE.Color(palette.ivory),
      this.lavender,
      new THREE.Color(palette.petal),
      shade(palette.blush, -0.02, 0.1, -0.08),
    ];

    // Un solo material con color por vértice (y por instancia) para casi todo
    this.matte = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    this._materials.push(this.matte);

    this._buildShadows();
    this._buildTrees();
    this._buildHedges();
    this._buildArch();
    this._buildBeds();
    this._buildChairs();
    this._buildGarlands();
    this._buildFliers();
    this._buildPetals();
  }

  // ---------- Utilidades de instancias ----------

  _instanced(geometry, material, count, name) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name;
    this._geometries.push(geometry);
    this.group.add(mesh);
    return mesh;
  }

  _put(mesh, i, x, y, z, sx, sy, sz, ry, color) {
    const d = this._dummy;
    d.position.set(x, y, z);
    d.rotation.set(0, ry, 0);
    d.scale.set(sx, sy, sz);
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
    if (color) mesh.setColorAt(i, color);
  }

  _finish(mesh) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  // ---------- Sombras suaves bajo árboles y arbustos ----------

  _buildShadows() {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.65)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._textures.push(tex);
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      map: tex,
      color: shade(palette.espresso, 0, 0, -0.02),
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this._materials.push(this.shadowMaterial);
    this.shadows = [];
  }

  _flushShadows() {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mesh = this._instanced(geo, this.shadowMaterial, this.shadows.length, "sombras");
    mesh.renderOrder = 1;
    this.shadows.forEach((s, i) => this._put(mesh, i, s.x, GROUND_Y + 0.04, s.z, s.w, 1, s.d, 0));
    this._finish(mesh);
  }

  // ---------- Árboles ----------

  _buildTrees() {
    const trees = [];
    const place = (x, z, s) => {
      const r = 2.7 * s;
      if (blocked(x, z, r)) return false;
      for (const t of trees) {
        if (Math.hypot(t.x - x, t.z - z) < (t.s + s) * 2.1) return false;
      }
      trees.push({ x, z, s });
      return true;
    };

    // Árboles de borde cercanos a la cámara, para enmarcar la vista a ras de suelo
    [
      [-15.5, 3, 1.15],
      [16.5, 1, 1.25],
      [-23, -3, 1.5],
      [24, -5, 1.4],
      [-19, -37, 1.1],
      [20, -40, 1.2],
    ].forEach(([x, z, s]) => place(x, z, s));

    for (const side of [-1, 1]) {
      let tries = 0;
      let count = 0;
      while (count < 24 && tries < 400) {
        tries++;
        const x = side * (14 + Math.pow(rng(), 1.3) * 32);
        const z = 14 - rng() * 148;
        const s = rand(0.85, 1.6) * (Math.abs(x) > 30 ? 1.2 : 1);
        if (place(x, z, s)) count++;
      }
    }

    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.36, 1, 7);
    trunkGeo.translate(0, 0.5, 0);
    const trunks = this._instanced(trunkGeo, new THREE.MeshLambertMaterial({ color: palette.trunk }), trees.length, "troncos");
    this._materials.push(trunks.material);

    // Copa: esfera achatada principal más tres lóbulos con colores por vértice
    const top = new THREE.Color(1, 1, 1);
    const low = new THREE.Color(0.8, 0.8, 0.8);
    const parts = [
      placed(prep(jitter(new THREE.IcosahedronGeometry(1, 2), 0.06), low), new THREE.Vector3(0, 0, 0), null, new THREE.Vector3(1, 0.86, 1)),
      placed(prep(jitter(new THREE.IcosahedronGeometry(0.66, 2), 0.07), top), new THREE.Vector3(0.62, 0.28, 0.25), null, new THREE.Vector3(1, 0.9, 1)),
      placed(prep(jitter(new THREE.IcosahedronGeometry(0.62, 2), 0.07), new THREE.Color(0.92, 0.92, 0.92)), new THREE.Vector3(-0.56, 0.22, -0.34), null, new THREE.Vector3(1, 0.9, 1)),
      placed(prep(jitter(new THREE.IcosahedronGeometry(0.58, 2), 0.07), top), new THREE.Vector3(0.05, 0.62, -0.1), null, new THREE.Vector3(1, 0.9, 1)),
    ];
    const canopyGeo = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    const canopies = this._instanced(canopyGeo, this.matte, trees.length, "copas");

    const tones = [
      new THREE.Color(palette.leaf),
      new THREE.Color(palette.sage),
      new THREE.Color(palette.grass),
      shade(palette.leaf, 0.01, 0.02, 0.06),
    ];
    trees.forEach((t, i) => {
      const trunkH = 2.6 * t.s;
      const canopyR = 2.5 * t.s;
      const ry = rand(0, Math.PI * 2);
      this._put(trunks, i, t.x, GROUND_Y, t.z, t.s, trunkH, t.s, ry);
      const tone = pick(tones).clone().offsetHSL(rand(-0.01, 0.01), 0, rand(-0.03, 0.04));
      this._put(canopies, i, t.x, GROUND_Y + trunkH + canopyR * 0.55, t.z, canopyR, canopyR, canopyR, ry, tone);
      this.shadows.push({ x: t.x + 0.6, z: t.z - 0.4, w: canopyR * 2.3, d: canopyR * 2.1 });
    });
    this._finish(trunks);
    this._finish(canopies);
    this.trees = trees;
  }

  // ---------- Setos ----------

  _buildHedges() {
    const len = 4;
    const geo = new RoundedBoxGeometry(len, 1.7, 1.7, 3, 0.55);
    const items = [];
    // Cumple zonas libres en el centro y en los extremos del seto
    const ok = (x, z) =>
      [-len / 2, 0, len / 2].every((o) => {
        const zz = z + o;
        return !(
          Math.hypot(x, zz) < 12.5 ||
          Math.hypot(x, zz + 44) < 18.5 ||
          Math.hypot(x, zz + 88) < 10.5 ||
          (Math.abs(x) < 17 && zz < -3 && zz > -35)
        );
      });

    // Bordeando el sendero a ambos lados
    for (const side of [-1, 1]) {
      for (let z = 12; z > -132; z -= len + 0.15) {
        if (ok(side * 6.2, z)) items.push({ x: side * 6.2, z, sy: rand(0.85, 1.15), ry: 0 });
      }
    }
    // Muros de seto lejanos, formando "salones" del jardín
    for (const side of [-1, 1]) {
      for (let z = 8; z > -128; z -= len + 0.15) {
        const x = side * 26;
        if (ok(x, z) && rng() > 0.18) items.push({ x, z, sy: rand(1.1, 1.7), ry: 0 });
      }
    }
    // Setos cortos que cierran las filas de sillas
    for (const side of [-1, 1]) {
      items.push({ x: side * 17.2, z: -70, sy: 1, ry: Math.PI / 2 });
      items.push({ x: side * 17.2, z: -74.2, sy: 1, ry: Math.PI / 2 });
    }

    const mesh = this._instanced(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), items.length, "setos");
    this._materials.push(mesh.material);
    const tones = [new THREE.Color(palette.leaf), new THREE.Color(palette.grassDeep), shade(palette.leaf, 0, 0.02, -0.04)];
    items.forEach((h, i) => {
      this._put(mesh, i, h.x, GROUND_Y + 0.85 * h.sy - 0.05, h.z, 1, h.sy, 1, h.ry, pick(tones));
      const along = h.ry ? { w: 2.8, d: len + 0.8 } : { w: len + 0.8, d: 2.8 };
      this.shadows.push({ x: h.x + 0.3, z: h.z - 0.2, ...along });
    });
    this._finish(mesh);
  }

  // ---------- Arco floral de boda ----------

  _buildArch() {
    const cx = 0;
    const cz = -27;
    const postX = 3.6;
    const postH = 5.8;
    const R = postX;
    const wood = new THREE.Color(palette.mocha);
    const woodLight = new THREE.Color(palette.caramel);
    const parts = [];

    // Postes y arco de madera
    for (const side of [-1, 1]) {
      parts.push(placed(prep(new THREE.CylinderGeometry(0.2, 0.26, postH, 8), wood), new THREE.Vector3(side * postX, GROUND_Y + postH / 2, 0)));
      parts.push(placed(prep(new THREE.CylinderGeometry(0.34, 0.4, 0.3, 8), woodLight), new THREE.Vector3(side * postX, GROUND_Y + 0.15, 0)));
    }
    const arc = new THREE.TorusGeometry(R, 0.2, 8, 36, Math.PI);
    parts.push(placed(prep(arc, wood), new THREE.Vector3(0, GROUND_Y + postH, 0)));
    // Follaje y flores: más densos hacia las esquinas y la corona
    const leafCols = [new THREE.Color(palette.leaf), new THREE.Color(palette.sage), new THREE.Color(palette.grassDeep), new THREE.Color(palette.grass)];
    const cy = GROUND_Y + postH;
    const arcPoint = (t, rad, depth) => {
      // t en [0, 1]: 0 poste izquierdo, 1 poste derecho
      const a = Math.PI - t * Math.PI;
      return new THREE.Vector3(Math.cos(a) * (R + rad), cy + Math.sin(a) * (R + rad), depth);
    };
    for (let i = 0; i < 150; i++) {
      const t = rng();
      const p = arcPoint(t, rand(-0.3, 0.3), rand(-0.3, 0.3));
      const leaf = new THREE.IcosahedronGeometry(1, 0);
      parts.push(placed(prep(leaf, pick(leafCols).clone().offsetHSL(0, 0, rand(-0.04, 0.05))), p, new THREE.Euler(rand(0, 3), rand(0, 3), rand(0, 3)), new THREE.Vector3(rand(0.22, 0.4), rand(0.08, 0.14), rand(0.14, 0.24))));
    }
    // Hiedra que baja por los postes
    for (const side of [-1, 1]) {
      for (let i = 0; i < 28; i++) {
        const h = rng() * postH * 0.95;
        parts.push(placed(prep(new THREE.IcosahedronGeometry(1, 0), pick(leafCols)), new THREE.Vector3(side * postX + rand(-0.3, 0.3), GROUND_Y + h, rand(-0.3, 0.3)), new THREE.Euler(rand(0, 3), rand(0, 3), rand(0, 3)), new THREE.Vector3(rand(0.15, 0.28), rand(0.07, 0.12), rand(0.12, 0.2))));
      }
    }
    const flowerCount = 130;
    for (let i = 0; i < flowerCount; i++) {
      // Distribución con más peso en los costados y la cima
      const u = rng();
      const t = u < 0.45 ? rand(0, 0.3) : u < 0.9 ? rand(0.7, 1) : rand(0.3, 0.7);
      const p = arcPoint(t, rand(-0.35, 0.4), rand(-0.34, 0.34));
      const c = pick(this.flowerColors).clone().offsetHSL(0, 0, rand(-0.04, 0.03));
      const s = rand(0.2, 0.42);
      parts.push(placed(prep(new THREE.IcosahedronGeometry(1, 1), c), p, null, new THREE.Vector3(s, s * 0.85, s)));
      if (rng() < 0.4) {
        const inner = new THREE.Color(palette.gold).lerp(new THREE.Color(palette.ivory), 0.4);
        parts.push(placed(prep(new THREE.IcosahedronGeometry(1, 0), inner), p.clone().add(new THREE.Vector3(0, 0, 0.14 * s / 0.3)), null, new THREE.Vector3(s * 0.35, s * 0.35, s * 0.35)));
      }
    }
    // Macizos al pie de los postes
    for (const side of [-1, 1]) {
      for (let i = 0; i < 26; i++) {
        const c = pick(this.flowerColors).clone();
        const s = rand(0.2, 0.36);
        parts.push(placed(prep(new THREE.IcosahedronGeometry(1, 1), c), new THREE.Vector3(side * postX + rand(-0.9, 0.9), GROUND_Y + rand(0.2, 1.1), rand(-0.8, 0.8)), null, new THREE.Vector3(s, s, s)));
      }
      for (let i = 0; i < 14; i++) {
        parts.push(placed(prep(new THREE.IcosahedronGeometry(1, 0), pick(leafCols)), new THREE.Vector3(side * postX + rand(-1, 1), GROUND_Y + rand(0.1, 0.5), rand(-0.9, 0.9)), new THREE.Euler(rand(0, 3), rand(0, 3), 0), new THREE.Vector3(rand(0.3, 0.5), rand(0.15, 0.25), rand(0.25, 0.4))));
      }
    }

    const geo = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    const mesh = new THREE.Mesh(geo, this.matte);
    mesh.name = "arco";
    mesh.position.set(cx, 0, cz);
    this._geometries.push(geo);
    this.group.add(mesh);
    this.shadows.push({ x: cx, z: cz - 0.3, w: 10, d: 3 });
  }

  // ---------- Macizos y jardineras de flores ----------

  _buildBeds() {
    const beds = [];
    const bedBlocked = (x, z, r) =>
      Math.hypot(x, z + 44) < 14 + r ||
      Math.hypot(x, z + 88) < 9 + r ||
      (Math.abs(x) < 8 + r && Math.abs(z) < 9) ||
      (Math.abs(x) < 6 && z < -3 && z > -36 && !(Math.abs(z + 27) < 3));

    const addBed = (x, z, w, d, planter) => {
      if (bedBlocked(x, z, Math.max(w, d) / 2)) return;
      for (const b of beds) if (Math.abs(b.x - x) < (b.w + w) / 2 && Math.abs(b.z - z) < (b.d + d) / 2) return;
      beds.push({ x, z, w, d, planter });
    };

    // Macizos al pie del arco, siguiendo el sendero
    addBed(-5.4, -27, 3.2, 3.2, false);
    addBed(5.4, -27, 3.2, 3.2, false);
    addBed(-7.8, -24, 3, 2.4, false);
    addBed(7.8, -24, 3, 2.4, false);
    // Jardineras a lo largo del sendero junto a los setos
    for (const side of [-1, 1]) {
      for (let z = -12; z > -130; z -= 7.4) addBed(side * 8.1, z, 2.2, 5.2, true);
    }
    // Macizos junto a la carta, laterales
    for (const side of [-1, 1]) {
      addBed(side * 10.5, 4, 3.4, 3.2, false);
      addBed(side * 12.5, -2, 3.6, 3.0, false);
      addBed(side * 9.6, -8, 3, 3, false);
    }
    // Praderas de flores silvestres y macizos grandes dispersos
    for (let i = 0; i < 46; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      addBed(side * rand(10, 38), rand(10, -125), rand(2.4, 5.5), rand(2.4, 5.5), false);
    }

    const roseCount = 340;
    const floretCount = 820;
    const leafCount = 380;
    const moundGeo = new THREE.IcosahedronGeometry(0.5, 1);
    const mounds = this._instanced(moundGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), beds.length, "macizos");
    this._materials.push(mounds.material);
    const planterGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.1);
    const planters = this._instanced(planterGeo, new THREE.MeshLambertMaterial({ color: palette.caramel }), beds.filter((b) => b.planter).length, "jardineras");
    this._materials.push(planters.material);

    // Rosa: capullo exterior más un corazón oscuro
    const rose = mergeGeometries([
      prep(new THREE.IcosahedronGeometry(1, 1), new THREE.Color(1, 1, 1)),
      placed(prep(new THREE.IcosahedronGeometry(0.62, 1), new THREE.Color(0.84, 0.8, 0.8)), new THREE.Vector3(0, 0.45, 0)),
    ]);
    const roses = this._instanced(rose, this.matte, roseCount, "rosas");
    const floretGeo = prep(new THREE.IcosahedronGeometry(1, 0), new THREE.Color(1, 1, 1));
    const florets = this._instanced(floretGeo, this.matte, floretCount, "florecillas");
    const leafGeo = prep(new THREE.IcosahedronGeometry(1, 0), new THREE.Color(1, 1, 1));
    const leaves = this._instanced(leafGeo, this.matte, leafCount, "hojas de macizo");

    const leafCols = [new THREE.Color(palette.leaf), new THREE.Color(palette.sage), new THREE.Color(palette.grassDeep)];
    // Cada macizo tiene una mezcla propia de 2 o 3 colores
    let r = 0;
    let f = 0;
    let l = 0;
    let mi = 0;
    let pi = 0;
    const perBed = (b) => Math.max(4, Math.round((b.w * b.d) * 1.0));
    const totalArea = beds.reduce((a, b) => a + perBed(b), 0);
    const roseShare = Math.min(1, roseCount / totalArea);
    beds.forEach((b) => {
      const mix = [pick(this.flowerColors), pick(this.flowerColors), pick(this.flowerColors)];
      const topY = GROUND_Y + (b.planter ? 0.6 : 0.42);
      if (b.planter) {
        this._put(planters, pi++, b.x, GROUND_Y + 0.25, b.z, b.w, 0.5, b.d, 0);
        this._put(mounds, mi++, b.x, GROUND_Y + 0.5, b.z, b.w * 0.95, 0.55, b.d * 0.95, 0, pick(leafCols));
      } else {
        this._put(mounds, mi++, b.x, GROUND_Y + 0.05, b.z, b.w * 1.05, 0.95, b.d * 1.05, 0, pick(leafCols));
      }
      const n = perBed(b);
      for (let k = 0; k < n * 2.4 && f < floretCount; k++) {
        const x = b.x + rand(-0.5, 0.5) * b.w * 0.95;
        const z = b.z + rand(-0.5, 0.5) * b.d * 0.95;
        const s = rand(0.1, 0.2);
        const c = pick(mix).clone().offsetHSL(rand(-0.015, 0.015), 0, rand(-0.06, 0.04));
        this._put(florets, f++, x, topY + rand(0.05, 0.45), z, s, s, s, rand(0, 3), c);
      }
      for (let k = 0; k < n && r < roseCount; k++) {
        if (rng() > roseShare * 1.4) continue;
        const x = b.x + rand(-0.5, 0.5) * b.w * 0.9;
        const z = b.z + rand(-0.5, 0.5) * b.d * 0.9;
        const s = rand(0.22, 0.38);
        const c = pick(mix).clone().offsetHSL(0, 0, rand(-0.05, 0.03));
        this._put(roses, r++, x, topY + rand(0.1, 0.5), z, s, s, s, rand(0, 3), c);
      }
      for (let k = 0; k < n * 1.1 && l < leafCount; k++) {
        const x = b.x + rand(-0.5, 0.5) * b.w;
        const z = b.z + rand(-0.5, 0.5) * b.d;
        const c = pick(leafCols).clone().offsetHSL(0, 0, rand(-0.03, 0.08));
        this._put(leaves, l++, x, topY - 0.05 + rand(0, 0.25), z, rand(0.25, 0.4), rand(0.1, 0.16), rand(0.18, 0.3), rand(0, 3), c);
      }
    });
    mounds.count = mi;
    planters.count = pi;
    roses.count = r;
    florets.count = f;
    leaves.count = l;
    [mounds, planters, roses, florets, leaves].forEach((m) => this._finish(m));
    this.beds = beds;
  }

  // ---------- Sillas de boda ----------

  _buildChairs() {
    const seat = new THREE.Color(palette.ivory);
    const frame = new THREE.Color(palette.latte);
    const parts = [
      placed(prep(new THREE.BoxGeometry(0.62, 0.08, 0.6), seat), new THREE.Vector3(0, 0.62, 0)),
      placed(prep(new THREE.BoxGeometry(0.62, 0.74, 0.07), seat), new THREE.Vector3(0, 1.02, 0.3)),
      placed(prep(new THREE.BoxGeometry(0.5, 0.1, 0.05), frame), new THREE.Vector3(0, 1.3, 0.32)),
    ];
    for (const lx of [-0.26, 0.26]) {
      for (const lz of [-0.24, 0.26]) {
        parts.push(placed(prep(new THREE.BoxGeometry(0.06, 0.62, 0.06), frame), new THREE.Vector3(lx, 0.31, lz)));
      }
    }
    const geo = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());

    const slots = [];
    for (const side of [-1, 1]) {
      for (let row = 0; row < 6; row++) {
        for (let k = 0; k < 4; k++) {
          slots.push({ x: side * (9.4 + k * 1.15), z: -64.5 - row * 2.1 });
        }
      }
    }
    const mesh = this._instanced(geo, this.matte, slots.length, "sillas");
    const white = new THREE.Color(1, 1, 1);
    slots.forEach((s, i) => this._put(mesh, i, s.x, GROUND_Y, s.z, 1.2, 1.2, 1.2, 0, white));
    this._finish(mesh);
    for (const side of [-1, 1]) this.shadows.push({ x: side * 11.2, z: -69.5, w: 6, d: 14 });
  }

  // ---------- Guirnaldas de luces ----------

  _buildGarlands() {
    const poleH = 7;
    const poles = [];
    const runs = [];
    // Hilera junto a la carta: postes altos a los lados (detrás del sendero visual)
    const addPole = (x, z, h = poleH) => {
      poles.push({ x, z, h });
      return new THREE.Vector3(x, GROUND_Y + h, z);
    };

    const a1 = addPole(-17, -12);
    const a2 = addPole(-17, -21);
    const a3 = addPole(-17, -30);
    runs.push([a1, a2, 1.0], [a2, a3, 1.0]);
    const b1 = addPole(17, -12);
    const b2 = addPole(17, -21);
    const b3 = addPole(17, -30);
    runs.push([b1, b2, 1.0], [b2, b3, 1.0]);

    // Dosel sobre el pasillo de sillas: pares de postes cruzados
    for (const z of [-64.5, -70.8, -77]) {
      const l = addPole(-7.4, z, 6.4);
      const r = addPole(7.4, z, 6.4);
      runs.push([l, r, 1.5]);
    }
    // Y a lo largo de cada lado, unidos entre sí
    runs.push([new THREE.Vector3(-7.4, GROUND_Y + 6.4, -64.5), new THREE.Vector3(-7.4, GROUND_Y + 6.4, -70.8), 0.9]);
    runs.push([new THREE.Vector3(-7.4, GROUND_Y + 6.4, -70.8), new THREE.Vector3(-7.4, GROUND_Y + 6.4, -77), 0.9]);
    runs.push([new THREE.Vector3(7.4, GROUND_Y + 6.4, -64.5), new THREE.Vector3(7.4, GROUND_Y + 6.4, -70.8), 0.9]);
    runs.push([new THREE.Vector3(7.4, GROUND_Y + 6.4, -70.8), new THREE.Vector3(7.4, GROUND_Y + 6.4, -77), 0.9]);

    // Entre el arco y los primeros postes del pasillo: guirnalda larga sobre el sendero
    const c1 = addPole(-9, -102, 6.6);
    const c2 = addPole(9, -102, 6.6);
    const c3 = addPole(-9, -114, 6.6);
    const c4 = addPole(9, -114, 6.6);
    runs.push([c1, c2, 1.6], [c3, c4, 1.6], [c1, c3, 1.1], [c2, c4, 1.1]);

    // Del arco a dos postes laterales
    const archTop = new THREE.Vector3(-3.6, GROUND_Y + 5.8, -27);
    const archTopR = new THREE.Vector3(3.6, GROUND_Y + 5.8, -27);
    runs.push([archTop, a3, 1.4], [archTopR, b3, 1.4]);

    // Postes
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 6);
    poleGeo.translate(0, 0.5, 0);
    const poleMesh = this._instanced(poleGeo, new THREE.MeshLambertMaterial({ color: palette.mocha }), poles.length, "postes");
    this._materials.push(poleMesh.material);
    poles.forEach((p, i) => this._put(poleMesh, i, p.x, GROUND_Y, p.z, 1, p.h, 1, 0));
    this._finish(poleMesh);

    // Cuerdas y bombillos
    const bulbPositions = [];
    const tubes = [];
    const stringColor = new THREE.Color(palette.espresso);
    runs.forEach(([a, b, sag]) => {
      const mid = a.clone().lerp(b, 0.5);
      mid.y -= sag * 1.6;
      const quarter1 = a.clone().lerp(b, 0.25);
      quarter1.y -= sag * 1.15;
      const quarter3 = a.clone().lerp(b, 0.75);
      quarter3.y -= sag * 1.15;
      const curve = new THREE.CatmullRomCurve3([a, quarter1, mid, quarter3, b]);
      tubes.push(prep(new THREE.TubeGeometry(curve, 24, 0.035, 4, false), stringColor));
      const n = Math.max(6, Math.round(curve.getLength() / 0.85));
      for (let i = 1; i < n; i++) {
        const p = curve.getPoint(i / n);
        bulbPositions.push(p.clone().add(new THREE.Vector3(0, -0.13, 0)));
      }
    });
    const stringGeo = mergeGeometries(tubes);
    tubes.forEach((t) => t.dispose());
    const strings = new THREE.Mesh(stringGeo, this.matte);
    strings.name = "cuerdas";
    this._geometries.push(stringGeo);
    this.group.add(strings);

    // Dos grupos de bombillos que titilan en contrafase
    this.bulbMaterials = [0, 1].map(
      () =>
        new THREE.MeshStandardMaterial({
          color: palette.haze,
          emissive: palette.spotlight,
          emissiveIntensity: 1,
          roughness: 0.5,
        }),
    );
    this._materials.push(...this.bulbMaterials);
    const bulbGeo = new THREE.IcosahedronGeometry(0.13, 1);
    this._geometries.push(bulbGeo);
    this.bulbMeshes = [0, 1].map((g) => {
      const list = bulbPositions.filter((_, i) => i % 2 === g);
      const m = new THREE.InstancedMesh(bulbGeo, this.bulbMaterials[g], list.length);
      m.name = `bombillos ${g}`;
      list.forEach((p, i) => this._put(m, i, p.x, p.y, p.z, 1, 1.25, 1, 0));
      this._finish(m);
      this.group.add(m);
      return m;
    });
  }

  // ---------- Mariposas y abejas ----------

  _buildFliers() {
    const butterflies = 16;
    const bees = 10;
    const total = butterflies + bees;

    // Ala derecha en el plano XZ (la izquierda se obtiene con escala x negativa)
    const s1 = new THREE.Shape();
    s1.absellipse(0.5, 0.28, 0.5, 0.32, 0, Math.PI * 2, false, 0.3);
    const s2 = new THREE.Shape();
    s2.absellipse(0.38, -0.2, 0.34, 0.26, 0, Math.PI * 2, false, -0.3);
    const wingGeo = new THREE.ShapeGeometry([s1, s2], 8).rotateX(-Math.PI / 2);
    this._geometries.push(wingGeo);
    this.wingMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this._materials.push(this.wingMaterial);
    this.wings = new THREE.InstancedMesh(wingGeo, this.wingMaterial, total * 2);
    this.wings.name = "alas";
    this.wings.frustumCulled = false;
    this.group.add(this.wings);

    // Cuerpos: mariposas delgadas oscuras y abejas rayadas
    const bflyBody = mergeGeometries([
      placed(prep(new THREE.IcosahedronGeometry(1, 0), new THREE.Color(palette.espresso)), new THREE.Vector3(0, 0, 0), null, new THREE.Vector3(0.035, 0.035, 0.22)),
    ]);
    const beeYellow = shade(palette.gold, 0.04, 0.2, 0.2);
    const beeBody = mergeGeometries([
      placed(prep(new THREE.IcosahedronGeometry(1, 1), beeYellow), new THREE.Vector3(0, 0, -0.04), null, new THREE.Vector3(0.07, 0.07, 0.11)),
      placed(prep(new THREE.IcosahedronGeometry(1, 0), new THREE.Color(palette.espresso)), new THREE.Vector3(0, 0, -0.14), null, new THREE.Vector3(0.072, 0.072, 0.03)),
      placed(prep(new THREE.IcosahedronGeometry(1, 0), new THREE.Color(palette.espresso)), new THREE.Vector3(0, 0, 0.1), null, new THREE.Vector3(0.05, 0.05, 0.05)),
    ]);
    this._geometries.push(bflyBody, beeBody);
    this.bflyBodies = new THREE.InstancedMesh(bflyBody, this.matte, butterflies);
    this.beeBodies = new THREE.InstancedMesh(beeBody, this.matte, bees);
    this.bflyBodies.frustumCulled = false;
    this.beeBodies.frustumCulled = false;
    this.bflyBodies.name = "cuerpos mariposa";
    this.beeBodies.name = "cuerpos abeja";
    this.group.add(this.bflyBodies, this.beeBodies);

    const wingColors = [
      new THREE.Color(palette.blush),
      new THREE.Color(palette.cream),
      new THREE.Color(palette.petal),
      this.lavender,
      shade(palette.gold, 0.02, 0.15, 0.2),
      new THREE.Color(palette.ivory),
    ];
    const beeWing = new THREE.Color(palette.ivory);

    for (let i = 0; i < total; i++) {
      const isBee = i >= butterflies;
      const side = rng() < 0.5 ? -1 : 1;
      // Cerca de los macizos y del camino; las abejas más pequeñas y rápidas
      const cx = side * rand(7, isBee ? 22 : 26);
      const cz = rand(8, -120);
      const f = {
        isBee,
        index: isBee ? i - butterflies : i,
        cx,
        cz,
        cy: GROUND_Y + (isBee ? rand(1.0, 2.2) : rand(1.6, 4.2)),
        rx: isBee ? rand(1.2, 2.4) : rand(2.5, 6),
        rz: isBee ? rand(1.2, 2.4) : rand(3, 8),
        ry: isBee ? rand(0.2, 0.5) : rand(0.5, 1.2),
        w: isBee ? rand(0.9, 1.5) : rand(0.28, 0.5),
        ph: rand(0, Math.PI * 2),
        flap: isBee ? rand(38, 48) : rand(9, 13),
        size: isBee ? 0.2 : rand(0.5, 0.8),
      };
      this._fliers.push(f);
      const color = isBee ? beeWing : pick(wingColors).clone().offsetHSL(0, 0, rand(-0.05, 0.02));
      this.wings.setColorAt(i * 2, color);
      this.wings.setColorAt(i * 2 + 1, color);
    }
    this.wings.instanceColor.needsUpdate = true;
    this._poseFliers(0, 0.55);
  }

  _flierPosition(f, t, out) {
    const a = t * f.w + f.ph;
    out.set(
      f.cx + Math.sin(a) * f.rx,
      f.cy + Math.sin(a * 1.9 + f.ph) * f.ry,
      f.cz + Math.sin(a * 2) * f.rz * 0.7 + Math.cos(a * 0.5) * f.rz * 0.3,
    );
    return out;
  }

  _poseFliers(t, fixedFlap) {
    const d = this._dummy;
    const pos = new THREE.Vector3();
    const ahead = new THREE.Vector3();
    const qYaw = new THREE.Quaternion();
    const qFlap = new THREE.Quaternion();
    const axisY = new THREE.Vector3(0, 1, 0);
    const axisZ = new THREE.Vector3(0, 0, 1);
    for (const f of this._fliers) {
      this._flierPosition(f, t, pos);
      this._flierPosition(f, t + 0.05, ahead);
      const yaw = Math.atan2(ahead.x - pos.x, ahead.z - pos.z);
      qYaw.setFromAxisAngle(axisY, yaw);
      const flapAngle =
        fixedFlap !== undefined
          ? fixedFlap
          : f.isBee
            ? 0.45 + 0.5 * Math.sin(t * f.flap + f.ph)
            : 0.15 + 1.0 * Math.sin(t * f.flap + f.ph);
      const bodyMesh = f.isBee ? this.beeBodies : this.bflyBodies;
      const sc = f.isBee ? 1 : f.size * 1.4;
      d.position.copy(pos);
      d.quaternion.copy(qYaw);
      d.scale.set(sc, sc, sc);
      d.updateMatrix();
      bodyMesh.setMatrixAt(f.index, d.matrix);
      for (const side of [1, -1]) {
        qFlap.setFromAxisAngle(axisZ, side * flapAngle);
        d.quaternion.copy(qYaw).multiply(qFlap);
        d.scale.set(side * f.size, f.size, f.size);
        d.updateMatrix();
        this.wings.setMatrixAt((f.isBee ? 16 + f.index : f.index) * 2 + (side === 1 ? 0 : 1), d.matrix);
      }
    }
    this.wings.instanceMatrix.needsUpdate = true;
    this.bflyBodies.instanceMatrix.needsUpdate = true;
    this.beeBodies.instanceMatrix.needsUpdate = true;
  }

  // ---------- Pétalos y flores caídas sobre el pasto ----------

  _buildPetals() {
    const count = 760;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    geo.scale(1, 0.12, 0.7);
    const mesh = this._instanced(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), count, "petalos suelo");
    this._materials.push(mesh.material);
    mesh.material.polygonOffset = true;
    mesh.material.polygonOffsetFactor = -1;
    mesh.material.polygonOffsetUnits = -1;
    for (let i = 0; i < count; i++) {
      let x;
      let z;
      const u = rng();
      if (u < 0.3) {
        // Pasillo del arco
        x = rand(-3.4, 3.4);
        z = rand(-20, -36);
      } else if (u < 0.5) {
        // Pasillo de las sillas
        x = rand(-3.8, 3.8);
        z = rand(-62, -80);
      } else if (u < 0.58) {
        // Entorno de la carta
        x = rand(-8, 8);
        z = rand(8, -8);
      } else {
        x = rand(-34, 34);
        z = rand(12, -125);
      }
      const s = rand(0.07, 0.17);
      const c = pick(this.flowerColors).clone().offsetHSL(rand(-0.01, 0.01), 0, rand(-0.07, 0.03));
      this._put(mesh, i, x, GROUND_Y + 0.03 + rng() * 0.02, z, s, s, s, rand(0, Math.PI * 2), c);
    }
    this._finish(mesh);
    this._flushShadows();
  }

  // ---------- Ciclo de vida ----------

  update(elapsed) {
    if (this.reducedMotion) return;
    this._poseFliers(elapsed);
    // Titilar suave de los focos de las guirnaldas, en contrafase
    this.bulbMaterials[0].emissiveIntensity = 0.85 + 0.2 * Math.sin(elapsed * 1.6);
    this.bulbMaterials[1].emissiveIntensity = 0.85 + 0.2 * Math.sin(elapsed * 1.6 + Math.PI);
  }

  dispose() {
    this.group.removeFromParent();
    this._geometries.forEach((g) => g.dispose());
    this._materials.forEach((m) => m.dispose());
    this._textures.forEach((t) => t.dispose());
    this.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    this._geometries = [];
    this._materials = [];
    this._textures = [];
  }
}
