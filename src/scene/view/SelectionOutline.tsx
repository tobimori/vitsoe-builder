import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import type { Selection } from '../../editor/store'

function outline(assembly: THREE.Group, selection: Selection) {
  const object = assembly.children.find((child) =>
    selection?.type === 'item'
      ? child.userData.itemId === selection.id
      : selection?.type === 'support' && child.userData.supportIndex === selection.index,
  )
  if (!object) return null

  const box = new THREE.BoxHelper(object, '#888b69')
  box.material.depthTest = false
  box.material.transparent = true
  box.material.opacity = 0.65
  box.renderOrder = 20
  return box
}

export function SelectionOutline({
  assembly,
  selection,
}: {
  assembly: THREE.Group
  selection: Selection
}) {
  const helper = outline(assembly, selection)

  useEffect(
    () => () => {
      helper?.geometry.dispose()
      helper?.material.dispose()
    },
    [helper],
  )

  useFrame(() => helper?.update())

  return helper ? <primitive object={helper} /> : null
}
