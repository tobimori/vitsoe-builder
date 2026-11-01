import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'three/addons/libs/fflate.module.js'
import type { Catalog } from '../catalog/catalog'
import { parsePlan } from './codec'
import type { Plan } from './types'

const MAX_FRAGMENT_LENGTH = 250_000
const MAX_DOCUMENT_BYTES = 2_000_000

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

/** The uncompressed size from the gzip trailer, read before inflating untrusted input. */
function declaredGzipSize(bytes: Uint8Array) {
  if (bytes.length < 4) return 0
  return new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 4, 4).getUint32(0, true)
}

export function encodePlanHash(plan: Plan) {
  const source = strToU8(JSON.stringify(plan))
  if (source.length > MAX_DOCUMENT_BYTES) throw new Error('Plan is too large to share')

  const payload = encodeBase64Url(gzipSync(source, { level: 9, mtime: 0 }))
  if (payload.length > MAX_FRAGMENT_LENGTH) throw new Error('Plan link is too long')

  return `#plan=${payload}`
}

export function buildPlanUrl(plan: Plan, currentUrl: string) {
  const url = new URL(currentUrl)
  url.hash = encodePlanHash(plan)
  return url.toString()
}

export type DecodedPlan =
  | { status: 'absent' }
  | { status: 'invalid'; message: string }
  | { status: 'valid'; plan: Plan }

export function decodePlanHash(hash: string, catalog: Catalog): DecodedPlan {
  const payload = new URLSearchParams(hash.replace(/^#/, '')).get('plan')
  if (payload === null) return { status: 'absent' }
  if (!payload) return { status: 'invalid', message: 'The shared plan link is empty.' }
  if (payload.length > MAX_FRAGMENT_LENGTH) {
    return { status: 'invalid', message: 'The shared plan link is too large.' }
  }

  let source: string
  try {
    const compressed = decodeBase64Url(payload)
    if (declaredGzipSize(compressed) > MAX_DOCUMENT_BYTES) {
      return { status: 'invalid', message: 'The shared plan contains too much data.' }
    }
    source = strFromU8(gunzipSync(compressed))
  } catch {
    return { status: 'invalid', message: 'The shared plan could not be read.' }
  }

  const plan = parsePlan(source, catalog)
  return plan
    ? { status: 'valid', plan }
    : { status: 'invalid', message: 'The shared plan is malformed.' }
}

export type InitialPlan = {
  plan: Plan
  source: 'url' | 'local' | 'default'
  warning?: string
}

/** A shared link wins over the saved plan, which wins over the default plan. */
export function resolveInitialPlan(
  hash: string,
  saved: string | null,
  catalog: Catalog,
  fallback: Plan,
): InitialPlan {
  const shared = decodePlanHash(hash, catalog)
  if (shared.status === 'valid') return { plan: shared.plan, source: 'url' }

  const stored = saved ? parsePlan(saved, catalog) : undefined
  return {
    plan: stored ?? fallback,
    source: stored ? 'local' : 'default',
    warning: shared.status === 'invalid' ? shared.message : undefined,
  }
}
