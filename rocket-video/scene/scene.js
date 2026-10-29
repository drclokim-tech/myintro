/* 공공 AX 네트워크 2,700명 돌파 — Cesium rocket launch scene.
 * Everything is a pure function of time t (seconds), so render.js can step frames deterministically
 * (apart from Cesium's particle systems, which are warmed up before capture). */
'use strict';
const C = Cesium;

// ---------------------------------------------------------------- timeline
const DURATION = 60;
const T = {
  brandIn: 1.0, countdown: 7.5, ignition: 12.3, liftoff: 13.0, reach: 42.0,
  celebrateEnd: 48.0, turnEnd: 51.0, glitch: 50.0, hudOut: 56.6, flash: 57.2, end: 60,
};
const GOAL = 2700;
const DAYS = 301; // 2026-01-01 → 2026-10-29
const K = 5;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, s) => a + (b - a) * s;
const smooth = (a, b, x) => { const s = clamp((x - a) / (b - a)); return s * s * (3 - 2 * s); };
const easeInOutCubic = (s) => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const logLerp = (a, b, s) => Math.exp(lerp(Math.log(a), Math.log(b), s));
const rad = C.Math.toRadians;

// Network size (= altitude in km). Slow liftoff, accelerating growth, then a slow approach to 2,700.
function countAt(t) {
  const u = clamp((t - T.liftoff) / (T.reach - T.liftoff));
  return GOAL * (Math.exp(K * easeInOutCubic(u)) - 1) / (Math.exp(K) - 1);
}
function dateAt(t) {
  const u = clamp((t - T.liftoff) / (T.reach - T.liftoff));
  const d = new Date(Date.UTC(2026, 0, 1) + Math.round(u * DAYS) * 86400000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}
function timeAtCount(n) { let a = T.liftoff, b = T.reach; for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (countAt(m) < n) a = m; else b = m; } return b; }
const T_SEP = timeAtCount(150); // first-stage separation just after the Kármán line

// ---------------------------------------------------------------- viewer
C.Ion.defaultAccessToken = undefined;
const START = C.JulianDate.fromIso8601('2026-10-28T20:40:00Z'); // 05:40 KST, pre-dawn
const viewer = new C.Viewer('cesium', {
  baseLayer: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
  navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false, infoBox: false,
  selectionIndicator: false, scene3DOnly: true, useDefaultRenderLoop: false, requestRenderMode: false,
  shouldAnimate: false, msaaSamples: 4,
  contextOptions: { webgl: { preserveDrawingBuffer: true, alpha: false } },
});
const scene = viewer.scene, globe = scene.globe, camera = scene.camera;
viewer.resolutionScale = 1;
viewer.clock.currentTime = START.clone();
viewer.clock.shouldAnimate = false;
globe.enableLighting = true;
globe.baseColor = C.Color.BLACK;
globe.showGroundAtmosphere = false;
globe.depthTestAgainstTerrain = false;
scene.fog.enabled = true;
scene.highDynamicRange = false;
camera.frustum.fov = rad(62);
camera.frustum.near = 0.5;
const bloom = scene.postProcessStages.bloom;
bloom.enabled = true;
bloom.uniforms.contrast = 119;
bloom.uniforms.brightness = -0.35;
bloom.uniforms.glowOnly = false;
bloom.uniforms.delta = 1.0;
bloom.uniforms.sigma = 3.0;
bloom.uniforms.stepSize = 1.0;

const IMG = '/node_modules/three-globe/example/img/';
let nightLayer;
async function addImagery() {
  const day = await C.SingleTileImageryProvider.fromUrl(IMG + 'earth-blue-marble.jpg');
  const night = await C.SingleTileImageryProvider.fromUrl(IMG + 'earth-night.jpg');
  const dayLayer = viewer.imageryLayers.addImageryProvider(day);
  dayLayer.nightAlpha = 0.0;
  nightLayer = viewer.imageryLayers.addImageryProvider(night);
  nightLayer.dayAlpha = 0.0;
  nightLayer.brightness = 1.6;
}

// ---------------------------------------------------------------- places
const PAD = C.Cartesian3.fromDegrees(127.2690, 36.4995, 0);           // 세종호수공원 인근
const PAD_FRAME = C.Transforms.eastNorthUpToFixedFrame(PAD);
const AX = {
  e: C.Matrix4.multiplyByPointAsVector(PAD_FRAME, new C.Cartesian3(1, 0, 0), new C.Cartesian3()),
  n: C.Matrix4.multiplyByPointAsVector(PAD_FRAME, new C.Cartesian3(0, 1, 0), new C.Cartesian3()),
  u: C.Matrix4.multiplyByPointAsVector(PAD_FRAME, new C.Cartesian3(0, 0, 1), new C.Cartesian3()),
};
const v3 = (x, y, z) => new C.Cartesian3(x, y, z);
const add = (a, b) => C.Cartesian3.add(a, b, new C.Cartesian3());
const sub = (a, b) => C.Cartesian3.subtract(a, b, new C.Cartesian3());
const mul = (a, s) => C.Cartesian3.multiplyByScalar(a, s, new C.Cartesian3());
const norm = (a) => C.Cartesian3.normalize(a, new C.Cartesian3());
const cross = (a, b) => C.Cartesian3.cross(a, b, new C.Cartesian3());
const vlerp = (a, b, s) => C.Cartesian3.lerp(a, b, s, new C.Cartesian3());
const padLocal = (e, n, u) => add(PAD, add(mul(AX.e, e), add(mul(AX.n, n), mul(AX.u, u))));
// Offset in the pad's ENU frame from azimuth (deg, clockwise from north), elevation (deg), distance (m)
function enuOffset(az, el, d) {
  const a = rad(az), e = rad(el);
  return add(mul(AX.e, d * Math.cos(e) * Math.sin(a)), add(mul(AX.n, d * Math.cos(e) * Math.cos(a)), mul(AX.u, d * Math.sin(e))));
}

// ---------------------------------------------------------------- textures
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,200,120,0.5)') {
  const c = canvas(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, mid); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
}
function smokeTexture() {
  const c = canvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
}

// 태극기 (simplified proportions 3:2)
function drawTaegeukgi(g, x, y, w) {
  const h = w * 2 / 3, cx = x + w / 2, cy = y + h / 2, R = h / 4;
  g.fillStyle = '#fff'; g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
  const ang = Math.atan2(h, w);
  g.save(); g.translate(cx, cy); g.rotate(ang);
  g.fillStyle = '#cd2e3a'; g.beginPath(); g.arc(0, 0, R, Math.PI, 0); g.fill();
  g.fillStyle = '#0047a0'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI); g.fill();
  g.fillStyle = '#cd2e3a'; g.beginPath(); g.arc(-R / 2, 0, R / 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0047a0'; g.beginPath(); g.arc(R / 2, 0, R / 2, 0, Math.PI * 2); g.fill();
  g.restore();
  // trigrams: pattern listed from the bar nearest the centre outward (true = solid)
  const tri = [
    { a: Math.PI + ang, p: [true, true, true] },          // 건 (top-left)
    { a: -ang, p: [false, true, false] },                  // 감 (top-right)
    { a: Math.PI - ang, p: [true, false, true] },          // 리 (bottom-left)
    { a: ang, p: [false, false, false] },                  // 곤 (bottom-right)
  ];
  const bw = R * 1.0, bh = R / 6, gap = R / 12, start = R * 1.5;
  g.fillStyle = '#000';
  for (const t of tri) {
    g.save(); g.translate(cx, cy); g.rotate(t.a);
    t.p.forEach((solid, i) => {
      const d = start + i * (bh + gap);
      g.save(); g.translate(d, 0); g.rotate(Math.PI / 2);
      if (solid) g.fillRect(-bw / 2, -bh / 2, bw, bh);
      else { const s = bw * 0.46; g.fillRect(-bw / 2, -bh / 2, s, bh); g.fillRect(bw / 2 - s, -bh / 2, s, bh); }
      g.restore();
    });
    g.restore();
  }
}

const ROCKET_H = 47;
function bodyTexture() {
  const W = 1024, H = 4096, c = canvas(W, H), g = c.getContext('2d');
  const y = (z) => H * (1 - z / ROCKET_H);
  g.fillStyle = '#f4f5f2'; g.fillRect(0, 0, W, H);
  // engine skirt, interstages and seams
  g.fillStyle = '#3a3d42'; g.fillRect(0, y(2.4), W, y(0) - y(2.4));
  g.fillStyle = '#5a5e64'; g.fillRect(0, y(23.6), W, y(21.6) - y(23.6));
  g.fillStyle = '#9aa0a6';
  for (const z of [2.4, 12.0, 21.6, 23.6, 31.0, 37.2, 38.5]) g.fillRect(0, y(z) - 3, W, 6);
  // subtle panel lines
  g.globalAlpha = 0.18; g.fillStyle = '#000';
  for (let i = 0; i < 16; i++) g.fillRect((i / 16) * W, 0, 2, H);
  g.globalAlpha = 1;
  // decal facing the main camera (camera at azimuth ~160° ⇒ s ≈ 0.80)
  const sx = 0.80 * W;
  drawTaegeukgi(g, sx - 125, y(19.4), 250);
  g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 150px Pretendard';
  ['대', '한', '민', '국'].forEach((ch, i) => g.fillText(ch, sx, y(15.0 - i * 2.0)));
  // second decal on the opposite side for orbit shots
  const sx2 = 0.30 * W;
  drawTaegeukgi(g, sx2 - 125, y(19.4), 250);
  ['대', '한', '민', '국'].forEach((ch, i) => g.fillText(ch, sx2, y(15.0 - i * 2.0)));
  g.font = '800 90px Pretendard'; g.fillStyle = '#1b3a6b';
  g.fillText('NURI-AX', sx, y(33.5)); g.fillText('NURI-AX', sx2, y(33.5));
  return c;
}

// ---------------------------------------------------------------- lathe geometry
// profile: [[r, z], ...]; repeated points create hard edges. tOf(r, z, j, n) → texture t.
function lathe(profile, slices, tOf) {
  const n = profile.length, cols = slices + 1;
  const pos = new Float64Array(n * cols * 3), nor = new Float32Array(n * cols * 3), st = new Float32Array(n * cols * 2);
  const same = (a, b) => b && a[0] === b[0] && a[1] === b[1];
  for (let j = 0; j < n; j++) {
    const p = profile[j];
    let a = profile[j - 1], b = profile[j + 1];
    if (same(p, a) || !a) a = p;
    if (same(p, b) || !b) b = p;
    let dr = b[0] - a[0], dz = b[1] - a[1];
    if (dr === 0 && dz === 0) { dr = 0; dz = 1; }
    let nr = dz, nz = -dr; const l = Math.hypot(nr, nz) || 1; nr /= l; nz /= l;
    const t = tOf(p[0], p[1], j, n);
    for (let i = 0; i < cols; i++) {
      const ang = (i / slices) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang), k = j * cols + i;
      pos[k * 3] = p[0] * c; pos[k * 3 + 1] = p[0] * s; pos[k * 3 + 2] = p[1];
      nor[k * 3] = nr * c; nor[k * 3 + 1] = nr * s; nor[k * 3 + 2] = nz;
      st[k * 2] = i / slices; st[k * 2 + 1] = t;
    }
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) {
    if (same(profile[j], profile[j + 1])) continue;
    for (let i = 0; i < slices; i++) {
      const a = j * cols + i, b = a + 1, c2 = a + cols, d = c2 + 1;
      idx.push(a, b, d, a, d, c2);
    }
  }
  return new C.Geometry({
    attributes: {
      position: new C.GeometryAttribute({ componentDatatype: C.ComponentDatatype.DOUBLE, componentsPerAttribute: 3, values: pos }),
      normal: new C.GeometryAttribute({ componentDatatype: C.ComponentDatatype.FLOAT, componentsPerAttribute: 3, values: nor }),
      st: new C.GeometryAttribute({ componentDatatype: C.ComponentDatatype.FLOAT, componentsPerAttribute: 2, values: st }),
    },
    indices: idx.length > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
    primitiveType: C.PrimitiveType.TRIANGLES,
    boundingSphere: C.BoundingSphere.fromVertices(pos),
  });
}

// Headlight-style shading so the rocket reads clearly at night and in space; flameDir adds engine underglow.
const SHADED_SRC = `
uniform vec4 color; uniform sampler2D image; uniform float useImage; uniform vec3 flameDir; uniform float flameI;
czm_material czm_getMaterial(czm_materialInput mi) {
  czm_material m = czm_getDefaultMaterial(mi);
  vec3 base = color.rgb;
  if (useImage > 0.5) base *= texture(image, mi.st).rgb;
  vec3 n = normalize(mi.normalEC);
  vec3 V = normalize(mi.positionToEyeEC);
  if (dot(n, V) < 0.0) n = -n;
  vec3 L = normalize(vec3(-0.55, 0.6, 0.6));
  float d = max(dot(n, L), 0.0);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(n, H), 0.0), 36.0);
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  float under = max(dot(n, normalize(flameDir)), 0.0) * flameI;
  m.emission = base * (0.22 + 0.9 * d) + vec3(0.28) * spec + vec3(0.35, 0.5, 0.75) * rim * 0.45 + vec3(1.0, 0.55, 0.22) * under * 0.55;
  m.diffuse = vec3(0.0);
  m.alpha = 1.0;
  return m;
}`;
const FLAME_SRC = `
uniform vec4 core; uniform vec4 edge; uniform float intensity; uniform float time;
czm_material czm_getMaterial(czm_materialInput mi) {
  czm_material m = czm_getDefaultMaterial(mi);
  float t = mi.st.t;
  vec3 n = normalize(mi.normalEC); vec3 V = normalize(mi.positionToEyeEC);
  float facing = abs(dot(n, V));
  float c = pow(facing, 1.6);
  float flick = 0.82 + 0.18 * sin(time * 47.0 + t * 23.0) * sin(time * 31.0 + mi.st.s * 40.0);
  float a = pow(1.0 - t, 1.5) * (0.15 + 0.85 * c) * intensity * flick;
  m.emission = mix(core.rgb, edge.rgb, smoothstep(0.0, 0.75, t + (1.0 - c) * 0.5));
  m.diffuse = vec3(0.0);
  m.alpha = clamp(a, 0.0, 1.0);
  return m;
}`;
const parts = [];
function makePart(geometry, uniforms, opts = {}) {
  const flame = !!opts.flame;
  const material = new C.Material({
    fabric: { uniforms: flame
      ? Object.assign({ core: new C.Color(1, 0.95, 0.8, 1), edge: new C.Color(1, 0.45, 0.1, 1), intensity: 1, time: 0 }, uniforms)
      : Object.assign({ color: C.Color.WHITE, image: C.Material.DefaultImageId, useImage: 0, flameDir: v3(0, -1, 0), flameI: 0 }, uniforms),
    source: flame ? FLAME_SRC : SHADED_SRC },
    translucent: flame,
  });
  const appearance = new C.MaterialAppearance({
    material, flat: true, translucent: flame, closed: false,
    materialSupport: C.MaterialAppearance.MaterialSupport.TEXTURED,
    renderState: flame
      ? { blending: C.BlendingState.ADDITIVE_BLEND, depthMask: false, depthTest: { enabled: true }, cull: { enabled: false } }
      : { depthTest: { enabled: true }, cull: { enabled: false } },
  });
  const prim = scene.primitives.add(new C.Primitive({
    geometryInstances: new C.GeometryInstance({ geometry }), appearance, asynchronous: false, compressVertices: false,
  }));
  const part = { prim, material, local: opts.local || C.Matrix4.IDENTITY, group: opts.group || 'upper', flame };
  parts.push(part); return part;
}

// ---------------------------------------------------------------- rocket (누리호 style, 47 m)
let rocketTex;
function buildRocket() {
  rocketTex = bodyTexture();
  const tAbs = (r, z) => z / ROCKET_H;
  const stage1 = [[0, 0], [1.95, 0], [1.95, 0], [1.95, 0.5], [1.8, 2.2], [1.75, 2.6], [1.75, 21.6], [1.75, 22.4], [1.75, 22.4], [0, 22.4]];
  const upper = [[0, 22.4], [1.75, 22.4], [1.75, 22.4], [1.75, 23.6], [1.45, 24.6], [1.45, 37.2], [1.45, 38.5]];
  for (let i = 1; i <= 12; i++) { const x = i / 12; upper.push([1.45 * Math.pow(1 - x * x, 0.62), 38.5 + 8.5 * x]); }
  upper[upper.length - 1] = [0, ROCKET_H];
  const img = rocketTex.toDataURL('image/png');
  makePart(lathe(stage1, 96, tAbs), { image: img, useImage: 1 }, { group: 'stage1' });
  makePart(lathe(upper, 96, tAbs), { image: img, useImage: 1 }, { group: 'upper' });
  // engines
  const bell = (r0, r1, L) => { const p = []; for (let i = 0; i <= 10; i++) { const x = i / 10; p.push([r0 + (r1 - r0) * Math.pow(x, 0.6), -L * x]); } return p; };
  const metal = new C.Color(0.32, 0.33, 0.36, 1);
  for (const [x, y] of [[0.85, 0.85], [-0.85, 0.85], [0.85, -0.85], [-0.85, -0.85]]) {
    makePart(lathe(bell(0.28, 0.6, 1.9), 32, (r, z, j, n) => j / (n - 1)), { color: metal },
      { group: 'stage1', local: C.Matrix4.fromTranslation(v3(x, y, 0)) });
  }
  makePart(lathe(bell(0.3, 0.7, 1.8), 32, (r, z, j, n) => j / (n - 1)), { color: metal },
    { group: 'upper', local: C.Matrix4.fromTranslation(v3(0, 0, 22.4)) });
  // flames (unit length, opening downward); scaled per frame
  const plume = (r0, r1) => { const p = []; for (let i = 0; i <= 16; i++) { const x = i / 16; p.push([r0 + (r1 - r0) * Math.sqrt(x), -x]); } return p; };
  const flameT = (r, z, j, n) => j / (n - 1);
  for (const [x, y] of [[0.85, 0.85], [-0.85, 0.85], [0.85, -0.85], [-0.85, -0.85]]) {
    makePart(lathe(plume(0.55, 1.0), 32, flameT), {}, { flame: true, group: 'flame1', local: C.Matrix4.fromTranslation(v3(x, y, -1.9)) });
  }
  makePart(lathe(plume(1.7, 3.6), 48, flameT), { core: new C.Color(1, 0.8, 0.5, 1), edge: new C.Color(1, 0.35, 0.08, 1) },
    { flame: true, group: 'flame1outer', local: C.Matrix4.fromTranslation(v3(0, 0, -1.9)) });
  makePart(lathe(plume(0.65, 1.3), 32, flameT), { core: new C.Color(0.85, 0.9, 1, 1), edge: new C.Color(0.45, 0.55, 1.0, 1) },
    { flame: true, group: 'flame2', local: C.Matrix4.fromTranslation(v3(0, 0, 20.6)) });
  makePart(lathe(plume(1.2, 6.0), 48, flameT), { core: new C.Color(0.9, 0.85, 1, 1), edge: new C.Color(0.4, 0.45, 1.0, 1) },
    { flame: true, group: 'flame2outer', local: C.Matrix4.fromTranslation(v3(0, 0, 20.6)) });
}

// ---------------------------------------------------------------- ground: pad, 세종청사, city lights
const points = scene.primitives.add(new C.PointPrimitiveCollection());
const billboards = scene.primitives.add(new C.BillboardCollection());
let glowBB, glowFarBB, clouds;
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function buildGround() {
  const r = rng(2700);
  // pad apron with a radial floodlight falloff
  makePart(lathe([[0, 0.05], [60, 0.05]], 64, (rr) => rr / 60), { color: new C.Color(0.5, 0.5, 0.52, 1) }, { group: 'pad' });
  makePart(lathe([[0, 0.02], [260, 0.02]], 64, (rr) => rr / 260), { color: new C.Color(0.12, 0.13, 0.12, 1) }, { group: 'pad' });
  // umbilical tower
  const tower = []; tower.push([0, 0], [2.4, 0], [2.4, 0], [2.4, 58], [2.4, 58], [0, 58]);
  makePart(lathe(tower, 4, (rr, z) => z / 58), { color: new C.Color(0.36, 0.38, 0.42, 1) },
    { group: 'pad', local: C.Matrix4.fromTranslation(v3(-9, 0, 0)) });
  const tw = padLocal(-9, 0, 59);
  points.add({ position: tw, pixelSize: 8, color: new C.Color(1, 0.15, 0.1, 1) });
  // floodlights
  const flood = glowTexture('rgba(255,255,255,1)', 'rgba(255,240,210,0.4)');
  for (const [e, n] of [[45, 45], [-45, 45], [45, -45], [-45, -45]]) {
    billboards.add({ position: padLocal(e, n, 18), image: flood, width: 22, height: 22, sizeInMeters: true, color: new C.Color(1, 0.95, 0.85, 0.9) });
  }

  // 정부세종청사 — the long, winding connected building (approximate footprint)
  const path = [[127.2545, 36.4985], [127.2558, 36.5003], [127.2580, 36.5018], [127.2610, 36.5028], [127.2636, 36.5043],
    [127.2648, 36.5063], [127.2642, 36.5083], [127.2620, 36.5094], [127.2595, 36.5090]];
  const positions = C.Cartesian3.fromDegreesArray(path.flat());
  scene.primitives.add(new C.Primitive({
    geometryInstances: new C.GeometryInstance({
      geometry: new C.CorridorGeometry({ positions, width: 70, height: 0, extrudedHeight: 34, cornerType: C.CornerType.ROUNDED,
        vertexFormat: C.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT }),
      attributes: { color: C.ColorGeometryInstanceAttribute.fromColor(new C.Color(0.10, 0.12, 0.17, 1)) },
    }),
    appearance: new C.PerInstanceColorAppearance({ flat: true, closed: true }), asynchronous: false,
  }));
  // windows + roof-garden lights along the building
  const ell = C.Ellipsoid.WGS84;
  for (let s = 0; s < path.length - 1; s++) {
    const a = path[s], b = path[s + 1];
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const lon = lerp(a[0], b[0], i / steps), lat = lerp(a[1], b[1], i / steps);
      const dx = (b[0] - a[0]) * Math.cos(rad(lat)), dy = b[1] - a[1], l = Math.hypot(dx, dy);
      const ox = -dy / l * 0.00036 / Math.cos(rad(lat)), oy = dx / l * 0.00036;
      for (const side of [-1, 1]) for (const h of [6, 12, 18, 24, 30]) {
        if (r() < 0.35) continue;
        const warm = r() < 0.7;
        points.add({ position: C.Cartesian3.fromDegrees(lon + side * ox, lat + side * oy, h), pixelSize: 2.6,
          color: warm ? new C.Color(1, 0.82, 0.55, 0.95) : new C.Color(0.8, 0.9, 1, 0.9),
          scaleByDistance: new C.NearFarScalar(300, 2.2, 8000, 0.6) });
      }
      points.add({ position: C.Cartesian3.fromDegrees(lon, lat, 35), pixelSize: 2, color: new C.Color(0.6, 1, 0.75, 0.8),
        scaleByDistance: new C.NearFarScalar(300, 2, 8000, 0.5) });
    }
  }
  void ell;
  // city lights: 세종, 대전, 청주, 공주
  const cities = [[127.270, 36.495, 0.055, 5000], [127.385, 36.350, 0.09, 6500], [127.489, 36.642, 0.07, 4500], [127.120, 36.455, 0.03, 1200], [127.29, 36.60, 0.03, 900]];
  for (const [lon0, lat0, spread, count] of cities) {
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, d = spread * Math.pow(r(), 0.7);
      const lon = lon0 + Math.cos(a) * d / Math.cos(rad(lat0)), lat = lat0 + Math.sin(a) * d * 0.9;
      if (Math.hypot((lon - 127.2690) * 0.8, lat - 36.4995) < 0.0035) continue; // keep the park dark
      const k = r();
      points.add({ position: C.Cartesian3.fromDegrees(lon, lat, 8), pixelSize: k < 0.08 ? 3.2 : 1.8,
        color: k < 0.6 ? new C.Color(1, 0.78, 0.45, 0.9) : k < 0.85 ? new C.Color(1, 0.95, 0.85, 0.9) : new C.Color(0.7, 0.85, 1, 0.85),
        scaleByDistance: new C.NearFarScalar(500, 1.8, 3e5, 0.5), translucencyByDistance: new C.NearFarScalar(8e4, 1, 6e5, 0) });
    }
  }
  // clouds the rocket punches through (~2.5 km)
  clouds = scene.primitives.add(new C.CloudCollection({ noiseDetail: 16 }));
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 300 + 3500 * Math.sqrt(r());
    const w = 700 + 900 * r();
    clouds.add({ position: padLocal(Math.cos(a) * d, Math.sin(a) * d, 2300 + 500 * r()), scale: new C.Cartesian2(w, w * 0.35),
      maximumSize: new C.Cartesian3(50, 16, 14), slice: 0.36 + 0.2 * r(), brightness: 0.35, color: new C.Color(0.75, 0.8, 0.95, 1) });
  }
  // the deck of clouds right above the pad
  for (let i = 0; i < 6; i++) {
    clouds.add({ position: padLocal((r() - 0.5) * 700, (r() - 0.5) * 700, 2450 + 120 * i), scale: new C.Cartesian2(900, 300),
      maximumSize: new C.Cartesian3(50, 18, 14), slice: 0.4, brightness: 0.4, color: new C.Color(0.75, 0.8, 0.95, 1) });
  }

  const glow = glowTexture('rgba(255,255,255,1)', 'rgba(255,170,80,0.55)');
  glowBB = billboards.add({ position: PAD, image: glow, width: 40, height: 40, sizeInMeters: true, color: new C.Color(1, 0.8, 0.55, 0), disableDepthTestDistance: 0 });
  glowFarBB = billboards.add({ position: PAD, image: glow, width: 60, height: 60, sizeInMeters: false, color: new C.Color(1, 0.85, 0.6, 0), disableDepthTestDistance: Number.POSITIVE_INFINITY });
}

// ---------------------------------------------------------------- smoke
let groundSmoke, trailSmoke;
function buildSmoke() {
  const img = smokeTexture();
  const drag = (k, lift) => (p, dt) => {
    C.Cartesian3.multiplyByScalar(p.velocity, Math.max(0, 1 - k * dt), p.velocity);
    const up = C.Cartesian3.normalize(p.position, new C.Cartesian3());
    C.Cartesian3.add(p.velocity, C.Cartesian3.multiplyByScalar(up, lift * dt, up), p.velocity);
  };
  groundSmoke = scene.primitives.add(new C.ParticleSystem({
    image: img, sizeInMeters: true, imageSize: new C.Cartesian2(10, 10), startScale: 1.0, endScale: 6.0,
    startColor: new C.Color(0.95, 0.7, 0.5, 0.45), endColor: new C.Color(0.35, 0.36, 0.4, 0.0),
    minimumParticleLife: 5, maximumParticleLife: 9, minimumSpeed: 18, maximumSpeed: 40, emissionRate: 0,
    emitter: new C.BoxEmitter(new C.Cartesian3(30, 30, 3)), modelMatrix: PAD_FRAME, lifetime: 1e6, loop: true,
    updateCallback: drag(0.35, 2.5),
  }));
  trailSmoke = scene.primitives.add(new C.ParticleSystem({
    image: img, sizeInMeters: true, imageSize: new C.Cartesian2(10, 10), startScale: 1.0, endScale: 9.0,
    startColor: new C.Color(1.0, 0.7, 0.45, 0.6), endColor: new C.Color(0.45, 0.46, 0.52, 0.0),
    minimumParticleLife: 3, maximumParticleLife: 6, minimumSpeed: 30, maximumSpeed: 60, emissionRate: 0,
    emitter: new C.ConeEmitter(rad(12)), modelMatrix: PAD_FRAME,
    emitterModelMatrix: C.Matrix4.multiply(C.Matrix4.fromTranslation(v3(0, 0, -4)), C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationX(Math.PI)), new C.Matrix4()),
    lifetime: 1e6, loop: true, updateCallback: drag(0.6, 0.8),
  }));
}

// ---------------------------------------------------------------- rocket kinematics
const F_DIR = norm(add(mul(AX.u, 0.62), add(mul(AX.n, 0.62), mul(AX.e, -0.48)))); // heading into the unknown
const P48 = padLocal(0, 0, GOAL * 1000 + 6000 * (T.celebrateEnd - T.reach));
function rocketState(t) {
  let pos, zAxis;
  if (t < T.reach) {
    pos = padLocal(0, 0, t < T.liftoff ? 0 : countAt(t) * 1000);
    zAxis = AX.u;
  } else if (t < T.celebrateEnd) {
    pos = padLocal(0, 0, GOAL * 1000 + 6000 * (t - T.reach));
    zAxis = AX.u;
  } else {
    const s = smooth(T.celebrateEnd, T.turnEnd, t);
    zAxis = norm(vlerp(AX.u, F_DIR, s));
    const cruise = 40 * Math.min(t - T.celebrateEnd, T.turnEnd - T.celebrateEnd);
    const away = t > T.turnEnd ? 60 * (Math.exp(1.45 * (t - T.turnEnd)) - 1) : 0;
    pos = add(P48, add(mul(norm(vlerp(AX.u, F_DIR, 0.5)), cruise), mul(F_DIR, away)));
  }
  const xa = norm(cross(AX.n, zAxis)); // x stays ≈ east (n × u = e)
  const yAxis = norm(cross(zAxis, xa));
  const m = new C.Matrix4(
    xa.x, yAxis.x, zAxis.x, pos.x,
    xa.y, yAxis.y, zAxis.y, pos.y,
    xa.z, yAxis.z, zAxis.z, pos.z,
    0, 0, 0, 1);
  return { pos, zAxis, model: m };
}
const local2world = (m, x, y, z) => C.Matrix4.multiplyByPoint(m, v3(x, y, z), new C.Cartesian3());

// ---------------------------------------------------------------- camera
function lookAt(eye, target, upHint) {
  const dir = norm(sub(target, eye));
  let right = cross(dir, upHint);
  if (C.Cartesian3.magnitude(right) < 1e-6) right = cross(dir, AX.n);
  right = norm(right);
  const up = norm(cross(right, dir));
  camera.setView({ destination: eye, orientation: { direction: dir, up } });
}
const CENTER = 22; // look at the rocket's middle
function cameraAt(t, rs) {
  const center = local2world(rs.model, 0, 0, CENTER);
  if (t < T.countdown - 0.5) { // A: from orbit down to the pad
    const s = easeInOutCubic(clamp((t - 0.8) / 6.0));
    const el = lerp(89.5, 4, Math.pow(s, 0.8)), az = lerp(200, 160, s), d = logLerp(1.25e7, 190, s);
    const target = padLocal(0, 0, lerp(0, 34, s));
    const eye = add(target, enuOffset(az, el, d));
    const fwd = norm(mul(enuOffset(az, 0, 1), -1));
    lookAt(eye, target, norm(add(mul(AX.u, Math.cos(rad(el))), mul(fwd, Math.sin(rad(el))))));
    return;
  }
  // B/C: ground camera
  const sB = smooth(T.countdown - 0.5, T.liftoff, t);
  const groundEye = add(PAD, enuOffset(160, lerp(4, 2.0, sB), lerp(190, 125, sB)));
  if (t < 14.8) {
    const tgt = t < T.liftoff ? padLocal(0, 0, 34) : local2world(rs.model, 0, 0, 34);
    lookAt(groundEye, tgt, AX.u);
    return;
  }
  // D: chase camera (blends in from the ground camera)
  const sD = smooth(14.8, 17.4, t);
  const el = lerp(4, 52, smooth(17, 38, t)), dist = lerp(75, 125, smooth(17, 40, t));
  let az = 160;
  let elE = el, distE = dist;
  if (t >= T.reach) { // E: orbit to the front for the celebration
    const sE = smooth(T.reach, T.celebrateEnd, t);
    az = lerp(160, 300, sE); elE = lerp(52, 8, sE); distE = lerp(125, 105, sE);
  }
  const chaseEye = add(center, enuOffset(az, elE, distE));
  const chaseTgt = add(center, mul(AX.u, lerp(0, -14, smooth(18, 38, t))));
  if (t < T.celebrateEnd) {
    lookAt(vlerp(groundEye, chaseEye, sD), sD < 1 ? vlerp(center, chaseTgt, sD) : chaseTgt, AX.u);
    return;
  }
  // F: swing behind the rocket, then hold while it races into the nebula
  const side = norm(cross(F_DIR, AX.u));
  const upF = norm(cross(side, F_DIR));
  const eyeAt = (tt) => {
    const s = smooth(T.celebrateEnd, T.turnEnd + 0.4, tt);
    const c = local2world(rocketState(tt).model, 0, 0, CENTER);
    const o0 = enuOffset(300, 8, 105), o1 = add(mul(F_DIR, -95), add(mul(upF, 14), mul(side, 6)));
    const len = lerp(C.Cartesian3.magnitude(o0), C.Cartesian3.magnitude(o1), s);
    return add(c, mul(norm(vlerp(o0, o1, s)), len));
  };
  const sF = smooth(T.celebrateEnd, T.turnEnd + 0.4, t);
  const eye = eyeAt(Math.min(t, T.turnEnd + 0.4));
  const lookTarget = vlerp(center, add(eye, mul(F_DIR, 1000)), smooth(T.turnEnd - 1, T.turnEnd + 0.6, t));
  lookAt(eye, lookTarget, norm(vlerp(AX.u, upF, sF)));
}

// ---------------------------------------------------------------- per-frame update
const scratchM = new C.Matrix4();
function updateScene(t) {
  const rs = rocketState(t);
  const sep = t >= T_SEP;
  // first stage drifts back and tumbles after separation
  let stage1Model = rs.model;
  if (sep) {
    const dt = t - T_SEP;
    const back = 3 * dt + 9 * dt * dt;
    const rot = C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationX(0.25 * dt * dt), v3(1.2 * dt, 0, -back));
    stage1Model = C.Matrix4.multiply(rs.model, rot, new C.Matrix4());
  }
  const alt = t < T.liftoff ? 0 : Math.min(countAt(t), GOAL) * 1000;
  const ign = smooth(T.ignition, T.liftoff - 0.2, t);
  const space = smooth(15000, 120000, alt);
  const fadeOut = 1 - smooth(T.flash - 0.3, T.flash + 0.2, t);
  const e1 = sep ? Math.max(0, 1 - (t - T_SEP) * 3) : ign;            // first-stage engines
  const e2 = sep ? smooth(T_SEP + 0.5, T_SEP + 1.2, t) * fadeOut : 0;   // upper-stage engine
  const flick = 0.9 + 0.1 * Math.sin(t * 61) * Math.sin(t * 23);

  const flameDirEC = C.Matrix4.multiplyByPointAsVector(camera.viewMatrix, mul(rs.zAxis, -1), new C.Cartesian3());
  for (const p of parts) {
    let base = p.group === 'stage1' || p.group === 'flame1' || p.group === 'flame1outer' ? stage1Model : rs.model;
    let local = p.local;
    if (p.flame) {
      let L = 1, Rs = 1, I = 0;
      if (p.group === 'flame1') { L = (10 + 6 * ign) * flick; Rs = 1 + space * 1.2; I = e1 * 1.1; }
      if (p.group === 'flame1outer') { L = (16 + 18 * space) * flick; Rs = 1 + space * 2.5; I = e1 * (0.55 - 0.25 * space); }
      if (p.group === 'flame2') { L = 12 * flick; Rs = 1.3; I = e2 * 1.2; }
      if (p.group === 'flame2outer') { L = 30 * flick; Rs = 1.6; I = e2 * 0.35; }
      p.prim.show = I > 0.002;
      p.material.uniforms.intensity = I;
      p.material.uniforms.time = t;
      local = C.Matrix4.multiply(p.local, C.Matrix4.fromScale(v3(Rs, Rs, L)), scratchM);
    } else if (p.group !== 'pad') {
      p.material.uniforms.flameDir = flameDirEC;
      p.material.uniforms.flameI = Math.max(e1, e2) * (1 - space * 0.7);
      p.prim.show = !(p.group === 'stage1' && sep && t - T_SEP > 6);
    }
    if (p.group === 'pad') continue;
    p.prim.modelMatrix = C.Matrix4.multiply(base, local, new C.Matrix4());
  }
  // engine glow sprites
  const nozzle = sep ? local2world(rs.model, 0, 0, 20.2) : local2world(rs.model, 0, 0, -3);
  const gI = Math.max(e1, e2);
  glowBB.position = nozzle;
  glowBB.width = glowBB.height = (sep ? 26 : 46) * (0.9 + 0.1 * flick);
  glowBB.color = new C.Color(1, sep ? 0.85 : 0.75, sep ? 0.85 : 0.5, gI * 0.95);
  glowFarBB.position = nozzle;
  const far = smooth(T.turnEnd + 0.5, T.turnEnd + 2.5, t);
  glowFarBB.color = new C.Color(0.85, 0.9, 1, far * fadeOut);
  glowFarBB.width = glowFarBB.height = 70 + 30 * smooth(53, 57, t);

  // smoke
  groundSmoke.emissionRate = t > T.ignition && t < 16.5 ? 90 * ign : 0;
  clouds.show = false;
  trailSmoke.modelMatrix = rs.model;
  trailSmoke.emissionRate = t > T.liftoff - 0.2 && alt < 25000 ? 120 * (1 - smooth(12000, 25000, alt)) : 0;

  cameraAt(t, rs);
  nightLayer.brightness = lerp(0.25, 1.6, smooth(3e3, 6e5, camera.positionCartographic.height));
}

// ---------------------------------------------------------------- HUD
const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en-US');
const ALT_TICKS = [1, 10, 100, 1000, 2700];
const logPos = (n) => Math.log10(1 + n) / Math.log10(1 + GOAL);
function buildHud() {
  const ticks = document.querySelector('#altimeter .ticks');
  for (const v of ALT_TICKS) {
    const d = document.createElement('div');
    d.style.bottom = (logPos(v) * 100) + '%';
    d.style.transform = 'translateY(50%)';
    d.textContent = fmt(v) + ' km';
    ticks.appendChild(d);
  }
}
const GLITCH = '0123456789#%&?∞';
function updateHud(t) {
  const c = countAt(t);
  const n = t >= T.reach ? GOAL : Math.floor(c);
  const hudVis = 1 - smooth(T.hudOut, T.hudOut + 0.5, t);
  $('brand').style.opacity = smooth(T.brandIn, T.brandIn + 1, t) * hudVis;
  $('readout').style.opacity = smooth(6.5, 7.5, t) * hudVis;
  $('altimeter').style.opacity = smooth(12.5, 13.5, t) * hudVis;
  $('date').textContent = dateAt(t);

  const num = $('num'), unit = $('unit'), altNum = $('altNum');
  if (t < T.glitch) {
    num.textContent = fmt(n); unit.style.display = ''; altNum.textContent = fmt(n);
  } else if (t < T.glitch + 0.9) {
    const r = rng(Math.floor(t * 30));
    num.textContent = Array.from({ length: 4 }, () => GLITCH[Math.floor(r() * GLITCH.length)]).join('');
    altNum.textContent = num.textContent;
    num.style.transform = `translateX(${(r() - 0.5) * 30}px)`;
  } else {
    num.textContent = '∞'; unit.style.display = 'none'; altNum.textContent = '∞'; num.style.transform = '';
  }
  // pulse at 2,700
  const pulse = t >= T.reach ? Math.exp(-(t - T.reach) * 2.5) : 0;
  $('count').style.transform = `scale(${1 + 0.18 * pulse})`;
  num.style.color = t >= T.reach && t < T.glitch ? '#ffd76b' : '#fff';

  const p = logPos(Math.min(c, GOAL));
  document.querySelector('#altimeter .fill').style.height = (p * 100) + '%';
  document.querySelector('#altimeter .marker').style.bottom = (p * 100) + '%';

  // centre text: countdown → 축하!
  const center = $('center');
  if (t >= T.countdown && t < T.countdown + 5) {
    const k = Math.floor(t - T.countdown), f = t - T.countdown - k;
    center.textContent = String(5 - k);
    center.style.fontSize = '300px'; center.style.top = '330px';
    center.style.opacity = (1 - smooth(0.6, 1.0, f)) * smooth(0, 0.08, f);
    center.style.transform = `scale(${lerp(1.35, 1.0, easeInOutCubic(clamp(f / 0.5)))})`;
  } else if (t >= T.reach && t < T.celebrateEnd) {
    const f = t - T.reach;
    center.textContent = '축하!';
    center.style.fontSize = '300px'; center.style.top = '960px';
    center.style.opacity = smooth(0, 0.15, f) * (1 - smooth(5.2, 6.0, f));
    const pop = f < 0.5 ? 0.4 + 0.75 * Math.sin(clamp(f / 0.5) * Math.PI / 2) + 0.15 * Math.sin(clamp(f / 0.5) * Math.PI) : 1.0 + 0.03 * Math.sin(f * 6);
    center.style.transform = `scale(${pop})`;
    center.style.color = '#fff3c4';
  } else {
    center.style.opacity = 0;
  }

  // nebula approach
  const neb = smooth(48.8, 53.5, t) * (1 - smooth(T.flash, T.flash + 0.4, t));
  $('nebula').style.opacity = neb;
  const z = lerp(1.0, 1.9, Math.pow(smooth(48.8, T.flash, t), 1.4));
  $('nebulaImg').style.transform = `translate(-50%, -50%) scale(${z}) rotate(${lerp(-2, 3, smooth(48, 58, t))}deg)`;

  // flash + end card
  const fl = smooth(T.flash - 0.5, T.flash, t) * (1 - smooth(T.flash + 0.15, T.flash + 1.3, t));
  $('flash').style.opacity = fl;
  const ec = smooth(T.flash + 0.2, T.flash + 1.0, t);
  $('endcard').style.opacity = ec;
  $('endInf').style.transform = `scale(${lerp(0.85, 1.0, easeInOutCubic(ec))})`;

  drawFx(t);
}

// fireworks + sparkles (stateless: fully determined by t)
const fx = $('fx'), g2 = fx.getContext('2d');
const BURSTS = [42.0, 42.45, 42.9, 43.5, 44.1, 44.7, 45.2, 45.9, 46.5, 47.0].map((bt, i) => {
  const r = rng(100 + i);
  return { t: bt, x: 140 + r() * 800, y: 260 + r() * 820, hue: [45, 195, 330, 140, 25, 260][i % 6], seed: 500 + i, n: 90 };
});
function drawFx(t) {
  g2.clearRect(0, 0, fx.width, fx.height);
  if (t < 41.9 || t > 49.5) return;
  g2.globalCompositeOperation = 'lighter';
  for (const b of BURSTS) {
    const dt = t - b.t;
    if (dt < 0 || dt > 2.2) continue;
    const r = rng(b.seed);
    for (let i = 0; i < b.n; i++) {
      const a = r() * Math.PI * 2, sp = 260 + r() * 260, life = 1.4 + r() * 0.8;
      if (dt > life) continue;
      const pt = (tt) => { const k = 1 - Math.exp(-tt * 2.2); return [b.x + Math.cos(a) * sp * k / 2.2 * 2.2 * 0.55, b.y + Math.sin(a) * sp * k / 2.2 * 2.2 * 0.55 + 120 * tt * tt]; };
      const [x1, y1] = pt(dt), [x0, y0] = pt(Math.max(0, dt - 0.09));
      const alpha = (1 - dt / life) * (0.6 + 0.4 * Math.sin(dt * 40 + i));
      const light = 60 + 30 * (1 - dt / life);
      g2.strokeStyle = `hsla(${b.hue + (r() - 0.5) * 30}, 100%, ${light}%, ${alpha})`;
      g2.lineWidth = 4;
      g2.beginPath(); g2.moveTo(x0, y0); g2.lineTo(x1, y1); g2.stroke();
    }
    // flash at burst centre
    if (dt < 0.25) {
      const gr = g2.createRadialGradient(b.x, b.y, 0, b.x, b.y, 120);
      gr.addColorStop(0, `hsla(${b.hue},100%,90%,${1 - dt / 0.25})`); gr.addColorStop(1, 'hsla(0,0%,0%,0)');
      g2.fillStyle = gr; g2.fillRect(b.x - 120, b.y - 120, 240, 240);
    }
  }
  g2.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- assets (user-supplied)
async function exists(url) { try { const r = await fetch(url, { method: 'HEAD' }); return r.ok; } catch { return false; } }
async function loadAssets() {
  for (const ext of ['jpg', 'png', 'jpeg', 'webp']) {
    if (await exists(`../assets/nebula.${ext}`)) {
      const img = $('nebulaImg'); img.src = `../assets/nebula.${ext}`; await img.decode(); img.style.display = 'block'; $('nebulaMissing').style.display = 'none'; break;
    }
  }
  for (const ext of ['png', 'svg', 'jpg', 'webp']) {
    if (await exists(`../assets/aks-logo.${ext}`)) {
      for (const id of ['logoImg', 'endLogoImg']) { const img = $(id); img.src = `../assets/aks-logo.${ext}`; await img.decode(); img.style.display = 'block'; }
      $('logoMissing').style.display = 'none'; break;
    }
  }
}

// ---------------------------------------------------------------- public API for render.js
let lastT = -1;
window.renderFrame = async function (t) {
  const jd = C.JulianDate.addSeconds(START, t, new C.JulianDate());
  viewer.clock.currentTime = jd;
  updateScene(t);
  updateHud(t);
  scene.render(jd);
  for (let i = 0; i < 4 && !globe.tilesLoaded; i++) {
    await new Promise((r) => setTimeout(r, 10));
    scene.render(jd);
  }
  lastT = t;
  return { t, count: Math.floor(countAt(t)) };
};
// Run the particle simulation forward without capturing (cheap warm-up for chunked rendering).
window.simulate = async function (t) {
  const jd = C.JulianDate.addSeconds(START, t, new C.JulianDate());
  viewer.clock.currentTime = jd;
  updateScene(t);
  scene.render(jd);
};
window.DURATION = DURATION;
window.sceneReady = (async () => {
  await document.fonts.load('900 150px Pretendard');
  await document.fonts.ready;
  await addImagery();
  buildRocket(); buildGround(); buildSmoke(); buildHud();
  await loadAssets();
  await window.renderFrame(0);
  return { T_SEP };
})();
