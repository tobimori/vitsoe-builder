import { gzipSync, gunzipSync, strFromU8, strToU8 } from 'three/addons/libs/fflate.module.js'
import { migrateDocumentFinishes, parseBuilderDocument } from './document'
import type { BuilderDocument, CatalogProduct } from './types'

export const SHARE_VERSION = 'v1'
export const MAX_SHARE_FRAGMENT_LENGTH = 250_000
export const MAX_SHARE_DOCUMENT_BYTES = 2_000_000

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 16_384) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 16_384))
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Malformed plan encoding')
  const standard = value.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(standard.padEnd(Math.ceil(standard.length / 4) * 4, '='))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function declaredGzipSize(bytes: Uint8Array) {
  if (bytes.length < 4) return 0
  const offset = bytes.length - 4
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  )
}

export function encodePlanHash(document: BuilderDocument) {
  const source = strToU8(JSON.stringify(document))
  if (source.length > MAX_SHARE_DOCUMENT_BYTES) throw new Error('Plan is too large to share')
  const payload = encodeBase64Url(gzipSync(source, { level: 9, mtime: 0 }))
  if (payload.length > MAX_SHARE_FRAGMENT_LENGTH) throw new Error('Plan link is too long')
  return `#plan=${SHARE_VERSION}.${payload}`
}

export type DecodedPlan =
  | { status: 'absent' }
  | { status: 'invalid'; message: string }
  | { status: 'valid'; document: BuilderDocument }

export function decodePlanHash(hash: string, catalog: CatalogProduct[]): DecodedPlan {
  const parameters = new URLSearchParams(hash.replace(/^#/, ''))
  if (!parameters.has('plan')) return { status: 'absent' }
  const plan = parameters.get('plan') ?? ''
  if (!plan) return { status: 'invalid', message: 'The shared plan link is empty.' }
  if (plan.length > MAX_SHARE_FRAGMENT_LENGTH) {
    return { status: 'invalid', message: 'The shared plan link is too large.' }
  }

  const separator = plan.indexOf('.')
  if (separator < 0 || plan.slice(0, separator) !== SHARE_VERSION) {
    return { status: 'invalid', message: 'This shared plan version is unsupported.' }
  }

  try {
    const compressed = decodeBase64Url(plan.slice(separator + 1))
    if (declaredGzipSize(compressed) > MAX_SHARE_DOCUMENT_BYTES) {
      return { status: 'invalid', message: 'The shared plan contains too much data.' }
    }
    const source = strFromU8(gunzipSync(compressed))
    if (source.length > MAX_SHARE_DOCUMENT_BYTES) {
      return { status: 'invalid', message: 'The shared plan contains too much data.' }
    }
    const document = parseBuilderDocument(source, catalog)
    if (!document) return { status: 'invalid', message: 'The shared plan is malformed.' }
    return { status: 'valid', document: migrateDocumentFinishes(document, catalog) }
  } catch {
    return { status: 'invalid', message: 'The shared plan could not be read.' }
  }
}

export function resolveInitialPlan(
  hash: string,
  saved: string | null,
  catalog: CatalogProduct[],
  fallback: BuilderDocument,
) {
  const shared = decodePlanHash(hash, catalog)
  if (shared.status === 'valid') {
    return { document: shared.document, source: 'url' as const }
  }

  const stored = saved ? parseBuilderDocument(saved, catalog) : undefined
  const document = stored ? migrateDocumentFinishes(stored, catalog) : fallback
  return {
    document,
    source: stored ? ('local' as const) : ('default' as const),
    warning: shared.status === 'invalid' ? shared.message : undefined,
  }
}

export function buildPlanUrl(document: BuilderDocument, currentUrl: string) {
  const url = new URL(currentUrl)
  url.hash = encodePlanHash(document)
  return url.toString()
}
