import {PAGES_ORIGIN, apiPath, decodeResponse} from './cloud-transport.js';
const PREFIX = 'urbanlens-cloud-v1:';
const opener = window.opener;
const nonce = new URLSearchParams(location.hash.slice(1)).get('nonce');
const valid = Boolean(opener && /^[a-f0-9]{64}$/.test(nonce || ''));
const button = document.querySelector('#connect-button'), status = document.querySelector('#connect-status');
let approved = false, busy = 0;
const seen = new Set();
function send(message) { opener?.postMessage({...message, channel: nonce}, PAGES_ORIGIN); }
function disconnected(message) { approved = false; status.textContent = message; button.disabled = true; }
if (!valid) disconnected('浏览器未保留连接窗口。请直接打开云端工作区。');
button.addEventListener('click', async () => {
  if (!valid || approved) return;
  button.disabled = true; status.textContent = '正在连接…';
  try {
    const response = await fetch('/api/me', {credentials: 'same-origin', cache: 'no-store', redirect: 'error'});
    const result = await decodeResponse(response);
    if (!result.user?.id) throw Error('请登录后重新连接。');
    approved = true; send({type: PREFIX + 'ready'});
    status.textContent = '已连接。请返回原网页操作，并保留此窗口。';
    button.textContent = '已连接'; document.querySelector('#disconnect-button').hidden = false;
  } catch (e) { status.textContent = e.message || '连接失败，请直接打开云端工作区。'; button.disabled = false; }
});
document.querySelector('#disconnect-button').addEventListener('click', () => {
  send({type: PREFIX + 'disconnected'}); disconnected('已断开连接。');
  document.querySelector('#disconnect-button').hidden = true;
});
window.addEventListener('message', async event => {
  if (!approved || event.origin !== PAGES_ORIGIN || event.source !== opener || !event.data || event.data.channel !== nonce || event.data.type !== PREFIX + 'request') return;
  const m = event.data;
  if (typeof m.id !== 'string' || !/^[a-f0-9-]{36}$/.test(m.id) || seen.has(m.id)) return;
  const reply = data => send({type: PREFIX + 'result', id: m.id, ...data});
  let path, body;
  try {
    path = apiPath(m.path);
    if (!['GET', 'POST'].includes(m.method) || m.method === 'GET' && m.body !== undefined) throw Error('不支持此操作');
    if (m.body !== undefined) {
      body = JSON.stringify(m.body);
      if (new TextEncoder().encode(body).length > 11 * 1024 * 1024) throw Error('请求内容过大');
    }
    if (busy >= 12) { reply({ok: false, code: 'BRIDGE_BUSY', error: '正在处理其他请求，请稍后重试。'}); return; }
  } catch (e) { reply({ok: false, code: 'INVALID_REQUEST', error: e.message}); return; }
  seen.add(m.id);
  // A fixed request budget avoids unbounded replay state. Reconnect creates a fresh channel.
  if (seen.size > 10000) { reply({ok: false, code: 'BRIDGE_EXPIRED', error: '连接已到期，请重新连接。'}); approved = false; return; }
  busy++;
  try {
    const response = await fetch(path, {method: m.method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: body === undefined ? {} : {'Content-Type': 'application/json'}, body});
    const value = await decodeResponse(response);
    if (approved) reply({ok: true, value});
  } catch (e) { if (approved) reply({ok: false, status: e.status, code: e.code || 'API_ERROR', error: e.message || '项目服务暂不可用'}); }
  finally { busy--; }
});
window.addEventListener('pagehide', () => { if (approved) send({type: PREFIX + 'disconnected'}); approved = false; });
