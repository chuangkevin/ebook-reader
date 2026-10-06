export function safeReturnTo(value: string | null, fallback = '/library') {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return fallback
    if (!/^\/(library|settings|upload|reader\/[^/]+)\/?$/.test(url.pathname)) return fallback
    return url.pathname + url.search
  } catch {
    return fallback
  }
}
export function libraryReturn(value: string | null) {
  const safe = safeReturnTo(value)
  return routePath(new URL(safe, window.location.origin).pathname) === '/library' ? safe : '/library'
}
export function routePath(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/'
}
