import { drawnFeature, drawingPoints, previewAreaM2 } from './custom-area-geometry.js';

const SVG = 'http://www.w3.org/2000/svg';
const stop = e => { e.preventDefault(); e.stopPropagation(); };
const pointArray = p => Array.isArray(p) ? p : [p.lng, p.lat];
const screenArray = p => Array.isArray(p) ? p : [p.x, p.y];
const uid = () => 'CUSTOM-' + crypto.randomUUID();
const CSS = `
.custom-area-layer{position:absolute;inset:0;z-index:12;pointer-events:none}
.custom-area-surface{position:absolute;inset:0;width:100%;height:100%;pointer-events:auto;touch-action:none;cursor:crosshair;outline:none}
.custom-area-toolbar{position:absolute;top:110px;right:24px;max-width:calc(100% - 48px);display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px;border:1px solid rgba(63,88,82,.2);border-radius:15px;background:rgba(255,255,255,.96);box-shadow:0 10px 38px #173c3020;color:#173f35;font:14px/1.45 -apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;pointer-events:auto}
.custom-area-toolbar input{width:150px;max-width:100%;padding:8px 9px;border:1px solid #cdd8d3;border-radius:8px;background:#fff;color:#173f35;font:inherit}
.custom-area-toolbar button{padding:8px 10px;border:1px solid #ccd8d3;border-radius:8px;background:#fff;color:#173f35;font:inherit;cursor:pointer}
.custom-area-toolbar button[data-draw=finish]{background:#173f35;border-color:#173f35;color:white}
.custom-area-toolbar button:disabled{opacity:.45;cursor:default}
.custom-area-toolbar input:focus-visible,.custom-area-toolbar button:focus-visible,.custom-area-surface:focus-visible{outline:2px solid #438b72;outline-offset:2px}
.custom-area-status{flex-basis:100%;min-height:18px;color:#5e7068}
.custom-area-status[data-error=true]{color:#a3352b}
@media(max-width:720px){.custom-area-toolbar{top:134px;left:12px;right:12px;max-width:none;gap:6px;padding:10px}.custom-area-toolbar input{width:125px}.custom-area-toolbar button{padding:8px}.custom-area-toolbar strong{flex-basis:100%}}
`;

/**
 * Renderer-independent polygon / two-corner rectangle editor.
 * onComplete receives a WGS84 Feature and may persist it asynchronously. A
 * rejected save leaves the draft in place. The caller owns project permissions.
 */
export class CustomAreaController {
  constructor({ map, boundary, onComplete, onActive = () => {}, toast = () => {} }) {
    this.map = map; this.boundary = boundary; this.onComplete = onComplete;
    this.onActive = onActive; this.toast = toast; this.active = false;
    this.renderBound = () => this.render();
    this.keyBound = e => this.key(e);
    this.generation = 0;
  }

  start(mode = 'polygon', { name = '自定义片区', id = uid() } = {}) {
    if (!['polygon', 'rectangle'].includes(mode)) throw Error('绘制方式无效');
    this.cancel();
    this.active = true; this.mode = mode; this.id = id; this.points = []; this.cursor = null; this.saving = false;
    this.previousFocus = document.activeElement;
    this.map.stop?.();
    if (!document.getElementById('custom-area-styles')) {
      const style = document.createElement('style'); style.id = 'custom-area-styles'; style.textContent = CSS; document.head.append(style);
    }
    const layer = document.createElement('section'); layer.className = 'custom-area-layer'; layer.setAttribute('aria-label', '自定义片区绘制');
    const surface = document.createElementNS(SVG, 'svg'); surface.classList.add('custom-area-surface'); surface.setAttribute('tabindex', '0'); surface.setAttribute('role', 'application'); surface.setAttribute('aria-label', mode === 'rectangle' ? '依次点击两个对角点绘制矩形。Enter 完成，Escape 取消。' : '依次点击片区边界点。Enter 完成，Backspace 撤销，Escape 取消。');
    const toolbar = document.createElement('div'); toolbar.className = 'custom-area-toolbar';
    toolbar.innerHTML = `<strong>${mode === 'rectangle' ? '矩形框选' : '绘制片区'}</strong><input aria-label="片区名称" maxlength="100"><button type="button" data-draw="undo">撤销</button><button type="button" data-draw="finish">加入片区</button><button type="button" data-draw="cancel">取消</button><span class="custom-area-status" role="status" aria-live="polite"></span>`;
    this.nameInput = toolbar.querySelector('input'); this.nameInput.value = name;
    this.status = toolbar.querySelector('.custom-area-status');
    this.layer = layer; this.surface = surface; this.toolbar = toolbar;
    layer.append(surface, toolbar); this.map.getContainer().append(layer);
    // The overlay receives the gestures itself, rather than allowing renderer
    // listeners to select a building, pan the map, or trigger a long press.
    for (const type of ['mousedown', 'mousemove', 'mouseup', 'click', 'touchstart', 'touchmove', 'touchend', 'contextmenu']) surface.addEventListener(type, stop, { passive: false });
    surface.addEventListener('pointerdown', e => this.down(e));
    surface.addEventListener('pointermove', e => this.move(e));
    surface.addEventListener('pointerup', e => this.up(e));
    surface.addEventListener('pointercancel', e => { stop(e); this.press = null; });
    surface.addEventListener('lostpointercapture', () => { this.press = null; });
    surface.addEventListener('pointerleave', () => { if (!this.press) { this.cursor = null; this.render(); } });
    surface.addEventListener('dblclick', e => { stop(e); this.finish(); });
    surface.addEventListener('wheel', e => this.wheel(e), { passive: false });
    toolbar.addEventListener('click', e => { e.stopPropagation(); const action = e.target.closest('[data-draw]')?.dataset.draw; if (action === 'undo') this.undo(); else if (action === 'finish') this.finish(); else if (action === 'cancel') this.cancel(); });
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove', 'mouseup', 'dblclick', 'touchstart', 'touchmove', 'touchend', 'wheel']) toolbar.addEventListener(type, e => e.stopPropagation(), { passive: true });
    this.map.on('move', this.renderBound); this.map.on('resize', this.renderBound);
    this.resizeObserver = new ResizeObserver(this.renderBound); this.resizeObserver.observe(this.map.getContainer());
    document.addEventListener('keydown', this.keyBound, true);
    this.onActive(true); this.render(); surface.focus();
    return this;
  }

  screen(e) { const r = this.map.getContainer().getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  coord(e) { return pointArray(this.map.unproject(this.screen(e))).map(n => Math.round(n * 1e7) / 1e7); }
  down(e) {
    stop(e); if (this.saving || e.button !== 0 && e.pointerType !== 'touch' || this.press) return;
    this.press = { id: e.pointerId, at: this.screen(e), moved: false };
    this.surface.setPointerCapture?.(e.pointerId);
  }
  move(e) {
    stop(e); if (this.saving) return;
    this.cursor = this.coord(e);
    if (this.press?.id === e.pointerId && Math.hypot(...this.screen(e).map((n, i) => n - this.press.at[i])) > 8) this.press.moved = true;
    this.render();
  }
  up(e) {
    stop(e);
    const press = this.press; this.press = null;
    if (this.surface.hasPointerCapture?.(e.pointerId)) this.surface.releasePointerCapture(e.pointerId);
    if (!press || press.id !== e.pointerId || press.moved || this.saving) return;
    const point = this.coord(e), pixel = this.screen(e);
    const near = p => Math.hypot(...screenArray(this.map.project(p)).map((n, i) => n - pixel[i])) < 8;
    if (this.mode === 'polygon' && this.points.length >= 3 && near(this.points[0])) return void this.finish();
    if (this.points.length && near(this.points.at(-1))) return;
    if (this.points.length >= (this.mode === 'rectangle' ? 2 : 300)) return;
    this.points.push(point); this.cursor = null; this.render();
  }
  wheel(e) {
    stop(e); if (this.saving || !Number.isFinite(e.deltaY)) return;
    const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.map.getContainer().clientHeight : 1;
    const zoom = Math.max(this.map.getMinZoom?.() ?? 10.5, Math.min(this.map.getMaxZoom?.() ?? 19, this.map.getZoom() - e.deltaY * factor * .006));
    this.map.easeTo({ zoom, duration: 0 }); this.cursor = null; this.render();
  }
  key(e) {
    if (!this.active || this.saving) return;
    if (e.key === 'Escape') { stop(e); this.cancel(); return; }
    if (e.target.closest?.('input,textarea,button,a,select,[contenteditable=true]')) return;
    if (e.key === 'Enter') { stop(e); this.finish(); }
    else if (e.key === 'Backspace' || e.key === 'Delete' || (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { stop(e); this.undo(); }
  }
  undo() { if (!this.active || this.saving) return; this.points.pop(); this.cursor = null; this.render(); this.surface.focus(); }

  render() {
    if (!this.active) return;
    const { clientWidth: width, clientHeight: height } = this.map.getContainer();
    this.surface.setAttribute('viewBox', `0 0 ${width || 1} ${height || 1}`);
    let displayed = this.points;
    if (this.mode === 'rectangle' && this.points.length) displayed = this.points.length === 2 ? drawingPoints(this.points, 'rectangle') : this.cursor ? drawingPoints([this.points[0], this.cursor], 'rectangle') : this.points;
    else if (this.cursor && this.points.length) displayed = [...this.points, this.cursor];
    const project = p => screenArray(this.map.project(p)).map(n => Math.round(n * 10) / 10);
    const pixels = displayed.map(project).filter(p => p.every(Number.isFinite));
    const path = pixels.length > 1 ? `<${pixels.length > 2 ? 'polygon' : 'polyline'} points="${pixels.map(p => p.join(',')).join(' ')}" fill="${pixels.length > 2 ? 'rgba(38,146,118,.2)' : 'none'}" stroke="#14785e" stroke-width="2.5" stroke-linejoin="round"/>` : '';
    this.surface.innerHTML = path + this.points.map((p, i) => { const [x, y] = project(p); return Number.isFinite(x) && Number.isFinite(y) ? `<circle cx="${x}" cy="${y}" r="${i ? 4 : 6}" fill="white" stroke="#14785e" stroke-width="2"/>` : ''; }).join('');
    const complete = this.mode === 'rectangle' ? this.points.length === 2 : this.points.length >= 3;
    this.toolbar.querySelector('[data-draw=finish]').disabled = this.saving || !complete;
    this.toolbar.querySelector('[data-draw=undo]').disabled = this.saving || !this.points.length;
    this.toolbar.querySelector('[data-draw=cancel]').disabled = this.saving;
    this.nameInput.disabled = this.saving;
    const area = previewAreaM2(displayed), areaText = area > 0 ? ` · ${(area / 10000).toFixed(2)} ha（预览）` : '';
    this.status.dataset.error = 'false';
    this.status.textContent = this.saving ? '正在加入并计算…' : this.mode === 'rectangle' ? `${this.points.length}/2 个角点${areaText} · Enter 完成` : `${this.points.length} 个点${areaText} · 双击或 Enter 完成`;
  }

  async finish() {
    if (!this.active || this.saving) return;
    const generation = this.generation;
    try {
      const feature = drawnFeature(this.points, { mode: this.mode, boundary: this.boundary, id: this.id, name: this.nameInput.value });
      this.saving = true; this.render();
      await this.onComplete(feature);
      if (this.generation === generation) this.cancel();
    } catch (error) {
      if (this.generation !== generation || !this.active) return;
      this.saving = false; this.render(); this.status.textContent = error.message; this.status.dataset.error = 'true'; this.toast(error.message);
    }
  }

  cancel() {
    this.generation++;
    if (!this.active) return;
    this.active = false; this.saving = false; this.press = null;
    this.map.off('move', this.renderBound); this.map.off('resize', this.renderBound);
    document.removeEventListener('keydown', this.keyBound, true); this.resizeObserver?.disconnect();
    this.layer.remove(); this.layer = this.surface = this.toolbar = null;
    this.onActive(false);
    if (this.previousFocus?.isConnected) this.previousFocus.focus?.();
  }
  destroy() { this.cancel(); }
}

export const installCustomArea = options => new CustomAreaController(options);
