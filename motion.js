/* Small, optional motion layer. App state, focus, forms and scroll stay owned by the app. */
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarse = window.matchMedia('(pointer: coarse)');
const compactMotion = () => coarse.matches || (navigator.deviceMemory || 8) <= 4;
const easeOut = 'cubic-bezier(.2,.8,.2,1)';
const surfaces = new Map();
const groups = new Map();
const activeAnimations = new Map();
const pendingContent = new Set();
const pendingGroups = new Map();
let frame = 0;
let lastIntent = -Infinity;
let destroyed = false;

const surfaceSelectors = {
  '#layers-popover': 'menu', '#search-results': 'menu', '#map-details': 'popup',
  '#inspector': 'inspector', '#panel-value': 'panel', '#panel-overview': 'panel',
  '#panel-object': 'panel', '#panel-data': 'panel', '#value-list': 'panel',
  '#value-detail': 'panel', '#value-chat': 'panel', '#value-tour': 'menu',
  '#study-hud': 'menu', '#measurement': 'menu', '#presentation-bar': 'menu',
  '#toast': 'toast', 'dialog': 'dialog'
};
const contentIds = new Set(['map-details', 'panel-object', 'value-detail', 'value-dialog-content', 'value-source-content']);
const tabSelector = '.segmented, .value-tabs, .inspector-tabs, .theme-options';

function visible(element) {
  return element.isConnected && !element.closest('[hidden]') &&
    !(element.tagName === 'DIALOG' && !element.open) &&
    element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
}

function cancelMotion(element) {
  const animation = activeAnimations.get(element);
  activeAnimations.delete(element);
  animation?.cancel();
}

function reveal(element, kind) {
  // The sidebar's own CSS controls its slide, including interrupted open/close actions.
  if (kind === 'inspector' || reduced.matches || document.hidden || !element.animate || !visible(element)) return;
  // A new action replaces the previous transition immediately, using its current appearance.
  const running = activeAnimations.get(element);
  const current = running ? getComputedStyle(element) : null;
  const from = current ? {opacity: current.opacity, translate: current.translate, scale: current.scale} : null;
  cancelMotion(element);
  const lite = compactMotion();
  const duration = lite ? 180 : kind === 'dialog' ? 280 : kind === 'content' ? 180 : 220;
  const distance = lite ? 3 : kind === 'panel' ? 6 : 8;
  const start = from || {
    opacity: kind === 'content' ? .76 : .25,
    translate: `0 ${distance}px`,
    scale: !lite && (kind === 'popup' || kind === 'dialog') ? '.975' : '1'
  };
  // Individual transforms preserve an element's existing transform and popup anchor origin.
  const animation = element.animate([start, {opacity: 1, translate: '0 0', scale: '1'}], {
    duration, easing: easeOut, fill: 'none'
  });
  activeAnimations.set(element, animation);
  const finish = () => { if (activeAnimations.get(element) === animation) activeAnimations.delete(element); };
  animation.onfinish = finish;
  animation.oncancel = finish;
}

function schedule() {
  if (!frame && !destroyed) frame = requestAnimationFrame(flush);
}

function flush() {
  frame = 0;
  const entering = new Map();
  for (const [element, state] of surfaces) {
    if (!element.isConnected) { cancelMotion(element); surfaces.delete(element); continue; }
    const next = visible(element);
    if (next && !state.visible) entering.set(element, state.kind);
    if (!next) cancelMotion(element);
    state.visible = next;
  }
  const intentional = performance.now() - lastIntent < 1800;
  if (intentional) {
    const targets = new Set(entering.keys());
    const parentEntering = element => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) if (targets.has(parent)) return true;
      return false;
    };
    for (const [element, kind] of entering) if (!parentEntering(element)) reveal(element, kind);
    for (const element of pendingContent) {
      if (!entering.has(element) && !parentEntering(element) && visible(element) &&
          !element.contains(document.activeElement)) reveal(element, 'content');
    }
  }
  pendingContent.clear();
  for (const [group, animate] of pendingGroups) positionIndicator(group, animate && intentional);
  pendingGroups.clear();
}

const surfaceObserver = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'childList' && contentIds.has(record.target.id)) pendingContent.add(record.target);
  }
  schedule();
});

function registerSurface(element, kind) {
  if (surfaces.has(element)) return;
  surfaces.set(element, {kind, visible: visible(element)});
  surfaceObserver.observe(element, {attributes: true, attributeFilter: ['hidden', 'open', 'class'],
    childList: contentIds.has(element.id)});
}

function queueGroup(group, animate = false) {
  pendingGroups.set(group, animate || pendingGroups.get(group) || false);
  schedule();
}

function positionIndicator(group, animate) {
  const state = groups.get(group);
  if (!state) return;
  if (!group.isConnected) {
    state.observer.disconnect(); resizeObserver?.unobserve(group); groups.delete(group); return;
  }
  const buttons = Array.from(group.children).filter(child => child.tagName === 'BUTTON' && !child.hidden);
  const selected = buttons.find(button => button.getAttribute('aria-selected') === 'true' ||
    button.getAttribute('aria-pressed') === 'true' || button.getAttribute('aria-current') === 'true' || button.classList.contains('active'));
  if (!selected || !visible(group) || buttons.length < 2) {
    group.classList.remove('liquid-tab-track'); state.indicator.hidden = true; state.geometry = null; return;
  }
  // The track establishes the offset parent. No button is wrapped, replaced or given a new role.
  group.classList.add('liquid-tab-track');
  const rows = buttons.map(button => button.offsetTop);
  if (Math.max(...rows) - Math.min(...rows) > 6) {
    group.classList.remove('liquid-tab-track'); state.indicator.hidden = true; state.geometry = null; return;
  }
  const geometry = [selected.offsetLeft, selected.offsetTop, selected.offsetWidth, selected.offsetHeight];
  if (!geometry[2] || !geometry[3]) return;
  const indicator = state.indicator;
  indicator.style.transition = !animate || reduced.matches || !state.geometry ? 'none' : '';
  indicator.style.width = `${geometry[2]}px`;
  indicator.style.height = `${geometry[3]}px`;
  indicator.style.transform = `translate(${geometry[0]}px, ${geometry[1]}px)`;
  indicator.style.visibility = 'visible';
  indicator.hidden = false;
  state.geometry = geometry;
}

const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
  for (const {target} of entries) queueGroup(target);
}) : null;

function registerGroup(group) {
  if (groups.has(group)) return;
  const indicator = document.createElement('span');
  indicator.className = 'liquid-tab-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.hidden = true;
  indicator.style.cssText = 'left:0;top:0;visibility:hidden;pointer-events:none';
  group.append(indicator);
  const observer = new MutationObserver(() => queueGroup(group, true));
  groups.set(group, {indicator, observer, geometry: null});
  // Only selection attributes on the existing direct buttons; no document-wide subtree observer.
  for (const button of group.children) if (button.tagName === 'BUTTON') {
    observer.observe(button, {attributes: true, attributeFilter: ['aria-selected', 'aria-pressed', 'aria-current', 'class', 'hidden']});
  }
  resizeObserver?.observe(group);
  queueGroup(group);
}

function discover(root) {
  if (!(root instanceof Element)) return;
  for (const [selector, kind] of Object.entries(surfaceSelectors)) {
    if (root.matches(selector)) registerSurface(root, kind);
    for (const element of root.querySelectorAll(selector)) registerSurface(element, kind);
  }
  if (root.matches(tabSelector)) registerGroup(root);
  for (const group of root.querySelectorAll(tabSelector)) registerGroup(group);
  for (const id of ['value-dialog-content', 'value-source-content']) {
    const content = root.id === id ? root : root.querySelector(`#${id}`);
    if (content) surfaceObserver.observe(content, {childList: true});
  }
}

const mountObserver = new MutationObserver(records => {
  for (const record of records) for (const node of record.addedNodes) discover(node);
  schedule();
});

function preferencesChanged() {
  if (reduced.matches) for (const element of activeAnimations.keys()) cancelMotion(element);
  for (const group of groups.keys()) queueGroup(group);
}

function markIntent(event) {
  if (event.isTrusted) lastIntent = performance.now();
}

function onResize() {
  for (const group of groups.keys()) queueGroup(group);
  schedule();
}

function onVisibility() {
  if (document.hidden) for (const element of activeAnimations.keys()) cancelMotion(element);
  else onResize();
}

function onPageHide(event) {
  for (const element of activeAnimations.keys()) cancelMotion(element);
  if (event.persisted) return;
  destroyed = true;
  cancelAnimationFrame(frame);
  surfaceObserver.disconnect(); mountObserver.disconnect(); resizeObserver?.disconnect();
  for (const state of groups.values()) state.observer.disconnect();
}

function boot() {
  if (!document.body) return;
  discover(document.body);
  // App initialization mounts the study workspace, popup and dialogs asynchronously.
  // Observe just their three insertion points, never the map's render tree or form subtrees.
  for (const root of [document.body, document.querySelector('#panel-value'), document.querySelector('.map-workspace')]) {
    if (root) mountObserver.observe(root, {childList: true});
  }
  surfaceObserver.observe(document.body, {attributes: true, attributeFilter: ['class']});
  document.body.classList.add('liquid-motion-ready');
  document.addEventListener('pointerdown', markIntent, {capture: true, passive: true});
  document.addEventListener('keydown', markIntent, {capture: true, passive: true});
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize, {passive: true});
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onResize);
  reduced.addEventListener('change', preferencesChanged);
  coarse.addEventListener('change', preferencesChanged);
  document.fonts?.ready.then(onResize);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
else boot();
