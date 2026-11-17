// The battlefield: a winding stone path from the spirit gate (top right) to the
// village gate (bottom left), eight stone build pads beside it, and the gate
// itself. Path math (nearest point, walk position) lives here so towers, enemies
// and rendering all agree on the same geometry.
export const PATH_POINTS = [
  [1252, 64], [1100, 88], [1010, 190], [830, 235], [765, 375],
  [565, 415], [505, 555], [305, 595], [185, 640],
];

export const PADS = [
  { x: 1150, y: 195 },
  { x: 920, y: 138 },
  { x: 1020, y: 335 },
  { x: 890, y: 345 },
  { x: 660, y: 288 },
  { x: 640, y: 482 },
  { x: 400, y: 438 },
  { x: 330, y: 622 },
];

export const GATE = { x: 150, y: 648, w: 84, h: 76 };

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { d: Math.hypot(px - cx, py - cy), x: cx, y: cy, t };
}

export function distanceToPath(x, y) {
  let best = Infinity;
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const a = PATH_POINTS[i];
    const b = PATH_POINTS[i + 1];
    const r = distToSeg(x, y, a[0], a[1], b[0], b[1]);
    if (r.d < best) best = r.d;
  }
  return best;
}

// Precompute cumulative segment lengths so enemies walk at constant speed.
const SEGMENTS = [];
{
  let total = 0;
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const a = PATH_POINTS[i];
    const b = PATH_POINTS[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    SEGMENTS.push({ a, b, len, start: total });
    total += len;
  }
  SEGMENTS.total = total;
}

export const PATH_LENGTH = SEGMENTS.total;

// Position (x, y, angle) at a distance along the path.
export function pointAt(dist) {
  const d = Math.max(0, Math.min(PATH_LENGTH, dist));
  for (const s of SEGMENTS) {
    if (d <= s.start + s.len || s === SEGMENTS[SEGMENTS.length - 1]) {
      const t = s.len === 0 ? 0 : Math.max(0, Math.min(1, (d - s.start) / s.len));
      const x = s.a[0] + (s.b[0] - s.a[0]) * t;
      const y = s.a[1] + (s.b[1] - s.a[1]) * t;
      const angle = Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]);
      return { x, y, angle };
    }
  }
  const last = PATH_POINTS[PATH_POINTS.length - 1];
  return { x: last[0], y: last[1], angle: 0 };
}
