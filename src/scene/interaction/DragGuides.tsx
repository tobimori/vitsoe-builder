import { Line } from '@react-three/drei'
import { Dimension } from '../view/Dimension'
import { ScreenLabel, type LabelStyle } from '../view/ScreenLabel'
import type { FaceMarker, ItemPreview, SupportPreview } from './useAssemblyDrag'

const markerStyle: LabelStyle = {
  color: 'white',
  background: '#0076ad',
  fontSize: 13,
  paddingX: 12,
  paddingY: 8,
}

/** Pin height, width and depth of the component at its drop position. */
export function ItemGuides({ preview }: { preview: ItemPreview }) {
  const { width, depth, height, x, z, face, tabletop } = preview
  const baseline = Math.max(0.08, height + preview.bottom - 0.08)

  return (
    <group position={[x, 0, z]} rotation={[0, face === 'back' ? Math.PI : 0, 0]}>
      <Dimension
        start={[-width / 2 - 0.14, 0, depth + 0.08]}
        end={[-width / 2 - 0.14, height, depth + 0.08]}
        label={`${tabletop ? 'Tabletop' : 'Pin'} ${Math.round(height * 1000)} mm`}
      />
      <Dimension
        start={[-width / 2, baseline, depth + 0.08]}
        end={[width / 2, baseline, depth + 0.08]}
        label={`${Math.round(width * 1000)} mm wide`}
      />
      <Dimension
        start={[width / 2 + 0.12, baseline, 0]}
        end={[width / 2 + 0.12, baseline, depth]}
        label={`${Math.round(depth * 1000)} mm deep`}
      />
    </group>
  )
}

/** Distances from the walls and the mounting height of a support run being moved. */
export function SupportGuides({ preview }: { preview: SupportPreview }) {
  const { x, z, height } = preview

  return (
    <group>
      <Dimension
        start={[0, 0.12, z]}
        end={[x, 0.12, z]}
        label={`Room X ${Math.round(x * 1000)} mm`}
      />
      <Dimension
        start={[x, 0.12, 0]}
        end={[x, 0.12, z]}
        label={`Room depth ${Math.round(z * 1000)} mm`}
      />
      <Dimension
        start={[x - 0.14, 0, z]}
        end={[x - 0.14, height, z]}
        label={`Mounting height ${Math.round(height * 1000)} mm`}
      />
    </group>
  )
}

export function FaceTarget({ marker }: { marker: FaceMarker }) {
  return (
    <group>
      {marker.point.distanceTo(marker.destination) > 0.001 && (
        <Line
          points={[marker.destination, marker.point]}
          color="#0076ad"
          lineWidth={1}
          dashed
          dashSize={0.025}
          gapSize={0.015}
        />
      )}
      <ScreenLabel
        position={marker.point.toArray()}
        text={`Drag here → ${marker.face}`}
        style={markerStyle}
      />
    </group>
  )
}
