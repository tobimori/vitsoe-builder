import * as stylex from '@stylexjs/stylex'
import { useLayoutEffect, useRef, useState } from 'react'
import {
  Button,
  Collection,
  DropIndicator,
  Tree,
  TreeItem,
  TreeItemContent,
  useDragAndDrop,
  type DropTarget,
  type Key,
  type TreeItemContentRenderProps,
} from 'react-aria-components'
import { catalog } from '../../domain/catalog/catalog'
import { sizeLabel } from '../../domain/catalog/options'
import { allowedFaces } from '../../domain/plan/system'
import type { Plan, PlanItem } from '../../domain/plan/types'
import type { Face } from '../../domain/types'
import { editor, selectors, useEditor, usePlan } from '../../editor/editor'
import { selectedIds, type Selection } from '../../editor/store'
import { ActionButton } from '../../ui/buttons'
import { Icon, type IconName } from '../../ui/icons'
import { text } from '../../ui/text'
import { colors, media } from '../../ui/tokens.stylex'
import { fitMoves, plannedMoves, type Place } from './layerMoves'

interface Layer {
  id: string
  name: string
  icon: IconName
  measure?: number
  /** What selecting the layer selects; sides, bays and the supports only group layers. */
  selection?: { type: 'item'; id: string } | { type: 'support'; index: number }
  /** Where components dropped on the layer go. */
  place?: Place
  children: Layer[]
}

const SUPPORTS = 'supports'
const supportKey = (index: number) => `support-${index}`

const faceNames: Record<Face, string> = { front: 'Front', back: 'Back' }

function itemLayer(item: PlanItem, items: readonly PlanItem[]): Layer {
  const product = catalog.product(item.productId)
  const variant = catalog.variant(item.productId, item.variantId)

  return {
    id: item.id,
    name: [product?.name ?? item.productId, variant && sizeLabel(variant)]
      .filter(Boolean)
      .join(', '),
    icon: product?.category ?? 'shelves',
    measure: item.height,
    selection: { type: 'item', id: item.id },
    place: { kind: 'item', item },
    children: items
      .filter((entry) => entry.parentItemId === item.id)
      .map((entry) => itemLayer(entry, items)),
  }
}

function bayLayers(plan: Plan, face: Face, prefix: string): Layer[] {
  const { bays, items } = plan.system

  return bays.map((bay, index) => ({
    id: `${prefix}${bay.id}`,
    name: `Bay ${index + 1}`,
    icon: 'bay',
    measure: bay.centreWidth,
    place: { kind: 'bay', face, bayIndex: index },
    children: items
      .filter((item) => item.face === face && item.bayIndex === index && !item.parentItemId)
      .sort((a, b) => b.height - a.height)
      .map((item) => itemLayer(item, items)),
  }))
}

/** Each side of a two-sided system, its bays from left to right, then the supports. */
function planLayers(plan: Plan): Layer[] {
  const faces = allowedFaces(plan)
  const bays =
    faces.length > 1
      ? faces.map((face) => ({
          id: `face-${face}`,
          name: faceNames[face],
          icon: 'face' as const,
          place: { kind: 'face' as const, face },
          children: bayLayers(plan, face, `${face}-`),
        }))
      : bayLayers(plan, faces[0] ?? 'front', '')
  const supportCount = plan.system.bays.length + 1

  return [
    ...bays,
    {
      id: SUPPORTS,
      name: 'Supports',
      icon: 'support',
      measure: supportCount,
      children: Array.from({ length: supportCount }, (_, index) => ({
        id: supportKey(index),
        name: `Support ${index + 1}`,
        icon: 'support' as const,
        selection: { type: 'support' as const, index },
        children: [],
      })),
    },
  ]
}

function selectedKeys(selection: Selection) {
  return selection?.type === 'support' ? [supportKey(selection.index)] : selectedIds(selection)
}

/** The groups that contain the layer with this key, outermost first. */
function pathTo(layers: Layer[], key: Key | null): string[] {
  for (const layer of layers) {
    if (layer.id === key) return []
    const path = pathTo(layer.children, key)
    if (path.length > 0 || layer.children.some((child) => child.id === key))
      return [layer.id, ...path]
  }
  return []
}

function flatten(layers: Layer[]): Layer[] {
  return layers.flatMap((layer) => [layer, ...flatten(layer.children)])
}

const styles = stylex.create({
  panel: {
    padding: '8px 8px 24px',
  },
  tree: {
    outline: 'none',
  },
  item: {
    outline: 'none',
    cursor: 'default',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: {
      default: 32,
      [media.touch]: 40,
    },
    paddingRight: 12,
    color: colors.ink,
    fontSize: 13,
    backgroundColor: 'transparent',
  },
  indent: (level: number) => ({
    paddingLeft: 4 + (level - 1) * 16,
  }),
  hovered: {
    backgroundColor: colors.band,
  },
  selected: {
    backgroundColor: colors.blueTint,
  },
  /** A closed group around the selection, as Figma marks it. */
  holdsSelection: {
    backgroundColor: 'rgb(0 115 177 / 0.05)',
  },
  focused: {
    outline: `2px solid ${colors.blue}`,
    outlineOffset: -2,
  },
  dropTarget: {
    backgroundColor: colors.blueTint,
    outlineWidth: 1,
    outlineStyle: 'solid',
    outlineColor: colors.blue,
    outlineOffset: -1,
  },
  dragging: {
    opacity: 0.4,
  },
  /** Lines up with the row's icon, as Figma draws it. */
  dropLine: {
    height: 0,
    marginLeft: 'calc(26px + (var(--tree-item-level) - 1) * 16px)',
    outline: 'none',
  },
  dropLineShown: {
    outlineWidth: 1,
    outlineStyle: 'solid',
    outlineColor: colors.blue,
  },
  chevron: {
    display: 'grid',
    flex: 'none',
    placeItems: 'center',
    width: 16,
    height: 16,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.muted,
    cursor: 'pointer',
    outline: 'none',
    transitionProperty: 'transform',
    transitionDuration: '0.12s',
  },
  expanded: {
    transform: 'rotate(90deg)',
  },
  spacer: {
    flex: 'none',
    width: 16,
  },
  icon: {
    display: 'flex',
    color: colors.muted,
  },
  iconSelected: {
    color: colors.blue,
  },
  name: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  measure: {
    color: colors.muted,
    fontVariantNumeric: 'tabular-nums',
  },
  grip: {
    display: 'grid',
    flex: 'none',
    placeItems: 'center',
    width: 16,
    height: 16,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: colors.muted,
    cursor: 'grab',
    opacity: 0,
    outline: 'none',
  },
  gripShown: {
    opacity: 1,
  },
  gripFocused: {
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineColor: colors.blue,
  },
  start: {
    padding: '12px 12px 4px',
  },
})

function LayerRow({
  layer,
  state,
  holdsSelection,
}: {
  layer: Layer
  state: TreeItemContentRenderProps
  holdsSelection: boolean
}) {
  const {
    isSelected,
    isHovered,
    isFocusVisible,
    isExpanded,
    hasChildItems,
    level,
    isDropTarget,
    isDragging,
  } = state
  const row = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (isSelected) row.current?.scrollIntoView({ block: 'nearest' })
  }, [isSelected])

  return (
    <div
      ref={row}
      {...stylex.props(
        styles.row,
        styles.indent(level),
        holdsSelection && !isExpanded && styles.holdsSelection,
        isHovered && styles.hovered,
        isSelected && styles.selected,
        isFocusVisible && styles.focused,
        isDropTarget && styles.dropTarget,
        isDragging && styles.dragging,
      )}
    >
      {hasChildItems ? (
        <Button slot="chevron" {...stylex.props(styles.chevron, isExpanded && styles.expanded)}>
          <Icon name="chevronRight" size={12} />
        </Button>
      ) : (
        <span {...stylex.props(styles.spacer)} />
      )}
      <span {...stylex.props(styles.icon, isSelected && styles.iconSelected)}>
        <Icon name={layer.icon} size={16} />
      </span>
      <span {...stylex.props(styles.name)}>{layer.name}</span>
      {layer.measure !== undefined && (
        <span {...stylex.props(styles.measure)}>{layer.measure}</span>
      )}
      <Button
        slot="drag"
        aria-label={`Move ${layer.name}`}
        isDisabled={layer.place?.kind !== 'item'}
        className={({ isFocusVisible, isDisabled }) =>
          stylex.props(
            styles.grip,
            !isDisabled && (isHovered || isFocusVisible) && styles.gripShown,
            isFocusVisible && styles.gripFocused,
          ).className ?? ''
        }
      >
        <Icon name="grip" size={14} />
      </Button>
    </div>
  )
}

/**
 * The system as layers: sides, bays, components with their accessories, and supports.
 * Selecting a layer selects it in the view; double-clicking a component zooms to it.
 * Dragging components moves them to another side or bay, or between two components;
 * dragging a bookend moves it to another shelf.
 */
export function LayersPanel() {
  const plan = usePlan()
  const selection = useEditor((context) => context.selection)
  const layers = planLayers(plan)
  const selected = selectedKeys(selection)
  const latest = selected.at(-1) ?? null
  const [collapsed, setCollapsed] = useState<ReadonlySet<Key>>(() => new Set([SUPPORTS]))
  const [revealed, setRevealed] = useState(latest)
  const dragged = useRef<PlanItem[]>([])

  // A selection made in the view opens the groups around it
  if (latest !== revealed) {
    setRevealed(latest)
    const path = pathTo(layers, latest)
    if (path.some((key) => collapsed.has(key)))
      setCollapsed(new Set([...collapsed].filter((key) => !path.includes(key as string))))
  }

  const around = new Set(selected.flatMap((key) => pathTo(layers, key)))
  const all = flatten(layers)
  const groups = all.filter((layer) => layer.children.length > 0).map((layer) => layer.id)
  const toggle = (key: Key) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const draggedItems = (keys: Iterable<Key>) => {
    const ids = new Set(keys)
    return selectors.plan.get().system.items.filter((item) => ids.has(item.id))
  }
  const moves = (target: DropTarget) => {
    if (target.type !== 'item') return undefined
    const place = all.find((layer) => layer.id === target.key)?.place
    return place && plannedMoves(selectors.plan.get(), dragged.current, place, target.dropPosition)
  }

  const { dragAndDropHooks } = useDragAndDrop<Layer>({
    getItems: (keys) =>
      [...keys].map((key) => ({
        'text/plain': all.find((layer) => layer.id === key)?.name ?? String(key),
      })),
    onDragStart: ({ keys }) => {
      dragged.current = draggedItems(keys)
    },
    onDragEnd: () => {
      dragged.current = []
    },
    getDropOperation: (target) => (moves(target) ? 'move' : 'cancel'),
    onMove: ({ target }) => {
      const planned = moves(target)
      if (!planned) return
      const current = selectors.plan.get()
      const changed = fitMoves(current, planned).filter((move) => {
        const original = current.system.items.find((item) => item.id === move.id)
        return (
          !original ||
          (Object.keys(move) as (keyof PlanItem)[]).some((key) => move[key] !== original[key])
        )
      })
      if (changed.length > 0) editor.trigger.moveItems({ items: changed })
    },
    renderDropIndicator: (target) => (
      <DropIndicator
        target={target}
        className={({ isDropTarget }) =>
          stylex.props(styles.dropLine, isDropTarget && styles.dropLineShown).className ?? ''
        }
      />
    ),
  })

  return (
    <div {...stylex.props(styles.panel)}>
      {plan.system.items.length === 0 && (
        <div {...stylex.props(styles.start)}>
          <p {...stylex.props(text.body)}>This system has no components yet.</p>
          <ActionButton
            variant="link"
            onPress={() => editor.trigger.showTab({ tab: 'components' })}
          >
            Add components
          </ActionButton>
        </div>
      )}
      <Tree
        aria-label="Layers"
        items={layers}
        selectionMode="multiple"
        selectionBehavior="replace"
        disabledBehavior="selection"
        disabledKeys={all.filter((layer) => !layer.selection).map((layer) => layer.id)}
        selectedKeys={selected}
        expandedKeys={groups.filter((key) => !collapsed.has(key))}
        onExpandedChange={(keys) => setCollapsed(new Set(groups.filter((key) => !keys.has(key))))}
        dragAndDropHooks={dragAndDropHooks}
        onSelectionChange={(keys) => {
          if (keys === 'all') return editor.trigger.selectAll()
          const targets = [...keys].map((key) => all.find((layer) => layer.id === key)?.selection)
          const ids = targets.flatMap((target) => (target?.type === 'item' ? [target.id] : []))
          const support = targets.find((target) => target?.type === 'support')
          if (ids.length > 0) editor.trigger.selectItems({ ids })
          else if (support) editor.trigger.selectSupport({ index: support.index })
          else editor.trigger.clearSelection()
        }}
        onAction={(key) => {
          const target = all.find((layer) => layer.id === key)?.selection
          if (!target) toggle(key)
          else if (target.type === 'item') editor.trigger.zoomTo({ itemId: target.id })
        }}
        {...stylex.props(styles.tree)}
      >
        {function renderLayer(layer: Layer) {
          return (
            <TreeItem id={layer.id} textValue={layer.name} {...stylex.props(styles.item)}>
              <TreeItemContent>
                {(state) => (
                  <LayerRow layer={layer} state={state} holdsSelection={around.has(layer.id)} />
                )}
              </TreeItemContent>
              <Collection items={layer.children}>{renderLayer}</Collection>
            </TreeItem>
          )
        }}
      </Tree>
    </div>
  )
}
