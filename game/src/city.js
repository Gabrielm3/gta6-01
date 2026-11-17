// The island of Saltwake: one fixed map, the same on every run. A ring road and a grid of streets cut the land into
// sixteen blocks; the four quarters are the Yard (north-west), the Ridge (north-east), the Quay
// (south-west) and the Market (south-east). The north pier runs out into the harbor from the
// middle of the north shore. This file lays the map out, answers collision questions about it,
// and paints the ground once into an offscreen canvas.
import { createRandom } from './random.js';

/** Centre lines of the streets, both ways: the first and last are the ring road. */
export const LINES = [150, 600, 1050, 1500, 1950];
export const ROAD_HALF = 40;
export const LANE = 12;
export const PARK = 31;
export const LAND = 2100;
export const SIDEWALK = 16;
/** How far the ground canvas reaches past the island on every side. */
export const MARGIN = 420;
export const PIER = { x0: 1018, x1: 1082, y0: -340, y1: 10, endX: 1050, endY: -290 };
export const SAFEHOUSE = { x: 380, y: 1830 };
export const MARKET_DROP = { x: 1725, y: 1500, r: 74 };
export const YARD_VAN_SPOT = { x: 600 + 32, y: 380, angle: -Math.PI / 2 };
export const MARKET_CAR_SPOT = { x: 1500 + 31, y: 1290, angle: -Math.PI / 2 };

export const DISTRICTS = {
  yard: { name: 'THE YARD', ground: '#4d4a44', roofs: ['#6f767d', '#7d6a55', '#5d6b63', '#857a6a'], tint: '#7a7064' },
  ridge: { name: 'THE RIDGE', ground: '#3b5134', roofs: ['#8a5a4a', '#6e7a86', '#a08566', '#7a5f6e'], tint: '#4f6b45' },
  quay: { name: 'THE QUAY', ground: '#53504a', roofs: ['#5a4038', '#3f4a52', '#6b5446', '#55606a'], tint: '#5f6670' },
  market: { name: 'THE MARKET', ground: '#6a5d4e', roofs: ['#b8563d', '#d29a3b', '#4f7f8c', '#8c4f6b'], tint: '#9a6a48' },
  pier: { name: 'NORTH PIER', ground: '#6e5135', roofs: ['#6e5135'], tint: '#8a6a45' },
};

/** Which district a point is in. */
export function districtAt(x, y) {
  if (y < 20 && x > PIER.x0 - 40 && x < PIER.x1 + 40) return 'pier';
  const west = x < 1050;
  const north = y < 1050;
  if (north) return west ? 'yard' : 'ridge';
  return west ? 'quay' : 'market';
}

function shade(hex, f) {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function addBox(city, rng, district, x0, y0, x1, y1, h, kind) {
  const roof = kind === 'container' ? pick(rng, ['#a8452f', '#2f6f8f', '#c99a2e', '#4f7a4a', '#7a4f7a']) : pick(rng, DISTRICTS[district].roofs);
  const lit = [];
  for (let i = 0; i < 64; i += 1) lit.push(rng() < 0.42);
  city.boxes.push({ x0, y0, x1, y1, h, kind, district, roof, wallA: shade(roof, 0.62), wallB: shade(roof, 0.46), edge: shade(roof, 1.25), lit, floors: Math.max(1, Math.floor(h / 16)) });
}

function fillBlock(city, rng, block) {
  const pad = SIDEWALK + 8;
  const x0 = block.x0 + pad;
  const y0 = block.y0 + pad;
  const x1 = block.x1 - pad;
  const y1 = block.y1 - pad;
  const d = block.district;
  if (block.plaza) {
    for (let gx = 0; gx < 4; gx += 1) {
      for (let gy = 0; gy < 3; gy += 1) {
        const sx = x0 + 30 + gx * 74;
        const sy = y0 + 40 + gy * 96;
        addBox(city, rng, d, sx, sy, sx + 44, sy + 30, 10, 'stall');
      }
    }
    return;
  }
  if (d === 'yard') {
    addBox(city, rng, d, x0 + 10, y0 + 10, x1 - 10, y0 + 170, 34 + rng() * 10, 'warehouse');
    for (let i = 0; i < 6; i += 1) {
      const cx = x0 + 14 + i * 52;
      const stack = 1 + Math.floor(rng() * 3);
      addBox(city, rng, d, cx, y1 - 92, cx + 40, y1 - 18, 9 * stack, 'container');
    }
    return;
  }
  const pattern = Math.floor(rng() * 3);
  const gap = 16;
  const mx = (x0 + x1) / 2 + (rng() - 0.5) * 60;
  const my = (y0 + y1) / 2 + (rng() - 0.5) * 60;
  const rects = pattern === 0
    ? [[x0, y0, mx - gap / 2, my - gap / 2], [mx + gap / 2, y0, x1, my - gap / 2], [x0, my + gap / 2, mx - gap / 2, y1], [mx + gap / 2, my + gap / 2, x1, y1]]
    : pattern === 1
      ? [[x0, y0, mx - gap / 2, y1], [mx + gap / 2, y0, x1, my - gap / 2], [mx + gap / 2, my + gap / 2, x1, y1]]
      : [[x0, y0, x1, my - gap / 2], [x0, my + gap / 2, mx - gap / 2, y1], [mx + gap / 2, my + gap / 2, x1, y1]];
  for (const [a, b, c, e] of rects) {
    if (d === 'ridge' && rng() < 0.3) {
      for (let t = 0; t < 4; t += 1) {
        const tx = a + 14 + rng() * (c - a - 28);
        const ty = b + 14 + rng() * (e - b - 28);
        city.trees.push({ x: tx, y: ty, r: 12 + rng() * 8 });
        city.boxes.push({ x0: tx - 5, y0: ty - 5, x1: tx + 5, y1: ty + 5, h: 0, kind: 'trunk', district: d });
      }
      continue;
    }
    const inset = 4 + rng() * 10;
    const h = d === 'ridge' ? 70 + rng() * 70 : d === 'market' ? 30 + rng() * 34 : 26 + rng() * 30;
    addBox(city, rng, d, a + inset, b + inset, c - inset, e - inset, h, d === 'quay' ? 'shed' : 'building');
  }
}

/** Lay out the whole island. The map is the same for every seed. */
export function buildCity() {
  const rng = createRandom(9021);
  const city = { blocks: [], boxes: [], trees: [], lamps: [], nodes: [], land: [], grid: new Map(), ground: null, minimap: null, glints: [] };
  city.land.push({ x0: 0, y0: 0, x1: LAND, y1: LAND });
  city.land.push({ x0: PIER.x0, y0: PIER.y0, x1: PIER.x1, y1: 10 });
  city.land.push({ x0: 250, y0: LAND - 10, x1: 312, y1: LAND + 150 });
  city.land.push({ x0: 720, y0: LAND - 10, x1: 782, y1: LAND + 150 });
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      const x0 = LINES[i] + ROAD_HALF;
      const y0 = LINES[j] + ROAD_HALF;
      const block = { i, j, x0, y0, x1: LINES[i + 1] - ROAD_HALF, y1: LINES[j + 1] - ROAD_HALF, district: districtAt(x0 + 10, y0 + 10), plaza: i === 2 && j === 2 };
      city.blocks.push(block);
      fillBlock(city, rng, block);
    }
  }
  // Containers on the Quay's south shore, sheds on the Yard's north shore.
  for (let k = 0; k < 9; k += 1) {
    const x = 340 + k * 70;
    if (x > 700 && x < 800) continue;
    addBox(city, rng, 'quay', x, 2006, x + 52, 2070, 9 * (1 + Math.floor(rng() * 3)), 'container');
  }
  addBox(city, rng, 'yard', 220, 22, 520, 96, 30, 'warehouse');
  addBox(city, rng, 'ridge', 1600, 20, 1880, 92, 44, 'building');
  for (const x of LINES) {
    for (const y of LINES) {
      city.nodes.push({ x, y });
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const lx = x + sx * (ROAD_HALF + 8);
        const ly = y + sy * (ROAD_HALF + 8);
        if (lx > 0 && ly > 0 && lx < LAND && ly < LAND) city.lamps.push({ x: lx, y: ly });
      }
    }
  }
  city.nodes.push({ x: 1050, y: 0 }, { x: 1050, y: PIER.endY });
  for (let y = -40; y > PIER.y0; y -= 80) city.lamps.push({ x: PIER.x0 + 4, y }, { x: PIER.x1 - 4, y: y - 40 });
  for (const box of city.boxes) {
    for (let gx = Math.floor(box.x0 / 150); gx <= Math.floor(box.x1 / 150); gx += 1) {
      for (let gy = Math.floor(box.y0 / 150); gy <= Math.floor(box.y1 / 150); gy += 1) {
        const key = gx * 1000 + gy;
        if (!city.grid.has(key)) city.grid.set(key, []);
        city.grid.get(key).push(box);
      }
    }
  }
  return city;
}

/** Grid neighbours of a road node: the nodes one street away along a road (and the pier). */
export function nodeNeighbours(city, node) {
  const out = [];
  for (const other of city.nodes) {
    if (other === node) continue;
    const sameX = other.x === node.x && Math.abs(other.y - node.y) <= 450;
    const sameY = other.y === node.y && Math.abs(other.x - node.x) <= 450 && node.y > 100 && other.y > 100;
    if (sameX || sameY) out.push(other);
  }
  return out;
}

export function nearestNode(city, x, y) {
  let best = city.nodes[0];
  let bestD = Infinity;
  for (const node of city.nodes) {
    const d = (node.x - x) ** 2 + (node.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = node;
    }
  }
  return best;
}

function onLand(city, x, y, r) {
  for (const l of city.land) if (x >= l.x0 + r && x <= l.x1 - r && y >= l.y0 + r && y <= l.y1 - r) return true;
  return false;
}

/**
 * Push a circle out of every solid box and back onto land. Returns the corrected point and the
 * push normal (zero when nothing was touched).
 */
export function resolveCircle(city, x, y, r) {
  let nx = 0;
  let ny = 0;
  const gx0 = Math.floor((x - r) / 150);
  const gy0 = Math.floor((y - r) / 150);
  for (let gx = gx0; gx <= Math.floor((x + r) / 150); gx += 1) {
    for (let gy = gy0; gy <= Math.floor((y + r) / 150); gy += 1) {
      const list = city.grid.get(gx * 1000 + gy);
      if (!list) continue;
      for (const b of list) {
        const cx = Math.max(b.x0, Math.min(x, b.x1));
        const cy = Math.max(b.y0, Math.min(y, b.y1));
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          y = cy + (dy / d) * r;
          nx += dx / d;
          ny += dy / d;
        } else {
          const left = x - b.x0;
          const right = b.x1 - x;
          const top = y - b.y0;
          const bottom = b.y1 - y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) { x = b.x0 - r; nx -= 1; } else if (m === right) { x = b.x1 + r; nx += 1; } else if (m === top) { y = b.y0 - r; ny -= 1; } else { y = b.y1 + r; ny += 1; }
        }
      }
    }
  }
  if (!onLand(city, x, y, r)) {
    let best = null;
    let bestD = Infinity;
    for (const l of city.land) {
      const cx = Math.max(l.x0 + r, Math.min(x, l.x1 - r));
      const cy = Math.max(l.y0 + r, Math.min(y, l.y1 - r));
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = [cx, cy];
      }
    }
    const d = Math.sqrt(bestD) || 1;
    nx += (best[0] - x) / d;
    ny += (best[1] - y) / d;
    x = best[0];
    y = best[1];
  }
  const len = Math.hypot(nx, ny);
  return { x, y, nx: len ? nx / len : 0, ny: len ? ny / len : 0, hit: len > 0 };
}

export function isLand(city, x, y) {
  return onLand(city, x, y, 0);
}

function paintRoads(g) {
  const a = LINES[0] - ROAD_HALF;
  const b = LINES[4] + ROAD_HALF;
  g.fillStyle = '#2a2d32';
  for (const l of LINES) {
    g.fillRect(l - ROAD_HALF, a, ROAD_HALF * 2, b - a);
    g.fillRect(a, l - ROAD_HALF, b - a, ROAD_HALF * 2);
  }
  g.fillRect(1050 - 30, 0, 60, a);
  g.strokeStyle = '#c9b46a';
  g.lineWidth = 2;
  g.setLineDash([18, 16]);
  for (const l of LINES) {
    const ring = l === LINES[0] || l === LINES[4];
    for (let k = 0; k < 4; k += 1) {
      const s = LINES[k] + ROAD_HALF + 6;
      const e = LINES[k + 1] - ROAD_HALF - 6;
      for (const off of ring ? [-2, 2] : [0]) {
        g.beginPath();
        g.moveTo(l + off, s);
        g.lineTo(l + off, e);
        g.moveTo(s, l + off);
        g.lineTo(e, l + off);
        g.stroke();
      }
    }
  }
  g.setLineDash([]);
  g.fillStyle = '#d6d2c4';
  for (const x of LINES) {
    for (const y of LINES) {
      for (let k = -4; k <= 4; k += 1) {
        g.fillRect(x + k * 8 - 2, y - ROAD_HALF - 10, 4, 8);
        g.fillRect(x + k * 8 - 2, y + ROAD_HALF + 2, 4, 8);
        g.fillRect(x - ROAD_HALF - 10, y + k * 8 - 2, 8, 4);
        g.fillRect(x + ROAD_HALF + 2, y + k * 8 - 2, 8, 4);
      }
    }
  }
}

function paintBlocks(g, city, rng) {
  for (const bl of city.blocks) {
    g.fillStyle = '#8a8579';
    g.fillRect(bl.x0, bl.y0, bl.x1 - bl.x0, bl.y1 - bl.y0);
    g.fillStyle = '#a9a496';
    g.fillRect(bl.x0, bl.y0, bl.x1 - bl.x0, 2);
    g.fillRect(bl.x0, bl.y1 - 2, bl.x1 - bl.x0, 2);
    g.fillRect(bl.x0, bl.y0, 2, bl.y1 - bl.y0);
    g.fillRect(bl.x1 - 2, bl.y0, 2, bl.y1 - bl.y0);
    const ix = bl.x0 + SIDEWALK;
    const iy = bl.y0 + SIDEWALK;
    const iw = bl.x1 - bl.x0 - SIDEWALK * 2;
    const ih = bl.y1 - bl.y0 - SIDEWALK * 2;
    g.fillStyle = DISTRICTS[bl.district].ground;
    g.fillRect(ix, iy, iw, ih);
    if (bl.plaza) {
      for (let x = 0; x < iw; x += 24) for (let y = 0; y < ih; y += 24) {
        g.fillStyle = ((x + y) / 24) % 2 ? '#8e7b62' : '#7d6c56';
        g.fillRect(ix + x, iy + y, 24, 24);
      }
    }
    for (let k = 0; k < 260; k += 1) {
      g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
      g.fillRect(ix + rng() * iw, iy + rng() * ih, 2 + rng() * 4, 2 + rng() * 4);
    }
    if (bl.district === 'yard') {
      g.strokeStyle = 'rgba(230,210,120,0.35)';
      g.lineWidth = 2;
      for (let x = ix + 20; x < ix + iw - 20; x += 34) {
        g.beginPath();
        g.moveTo(x, iy + 200);
        g.lineTo(x, iy + 250);
        g.stroke();
      }
    }
  }
}

function paintShore(g, rng) {
  g.fillStyle = '#625e55';
  g.fillRect(0, 0, LAND, LAND);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let k = 0; k < 2400; k += 1) g.fillRect(rng() * LAND, rng() * LAND, 3, 3);
  g.strokeStyle = '#34312c';
  g.lineWidth = 8;
  g.strokeRect(4, 4, LAND - 8, LAND - 8);
  g.fillStyle = '#c9b46a';
  for (let s = 40; s < LAND; s += 120) {
    for (const [x, y] of [[s, 10], [s, LAND - 10], [10, s], [LAND - 10, s]]) g.fillRect(x - 3, y - 3, 6, 6);
  }
  // Rail line along the Quay's south shore.
  g.strokeStyle = '#3e3a35';
  g.lineWidth = 3;
  for (const y of [2088, 2098 - 18]) {
    g.beginPath();
    g.moveTo(120, y);
    g.lineTo(1000, y);
    g.stroke();
  }
}

function paintPlanks(g, x0, y0, x1, y1) {
  g.fillStyle = '#6e5135';
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = y0; y < y1; y += 9) g.fillRect(x0, y, x1 - x0, 1.5);
  g.fillStyle = '#3b2a1c';
  for (let y = y0 + 10; y < y1; y += 60) {
    g.fillRect(x0 - 5, y, 6, 6);
    g.fillRect(x1 - 1, y, 6, 6);
  }
}

function paintBoat(g, x, y, len, angle, hull) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(4, 6, len / 2, len / 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hull;
  g.beginPath();
  g.moveTo(-len / 2, -len / 7);
  g.lineTo(len / 3, -len / 7);
  g.lineTo(len / 2, 0);
  g.lineTo(len / 3, len / 7);
  g.lineTo(-len / 2, len / 7);
  g.closePath();
  g.fill();
  g.fillStyle = '#e8e2d2';
  g.fillRect(-len / 4, -len / 12, len / 3, len / 6);
  g.restore();
}

/** Paint the ground (water, shore, roads, blocks, piers) once; drawn each frame by copying the visible part. */
export function paintGround(city) {
  const rng = createRandom(77);
  const size = LAND + MARGIN * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const sea = g.createLinearGradient(0, 0, size, size);
  sea.addColorStop(0, '#0d2738');
  sea.addColorStop(1, '#102f45');
  g.fillStyle = sea;
  g.fillRect(0, 0, size, size);
  g.translate(MARGIN, MARGIN);
  g.fillStyle = '#1b4757';
  g.fillRect(-18, -18, LAND + 36, LAND + 36);
  paintShore(g, rng);
  paintPlanks(g, PIER.x0, PIER.y0, PIER.x1, 6);
  g.fillStyle = '#2a2d32';
  g.fillRect(PIER.x0 + 12, 0, PIER.x1 - PIER.x0 - 24, 6);
  paintPlanks(g, 250, LAND, 312, LAND + 150);
  paintPlanks(g, 720, LAND, 782, LAND + 150);
  paintBoat(g, 360, LAND + 110, 120, 0.1, '#7a3b2c');
  paintBoat(g, 860, LAND + 90, 150, -0.05, '#2f4e6a');
  paintBoat(g, 1240, -150, 90, 1.4, '#6a5a2f');
  paintBoat(g, LAND + 140, 640, 180, 1.57, '#43505a');
  paintBoat(g, -150, 1300, 110, -1.5, '#5a2f3e');
  paintRoads(g);
  paintBlocks(g, city, rng);
  return canvas;
}
