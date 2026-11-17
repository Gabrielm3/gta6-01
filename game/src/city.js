// The island of Saltwake: a tile grid with water, coast, roads, sidewalks,
// lots and a wooden pier, split into four districts.

export const T = 64;
export const COLS = 60;
export const ROWS = 46;
export const WORLD_W = COLS * T;
export const WORLD_H = ROWS * T;

export const WATER = 0;
export const SAND = 1;
export const ROAD = 2;
export const WALK = 3;
export const LOT = 4;
export const BUILDING = 5;
export const PIER = 6;
export const GRASS = 7;

export const ROAD_ROWS = [9, 18, 27, 36];
export const ROAD_COLS = [7, 18, 29, 40, 51];
export const PIER_COL = 40;
export const PIER_END_ROW = 1;

export function makeRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DISTRICTS = {
  RIDGE: { name: 'RIDGE', color: '#7fd16b' },
  YARD: { name: 'YARD', color: '#ffb547' },
  QUAY: { name: 'QUAY', color: '#5fd4ff' },
  MARKET: { name: 'MARKET', color: '#ff7aa8' },
};

export function districtAt(x, y) {
  const c = x / T;
  const r = y / T;
  if (c < 29) return r < 22 ? DISTRICTS.RIDGE : DISTRICTS.YARD;
  return r < 22 ? DISTRICTS.QUAY : DISTRICTS.MARKET;
}

function isRoadRow(r) {
  return ROAD_ROWS.some((rr) => r === rr || r === rr + 1);
}

function isRoadCol(c) {
  return ROAD_COLS.some((cc) => c === cc || c === cc + 1);
}

function landAt(c, r, rng, edge) {
  const left = 4 + edge.left[r];
  const right = 55 - edge.right[r];
  const top = 6 + edge.top[c];
  const bottom = 40 - edge.bottom[c];
  return c >= left && c <= right && r >= top && r <= bottom;
}

function bumpyEdge(n, rng, amp) {
  const out = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    v += (rng() - 0.5) * 1.2;
    v = Math.max(0, Math.min(amp, v));
    out.push(Math.round(v));
  }
  return out;
}

export function buildCity(seed = 7) {
  const rng = makeRng(seed);
  const edge = {
    left: bumpyEdge(ROWS, rng, 2),
    right: bumpyEdge(ROWS, rng, 2),
    top: bumpyEdge(COLS, rng, 2),
    bottom: bumpyEdge(COLS, rng, 2),
  };
  const tiles = new Uint8Array(COLS * ROWS);
  const set = (c, r, v) => { tiles[r * COLS + c] = v; };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const land = landAt(c, r, rng, edge);
      const coast = !land && (landAt(c - 1, r, rng, edge) || landAt(c + 1, r, rng, edge) ||
        landAt(c, r - 1, rng, edge) || landAt(c, r + 1, rng, edge));
      set(c, r, land ? LOT : coast ? SAND : WATER);
    }
  }

  const roadTop = ROAD_ROWS[0];
  const roadBottom = ROAD_ROWS[ROAD_ROWS.length - 1] + 1;
  const roadLeft = ROAD_COLS[0];
  const roadRight = ROAD_COLS[ROAD_COLS.length - 1] + 1;
  for (let r = roadTop; r <= roadBottom; r++) {
    for (let c = roadLeft; c <= roadRight; c++) {
      if (isRoadRow(r) || isRoadCol(c)) set(c, r, ROAD);
    }
  }

  for (let r = roadTop - 1; r <= roadBottom + 1; r++) {
    for (let c = roadLeft - 1; c <= roadRight + 1; c++) {
      if (tiles[r * COLS + c] === ROAD) continue;
      let nearRoad = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < ROWS && cc < COLS && tiles[rr * COLS + cc] === ROAD) nearRoad = true;
        }
      }
      if (nearRoad) set(c, r, WALK);
    }
  }

  for (let r = 0; r < roadTop - 1; r++) {
    set(PIER_COL, r, r >= PIER_END_ROW ? PIER : WATER);
    set(PIER_COL + 1, r, r >= PIER_END_ROW ? PIER : WATER);
  }
  for (let r = PIER_END_ROW; r < PIER_END_ROW + 3; r++) {
    set(PIER_COL - 1, r, PIER);
    set(PIER_COL + 2, r, PIER);
  }
  for (let r = PIER_END_ROW + 3; r < roadTop - 1; r++) {
    if (tiles[r * COLS + PIER_COL] === PIER) {
      const base = r * COLS;
      if (tiles[base + PIER_COL - 1] === LOT) set(PIER_COL - 1, r, WALK);
      if (tiles[base + PIER_COL + 2] === LOT) set(PIER_COL + 2, r, WALK);
    }
  }

  const buildings = [];
  const props = [];
  const blocks = [];
  const rowsB = [6, ...ROAD_ROWS.map((v) => v + 2)];
  const rowsE = [...ROAD_ROWS.map((v) => v - 1), 41];
  const colsB = [3, ...ROAD_COLS.map((v) => v + 2)];
  const colsE = [...ROAD_COLS.map((v) => v - 1), 57];
  for (let bi = 0; bi < rowsB.length; bi++) {
    for (let bj = 0; bj < colsB.length; bj++) {
      blocks.push({ r0: rowsB[bi], r1: rowsE[bi], c0: colsB[bj], c1: colsE[bj] });
    }
  }

  for (const b of blocks) {
    const inner = [];
    for (let r = b.r0; r <= b.r1; r++) {
      for (let c = b.c0; c <= b.c1; c++) {
        if (tiles[r * COLS + c] === LOT) inner.push([c, r]);
      }
    }
    if (inner.length < 2) continue;
    const cx = (b.c0 + b.c1 + 1) / 2 * T;
    const cy = (b.r0 + b.r1 + 1) / 2 * T;
    const d = districtAt(cx, cy);
    for (const [c, r] of inner) {
      if (d === DISTRICTS.RIDGE) set(c, r, GRASS);
    }
    const box = {
      c0: Math.min(...inner.map((p) => p[0])), c1: Math.max(...inner.map((p) => p[0])),
      r0: Math.min(...inner.map((p) => p[1])), r1: Math.max(...inner.map((p) => p[1])),
    };
    const before = buildings.length;
    placeBuildings(box, d, tiles, buildings, props, rng);
    for (const bd of buildings.slice(before)) {
      for (let r = bd.r0; r <= bd.r1; r++) {
        for (let c = bd.c0; c <= bd.c1; c++) set(c, r, BUILDING);
      }
    }
    if (d === DISTRICTS.RIDGE) {
      for (let i = 0; i < inner.length / 4; i++) {
        const [c, r] = inner[Math.floor(rng() * inner.length)];
        if (tiles[r * COLS + c] === GRASS) props.push({ kind: 'tree', x: c * T + T / 2, y: r * T + T / 2, s: 18 + rng() * 10 });
      }
    }
  }

  for (const bd of buildings) {
    for (let r = bd.r0; r <= bd.r1; r++) {
      for (let c = bd.c0; c <= bd.c1; c++) set(c, r, BUILDING);
    }
  }

  const lights = [];
  for (const rr of ROAD_ROWS) {
    for (let c = ROAD_COLS[0]; c <= roadRight; c += 4) {
      lights.push({ x: c * T + T / 2, y: (rr - 1) * T + T * 0.7 });
      lights.push({ x: c * T + T * 1.5, y: (rr + 2) * T + T * 0.3 });
    }
  }

  const city = { tiles, buildings, props, lights, seed };
  city.yardVan = { x: (ROAD_COLS[1] - 2) * T + T / 2, y: (ROAD_ROWS[2] + 3) * T + T / 2 };
  city.market = { x: (ROAD_COLS[3] + 1) * T, y: (ROAD_ROWS[2] + 1) * T };
  city.pierEnd = { x: (PIER_COL + 1) * T, y: (PIER_END_ROW + 1.5) * T };
  city.spawn = { x: (ROAD_COLS[1] + 2.5) * T, y: (ROAD_ROWS[2] + 2.5) * T };
  clearLot(city, city.yardVan.x, city.yardVan.y);
  return city;
}

function clearLot(city, x, y) {
  const c0 = Math.floor(x / T) - 1;
  const r0 = Math.floor(y / T) - 1;
  for (let r = r0; r <= r0 + 2; r++) {
    for (let c = c0; c <= c0 + 2; c++) {
      if (city.tiles[r * COLS + c] === BUILDING) city.tiles[r * COLS + c] = LOT;
    }
  }
  city.buildings = city.buildings.filter((b) => !(b.c1 >= c0 && b.c0 <= c0 + 2 && b.r1 >= r0 && b.r0 <= r0 + 2));
  city.props = city.props.filter((p) => Math.hypot(p.x - x, p.y - y) > T * 1.6);
}

const RIDGE_ROOFS = ['#d9694a', '#c9553f', '#e08a4f', '#b8644d', '#d47a62'];
const QUAY_ROOFS = ['#5b7c99', '#6f8aa3', '#4f6d86', '#7d95a8'];
const MARKET_ROOFS = ['#e0b04a', '#d98c5f', '#c7a65e', '#e5c07a'];
const CONTAINERS = ['#e0533d', '#2f8fd8', '#f0b43c', '#3fb27f', '#9c5bd1', '#e87a2a'];

function placeBuildings(b, d, tiles, buildings, props, rng) {
  const w = b.c1 - b.c0 + 1;
  const h = b.r1 - b.r0 + 1;
  const ok = (c, r) => tiles[r * COLS + c] === LOT || tiles[r * COLS + c] === GRASS;
  const fits = (c0, r0, c1, r1) => {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (!ok(c, r)) return false;
    return true;
  };
  if (d === DISTRICTS.YARD) {
    for (let r = b.r0; r <= b.r1; r += 2) {
      for (let c = b.c0; c + 1 <= b.c1; c += 3) {
        if (rng() < 0.3 || !fits(c, r, c + 1, r)) continue;
        props.push({ kind: 'container', x: (c + 1) * T, y: r * T + T / 2,
          w: T * 1.8, h: T * 0.8, color: CONTAINERS[Math.floor(rng() * CONTAINERS.length)] });
        tiles[r * COLS + c] = BUILDING;
        tiles[r * COLS + c + 1] = BUILDING;
      }
    }
    return;
  }
  if (d === DISTRICTS.RIDGE) {
    for (let r = b.r0; r + 1 <= b.r1; r += 3) {
      for (let c = b.c0; c + 1 <= b.c1; c += 3) {
        if (!fits(c, r, c + 1, r + 1)) continue;
        buildings.push({ c0: c, r0: r, c1: c + 1, r1: r + 1, roof: RIDGE_ROOFS[Math.floor(rng() * RIDGE_ROOFS.length)], style: 'house' });
      }
    }
    return;
  }
  if (d === DISTRICTS.QUAY) {
    for (let r = b.r0; r + 1 <= b.r1; r += 3) {
      for (let c = b.c0; c + 2 <= b.c1; c += 4) {
        const c1 = Math.min(c + 3, b.c1);
        if (!fits(c, r, c1, r + 1)) continue;
        buildings.push({ c0: c, r0: r, c1, r1: r + 1, roof: QUAY_ROOFS[Math.floor(rng() * QUAY_ROOFS.length)], style: 'warehouse' });
      }
    }
    return;
  }
  for (let r = b.r0; r + 1 <= b.r1; r += 4) {
    for (let c = b.c0; c + 2 <= b.c1; c += 4) {
      if (!fits(c, r, c + 2, r + 1)) continue;
      buildings.push({ c0: c, r0: r, c1: c + 2, r1: r + 1, roof: MARKET_ROOFS[Math.floor(rng() * MARKET_ROOFS.length)], style: 'shop' });
    }
  }
  for (let r = b.r0; r <= b.r1; r++) {
    for (let c = b.c0; c <= b.c1; c++) {
      const covered = buildings.some((bd) => c >= bd.c0 && c <= bd.c1 && r >= bd.r0 && r <= bd.r1);
      if (!covered && tiles[r * COLS + c] === LOT && rng() < 0.35) {
        props.push({ kind: 'stall', x: c * T + T / 2, y: r * T + T / 2, color: CONTAINERS[Math.floor(rng() * CONTAINERS.length)] });
      }
    }
  }
}

export function tileAt(city, x, y) {
  const c = Math.floor(x / T);
  const r = Math.floor(y / T);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return WATER;
  return city.tiles[r * COLS + c];
}

export function blocksCar(tile) {
  return tile === BUILDING || tile === WATER;
}

export function blocksFoot(tile) {
  return tile === BUILDING || tile === WATER;
}

export function isWalkable(tile) {
  return tile === WALK || tile === PIER;
}

export function nodeList() {
  const nodes = [];
  for (let i = 0; i < ROAD_ROWS.length; i++) {
    for (let j = 0; j < ROAD_COLS.length; j++) {
      nodes.push({ i, j, x: (ROAD_COLS[j] + 1) * T, y: (ROAD_ROWS[i] + 1) * T });
    }
  }
  for (const n of nodes) {
    n.links = [];
    for (const m of nodes) {
      if (Math.abs(m.i - n.i) + Math.abs(m.j - n.j) === 1) n.links.push(m);
    }
  }
  return nodes;
}

export function nearestNode(nodes, x, y) {
  let best = nodes[0];
  let bd = Infinity;
  for (const n of nodes) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
