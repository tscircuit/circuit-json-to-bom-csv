import type {
  AnyCircuitElement,
  BomSource,
  SourceComponentBase,
  SourceGroup,
} from "circuit-json"
import { convertCircuitJsonToBomRows, type BomRow } from "./index"

/** A physical component or an electrical subcircuit used as a display group. */
export interface AssemblyBomNode {
  id: string
  name: string
  source_component_id?: string
  source_group_id?: string
  /** Local count per parent. */
  quantity: number
  /** Count for one complete root build, including all ancestor quantities. */
  total_quantity: number
  assembly_mode: "build" | "buy"
  /** False beneath a purchased assembly; retained for inspection only. */
  included_in_purchase: boolean
  sources: BomSource[]
  row?: BomRow
  children: AssemblyBomNode[]
}

const nonPcbTypes = new Set([
  "subassembly",
  "printedpart",
  "interconnect",
  "motor",
])

const getSources = (source: SourceComponentBase): BomSource[] => {
  const explicit = source.bom_sources ?? []
  const legacy: BomSource[] = Object.entries(
    source.supplier_part_numbers ?? {},
  ).flatMap(([supplier_name, numbers]) =>
    (numbers ?? []).map((supplier_part_number) => ({
      supplier_name,
      supplier_part_number,
    })),
  )
  const seen = new Set<string>()
  return [...explicit, ...legacy]
    .filter((option) => {
      const key = JSON.stringify([
        option.supplier_name,
        option.supplier_part_number,
        option.url,
      ])
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((option) => ({ ...option }))
}

/**
 * Build a BOM tree without changing the manufacturing CSV contract. Explicit
 * physical ownership wins over electrical grouping. Only subcircuits become
 * display groups; ordinary layout groups are traversed but not displayed.
 */
export const convertCircuitJsonToAssemblyBom = async ({
  circuitJson,
}: {
  circuitJson: AnyCircuitElement[]
}): Promise<AssemblyBomNode[]> => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson,
    includeSourceIds: true,
  })
  const rowsBySource = new Map(
    rows.map((row) => [row.source_component_id!, row]),
  )
  const sources = new Map<string, SourceComponentBase>()
  const groups = new Map<string, SourceGroup>()
  const pcbSources = new Set<string>()
  for (const element of circuitJson) {
    if (element.type === "source_component") {
      if (sources.has(element.source_component_id))
        throw new Error("Duplicate source component in assembly BOM")
      sources.set(element.source_component_id, element)
    }
    if (element.type === "source_group")
      groups.set(element.source_group_id, element)
    if (element.type === "pcb_component")
      pcbSources.add(element.source_component_id)
  }

  const nodes = new Map<string, AssemblyBomNode>()
  const parents = new Map<string, string>()
  const creating = new Set<string>()
  const subcircuitGroups = new Map(
    [...groups.values()]
      .filter((g) => g.is_subcircuit && g.subcircuit_id)
      .map((g) => [g.subcircuit_id!, g.source_group_id]),
  )

  const ensureGroup = (
    groupId: string | undefined,
    seen = new Set<string>(),
  ): string | undefined => {
    if (!groupId) return
    const group = groups.get(groupId)
    if (!group) return
    if (seen.has(groupId)) throw new Error("Cycle in BOM group ancestry")
    seen.add(groupId)
    const parent = ensureGroup(
      group.parent_source_group_id ??
        subcircuitGroups.get(group.parent_subcircuit_id ?? ""),
      seen,
    )
    if (!group.is_subcircuit) return parent
    const id = `group:${groupId}`
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        name: group.name || "Unnamed subcircuit",
        source_group_id: groupId,
        quantity: 1,
        total_quantity: 1,
        assembly_mode: "build",
        included_in_purchase: true,
        sources: [],
        children: [],
      })
      if (parent) parents.set(id, parent)
    }
    return id
  }

  const ensureSource = (source: SourceComponentBase): string => {
    const id = `component:${source.source_component_id}`
    if (creating.has(id)) throw new Error("Cycle in physical assembly ancestry")
    if (nodes.has(id)) return id
    creating.add(id)
    const quantity = source.bom_quantity ?? 1
    if (!Number.isSafeInteger(quantity) || quantity <= 0)
      throw new Error("BOM quantities must be positive safe integers")
    const physicalParent = sources.get(source.parent_source_component_id ?? "")
    const parent = physicalParent
      ? ensureSource(physicalParent)
      : ensureGroup(
          source.source_group_id ??
            subcircuitGroups.get(source.subcircuit_id ?? ""),
        )
    nodes.set(id, {
      id,
      name: source.display_name || source.name || "Unnamed component",
      source_component_id: source.source_component_id,
      quantity,
      total_quantity: quantity,
      assembly_mode: source.bom_assembly_mode ?? "buy",
      included_in_purchase: true,
      sources: getSources(source),
      row: rowsBySource.get(source.source_component_id),
      children: [],
    })
    if (parent) parents.set(id, parent)
    creating.delete(id)
    return id
  }

  for (const source of sources.values()) {
    const hasPcb = pcbSources.has(source.source_component_id)
    if (
      rowsBySource.has(source.source_component_id) ||
      (!hasPcb &&
        (nonPcbTypes.has(source.ftype ?? "") ||
          source.bom_sources !== undefined ||
          source.bom_assembly_mode !== undefined))
    )
      ensureSource(source)
  }

  const roots: AssemblyBomNode[] = []
  for (const node of nodes.values()) {
    const parent = nodes.get(parents.get(node.id) ?? "")
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const resolveQuantities = (
    node: AssemblyBomNode,
    parentQuantity: number,
    included: boolean,
  ) => {
    const source = sources.get(node.source_component_id ?? "")
    if (node.children.length && !source?.bom_assembly_mode)
      node.assembly_mode = "build"
    node.total_quantity = node.quantity * parentQuantity
    if (!Number.isSafeInteger(node.total_quantity))
      throw new Error("Assembly BOM quantity exceeds the safe integer range")
    node.included_in_purchase = included
    for (const child of node.children)
      resolveQuantities(
        child,
        node.total_quantity,
        included && node.assembly_mode === "build",
      )
  }
  for (const root of roots) resolveQuantities(root, 1, true)
  return roots
}
