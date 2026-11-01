import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import type * as THREE from 'three'
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { createInk, outlineCreases } from '../drawing/lines'

/** Kept for the whole session: disposing the last ink would recompile its shader on the next hover. */
const inks = new Map<string, LineMaterial>()

function outlineInk(colour: string) {
  let ink = inks.get(colour)
  if (!ink) {
    ink = createInk(colour, 1.5, true)
    inks.set(colour, ink)
  }
  return ink
}

/** Outlines the edges of a selected or hovered component in the shaded view. */
export function SelectionOutline({ object, colour }: { object: THREE.Object3D; colour: string }) {
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const ink = outlineInk(colour)

  useLayoutEffect(() => {
    ink.resolution.set(size.width, size.height)
    invalidate()
  }, [ink, size, invalidate])

  useLayoutEffect(() => {
    const restore = outlineCreases(object, ink)
    invalidate()
    return () => {
      restore()
      invalidate()
    }
  }, [object, ink, invalidate])

  return null
}
