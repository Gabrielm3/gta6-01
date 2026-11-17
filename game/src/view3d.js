// Third-person 3D view of Saltwake on the world3d canvas: tile ground, extruded
// buildings, trees and props, cars and pedestrians under a high midday sun.
// The 2D game canvas stays on top and carries only the HUD.

import * as THREE from '../vendor/three.min.js';
import { T, COLS, ROWS, WATER, SAND, ROAD, WALK, PIER, GRASS, ROAD_ROWS, ROAD_COLS, districtAt } from './city.js';
import { jobMarker } from './jobs.js';

const BUILDING_H = 2.2 * T;
const SKY = 0x6cc4ff;
const WATER_COLOR = '#1690e8';
const TEX_PX = 16;
const CAM_CLEAR = 40;

let renderer = null;
let scene = null;
let camera = null;
let sun = null;
let cityGroup = null;
let builtFor = null;
let marker = null;
const carPool = [];
const pedPool = [];
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
let camReady = false;

const matCache = new Map();
function mat(color) {
  const key = String(color);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
    matCache.set(key, m);
  }
  return m;
}

function tint(color, k) {
  const c = new THREE.Color(color);
  if (k < 1) return c.multiplyScalar(k).getStyle();
  return c.lerp(new THREE.Color(0xffffff), k - 1).getStyle();
}

function ensureRenderer() {
  if (renderer) return true;
  const canvas = document.getElementById('world3d');
  if (!canvas) return false;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  } catch (err) {
    console.warn('3D view unavailable:', err);
    return false;
  }
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(SKY);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, T * 22, T * 60);

  camera = new THREE.PerspectiveCamera(58, 16 / 9, 4, T * 120);

  scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x5f8a4a, 1.25));
  sun = new THREE.DirectionalLight(0xfffbea, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = T * 14;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 10, far: T * 70 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);
  return true;
}

const TILE_FILL = {
  [WATER]: WATER_COLOR, [SAND]: '#ffe08f', [ROAD]: '#4b515d', [WALK]: '#e9e2d2',
  [PIER]: '#c98a48', [GRASS]: '#4cc23a',
};
const LOT_FILL = { YARD: '#d4c7a8', QUAY: '#bccbd6', MARKET: '#f3cf92', RIDGE: '#4cc23a' };

function groundTexture(city) {
  const cv = document.createElement('canvas');
  cv.width = COLS * TEX_PX;
  cv.height = ROWS * TEX_PX;
  const g = cv.getContext('2d');
  const k = TEX_PX / T;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = city.tiles[r * COLS + c];
      let fill = TILE_FILL[tile];
      if (!fill) {
        const d = districtAt(c * T + T / 2, r * T + T / 2);
        fill = LOT_FILL[d.key] || LOT_FILL[d.name] || d.ground || '#d4c7a8';
      }
      g.fillStyle = fill;
      g.fillRect(c * TEX_PX, r * TEX_PX, TEX_PX, TEX_PX);
      if (tile === WALK) {
        g.strokeStyle = 'rgba(90,80,64,0.35)';
        g.lineWidth = 1;
        g.strokeRect(c * TEX_PX + 0.5, r * TEX_PX + 0.5, TEX_PX - 1, TEX_PX - 1);
      } else if (tile === PIER) {
        g.fillStyle = '#8e5c2a';
        for (let i = 2; i < TEX_PX; i += 4) g.fillRect(c * TEX_PX, r * TEX_PX + i, TEX_PX, 1);
      }
    }
  }
  g.strokeStyle = '#ffd23a';
  g.lineWidth = 5 * k;
  g.setLineDash([26 * k, 22 * k]);
  const left = ROAD_COLS[0] * T * k;
  const right = (ROAD_COLS[ROAD_COLS.length - 1] + 2) * T * k;
  const top = ROAD_ROWS[0] * T * k;
  const bottom = (ROAD_ROWS[ROAD_ROWS.length - 1] + 2) * T * k;
  for (const rr of ROAD_ROWS) {
    g.beginPath();
    g.moveTo(left, (rr + 1) * TEX_PX);
    g.lineTo(right, (rr + 1) * TEX_PX);
    g.stroke();
  }
  for (const cc of ROAD_COLS) {
    g.beginPath();
    g.moveTo((cc + 1) * TEX_PX, top);
    g.lineTo((cc + 1) * TEX_PX, bottom);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function windowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#5b7fa0';
  g.fillRect(10, 16, 18, 22);
  g.fillRect(36, 16, 18, 22);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 58, 64, 6);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildCity(city) {
  const group = new THREE.Group();
  const W = COLS * T;
  const H = ROWS * T;

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(W * 6, H * 6), mat(WATER_COLOR));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(W / 2, -1, H / 2);
  sea.receiveShadow = true;
  group.add(sea);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshLambertMaterial({ map: groundTexture(city) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(W / 2, 0, H / 2);
  ground.receiveShadow = true;
  group.add(ground);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const winTex = windowTexture();
  for (const b of city.buildings) {
    const w = (b.c1 + 1 - b.c0) * T - 8;
    const d = (b.r1 + 1 - b.r0) * T - 8;
    const h = BUILDING_H * (b.style === 'house' ? 0.8 : b.style === 'warehouse' ? 0.95 : 1.1);
    const wall = (repX) => {
      const t = winTex.clone();
      t.needsUpdate = true;
      t.repeat.set(Math.max(1, Math.round(repX / 40)), Math.max(1, Math.round(h / 44)));
      return new THREE.MeshLambertMaterial({ color: new THREE.Color(tint(b.roof, 1.45)), map: t });
    };
    const roof = mat(b.roof);
    const m = new THREE.Mesh(box, [wall(d), wall(d), roof, roof, wall(w), wall(w)]);
    m.scale.set(w, h, d);
    m.position.set(b.c0 * T + 4 + w / 2, h / 2, b.r0 * T + 4 + d / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    const lip = new THREE.Mesh(box, mat(tint(b.roof, 0.7)));
    lip.scale.set(w + 6, 6, d + 6);
    lip.position.set(m.position.x, h + 3, m.position.z);
    lip.castShadow = true;
    group.add(lip);
  }

  const trunkGeo = new THREE.CylinderGeometry(4, 5, 1, 6);
  const leafGeo = new THREE.SphereGeometry(1, 10, 8);
  for (const p of city.props) {
    if (p.kind === 'tree') {
      const s = p.s || 20;
      const trunk = new THREE.Mesh(trunkGeo, mat('#7a4f2a'));
      trunk.scale.y = s * 1.4;
      trunk.position.set(p.x, s * 0.7, p.y);
      trunk.castShadow = true;
      const leaves = new THREE.Mesh(leafGeo, mat('#2fb83a'));
      leaves.scale.set(s, s * 1.1, s);
      leaves.position.set(p.x, s * 1.9, p.y);
      leaves.castShadow = true;
      leaves.receiveShadow = true;
      group.add(trunk, leaves);
    } else if (p.kind === 'container') {
      const c = new THREE.Mesh(box, mat(p.color));
      c.scale.set(p.w, 30, p.h);
      c.position.set(p.x, 15, p.y);
      c.castShadow = true;
      c.receiveShadow = true;
      group.add(c);
    } else if (p.kind === 'stall') {
      const c = new THREE.Mesh(box, mat(p.color));
      c.scale.set(40, 22, 32);
      c.position.set(p.x, 11, p.y);
      c.castShadow = true;
      const awning = new THREE.Mesh(box, mat('#ffffff'));
      awning.scale.set(46, 4, 38);
      awning.position.set(p.x, 26, p.y);
      awning.castShadow = true;
      group.add(c, awning);
    }
  }
  scene.add(group);
  return group;
}

function makeCar() {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const g = new THREE.Group();
  const body = new THREE.Mesh(box, mat('#ffffff'));
  body.castShadow = true;
  body.receiveShadow = true;
  const cabin = new THREE.Mesh(box, mat('#2a3a4c'));
  cabin.castShadow = true;
  const roof = new THREE.Mesh(box, mat('#ffffff'));
  roof.castShadow = true;
  const barR = new THREE.Mesh(box, mat('#ff2626'));
  const barB = new THREE.Mesh(box, mat('#2a5cff'));
  const stripe = new THREE.Mesh(box, mat('#1f3f9a'));
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  for (let i = 0; i < 4; i++) {
    const wh = new THREE.Mesh(wheelGeo, mat('#16161c'));
    wh.rotation.x = Math.PI / 2;
    wheels.push(wh);
    g.add(wh);
  }
  g.add(body, cabin, roof, barR, barB, stripe);
  g.userData = { body, cabin, roof, barR, barB, stripe, wheels, kind: null };
  scene.add(g);
  return g;
}

function shapeCar(m, car) {
  const u = m.userData;
  const L = car.w;
  const Wd = car.h;
  const van = car.kind === 'van';
  const H = van ? 30 : 18;
  u.body.scale.set(L, H, Wd);
  u.body.position.set(0, 8 + H / 2, 0);
  const cl = van ? L * 0.62 : L * 0.5;
  const cx = van ? -L * 0.12 : -L * 0.06;
  const ch = van ? 12 : 13;
  u.cabin.scale.set(cl, ch, Wd - 3);
  u.cabin.position.set(cx, 8 + H + ch / 2, 0);
  u.roof.scale.set(cl - 6, 2, Wd - 4);
  u.roof.position.set(cx - 1, 8 + H + ch + 1, 0);
  const cop = car.kind === 'watch';
  u.barR.visible = cop;
  u.barB.visible = cop;
  u.stripe.visible = cop;
  if (cop) {
    const y = 8 + H + ch + 4;
    u.barR.scale.set(6, 5, Wd * 0.4);
    u.barR.position.set(cx, y, -Wd * 0.22);
    u.barB.scale.set(6, 5, Wd * 0.4);
    u.barB.position.set(cx, y, Wd * 0.22);
    u.stripe.scale.set(L + 0.5, 5, Wd + 0.5);
    u.stripe.position.set(0, 8 + H * 0.45, 0);
  }
  const r = 7;
  const xs = [L * 0.32, -L * 0.32];
  const zs = [Wd / 2 - 2, -Wd / 2 + 2];
  let i = 0;
  for (const x of xs) {
    for (const z of zs) {
      const wh = u.wheels[i++];
      wh.scale.set(r, 6, r);
      wh.position.set(x, r, z);
    }
  }
  u.kind = car.kind;
}

function syncCars(world) {
  const cars = world.cars || [];
  while (carPool.length < cars.length) carPool.push(makeCar());
  for (let i = 0; i < carPool.length; i++) {
    const m = carPool[i];
    const car = cars[i];
    if (!car) { m.visible = false; continue; }
    m.visible = true;
    if (m.userData.kind !== car.kind || m.userData.w !== car.w) {
      shapeCar(m, car);
      m.userData.w = car.w;
    }
    m.position.set(car.x, 0, car.y);
    m.rotation.y = -car.angle;
    m.userData.body.material = mat(car.kind === 'watch' ? '#f4f1e8' : car.color);
    m.userData.roof.material = m.userData.body.material;
    if (car.kind === 'watch') {
      const on = Math.sin((world.time || 0) * 14) > 0;
      m.userData.barR.material = mat(on ? '#ff3030' : '#7a1010');
      m.userData.barB.material = mat(on ? '#1a2a70' : '#3a7aff');
    }
  }
}

function makePed() {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const g = new THREE.Group();
  const legs = new THREE.Mesh(box, mat('#2c3140'));
  legs.scale.set(8, 16, 12);
  legs.position.y = 8;
  const torso = new THREE.Mesh(box, mat('#3060c0'));
  torso.scale.set(10, 16, 16);
  torso.position.y = 24;
  const head = new THREE.Mesh(box, mat('#d9a27a'));
  head.scale.set(9, 9, 9);
  head.position.y = 37;
  for (const part of [legs, torso, head]) part.castShadow = true;
  const body = new THREE.Group();
  body.add(legs, torso, head);
  g.add(body);
  g.userData = { torso, head, body };
  scene.add(g);
  return g;
}

function syncPeds(world) {
  const list = (world.peds || []).map((p) => ({ x: p.x, y: p.y, angle: p.angle ?? p.face ?? 0, shirt: p.shirt, down: p.down > 0, player: false }));
  const pl = world.player;
  if (pl && !pl.car) list.push({ x: pl.x, y: pl.y, angle: pl.face || 0, shirt: '#ffcc22', down: false, player: true });
  while (pedPool.length < list.length) pedPool.push(makePed());
  for (let i = 0; i < pedPool.length; i++) {
    const m = pedPool[i];
    const ped = list[i];
    if (!ped || Math.hypot(ped.x - camera.position.x, ped.y - camera.position.z) < CAM_CLEAR) {
      m.visible = false;
      continue;
    }
    m.visible = true;
    m.position.set(ped.x, 0, ped.y);
    m.rotation.y = -ped.angle;
    m.userData.torso.material = mat(ped.shirt || '#3060c0');
    m.userData.body.rotation.z = ped.down ? -Math.PI / 2 : 0;
    m.userData.body.position.y = ped.down ? 5 : 0;
    const s = ped.player ? 1.15 : 1;
    m.scale.set(s, s, s);
  }
}

function syncMarker(world) {
  const m = jobMarker(world);
  if (!marker) {
    marker = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    );
    scene.add(marker);
  }
  marker.visible = !!m;
  if (!m) return;
  const pulse = 0.5 + Math.sin((world.time || 0) * 5) * 0.5;
  marker.scale.set(m.r, 50 + pulse * 20, m.r);
  marker.position.set(m.x, marker.scale.y / 2, m.y);
}

function updateCamera(world, w, h) {
  const p = world.player;
  const driving = !!p.car;
  const focus = driving ? p.car : p;
  const a = driving ? p.car.angle : (p.face || 0);
  const fx = Math.cos(a);
  const fz = Math.sin(a);
  const dist = driving ? T * 2.1 : T * 1.6;
  const height = driving ? T * 1.05 : T * 0.95;
  const wantPos = new THREE.Vector3(focus.x - fx * dist, height, focus.y - fz * dist);
  const wantLook = new THREE.Vector3(focus.x + fx * T * 1.4, T * 0.35, focus.y + fz * T * 1.4);
  if (!camReady) {
    camPos.copy(wantPos);
    camLook.copy(wantLook);
    camReady = true;
  } else {
    camPos.lerp(wantPos, 0.15);
    camLook.lerp(wantLook, 0.22);
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  if (camera.aspect !== w / h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const cx = focus.x + fx * T * 6;
  const cz = focus.y + fz * T * 6;
  sun.position.set(cx + T * 7, T * 32, cz + T * 4);
  sun.target.position.set(cx, 0, cz);
}

export function render3d(world, width, height) {
  if (!world || !world.city || !world.player || !ensureRenderer()) return false;
  if (builtFor !== world.city) {
    if (cityGroup) scene.remove(cityGroup);
    cityGroup = buildCity(world.city);
    builtFor = world.city;
    camReady = false;
  }
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x !== width || size.y !== height) renderer.setSize(width, height, false);
  updateCamera(world, width, height);
  syncCars(world);
  syncPeds(world);
  syncMarker(world);
  renderer.render(scene, camera);
  return true;
}
