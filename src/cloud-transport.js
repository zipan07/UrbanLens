export const CLOUD_ORIGIN = 'https://urbanlens-workbench.zipan07.chatgpt.site';
export const PAGES_ORIGIN = 'https://zipan07.github.io';
const PREFIX = 'urbanlens-cloud-v1:';
const error = (message, code, status) => Object.assign(new Error(message), {code, status});
export function apiPath(path) {
  if (typeof path !== 'string') throw error('接口地址无效', 'INVALID_PATH');
  const normalized = path.startsWith('/api/') ? path : '/api/' + path;
  if (!/^\/api\/(?:me|projects(?:\/[A-Za-z0-9_-]+)*)$/.test(normalized)) throw error('接口地址无效', 'INVALID_PATH');
  return normalized;
}
function requestPayload(path, body, method) {
  const payload = {path: apiPath(path), method: method || (body === undefined ? 'GET' : 'POST')};
  if (!['GET', 'POST'].includes(payload.method) || payload.method === 'GET' && body !== undefined) throw error('不支持此操作', 'INVALID_METHOD');
  if (body !== undefined) {
    const json = JSON.stringify(body);
    if (typeof json !== 'string' || new TextEncoder().encode(json).length > 11 * 1024 * 1024) throw error('请求内容过大或无效', 'INVALID_BODY');
    payload.body = JSON.parse(json);
  }
  return payload;
}

/** Same-origin fetch on the private Site; consented popup RPC on the GitHub page. */
export class CloudTransport {
  constructor({onState = () => {}, requestTimeout = 45000, connectTimeout = 180000} = {}) {
    this.remote = location.origin === PAGES_ORIGIN;
    this.onState = onState; this.requestTimeout = requestTimeout; this.connectTimeout = connectTimeout;
    this.pending = new Map(); this.ready = false; this.popup = null;
    this.messageListener = event => this.receive(event);
    window.addEventListener('message', this.messageListener);
  }
  get connected() { return !this.remote || Boolean(this.ready && this.popup && !this.popup.closed); }
  /** Call directly in a click handler: window.open happens before any await. */
  connect() {
    if (!this.remote) return Promise.resolve();
    if (this.connected) { this.popup.focus(); return Promise.resolve(); }
    if (this.connecting && this.popup && !this.popup.closed) { this.popup.focus(); return this.connecting; }
    this.disconnect('正在重新连接', false);
    this.channel = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
    this.popup = window.open(CLOUD_ORIGIN + '/connect.html#nonce=' + this.channel, '_blank', 'popup=yes,width=520,height=640');
    if (!this.popup) return Promise.reject(error('请允许弹出窗口，再点击连接。也可以直接打开云端工作区。', 'POPUP_BLOCKED'));
    this.onState('connecting');
    this.connecting = new Promise((resolve, reject) => { this.resolveConnect = resolve; this.rejectConnect = reject; });
    this.connectTimer = setTimeout(() => this.disconnect('连接超时，请重新连接或打开云端工作区。'), this.connectTimeout);
    this.closeTimer = setInterval(() => {
      if (!this.popup || this.popup.closed) this.disconnect('连接窗口已关闭，请重新连接。');
    }, 500);
    return this.connecting;
  }
  receive(event) {
    if (event.origin !== CLOUD_ORIGIN || event.source !== this.popup || !event.data || event.data.channel !== this.channel) return;
    const message = event.data;
    if (message.type === PREFIX + 'ready') {
      if (!this.resolveConnect) return;
      clearTimeout(this.connectTimer); this.ready = true; this.resolveConnect();
      this.resolveConnect = null; this.rejectConnect = null; this.connecting = null;
      this.onState('connected'); return;
    }
    if (message.type === PREFIX + 'disconnected') { this.disconnect('连接已断开，请重新连接。', false); return; }
    if (message.type !== PREFIX + 'result' || typeof message.id !== 'string') return;
    const pending = this.pending.get(message.id); if (!pending) return;
    this.pending.delete(message.id); clearTimeout(pending.timer);
    if (message.ok === true) pending.resolve(message.value);
    else pending.reject(error(message.error || '项目服务暂不可用', message.code || 'API_ERROR', message.status));
  }
  async request(path, body, method) {
    const payload = requestPayload(path, body, method);
    if (!this.remote) {
      const response = await fetch(payload.path, {method: payload.method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: body === undefined ? {} : {'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(payload.body)});
      return decodeResponse(response);
    }
    if (!this.connected) throw error('请先点击“连接项目”，并在弹出窗口确认连接。', 'BRIDGE_CONNECT_REQUIRED');
    if (this.pending.size >= 12) throw error('正在处理其他请求，请稍后重试。', 'BRIDGE_BUSY');
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(error(payload.method === 'POST' ? '未收到保存确认，请重新载入项目核对后再操作，避免重复提交。' : '请求超时，请重试。', 'BRIDGE_TIMEOUT')); }, this.requestTimeout);
      this.pending.set(id, {resolve, reject, timer});
      try { this.popup.postMessage({type: PREFIX + 'request', channel: this.channel, id, ...payload}, CLOUD_ORIGIN); }
      catch { clearTimeout(timer); this.pending.delete(id); reject(error('连接已断开，请重新连接。', 'BRIDGE_DISCONNECTED')); }
    });
  }
  disconnect(message = '连接已断开，请重新连接。', close = true) {
    clearTimeout(this.connectTimer); clearInterval(this.closeTimer); this.ready = false;
    this.rejectConnect?.(error(message, 'BRIDGE_DISCONNECTED'));
    this.resolveConnect = null; this.rejectConnect = null; this.connecting = null;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error(message, 'BRIDGE_DISCONNECTED')); }
    this.pending.clear();
    if (close && this.popup && !this.popup.closed) this.popup.close();
    this.popup = null; this.channel = null; this.onState('disconnected');
  }
  destroy() { this.disconnect(); window.removeEventListener('message', this.messageListener); }
}

/** Attachment responses deliberately contain data only, never authentication headers. */
export async function decodeResponse(response) {
  const type = response.headers.get('Content-Type') || '';
  if (type.toLowerCase().includes('application/json')) {
    let value; try { value = await response.json(); } catch { throw error('项目服务返回了无效内容', 'INVALID_RESPONSE', response.status); }
    if (!response.ok) throw error(value.error || '请求失败', 'API_ERROR', response.status);
    return value;
  }
  if (!response.ok) throw error(response.status === 401 ? '请在云端窗口登录后重新连接。' : '项目服务暂不可用', 'API_ERROR', response.status);
  const disposition = response.headers.get('Content-Disposition') || '';
  // Only the attachment API returns binary. Reject login HTML or arbitrary asset responses.
  if (!/attachment/i.test(disposition)) throw error('请在云端窗口登录后重新连接。', 'INVALID_RESPONSE');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 8 * 1024 * 1024) throw error('附件过大，请直接在云端下载。', 'ATTACHMENT_TOO_LARGE');
  let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  let name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  try { name = name ? decodeURIComponent(name) : undefined; } catch { name = undefined; }
  name ||= disposition.match(/filename="([^"]+)"/i)?.[1] || 'attachment';
  name = name.replace(/[\\/\u0000-\u001f\u007f]/g, '_').slice(0, 250);
  return {binary: true, base64: btoa(binary), mime: type.split(';')[0] || 'application/octet-stream', name};
}

export function attachmentBlob(value) {
  if (!value?.binary || typeof value.base64 !== 'string') throw error('附件格式无效', 'INVALID_ATTACHMENT');
  return new Blob([Uint8Array.from(atob(value.base64), ch => ch.charCodeAt(0))], {type: value.mime || 'application/octet-stream'});
}
