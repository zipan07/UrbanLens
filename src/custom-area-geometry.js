// Pure WGS84 drawing validation. Shared by the editor and server import gate.
const EPS = 1e-12;
const samePoint = (a, b) => Math.abs(a[0] - b[0]) <= EPS && Math.abs(a[1] - b[1]) <= EPS;
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const onSegment = (p, a, b) => Math.abs(cross(a, b, p)) <= EPS && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;

export function segmentsIntersect(a, b, c, d) {
  const x = cross(a, b, c), y = cross(a, b, d), z = cross(c, d, a), w = cross(c, d, b);
  return ((x > EPS && y < -EPS || x < -EPS && y > EPS) && (z > EPS && w < -EPS || z < -EPS && w > EPS)) || onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d);
}

export function ringSelfIntersects(ring) {
  const points = samePoint(ring[0], ring.at(-1)) ? ring.slice(0, -1) : ring;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], c = points[(i + 2) % points.length];
    if (samePoint(a, b)) return true;
    // Adjacent edges can share their endpoint, but cannot reverse over each other.
    if (Math.abs(cross(a, b, c)) <= EPS && (a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1]) > EPS) return true;
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || i === 0 && j === points.length - 1) continue;
      if (segmentsIntersect(a, b, points[j], points[(j + 1) % points.length])) return true;
    }
  }
  return false;
}

const polygons = g => g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
function inRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (onSegment(p, a, b)) return true;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const inside = (p, g) => polygons(g).some(poly => inRing(p, poly[0]) && !poly.slice(1).some(hole => inRing(p, hole)));

// Unlike a vertex-only test, this accepts a rectangle surrounding the district
// and crossing polygons whose vertices all happen to sit outside one another.
export function geometriesOverlap(a, b) {
  const pa = polygons(a), pb = polygons(b);
  if (!pa.length || !pb.length) return false;
  if (pa.some(poly => poly[0].some(p => inside(p, b))) || pb.some(poly => poly[0].some(p => inside(p, a)))) return true;
  for (const ra of pa.flat()) for (const rb of pb.flat()) {
    for (let i = 1; i < ra.length; i++) for (let j = 1; j < rb.length; j++) if (segmentsIntersect(ra[i - 1], ra[i], rb[j - 1], rb[j])) return true;
  }
  return false;
}

// Small-area, locally projected preview only. Assessment still uses EPSG:32650.
export function previewAreaM2(points) {
  if (points.length < 3) return 0;
  const origin = points[0], lat = points.reduce((n, p) => n + p[1], 0) / points.length, scale = Math.PI / 180 * 6371008.8;
  const local = points.map(p => [(p[0] - origin[0]) * scale * Math.cos(lat * Math.PI / 180), (p[1] - origin[1]) * scale]);
  return Math.abs(local.reduce((sum, p, i) => { const q = local[(i + 1) % local.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
}

export function drawingPoints(points, mode = 'polygon') {
  if (mode === 'rectangle') {
    if (points.length !== 2) throw Error('请点击矩形的两个对角点');
    const [a, b] = points;
    return [[Math.min(a[0], b[0]), Math.min(a[1], b[1])], [Math.max(a[0], b[0]), Math.min(a[1], b[1])], [Math.max(a[0], b[0]), Math.max(a[1], b[1])], [Math.min(a[0], b[0]), Math.max(a[1], b[1])]];
  }
  if (mode !== 'polygon') throw Error('绘制方式无效');
  return points.length > 1 && samePoint(points[0], points.at(-1)) ? points.slice(0, -1) : points;
}

export function validateDrawnGeometry(points, { mode = 'polygon', boundary } = {}) {
  if (!Array.isArray(points) || points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) throw Error('绘制坐标无效，请重新选点');
  const open = drawingPoints(points, mode);
  if (open.length < 3) throw Error('至少点击三个边界点');
  if (open.length > 300) throw Error('最多绘制 300 个边界点');
  if (open.some(p => p[0] < 118.65 || p[0] > 119.02 || p[1] < 31.9 || p[1] > 32.2)) throw Error('请在南京玄武区附近绘制');
  if (ringSelfIntersects(open)) throw Error('边界有交叉或重叠，请撤销后调整');
  if (!(previewAreaM2(open) > 0)) throw Error('范围面积为零，请重新选点');
  const geometry = { type: 'Polygon', coordinates: [[...open.map(p => [...p]), [...open[0]]]] };
  if (boundary && !geometriesOverlap(geometry, boundary)) throw Error('绘制范围须与玄武区相交');
  return geometry;
}

export function drawnFeature(points, { mode = 'polygon', boundary, id, name, date = new Date().toISOString().slice(0, 10) } = {}) {
  const geometry = validateDrawnGeometry(points, { mode, boundary });
  if (typeof id !== 'string' || !id.trim() || id.length > 100 || ['__proto__', 'constructor', 'prototype'].includes(id)) throw Error('片区编号无效');
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw Error('请填写片区名称（最多 100 字）');
  return { type: 'Feature', id, geometry, properties: { parcel_id: id, unit_id: id, name: name.trim(), category: 'imported', imported: true, research_type: '自定义研究范围', boundary_source: '用户绘制，待核实', source_date: date, draw_method: mode } };
}
