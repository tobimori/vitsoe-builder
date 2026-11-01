import * as THREE from 'three'
import type { Room as RoomSize } from '../../domain/plan/types'
import { mm } from '../models/primitives'

const ignoreRaycast = () => {}

const wallMaterial = new THREE.MeshStandardMaterial({ color: '#d8d8d6', roughness: 0.95 })
const floorMaterial = new THREE.MeshStandardMaterial({ color: '#cfcfcc', roughness: 0.9 })

/**
 * Four walls and a floor. The walls face into the room and are drawn from the front only,
 * so a wall between the camera and the system disappears as the camera passes behind it.
 */
export function Room({ room }: { room: RoomSize }) {
  const w = mm(room.width)
  const d = mm(room.depth)
  const h = mm(room.ceilingHeight)

  const walls: { position: [number, number, number]; angle: number; length: number }[] = [
    { position: [w / 2, h / 2, 0], angle: 0, length: w },
    { position: [0, h / 2, d / 2], angle: Math.PI / 2, length: d },
    { position: [w / 2, h / 2, d], angle: Math.PI, length: w },
    { position: [w, h / 2, d / 2], angle: -Math.PI / 2, length: d },
  ]

  return (
    <group raycast={ignoreRaycast}>
      <mesh
        position={[w / 2, 0, d / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={floorMaterial}
        raycast={ignoreRaycast}
        receiveShadow
      >
        <planeGeometry args={[w, d]} />
      </mesh>
      {walls.map(({ position, angle, length }) => (
        <mesh
          key={angle}
          position={position}
          rotation={[0, angle, 0]}
          material={wallMaterial}
          raycast={ignoreRaycast}
          receiveShadow
        >
          <planeGeometry args={[length, h]} />
        </mesh>
      ))}
    </group>
  )
}
