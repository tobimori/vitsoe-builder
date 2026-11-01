import { Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Room as RoomSize } from '../../domain/plan/types'
import { mm } from '../models/primitives'
import { Dimension } from './Dimension'

export function Room({ room, showDimensions }: { room: RoomSize; showDimensions: boolean }) {
  const w = mm(room.width)
  const d = mm(room.depth)
  const h = mm(room.ceilingHeight)

  return (
    <group>
      <mesh position={[w / 2, -0.026, d / 2]} receiveShadow>
        <boxGeometry args={[w + 0.15, 0.05, d + 0.15]} />
        <meshStandardMaterial color="#cbc7bd" roughness={0.9} />
      </mesh>
      <mesh position={[w / 2, h / 2, -0.004]} receiveShadow>
        <planeGeometry args={[w + 0.15, h]} />
        <meshStandardMaterial color="#d8d6cf" roughness={0.95} />
      </mesh>
      <mesh position={[-0.004, h / 2, d / 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial color="#d1cec5" roughness={0.95} side={THREE.FrontSide} />
      </mesh>
      <mesh position={[w / 2, 0.042, 0.009]} receiveShadow>
        <boxGeometry args={[w, 0.084, 0.018]} />
        <meshStandardMaterial color="#e4e2d9" roughness={0.6} />
      </mesh>
      <Line
        points={[
          [0, h, 0],
          [w, h, 0],
          [w, h, d],
        ]}
        color="#d1cfc5"
        lineWidth={0.7}
      />
      <Line
        points={[
          [w, 0, 0],
          [w, 0, d],
          [0, 0, d],
        ]}
        color="#cbc8bd"
        lineWidth={0.8}
      />
      {showDimensions && (
        <>
          <Dimension
            start={[0, 0.01, Math.min(d - 0.12, 1.25)]}
            end={[w, 0.01, Math.min(d - 0.12, 1.25)]}
            label={`${w.toFixed(2)} m room width`}
          />
          <Dimension
            start={[w - 0.07, 0, 0.035]}
            end={[w - 0.07, h, 0.035]}
            label={`${h.toFixed(2)} m`}
          />
          <Dimension
            start={[w - 0.03, 0.012, 0]}
            end={[w - 0.03, 0.012, d]}
            label={`${d.toFixed(2)} m depth`}
          />
        </>
      )}
    </group>
  )
}
