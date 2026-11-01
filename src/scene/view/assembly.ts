import { createAtom } from '@xstate/store'
import { catalog } from '../../domain/catalog/catalog'
import type { Plan } from '../../domain/plan/types'
import { selectors } from '../../editor/editor'
import { buildAssembly } from '../models/assembly'

/** The assembly ignores placement, room width and depth, and the plan name. */
function sameAssembly(a: Plan, b: Plan) {
  return (
    a.room.ceilingHeight === b.room.ceilingHeight &&
    a.system.mountingType === b.system.mountingType &&
    a.system.bays === b.system.bays &&
    a.system.items === b.system.items &&
    a.system.railHeight === b.system.railHeight &&
    a.system.mountHeight === b.system.mountHeight &&
    a.system.trackMode === b.system.trackMode &&
    a.system.finish === b.system.finish &&
    a.system.structureOptions === b.system.structureOptions
  )
}

const assemblyPlan = createAtom(() => selectors.plan.get(), { compare: sameAssembly })

/** The furniture model, rebuilt only when its geometry or finish can change. */
export const assemblyAtom = createAtom(() => buildAssembly(assemblyPlan.get(), catalog))
