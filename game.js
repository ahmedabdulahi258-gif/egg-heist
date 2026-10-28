// Egg Heist (browser edition) - Three.js, no build step.
// Steal eggs from guarded zones, drive them home, hatch pets!
import * as THREE from './vendor/three.module.js';

// ================= CONFIG (same pets/rarities as the Roblox PetConfig) =================
const RARITY_COLORS = { Common: '#c8c8c8', Uncommon: '#55c855', Rare: '#4682ff', Epic: '#aa46ff', Legendary: '#ffbe28' };
const PETS = {
  Dog: 'Common', Cat: 'Common', Bunny: 'Uncommon', Fox: 'Rare',
  Panda: 'Rare', Owl: 'Epic', Dragon: 'Legendary', Unicorn: 'Legendary',
};
const TIERS = [
  { name: 'Common Egg', color: 0xf0f0dc, guards: 2, guardSpeed: 21, reward: 25, pos: [0, 190],
    pets: [['Dog', 50], ['Cat', 35], ['Bunny', 13], ['Fox', 2]] },
  { name: 'Rare Egg', color: 0x4682ff, guards: 3, guardSpeed: 28, reward: 75, pos: [-230, 340],
    pets: [['Bunny', 40], ['Fox', 30], ['Panda', 22], ['Owl', 8]] },
  { name: 'Legendary Egg', color: 0xffbe28, guards: 5, guardSpeed: 35, reward: 250, pos: [270, 500],
    pets: [['Panda', 40], ['Owl', 35], ['Dragon', 18], ['Unicorn', 7]] },
];
const TUNE = {
  carSpeed: 42, reverseSpeed: 15, accel: 26, brake: 60, turnRate: 2.3,
  grabRadius: 5, catchRadius: 3.3, grace: 1.2, giveUpTime: 25, giveUpDist: 260,
  eggRespawn: 15, padRadius: 8, world: 620, maxEquipped: 3,
};
const HOME = new THREE.Vector3(0, 0, -12); // hatch pad position

// ================= SAVE =================
const SAVE_KEY = 'eggHeistSave_v1';
let save = { coins: 0, pets: [] };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && Array.isArray(s.pets)) save = s; } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

// ================= RENDERER / SCENE =================
const isTouch = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3ff);
scene.fog = new THREE.Fog(0x8fd3ff, 150, 420);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.5, 600);
scene.add(new THREE.HemisphereLight(0xffffff, 0x5a7a4a, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(60, 120, 40);
scene.add(sun);

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 80 : 65; // wider view in portrait
  camera.updateProjectionMatrix();
}
addEventListener('resize', onResize);
onResize();

const mat = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'object' ? c : mat(c));

// Ground with a Roblox-ish stud grid texture
{
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#5fae4a'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#579f44'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(160, 160);
  tex.magFilter = THREE.NearestFilter;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ map: tex }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
}

// Glowing pillar (landmark visible from far away)
function pillar(x, z, color, h = 70) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, h, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, fog: false }));
  m.position.set(x, h / 2, z); scene.add(m); return m;
}

// ---- Base
{
  const floor = box(44, 0.6, 44, 0x8a8a96); floor.position.set(0, 0.3, 0); scene.add(floor);
  const pad = box(14, 0.4, 14, new THREE.MeshBasicMaterial({ color: 0x3cff78 })); pad.position.set(HOME.x, 0.75, HOME.z); scene.add(pad);
  pillar(HOME.x, HOME.z, 0x3cff78, 90);
  for (const [x, z] of [[-21, 0], [21, 0]]) { const w = box(2, 4, 44, 0x6a6a76); w.position.set(x, 2, z); scene.add(w); }
}

// ---- Scenery (instanced for speed)
{
  const rand = mulberry(7);
  const N = 140, trunks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 5, 1.6), mat(0x7a4a2a), N);
  const leaves = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 5, 6), mat(0x2f8f3a), N);
  const m = new THREE.Matrix4(); let i = 0;
  while (i < N) {
    const x = (rand() - 0.5) * 1100, z = (rand() - 0.5) * 1100;
    if (Math.hypot(x, z) < 50 || TIERS.some(t => Math.hypot(x - t.pos[0], z - t.pos[1]) < 60)) continue;
    m.makeTranslation(x, 2.5, z); trunks.setMatrixAt(i, m);
    m.makeTranslation(x, 7, z); leaves.setMatrixAt(i, m); i++;
  }
  scene.add(trunks, leaves);
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ================= CAR =================
const car = { pos: new THREE.Vector3(0, 0, 8), h: 0, speed: 0, flung: null, carrying: null };
const carMesh = new THREE.Group();
{ // Original two-tone hypercar
  const shiny = (c, sh = 90) => new THREE.MeshPhongMaterial({ color: c, shininess: sh, specular: 0x666666 });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); carMesh.add(o); return o; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const dark = shiny(0x0b1630), blue = shiny(0x1e6bff), glass = shiny(0x0a0f1a, 120), black = mat(0x111111), chrome = shiny(0xd8dde6, 120);
  add(B(4.4, 0.8, 7.0), dark, 0, 1.0, -0.1);                         // lower body
  add(B(4.2, 0.45, 1.8), blue, 0, 1.05, 3.3, -0.22);                  // sloped nose
  add(B(4.5, 0.55, 3.4), blue, 0, 1.35, 1.6);                         // bright front half
  add(B(4.5, 0.6, 3.2), dark, 0, 1.35, -1.8);                         // dark rear half
  add(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 1.6, -0.3, 0, 0, 0, 1.55, 0.95, 2.0); // canopy
  add(B(0.12, 0.7, 2.6), chrome, -2.27, 1.3, 0.2); add(B(0.12, 0.7, 2.6), chrome, 2.27, 1.3, 0.2); // side accent lines
  for (const x of [-1, 1]) add(B(0.2, 0.55, 1.4), black, x * 2.26, 1.2, -1.6); // side intakes
  add(B(1.3, 0.45, 0.15), chrome, 0, 1.15, 3.95);                     // front grille
  for (const x of [-1.5, 1.5]) add(B(0.9, 0.18, 0.12), new THREE.MeshBasicMaterial({ color: 0xeaf4ff }), x, 1.3, 3.78); // headlights
  add(B(3.9, 0.14, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2030 }), 0, 1.45, -3.62); // tail light strip
  add(B(4.0, 0.12, 0.8), dark, 0, 2.25, -3.1);                        // spoiler
  for (const x of [-1.3, 1.3]) add(B(0.15, 0.6, 0.3), black, x, 1.9, -3.1);
  for (const x of [-0.7, 0.7]) add(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10), chrome, x, 0.75, -3.6, Math.PI / 2); // exhausts
  const tire = new THREE.CylinderGeometry(0.9, 0.9, 0.7, 16); tire.rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.55, 0.55, 0.74, 12); rim.rotateZ(Math.PI / 2);
  for (const x of [-2.15, 2.15]) for (const z of [-2.3, 2.3]) { add(tire, black, x, 0.9, z); add(rim, chrome, x, 0.9, z); }
}
scene.add(carMesh);
const forward = h => new THREE.Vector3(Math.sin(h), 0, Math.cos(h));

// Big arrow floating above the car, always pointing at the hatch pad
const homeArrow = new THREE.Group();
{
  const am = new THREE.MeshBasicMaterial({ color: 0x3cff78 });
  const om = new THREE.MeshBasicMaterial({ color: 0x0b5a26 });
  const head = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.6, 16), am); head.rotation.x = Math.PI / 2; head.position.z = 2.2;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3, 12), am); shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.6;
  const rim = new THREE.Mesh(new THREE.ConeGeometry(1.85, 2.9, 16), om); rim.rotation.x = Math.PI / 2; rim.position.set(0, -0.15, 2.05);
  homeArrow.add(rim, head, shaft);
  // Glow: additive halo copies of the arrow plus a soft round sprite behind it
  const gm = new THREE.MeshBasicMaterial({ color: 0x7dffa8, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const gHead = new THREE.Mesh(head.geometry, gm); gHead.rotation.x = Math.PI / 2; gHead.position.z = 2.2; gHead.scale.setScalar(1.35);
  const gShaft = new THREE.Mesh(shaft.geometry, gm); gShaft.rotation.x = Math.PI / 2; gShaft.position.z = -0.6; gShaft.scale.set(1.8, 1.15, 1.8);
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(120,255,160,0.9)'); gr.addColorStop(0.4, 'rgba(60,255,120,0.35)'); gr.addColorStop(1, 'rgba(60,255,120,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.set(9, 9, 1); halo.position.z = 0.8;
  homeArrow.add(gHead, gShaft, halo);
  homeArrow.userData = { am, gm, halo };
}
homeArrow.visible = false; scene.add(homeArrow);

// ================= ZONES, EGGS, GUARDS =================
const eggGeo = new THREE.SphereGeometry(1.3, 10, 8); eggGeo.scale(1, 1.3, 1);
const zones = TIERS.map((tier, ti) => {
  const [zx, zz] = tier.pos, center = new THREE.Vector3(zx, 0, zz);
  const floor = box(70, 0.4, 70, new THREE.Color(tier.color).multiplyScalar(0.55)); floor.position.set(zx, 0.2, zz); scene.add(floor);
  pillar(zx, zz, tier.color);
  const zone = { tier, ti, center, eggs: [], guards: [], targetActive: false };
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, spot = new THREE.Vector3(zx + Math.cos(a) * 22, 2, zz + Math.sin(a) * 22);
    const mesh = new THREE.Mesh(eggGeo, new THREE.MeshLambertMaterial({ color: tier.color, emissive: tier.color, emissiveIntensity: 0.25 }));
    mesh.position.copy(spot); scene.add(mesh);
    zone.eggs.push({ zone, spot, mesh, state: 'ready', timer: 0 });
  }
  for (let i = 0; i < tier.guards; i++) {
    const a = i / tier.guards * Math.PI * 2 + 0.3, home = new THREE.Vector3(zx + Math.cos(a) * 10, 0, zz + Math.sin(a) * 10);
    zone.guards.push(makeGuard(home, tier.guardSpeed));
  }
  return zone;
});

function makeGuard(home, speed) {
  const g = new THREE.Group();
  const torso = box(2, 2, 1, 0x1e2a5a); torso.position.y = 3; g.add(torso);
  const head = box(1.2, 1.2, 1.2, 0xf5cd30); head.position.y = 4.6; g.add(head);
  const hat = box(1.4, 0.4, 1.4, 0x111111); hat.position.y = 5.4; g.add(hat);
  const legL = box(0.95, 2, 1, 0x223); const legR = legL.clone();
  for (const [l, x] of [[legL, -0.5], [legR, 0.5]]) { l.geometry = l.geometry.clone(); l.geometry.translate(0, -1, 0); l.position.set(x, 2, 0); g.add(l); }
  const armL = box(0.9, 2, 1, 0xf5cd30); const armR = armL.clone();
  for (const [a, x] of [[armL, -1.45], [armR, 1.45]]) { a.position.set(x, 3, 0); g.add(a); }
  const alert = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  alert.position.y = 7; alert.visible = false; g.add(alert);
  g.position.copy(home); scene.add(g);
  return { g, home: home.clone(), speed, legL, legR, alert, phase: Math.random() * 6 };
}

// ================= PETS =================
const petMeshes = [];
// Real 3D models for Dog, Cat, Bunny (test set); other pets still use the cube placeholder.
function part(g, geo, c, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, typeof c === 'object' ? c : mat(c));
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); g.add(m); return m;
}
const SPH = new THREE.SphereGeometry(0.5, 14, 10), CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10), CONE = new THREE.ConeGeometry(0.5, 1, 10);
function eyes(g, y, z, spread = 0.22, size = 0.16) {
  for (const x of [-spread, spread]) {
    part(g, SPH, 0x111111, x, y, z, size, size, size * 0.7);
    part(g, SPH, 0xffffff, x + 0.03, y + 0.04, z + 0.05, size * 0.35, size * 0.35, size * 0.3);
  }
}
function legs(g, c, w = 0.32, len = 0.5) {
  for (const x of [-0.3, 0.3]) for (const z of [-0.35, 0.35]) part(g, CYL, c, x, len / 2, z, w, len, w);
}
const PET_BUILDERS = {
  Dog(g) {
    const c = 0xb8804a, d = 0x7a4f28;
    legs(g, c); part(g, SPH, c, 0, 0.75, 0, 0.9, 0.7, 1.25);
    part(g, SPH, c, 0, 1.3, 0.55, 0.75, 0.7, 0.7);
    part(g, SPH, 0xe8c9a0, 0, 1.2, 0.9, 0.38, 0.3, 0.35); part(g, SPH, 0x111111, 0, 1.28, 1.06, 0.13, 0.1, 0.1);
    for (const s of [-1, 1]) part(g, SPH, d, s * 0.36, 1.35, 0.5, 0.18, 0.5, 0.3, 0, 0, s * 0.25);
    eyes(g, 1.42, 0.85, 0.17, 0.13);
    part(g, CYL, c, 0, 1.05, -0.65, 0.12, 0.5, 0.12, -0.8);
  },
  Cat(g) {
    const c = 0xf0a040, s2 = 0xc87a20;
    legs(g, c, 0.26); part(g, SPH, c, 0, 0.72, 0, 0.75, 0.6, 1.1);
    part(g, SPH, c, 0, 1.25, 0.5, 0.72, 0.62, 0.6);
    for (const s of [-1, 1]) { part(g, CONE, c, s * 0.22, 1.62, 0.5, 0.25, 0.32, 0.18, 0, 0, s * -0.25); part(g, CONE, 0xffb0c0, s * 0.22, 1.6, 0.54, 0.13, 0.2, 0.08, 0, 0, s * -0.25); }
    part(g, SPH, 0xfff0dc, 0, 1.15, 0.78, 0.32, 0.22, 0.15); part(g, SPH, 0xff8aa0, 0, 1.22, 0.86, 0.07, 0.05, 0.05);
    eyes(g, 1.32, 0.76, 0.16, 0.13);
    part(g, SPH, s2, 0, 0.98, 0.05, 0.6, 0.12, 0.5); // back stripe
    part(g, CYL, c, 0, 1.2, -0.62, 0.1, 0.9, 0.1, -0.3);
  },
  Bunny(g) {
    const c = 0xf6f6f6, p = 0xffb0c8;
    for (const x of [-0.25, 0.25]) part(g, SPH, c, x, 0.2, 0.1, 0.3, 0.3, 0.5);
    part(g, SPH, c, 0, 0.7, 0, 0.85, 0.85, 0.9);
    part(g, SPH, c, 0, 1.3, 0.3, 0.68, 0.62, 0.62);
    for (const s of [-1, 1]) { part(g, SPH, c, s * 0.16, 1.95, 0.22, 0.2, 0.85, 0.12, 0, 0, s * -0.12); part(g, SPH, p, s * 0.16, 1.95, 0.27, 0.1, 0.65, 0.05, 0, 0, s * -0.12); }
    part(g, SPH, p, 0, 1.24, 0.62, 0.09, 0.07, 0.06);
    eyes(g, 1.38, 0.56, 0.17, 0.13);
    part(g, SPH, 0xffffff, 0, 0.75, -0.48, 0.3, 0.3, 0.3);
  },
};
function petMesh(name) {
  const g = new THREE.Group(), c = RARITY_COLORS[PETS[name]];
  if (PET_BUILDERS[name]) {
    const inner = new THREE.Group(); PET_BUILDERS[name](inner);
    inner.scale.setScalar(1.6); inner.position.y = -1.2; g.add(inner); return g;
  }
  const b = box(1.8, 1.8, 1.8, c); g.add(b);
  for (const x of [-0.45, 0.45]) { const e = box(0.35, 0.35, 0.1, 0x000000); e.position.set(x, 0.3, 0.92); g.add(e); }
  if (PETS[name] === 'Legendary' || PETS[name] === 'Epic') { const crown = box(1, 0.5, 1, 0xffe066); crown.position.y = 1.15; g.add(crown); }
  return g;
}

// Small 3D viewer for the hatch reveal: the pet spins on a glowing rarity disc
let petView = null;
function showPetView(name) {
  const cv = $('petView');
  if (!petView) {
    const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.setSize(200, 200, false);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x666688, 1.3));
    const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(3, 5, 4); sc.add(dl);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50); cam.position.set(0, 1.6, 6.5); cam.lookAt(0, 0.3, 0);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.15, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    disc.position.y = -1.3; sc.add(disc);
    petView = { r, sc, cam, disc, model: null, t: 0, on: false };
    const loop = () => { if (!petView.on) return; petView.t += 1 / 60; if (petView.model) { petView.model.rotation.y = petView.t * 1.4; petView.model.position.y = Math.abs(Math.sin(petView.t * 3)) * 0.25; } r.render(sc, cam); requestAnimationFrame(loop); };
    petView.loop = loop;
  }
  if (petView.model) petView.sc.remove(petView.model);
  petView.model = petMesh(name); petView.sc.add(petView.model);
  petView.disc.material.color.set(RARITY_COLORS[PETS[name]]);
  if (!petView.on) { petView.on = true; petView.t = 0; petView.loop(); }
}
function hidePetView() { if (petView) petView.on = false; }
function refreshPets() {
  for (const p of petMeshes) scene.remove(p.g);
  petMeshes.length = 0;
  save.pets.filter(p => p.e).slice(0, TUNE.maxEquipped).forEach((p, i) => {
    const g = petMesh(p.n); g.position.copy(car.pos); scene.add(g); petMeshes.push({ g, slot: i });
  });
}
refreshPets();
const PET_OFFSETS = [new THREE.Vector3(-3.5, 2, -6), new THREE.Vector3(3.5, 2, -6), new THREE.Vector3(0, 2.5, -9)];

// ================= INPUT =================
const input = { steer: 0, throttle: 0, gas: false, brake: false, joyX: 0, joyY: 0, keys: {}, override: null };
addEventListener('keydown', e => { input.keys[e.code] = true; });
addEventListener('keyup', e => { input.keys[e.code] = false; });
// Stop iOS scroll / pinch zoom / double-tap zoom
document.addEventListener('touchmove', e => { if (!e.target.closest('.panel')) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

const joyZone = document.getElementById('joyZone'), joyBase = document.getElementById('joyBase'), knob = document.getElementById('joyKnob');
let joyId = null;
function joyMove(e) {
  const r = joyBase.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), max = 50;
  if (d > max) { dx *= max / d; dy *= max / d; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  input.joyX = dx / max; input.joyY = -dy / max;
}
joyZone.addEventListener('pointerdown', e => { joyId = e.pointerId; joyZone.setPointerCapture(e.pointerId); joyMove(e); });
joyZone.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; input.joyX = input.joyY = 0; knob.style.transform = ''; };
joyZone.addEventListener('pointerup', joyEnd); joyZone.addEventListener('pointercancel', joyEnd);
for (const [id, key] of [['gas', 'gas'], ['brake', 'brake']]) {
  const el = document.getElementById(id);
  const on = e => { e.preventDefault(); input[key] = true; el.classList.add('down'); el.setPointerCapture?.(e.pointerId); };
  const off = () => { input[key] = false; el.classList.remove('down'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
}
function readInput() {
  if (input.override) return input.override; // used by automated tests
  const k = input.keys;
  let steer = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + input.joyX;
  let thr = (k.KeyW || k.ArrowUp || input.gas ? 1 : 0) - (k.KeyS || k.ArrowDown || input.brake ? 1 : 0);
  if (thr === 0 && Math.abs(input.joyY) > 0.3) thr = input.joyY; // joystick up/down also drives
  return { steer: Math.max(-1, Math.min(1, steer)), throttle: Math.max(-1, Math.min(1, thr)) };
}

// ================= HUD =================
const $ = id => document.getElementById(id);
const hud = { coins: $('coinCount'), status: $('status'), chase: $('chase'), notice: $('notice') };
let noticeTimer = 0;
function notice(t, secs = 2.5) { hud.notice.textContent = t; noticeTimer = secs; }
function updateCoins() { hud.coins.textContent = save.coins.toLocaleString(); }
updateCoins();
function setStatus() {
  if (car.carrying) { hud.status.textContent = `Carrying ${car.carrying.zone.tier.name}! Get it home 🟩`; hud.status.classList.add('carry'); }
  else { hud.status.textContent = 'Drive to an egg zone and grab an egg!'; hud.status.classList.remove('carry'); }
}

// Pet screen
function renderPetScreen() {
  const grid = $('petGrid'); grid.innerHTML = '';
  const eq = save.pets.filter(p => p.e).length;
  $('equipInfo').textContent = `${save.pets.length} pets · ${eq}/${TUNE.maxEquipped} equipped`;
  if (!save.pets.length) grid.innerHTML = '<p class="hint">No pets yet, go steal an egg!</p>';
  save.pets.forEach((p, i) => {
    const d = document.createElement('button'); d.className = 'petCard' + (p.e ? ' eq' : '');
    d.innerHTML = `<div class="sw" style="background:${RARITY_COLORS[PETS[p.n]]}"></div>${p.n}<br><span style="color:${RARITY_COLORS[PETS[p.n]]}">${PETS[p.n]}</span>`;
    d.onclick = () => {
      if (!p.e && save.pets.filter(x => x.e).length >= TUNE.maxEquipped) { notice('Max 3 equipped, unequip one first'); return; }
      p.e = !p.e; persist(); refreshPets(); renderPetScreen();
    };
    grid.appendChild(d);
  });
}
$('petsBtn').onclick = () => { renderPetScreen(); $('petScreen').classList.remove('hidden'); };
$('closePets').onclick = () => $('petScreen').classList.add('hidden');

// Minimap
const mm = $('minimap').getContext('2d'), MS = 70 / TUNE.world * 1.0;
function drawMinimap() {
  mm.clearRect(0, 0, 140, 140);
  const P = (x, z) => [70 - (x - 0) * MS, 115 - z * MS * 0.95]; // +Z is "up" on the map
  mm.fillStyle = '#3cff78'; let [x, y] = P(HOME.x, HOME.z); mm.fillRect(x - 4, y - 4, 8, 8);
  for (const z of zones) {
    [x, y] = P(z.center.x, z.center.z); mm.fillStyle = '#' + new THREE.Color(z.tier.color).getHexString();
    mm.beginPath(); mm.arc(x, y, 6, 0, 7); mm.fill();
    mm.fillStyle = '#ff3030';
    for (const g of z.guards) { const [gx, gy] = P(g.g.position.x, g.g.position.z); mm.fillRect(gx - 1.5, gy - 1.5, 3, 3); }
  }
  [x, y] = P(car.pos.x, car.pos.z);
  mm.save(); mm.translate(x, y); mm.rotate(car.h); mm.fillStyle = '#fff';
  mm.beginPath(); mm.moveTo(0, -6); mm.lineTo(4, 5); mm.lineTo(-4, 5); mm.closePath(); mm.fill(); mm.restore();
}

// ================= GAME LOGIC =================
const state = { running: false, hatching: false, chased: false, stealTime: 0, time: 0, shake: 0 };

function grabEgg(egg) {
  egg.state = 'carried'; car.carrying = egg;
  state.stealTime = state.time; state.chased = true; egg.zone.targetActive = true;
  notice(`You stole a ${egg.zone.tier.name}! RUN!`); setStatus(); vibrate(60);
}
function returnEgg() {
  const egg = car.carrying; if (!egg) return;
  egg.state = 'ready'; egg.mesh.position.copy(egg.spot); egg.mesh.visible = true;
  egg.zone.targetActive = false; car.carrying = null; state.chased = false; setStatus();
}
function fling() {
  const a = Math.random() * Math.PI * 2;
  car.flung = { vx: Math.cos(a) * 35, vz: Math.sin(a) * 35, vy: 38, spinY: (Math.random() - 0.5) * 20, spinX: (Math.random() - 0.5) * 14, rx: 0, rz: 0 };
  car.speed = 0; state.shake = 1; returnEgg();
  notice('CAUGHT! 💥 The egg went back.', 3); vibrate([100, 50, 200]);
}
function vibrate(p) { try { navigator.vibrate?.(p); } catch (e) {} }

function rollPet(tier) {
  const total = tier.pets.reduce((s, p) => s + p[1], 0); let r = Math.random() * total;
  for (const [n, w] of tier.pets) { r -= w; if (r <= 0) return n; }
  return tier.pets[tier.pets.length - 1][0];
}
function hatch() {
  const egg = car.carrying, tier = egg.zone.tier, pet = rollPet(tier);
  egg.state = 'cooldown'; egg.timer = TUNE.eggRespawn; egg.mesh.visible = false;
  egg.zone.targetActive = false; car.carrying = null; state.chased = false; setStatus();
  const eq = save.pets.filter(p => p.e).length;
  save.pets.push({ n: pet, e: eq < TUNE.maxEquipped }); save.coins += tier.reward; persist();
  state.hatching = true; car.speed = 0;
  const ov = $('hatch'), eggEl = $('hatchEgg'), res = $('hatchResult');
  ov.classList.remove('hidden'); res.classList.add('hidden'); eggEl.className = ''; eggEl.style.display = '';
  eggEl.style.filter = `drop-shadow(0 0 20px #${new THREE.Color(tier.color).getHexString()})`;
  setTimeout(() => { eggEl.className = 'crack'; vibrate(80); }, 1600);
  setTimeout(() => {
    eggEl.style.display = 'none'; res.classList.remove('hidden');
    const col = RARITY_COLORS[PETS[pet]];
    showPetView(pet);
    $('petName').textContent = pet; $('petRarity').textContent = PETS[pet]; $('petRarity').style.color = col;
    $('petCoins').textContent = `+${tier.reward} coins`;
    updateCoins(); refreshPets();
  }, 2100);
}
$('hatchOk').onclick = () => { $('hatch').classList.add('hidden'); hidePetView(); state.hatching = false; };

function update(dt) {
  state.time += dt;
  const { steer, throttle } = state.hatching ? { steer: 0, throttle: 0 } : readInput();

  // --- Car
  if (car.flung) {
    const f = car.flung;
    car.pos.x += f.vx * dt; car.pos.z += f.vz * dt; car.pos.y += f.vy * dt; f.vy -= 60 * dt;
    car.h += f.spinY * dt; f.rx += f.spinX * dt; f.rz += f.spinX * 0.7 * dt;
    if (car.pos.y <= 0 && f.vy < 0) { car.pos.y = 0; car.flung = null; state.shake = 0.5; }
  } else {
    let target = throttle > 0 ? throttle * TUNE.carSpeed : throttle * TUNE.reverseSpeed;
    if (throttle < 0 && car.speed > 1) target = 0; // braking first
    const rate = (throttle < 0 && car.speed > 1) ? TUNE.brake : (Math.abs(target) > Math.abs(car.speed) ? TUNE.accel : TUNE.accel * 1.2);
    car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), rate * dt);
    const tf = Math.min(1, Math.abs(car.speed) / 8) * Math.sign(car.speed);
    car.h -= steer * TUNE.turnRate * tf * dt;
    car.pos.addScaledVector(forward(car.h), car.speed * dt);
  }
  const W = TUNE.world;
  car.pos.x = Math.max(-W, Math.min(W, car.pos.x)); car.pos.z = Math.max(-W, Math.min(W, car.pos.z));
  carMesh.position.copy(car.pos); carMesh.rotation.set(car.flung ? car.flung.rx : 0, car.h, car.flung ? car.flung.rz : 0, 'YXZ');
  if (!car.flung) carMesh.rotation.z = -steer * Math.min(1, Math.abs(car.speed) / 30) * 0.06; // little lean

  // --- Eggs
  for (const z of zones) for (const egg of z.eggs) {
    if (egg.state === 'ready') {
      egg.mesh.position.y = 2 + Math.sin(state.time * 2 + egg.spot.x) * 0.4; egg.mesh.rotation.y += dt;
      if (!car.carrying && !car.flung && !state.hatching && car.pos.distanceTo(egg.spot) < TUNE.grabRadius + 2) grabEgg(egg);
    } else if (egg.state === 'carried') {
      egg.mesh.position.set(car.pos.x, car.pos.y + 6 + Math.sin(state.time * 5) * 0.3, car.pos.z); egg.mesh.rotation.y += dt * 3;
    } else if (egg.state === 'cooldown') {
      egg.timer -= dt; if (egg.timer <= 0) { egg.state = 'ready'; egg.mesh.position.copy(egg.spot); egg.mesh.visible = true; }
    }
  }

  // --- Escape / hatch checks
  if (car.carrying) {
    const z = car.carrying.zone;
    if (z.targetActive && (state.time - state.stealTime > TUNE.giveUpTime || car.pos.distanceTo(z.center) > TUNE.giveUpDist)) {
      z.targetActive = false; state.chased = false; notice('You lost the guards! Get home!');
    }
    if (!car.flung && Math.hypot(car.pos.x - HOME.x, car.pos.z - HOME.z) < TUNE.padRadius) hatch();
  }

  // --- Guards
  for (const z of zones) for (const g of z.guards) {
    const p = g.g.position; let target = g.home, chasing = false;
    if (z.targetActive && car.carrying && !car.flung) {
      chasing = true;
      target = car.pos.clone().addScaledVector(forward(car.h), car.speed * 0.35); // aim ahead
    }
    const d = new THREE.Vector3(target.x - p.x, 0, target.z - p.z), dist = d.length();
    const moving = dist > (chasing ? 0.5 : 1.5);
    if (moving) { const step = Math.min(dist, g.speed * (chasing ? 1 : 0.5) * dt); p.addScaledVector(d.normalize(), step); g.g.rotation.y = Math.atan2(d.x, d.z); }
    g.phase += dt * (moving ? g.speed * 0.6 : 0);
    const swing = moving ? Math.sin(g.phase) * 0.8 : 0;
    g.legL.rotation.x = swing; g.legR.rotation.x = -swing;
    g.alert.visible = chasing && Math.sin(state.time * 12) > 0;
    if (chasing && state.time - state.stealTime > TUNE.grace && Math.hypot(car.pos.x - p.x, car.pos.z - p.z) < TUNE.catchRadius + 1.5) fling();
  }

  // --- Pets follow
  for (const pm of petMeshes) {
    const off = PET_OFFSETS[pm.slot].clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), car.h);
    const t = car.pos.clone().add(off); t.y = 2 + Math.sin(state.time * 4 + pm.slot) * 0.4;
    pm.g.position.lerp(t, Math.min(1, dt * 5)); pm.g.rotation.y = car.h;
  }

  // --- Home arrow
  const toHome = Math.atan2(HOME.x - car.pos.x, HOME.z - car.pos.z);
  const homeDist = Math.hypot(HOME.x - car.pos.x, HOME.z - car.pos.z);
  homeArrow.visible = !car.flung && homeDist > TUNE.padRadius;
  if (homeArrow.visible) {
    homeArrow.position.set(car.pos.x, car.pos.y + 7 + Math.sin(state.time * 4) * 0.4, car.pos.z);
    homeArrow.rotation.y = toHome;
    homeArrow.scale.setScalar(car.carrying ? 1.25 : 1);
    const pulse = 0.5 + 0.5 * Math.sin(state.time * 5);
    homeArrow.userData.gm.opacity = 0.2 + 0.3 * pulse;
    homeArrow.userData.halo.material.opacity = 0.55 + 0.45 * pulse;
    homeArrow.userData.am.color.setHSL(0.39, 1, 0.55 + 0.15 * pulse);
  }
  hud.chase.classList.toggle('on', state.chased);
  if (noticeTimer > 0) { noticeTimer -= dt; if (noticeTimer <= 0) hud.notice.textContent = ''; }

  // --- Camera (chase cam, further back in portrait)
  const portrait = camera.aspect < 1, back = portrait ? 22 : 17, up = portrait ? 11 : 8;
  const camTarget = car.pos.clone().addScaledVector(forward(car.h), -back); camTarget.y = car.pos.y * 0.5 + up;
  camera.position.lerp(camTarget, Math.min(1, dt * (car.flung ? 2 : 4)));
  if (state.shake > 0) { camera.position.x += (Math.random() - 0.5) * state.shake * 2; camera.position.y += (Math.random() - 0.5) * state.shake * 2; state.shake -= dt * 1.5; }
  camera.lookAt(car.pos.x, car.pos.y + 3, car.pos.z);
}

let last = performance.now(), mmTimer = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state.running) update(dt);
  mmTimer -= dt; if (mmTimer <= 0) { drawMinimap(); mmTimer = 0.1; }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
camera.position.set(0, 10, -10); camera.lookAt(0, 0, 20);
requestAnimationFrame(frame);

// ================= LANDSCAPE ONLY =================
// Lock to landscape where the browser allows it (Android / installed app); everywhere else
// (iPhone Safari) the #rotate overlay covers the game and play pauses while held upright.
const portraitMQ = matchMedia('(orientation: portrait) and (pointer: coarse)');
let started = false;
function lockLandscape() { try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) {} }
function applyOrientation() {
  const upright = portraitMQ.matches;
  if (upright) { input.joyX = input.joyY = 0; for (const k of Object.keys(input)) if (input[k] === true) input[k] = false; }
  if (started) state.running = !upright;
  setTimeout(onResize, 100);
}
portraitMQ.addEventListener?.('change', applyOrientation);
addEventListener('orientationchange', applyOrientation);
applyOrientation();

$('play').onclick = () => { $('start').classList.add('hidden'); started = true; lockLandscape(); state.running = !portraitMQ.matches; };

// ================= FULLSCREEN =================
// Real Fullscreen API where available (desktop/Android); on iPhone Safari (no element
// fullscreen) or if it is blocked, fall back to a fill-the-screen mode + a one-time hint.
const fsBtn = $('fsBtn'), fsHint = $('fsHint');
let fillMode = false, hintShown = false;
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
function setFsIcon() { const on = !!fsElement() || fillMode; fsBtn.textContent = on ? '✕' : '⛶'; fsBtn.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Fullscreen'); }
function goFill() {
  fillMode = true; document.body.classList.add('fillmode'); window.scrollTo(0, 0); setFsIcon(); onResize();
  if (!hintShown) { hintShown = true; fsHint.classList.remove('hidden'); setTimeout(() => fsHint.classList.add('hidden'), 6000); }
}
fsHint.onclick = () => fsHint.classList.add('hidden');
fsBtn.onclick = () => {
  if (fillMode) { fillMode = false; document.body.classList.remove('fillmode'); setFsIcon(); onResize(); return; }
  if (fsElement()) { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {}); return; }
  const el = document.documentElement;
  try {
    if (el.requestFullscreen && document.fullscreenEnabled !== false) el.requestFullscreen().catch(goFill);
    else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); setTimeout(() => { if (!fsElement()) goFill(); }, 400); }
    else goFill();
  } catch (e) { goFill(); }
};
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => { setFsIcon(); if (fsElement()) lockLandscape(); setTimeout(onResize, 50); });

// Hook for automated tests / tinkering in the console
window.EH = { state, car, zones, input, save, TUNE, HOME };
