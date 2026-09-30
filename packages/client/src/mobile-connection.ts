/** Pure connection rules, shared by the native settings UI and tests. */
export function normalizeServer(value: string, allowInsecure = false): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Ingresá una URL completa, por ejemplo https://mi-servidor.com.'); }
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Usá HTTP, HTTPS, WS o WSS, sin credenciales ni parámetros.');
  if (!allowInsecure && ['http:', 'ws:'].includes(url.protocol)) throw new Error('Esta versión requiere HTTPS o WSS.');
  if (url.pathname !== '/') throw new Error('Ingresá la dirección raíz del servidor, sin rutas adicionales.');
  url.protocol = ['https:', 'wss:'].includes(url.protocol) ? 'wss:' : 'ws:';
  return url.href.replace(/\/$/, '');
}
export function healthUrl(endpoint: string): string {
  return `${endpoint.replace(/^ws/, 'http').replace(/\/$/, '')}/health`;
}
export function roomCode(value: string): string {
  let code = value.trim();
  if (/^https?:\/\//i.test(code)) {
    try { code = new URL(code).searchParams.get('sala') ?? ''; } catch { code = ''; }
  }
  if (!/^[a-zA-Z0-9_-]{6,128}$/.test(code)) throw new Error('Ingresá un código de sala o un enlace con ?sala=.');
  return code;
}
export function invitation(code: string, native: boolean, publicUrl?: string): string {
  if (native && !publicUrl) return code;
  const url = new URL(publicUrl || location.href);
  if (!['https:', 'http:'].includes(url.protocol)) return code;
  url.search = ''; url.hash = ''; url.searchParams.set('sala', code);
  return url.href;
}
