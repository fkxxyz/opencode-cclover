interface ResolveBackendOriginOptions {
  dev: boolean
  envBackendOrigin?: string
  windowOrigin: string
}

export function resolveBackendOrigin({
  dev,
  envBackendOrigin,
  windowOrigin,
}: ResolveBackendOriginOptions): string {
  if (dev && envBackendOrigin) {
    return envBackendOrigin
  }

  return windowOrigin
}

export function getApiBaseUrl(origin: string): string {
  return `${origin}/api`
}

export function getWebSocketUrl(origin: string): string {
  const url = new URL(origin)
  const protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${url.host}/ws`
}

export function getBackendOriginFromRuntime(): string {
  return resolveBackendOrigin({
    dev: import.meta.env.DEV,
    envBackendOrigin: import.meta.env.VITE_CCLOVER_BACKEND_ORIGIN,
    windowOrigin: window.location.origin,
  })
}

export function getApiBaseUrlFromRuntime(): string {
  return getApiBaseUrl(getBackendOriginFromRuntime())
}

export function getWebSocketUrlFromRuntime(): string {
  return getWebSocketUrl(getBackendOriginFromRuntime())
}
