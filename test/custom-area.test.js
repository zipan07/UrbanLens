import test from 'node:test';
import assert from 'node:assert/strict';
import { geometriesOverlap, ringSelfIntersects, previewAreaM2, validateDrawnGeometry, drawnFeature } from '../src/custom-area-geometry.js';
const polygon = points => ({ type: 'Polygon', coordinates: [[...points, points[0]]] });
const rectangle = (a, b) => polygon([a, [b[0], a[1]], b, [a[0], b[1]]]);
const boundary = rectangle([118.78, 32.04], [118.82, 32.08]);

test('valid drawn polygon closes its ring without modifying clicked points', () => {
  const points = [[118.79, 32.05], [118.80, 32.05], [118.80, 32.06], [118.79, 32.06]];
  const before = structuredClone(points), g = validateDrawnGeometry(points, { boundary });
  assert.equal(g.coordinates[0].length, 5); assert.deepEqual(g.coordinates[0][0], g.coordinates[0].at(-1));
  assert.deepEqual(points, before); assert.ok(previewAreaM2(points) > 1000000);
});
test('rectangle can surround the district although all its corners are outside', () => {
  const g = validateDrawnGeometry([[118.77, 32.03], [118.83, 32.09]], { mode: 'rectangle', boundary });
  assert.equal(g.type, 'Polygon'); assert.equal(g.coordinates[0].length, 5);
});
test('overlap detects crossing boundaries without contained vertices', () => {
  const horizontal = rectangle([0, 1], [4, 2]), vertical = rectangle([1, 0], [2, 4]);
  assert.ok(geometriesOverlap(horizontal, vertical));
  assert.ok(geometriesOverlap(vertical, horizontal));
});
test('district hole excludes a drawing entirely inside the hole', () => {
  const donut = rectangle([0, 0], [5, 5]); donut.coordinates.push(rectangle([1, 1], [4, 4]).coordinates[0]);
  assert.equal(geometriesOverlap(donut, rectangle([2, 2], [3, 3])), false);
});
test('drawings outside the district are rejected', () => {
  assert.throws(() => validateDrawnGeometry([[118.90, 32.04], [118.91, 32.05]], { mode: 'rectangle', boundary }), /已覆盖研究区/);
});
test('crossings, shared nonadjacent endpoints and backtracking are rejected', () => {
  assert.ok(ringSelfIntersects([[0, 0], [2, 2], [0, 2], [2, 0]]));
  assert.ok(ringSelfIntersects([[0, 0], [2, 0], [1, 1], [2, 2], [0, 2], [1, 1]]));
  assert.ok(ringSelfIntersects([[0, 0], [2, 0], [1, 0], [1, 2], [0, 2]]));
  assert.throws(() => validateDrawnGeometry([[118.79, 32.05], [118.80, 32.06], [118.79, 32.06], [118.80, 32.05]], { boundary }), /交叉|重叠/);
});
test('zero area, insufficient points, invalid coordinates and excessive points are rejected', () => {
  assert.throws(() => validateDrawnGeometry([[118.79, 32.05], [118.80, 32.05]], { mode: 'rectangle', boundary }), /交叉|重叠|面积/);
  assert.throws(() => validateDrawnGeometry([[118.79, 32.05]], { boundary }), /至少/);
  assert.throws(() => validateDrawnGeometry([[NaN, 32.05], [118.80, 32.06], [118.79, 32.06]], { boundary }), /坐标/);
  assert.throws(() => validateDrawnGeometry(Array.from({ length: 301 }, (_, i) => [118.8 + .01 * Math.cos(i / 301 * Math.PI * 2), 32.06 + .01 * Math.sin(i / 301 * Math.PI * 2)]), { boundary }), /300/);
});
test('drawn feature has editable name and explicit unverified boundary provenance', () => {
  const f = drawnFeature([[118.79, 32.05], [118.80, 32.06]], { mode: 'rectangle', boundary, id: 'CUSTOM-test', name: '  自定义街区 A  ', date: '2026-09-13' });
  assert.equal(f.properties.name, '自定义街区 A'); assert.equal(f.id, 'CUSTOM-test');
  assert.equal(f.properties.boundary_source, '用户绘制，待核实'); assert.equal(f.properties.source_date, '2026-09-13');
  assert.throws(() => drawnFeature([[118.79, 32.05], [118.80, 32.06]], { mode: 'rectangle', boundary, id: 'constructor', name: '街区' }), /编号/);
});
