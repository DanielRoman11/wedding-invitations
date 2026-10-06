import * as THREE from "three";
import { palette } from "../config.js";
import { GardenProps } from "./GardenProps.js";

/**
 * Base del jardín de bodas (tarde dorada): cúpula de cielo con sol difuso,
 * suelo de césped con ondulaciones, sendero de piedra café que pasa por los
 * tres objetos (z = 0, -44, -88), colinas lejanas y pasto alto instanciado.
 * Compone GardenProps (árboles, setos, arco, flores, luces...).
 *
 * Todo se funde con la niebla de la escena (color skyDeep).
 */

const GROUND_Y = -4;
const Z_NEAR = 14;
const Z_FAR = -140;
const HALF_WIDTH = 60;
const OBJECT_ZONES = [
  { z: 0, r: 12 },
  { z: -44, r: 18 },
  { z: -88, r: 10 },
];

/** Posición x del sendero en z. Cruza x=0 en z = 0, -44, -88 con tangente recta. */
export function pathX(z) {
  const s = Math.sin((Math.PI * z) / 44);
  return 7 * s * Math.abs(s);
}

/** Altura del terreno (relativa al plano del suelo). Plano cerca del sendero. */
export function groundHeight(x, z) {
  const d = Math.abs(x - pathX(z));
  const m = THREE.MathUtils.smoothstep(d, 14, 26);
  const h =
    Math.sin(x * 0.09 + 1.3) * Math.cos(z * 0.07 + 0.4) * 0.5 +
    Math.sin(x * 0.21 + z * 0.15) * 0.18 +
    Math.cos(x * 0.05 - z * 0.11) * 0.35;
  return h * m * 1.1;
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Generador pseudoaleatorio determinista (mulberry32) */
function makeRng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inFreeZone(x, z, margin = 0) {
  for (const zone of OBJECT_ZONES) {
    if (Math.hypot(x, z - zone.z) < zone.r + margin) return true;
  }
  return false;
}

export class Garden {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "Garden";
    this._disposables = [];

    this._buildSky();
    this._buildGround();
    this._buildPath();
    this._buildHills();
    this._buildTufts();
    this._buildLights();

    this.props = new GardenProps();
    this.group.add(this.props.group);
  }

  /* ---------------------------------------------------------------- cielo */

  _buildSky() {
    const geo = new THREE.SphereGeometry(120, 32, 16);
    const sunDir = new THREE.Vector3(0.22, 0.3, -1).normalize();
    this.sunDir = sunDir;
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      uniforms: {
        uHorizon: { value: new THREE.Color(palette.skyDeep) },
        uMid: { value: new THREE.Color(0xf6d6b8) },
        uTop: { value: new THREE.Color(0xfdf3e1) },
        uSun: { value: new THREE.Color(0xfff0cc) },
        uSunDir: { value: sunDir },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uHorizon;
        uniform vec3 uMid;
        uniform vec3 uTop;
        uniform vec3 uSun;
        uniform vec3 uSunDir;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
          col = mix(col, uTop, smoothstep(0.15, 0.85, h));
          float s = max(dot(d, normalize(uSunDir)), 0.0);
          float halo = pow(s, 6.0) * 0.55 + pow(s, 40.0) * 0.5;
          float disc = smoothstep(0.9965, 0.9992, s);
          col = mix(col, uSun, clamp(halo, 0.0, 0.85));
          col = mix(col, vec3(1.0, 0.98, 0.92), disc * 0.9);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.renderOrder = -100;
    this.sky.frustumCulled = false;
    this.group.add(this.sky);
    this._disposables.push(geo, mat);
  }

  /* ----------------------------------------------------------------- suelo */

  _grassTexture() {
    const size = 512;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = "#d4d8bf";
    g.fillRect(0, 0, size, size);
    const rng = makeRng(7);
    // Manchas suaves (envuelven los bordes para que repita sin costuras)
    for (let i = 0; i < 90; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 14 + rng() * 40;
      const l = 190 + rng() * 50;
      g.fillStyle = `rgba(${l - 8},${l},${l - 24},${0.12 + rng() * 0.12})`;
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          g.beginPath();
          g.arc(x + ox, y + oy, r, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // Briznas
    for (let i = 0; i < 5000; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const l = 150 + rng() * 90;
      g.strokeStyle = `rgba(${l - 20},${l},${l - 50},${0.25 + rng() * 0.3})`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 4, y - 3 - rng() * 6);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(30, 38);
    tex.anisotropy = 4;
    this._disposables.push(tex);
    return tex;
  }

  _buildGround() {
    const depth = Z_NEAR - Z_FAR;
    const centerZ = (Z_NEAR + Z_FAR) / 2;
    const geo = new THREE.PlaneGeometry(HALF_WIDTH * 2, depth, 60, 77);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color(palette.grass);
    const cDeep = new THREE.Color(palette.grassDeep);
    const cSage = new THREE.Color(palette.sage);
    const cLatte = new THREE.Color(palette.latte);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i) + centerZ;
      pos.setY(i, groundHeight(x, z));
      const n1 = valueNoise(x * 0.08, z * 0.08);
      const n2 = valueNoise(x * 0.3 + 40, z * 0.3 + 9);
      tmp.copy(cGrass).lerp(cDeep, THREE.MathUtils.smoothstep(n1, 0.35, 0.8));
      tmp.lerp(cSage, THREE.MathUtils.smoothstep(n2, 0.5, 0.95) * 0.55);
      // Un toque de tierra seca cerca del sendero
      const d = Math.abs(x - pathX(z));
      tmp.lerp(cLatte, (1 - THREE.MathUtils.smoothstep(d, 1.5, 6)) * 0.35);
      // Más claro en la lejanía para fundirse con la bruma
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const map = this._grassTexture();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map,
      roughness: 1,
      metalness: 0,
      emissive: 0xffe9b0,
      emissiveMap: map,
      emissiveIntensity: 0.22,
    });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.position.set(0, GROUND_Y, centerZ);
    this.group.add(this.ground);
    this._disposables.push(geo, mat);
  }

  /* --------------------------------------------------------------- sendero */

  _pathTexture() {
    const w = 256;
    const h = 512;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    const rng = makeRng(21);
    g.fillStyle = "#d9bf9b";
    g.fillRect(0, 0, w, h);
    // Variación de tierra
    for (let i = 0; i < 160; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const r = 8 + rng() * 26;
      const dark = rng() < 0.5;
      g.fillStyle = dark ? "rgba(185,133,88,0.16)" : "rgba(247,239,227,0.2)";
      for (const oy of [-h, 0, h]) {
        g.beginPath();
        g.arc(x, y + oy, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Piedritas
    for (let i = 0; i < 380; i++) {
      const x = 30 + rng() * (w - 60);
      const y = rng() * h;
      const rx = 3 + rng() * 6;
      const ry = rx * (0.6 + rng() * 0.3);
      const l = 190 + rng() * 55;
      for (const oy of [-h, 0, h]) {
        g.fillStyle = `rgba(${l},${l - 28},${l - 66},0.8)`;
        g.beginPath();
        g.ellipse(x, y + oy, rx, ry, rng() * 3, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "rgba(122,80,52,0.35)";
        g.lineWidth = 1;
        g.stroke();
      }
    }
    // Borde irregular transparente (alfa) hacia el césped
    const img = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        const edge = 1 - Math.abs(u - 0.5) * 2; // 0 en bordes, 1 al centro
        const wob = valueNoise(y * 0.06, u * 3) * 0.12 + valueNoise(y * 0.2, 5) * 0.05;
        const a = THREE.MathUtils.smoothstep(edge, 0.06 + wob, 0.22 + wob);
        const i = (y * w + x) * 4;
        img.data[i + 3] = Math.round(a * 255);
        // Borde algo más oscuro (tierra húmeda)
        const rim = 1 - THREE.MathUtils.smoothstep(edge, 0.12, 0.4);
        img.data[i] *= 1 - rim * 0.1;
        img.data[i + 1] *= 1 - rim * 0.14;
        img.data[i + 2] *= 1 - rim * 0.18;
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    this._disposables.push(tex);
    return tex;
  }

  _buildPath() {
    const halfW = 2.1;
    const step = 1.5;
    const count = Math.ceil((Z_NEAR - Z_FAR) / step);
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= count; i++) {
      const z = Z_NEAR - i * step;
      const x = pathX(z);
      // Tangente para el ancho perpendicular
      const dx = pathX(z - 0.1) - pathX(z + 0.1);
      const dz = -0.2;
      const len = Math.hypot(dx, dz);
      const nx = -dz / len;
      const nz = dx / len;
      const y = GROUND_Y + 0.05;
      positions.push(x - nx * halfW, y, z - nz * halfW, x + nx * halfW, y, z + nz * halfW);
      const v = (i * step) / 8;
      uvs.push(0, v, 1, v);
      if (i < count) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    // Las normales deben apuntar hacia arriba
    const nrm = geo.attributes.normal;
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);

    const map = this._pathTexture();
    const mat = new THREE.MeshStandardMaterial({
      map,
      transparent: true,
      roughness: 1,
      metalness: 0,
      emissive: 0xffffff,
      emissiveMap: map,
      emissiveIntensity: 0.3,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.path = new THREE.Mesh(geo, mat);
    this.path.renderOrder = 1;
    this.path.frustumCulled = false;
    this.group.add(this.path);
    this._disposables.push(geo, mat);
  }

  /* --------------------------------------------------------------- colinas */

  _buildHills() {
    const layers = [
      { z: -132, base: 5, amp: 9, freq: 0.045, seed: 1, color: 0x9bb088, mix: 0.5 },
      { z: -146, base: 9, amp: 14, freq: 0.03, seed: 2, color: 0xb7c3a0, mix: 0.7 },
    ];
    const fogColor = new THREE.Color(palette.skyDeep);
    const segs = 70;
    for (const l of layers) {
      const positions = [];
      const colors = [];
      const indices = [];
      const top = new THREE.Color(l.color).lerp(fogColor, l.mix);
      const bottom = new THREE.Color(palette.grassDeep).lerp(fogColor, l.mix);
      for (let i = 0; i <= segs; i++) {
        const x = -130 + (260 * i) / segs;
        const h =
          l.base +
          valueNoise(x * l.freq + l.seed * 10, l.seed) * l.amp +
          Math.sin(x * 0.02 + l.seed) * 2;
        positions.push(x, GROUND_Y + h, l.z, x, GROUND_Y - 2, l.z);
        colors.push(top.r, top.g, top.b, bottom.r, bottom.g, bottom.b);
        if (i < segs) {
          const a = i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geo.setIndex(indices);
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this._disposables.push(geo, mat);
    }
  }

  /* ------------------------------------------------------------ pasto alto */

  _buildTufts() {
    // Mechón: tres hojas cónicas cruzadas, base oscura y punta clara
    const positions = [];
    const colors = [];
    const base = new THREE.Color(palette.grassDeep);
    const tip = new THREE.Color(0xb8c878);
    for (let b = 0; b < 3; b++) {
      const a = (b * Math.PI) / 3;
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      const w = 0.12;
      const lean = 0.12 * (b - 1);
      positions.push(
        -cx * w, 0, -cz * w,
        cx * w, 0, cz * w,
        lean * cz, 1, -lean * cx
      );
      colors.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this._swayTime = { value: 0 };
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this._swayTime;
      shader.vertexShader = shader.vertexShader
        .replace("void main() {", "uniform float uTime;\nvoid main() {")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           #ifdef USE_INSTANCING
             float ph = instanceMatrix[3].x * 0.4 + instanceMatrix[3].z * 0.25;
             transformed.x += sin(uTime * 1.6 + ph) * 0.22 * position.y * position.y;
             transformed.z += cos(uTime * 1.3 + ph) * 0.12 * position.y * position.y;
           #endif`
        );
    };

    const count = 2600;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const rng = makeRng(99);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 20) {
      const x = (rng() * 2 - 1) * 48;
      const z = Z_NEAR - 2 - rng() * (Z_NEAR - 2 - 125);
      if (Math.abs(x - pathX(z)) < 2.8) continue;
      if (inFreeZone(x, z, -3)) continue;
      const y = GROUND_Y + groundHeight(x, z);
      const h = 0.5 + rng() * 0.8;
      p.set(x, y, z);
      e.set(0, rng() * Math.PI, 0);
      q.setFromEuler(e);
      s.set(h * 1.2, h, h * 1.2);
      m.compose(p, q, s);
      mesh.setMatrixAt(placed, m);
      col.setHSL(0.22 + rng() * 0.06, 0.4 + rng() * 0.15, 0.5 + rng() * 0.2);
      mesh.setColorAt(placed, col);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.tufts = mesh;
    this.group.add(mesh);
    this._disposables.push(geo, mat);
  }

  /* ------------------------------------------------------------------ luz */

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(palette.haze, palette.grass, 0.55);
    this.sun = new THREE.DirectionalLight(palette.spotlight, 0.8);
    this.sun.position.copy(this.sunDir).multiplyScalar(-1).multiplyScalar(-40);
    this.group.add(this.hemi, this.sun);
  }

  /* ---------------------------------------------------------------- ciclo */

  update(elapsed, delta, cameraPosition) {
    if (cameraPosition) this.sky.position.copy(cameraPosition);
    this._swayTime.value = elapsed;
    this.props.update(elapsed, delta, cameraPosition);
  }

  dispose() {
    this.props.dispose();
    for (const d of this._disposables) d.dispose();
    this._disposables.length = 0;
    this.tufts.dispose();
  }
}
