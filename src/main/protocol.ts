import { net, protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
].join('; ')

export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

export function installAppProtocol(rendererRoot: string): void {
  const root = resolve(rendererRoot)

  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url)
      if (url.host !== 'bundle') return new Response('Not found', { status: 404 })

      let pathname = decodeURIComponent(url.pathname)
      if (pathname === '/' || pathname === '') pathname = '/index.html'
      const relative = normalize(pathname).replace(/^([/\\])+/, '')
      const filePath = resolve(join(root, relative))
      if (filePath !== root && !filePath.startsWith(root + sep)) {
        return new Response('Forbidden', { status: 403 })
      }

      const data = await readFile(filePath)
      const type = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': type,
          'Content-Security-Policy': CSP,
          'Cache-Control': 'no-cache',
        },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

export function fileUrl(path: string): string {
  return pathToFileURL(path).toString()
}

export function fetchLocalFile(path: string): Promise<Response> {
  return net.fetch(fileUrl(path))
}
