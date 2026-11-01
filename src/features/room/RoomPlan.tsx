import * as stylex from '@stylexjs/stylex'
import { useRef, useState, type PointerEvent } from 'react'
import { catalog } from '../../domain/catalog/catalog'
import { setPlacement } from '../../domain/plan/system'
import type { Plan, Wall } from '../../domain/plan/types'
import { runFrame } from '../../domain/plan/walls'
import { fitPlacement, footprintCorners } from '../../domain/supports/footprint'
import { editor, usePlan } from '../../editor/editor'
import { colors, media } from '../../ui/tokens.stylex'

const PAD = 260

const styles = stylex.create({
  plan: {
    display: 'block',
    width: '100%',
    maxHeight: {
      default: 220,
      [media.stacked]: 190,
    },
    marginBottom: 12,
    touchAction: 'none',
    userSelect: 'none',
  },
  floor: {
    fill: colors.band,
  },
  wall: {
    stroke: '#c4c4c4',
    strokeWidth: 3,
    strokeLinecap: 'square',
    cursor: 'pointer',
    transitionProperty: 'stroke',
    transitionDuration: '0.12s',
  },
  hoveredWall: {
    stroke: colors.blue,
  },
  activeWall: {
    stroke: colors.ink,
    cursor: 'default',
  },
  hit: {
    stroke: 'transparent',
    strokeWidth: 18,
  },
  system: {
    fill: {
      default: colors.ink,
      ':hover': colors.blue,
    },
    cursor: 'grab',
  },
  moving: {
    fill: colors.blue,
    cursor: 'grabbing',
  },
})

/** The run's local axes in the room: along its wall, and out into the room. */
function toRun(plan: Plan, dx: number, dz: number) {
  const { cos, sin } = runFrame(plan)
  return { along: dx * cos - dz * sin, out: dx * sin + dz * cos }
}

/**
 * The room from above, with the back wall at the top. Choose a wall to stand the system
 * along it, and drag the system to move it along the wall or, if it stands, out into the room.
 */
export function RoomPlan() {
  const plan = usePlan()
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ from: Plan; x: number; z: number } | null>(null)
  const [moving, setMoving] = useState(false)
  const [hovered, setHovered] = useState<Wall | null>(null)
  const { width, depth } = plan.room
  const active = plan.system.placement.wall

  const walls: { wall: Wall; points: [number, number, number, number] }[] = [
    { wall: 'back', points: [0, 0, width, 0] },
    { wall: 'right', points: [width, 0, width, depth] },
    { wall: 'front', points: [width, depth, 0, depth] },
    { wall: 'left', points: [0, depth, 0, 0] },
  ]
  const footprint = footprintCorners(plan, catalog)
    .map(({ x, z }) => `${x},${z}`)
    .join(' ')

  const roomPoint = (event: PointerEvent) => {
    const matrix = svg.current?.getScreenCTM()?.inverse()
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix)
    return { x: point.x, z: point.y }
  }

  const start = (event: PointerEvent<SVGPolygonElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { from: plan, ...roomPoint(event) }
    setMoving(true)
  }

  const move = (event: PointerEvent) => {
    const current = drag.current
    if (!current) return
    const point = roomPoint(event)
    const { along, out } = toRun(current.from, point.x - current.x, point.z - current.z)
    const { offset, distance } = current.from.system.placement
    editor.trigger.previewPlan({
      plan: fitPlacement(
        setPlacement(current.from, { offset: offset + along, distance: distance + out }),
        catalog,
      ),
    })
  }

  const end = () => {
    const current = drag.current
    if (!current) return
    drag.current = null
    setMoving(false)
    editor.trigger.commitPreview({ from: current.from })
    editor.trigger.fitCamera()
  }

  return (
    <svg
      ref={svg}
      role="img"
      aria-label={`Room plan. The system stands along the ${active} wall.`}
      viewBox={`${-PAD} ${-PAD} ${width + PAD * 2} ${depth + PAD * 2}`}
      {...stylex.props(styles.plan)}
    >
      <rect width={width} height={depth} {...stylex.props(styles.floor)} />
      {walls.map(({ wall, points: [x1, y1, x2, y2] }) => (
        <g
          key={wall}
          onClick={() => editor.trigger.moveToWall({ wall })}
          onPointerEnter={() => setHovered(wall)}
          onPointerLeave={() => setHovered(null)}
        >
          <title>{wall === active ? `${wall} wall` : `Move the system to the ${wall} wall`}</title>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            vectorEffect="non-scaling-stroke"
            {...stylex.props(styles.hit)}
          />
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            vectorEffect="non-scaling-stroke"
            {...stylex.props(
              styles.wall,
              wall === hovered && styles.hoveredWall,
              wall === active && styles.activeWall,
            )}
          />
        </g>
      ))}
      <polygon
        points={footprint}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        {...stylex.props(styles.system, moving && styles.moving)}
      >
        <title>Drag to move the system</title>
      </polygon>
    </svg>
  )
}
