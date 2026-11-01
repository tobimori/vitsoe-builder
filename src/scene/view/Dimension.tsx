import { Line } from '@react-three/drei'
import { ScreenLabel, type LabelStyle } from './ScreenLabel'

export type Point = [number, number, number]

const ignoreRaycast = () => {}

const labelStyle: LabelStyle = {
  color: '#77776f',
  background: 'rgba(246,245,240,.88)',
  fontSize: 10,
  paddingX: 6,
  paddingY: 3,
  radius: 2,
}

/** A dimension line with end ticks and a label, in metres. */
export function Dimension({
  start,
  end,
  label,
  labelPosition,
}: {
  start: Point
  end: Point
  label: string
  labelPosition?: Point
}) {
  const midpoint: Point = labelPosition ?? [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ]
  const horizontal = Math.hypot(end[0] - start[0], end[2] - start[2]) > Math.abs(end[1] - start[1])
  const tick: Point = horizontal ? [0, 0.026, 0] : [0.026, 0, 0]

  return (
    <group raycast={ignoreRaycast}>
      <Line raycast={ignoreRaycast} points={[start, end]} color="#96968c" lineWidth={0.75} />
      {[start, end].map((point, index) => (
        <Line
          raycast={ignoreRaycast}
          key={index}
          points={[
            [point[0] - tick[0], point[1] - tick[1], point[2] - tick[2]],
            [point[0] + tick[0], point[1] + tick[1], point[2] + tick[2]],
          ]}
          color="#96968c"
          lineWidth={0.75}
        />
      ))}
      <ScreenLabel position={midpoint} text={label} style={labelStyle} />
    </group>
  )
}
