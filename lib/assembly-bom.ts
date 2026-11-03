import type {
  AnyCircuitElement,
  CadAssemblyBomItem,
  SourceComponentBase,
  SourceGroup,
  SupplierName,
} from "circuit-json"
import { convertCircuitJsonToBomRows, type BomRow } from "./index"

/** An explicit assembly item, a fallback PCB item, or a structural display group. */
export interface AssemblyBomNode {
  id: string
  kind: "assembly_bom_item" | "pcb_component" | "subcircuit"
  name: string
  cad_assembly_bom_item_id?: string
  source_component_id?: string
  source_group_id?: string
  cad_component_ids?: string[]
  /** Local count per parent. */
  quantity: number
  /** Count for one root build, including ancestor quantities. */
  total_quantity: number
  supplier_part_numbers?: SourceComponentBase["supplier_part_numbers"]
  purchase_urls: string[]
  row?: BomRow
  children: AssemblyBomNode[]
}

const normalizePartNumbers = (
  numbers: SourceComponentBase["supplier_part_numbers"],
) => {
  if (!numbers) return undefined
  const normalized: NonNullable<SourceComponentBase["supplier_part_numbers"]> =
    {}
  for (const supplier of Object.keys(numbers) as SupplierName[]) {
    const parts = [
      ...new Set(
        (numbers[supplier] ?? [])
          .map((number) => number.trim())
          .filter(Boolean),
      ),
    ]
    if (parts.length) normalized[supplier] = parts
  }
  return normalized
}

/**
 * Explicit assembly BOM entries own their nesting and quantities. PCB items not
 * represented by an explicit entry remain available under electrical subcircuits.
 * Geometry references identify represented components; they never set quantity.
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
  const cadSources = new Map<string, string>()
  const items = new Map<string, CadAssemblyBomItem>()
  for (const element of circuitJson) {
    if (element.type === "source_component") {
      if (sources.has(element.source_component_id))
        throw new Error("Duplicate source component in assembly BOM")
      sources.set(element.source_component_id, element)
    } else if (element.type === "source_group") {
      if (groups.has(element.source_group_id))
        throw new Error("Duplicate source group in assembly BOM")
      groups.set(element.source_group_id, element)
    } else if (element.type === "cad_component") {
      if (cadSources.has(element.cad_component_id))
        throw new Error("Duplicate CAD component in assembly BOM")
      cadSources.set(element.cad_component_id, element.source_component_id)
    } else if (element.type === "cad_assembly_bom_item") {
      if (items.has(element.cad_assembly_bom_item_id))
        throw new Error("Duplicate assembly BOM item")
      items.set(element.cad_assembly_bom_item_id, element)
    }
  }

  const nodes = new Map<string, AssemblyBomNode>()
  const parents = new Map<string, string>()
  const representedSources = new Set<string>()
  for (const item of items.values()) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0)
      throw new Error("BOM quantities must be positive safe integers")
    const linkedSources = new Set<string>()
    if (item.source_component_id) linkedSources.add(item.source_component_id)
    for (const cadId of item.cad_component_ids ?? []) {
      const sourceId = cadSources.get(cadId)
      if (sourceId) linkedSources.add(sourceId)
    }
    for (const sourceId of linkedSources) representedSources.add(sourceId)
    // Multiple referenced components do not imply one shared part/footprint.
    const sourceId =
      item.source_component_id ??
      (linkedSources.size === 1 ? [...linkedSources][0] : undefined)
    const source = sourceId ? sources.get(sourceId) : undefined
    const id = `bom:${item.cad_assembly_bom_item_id}`
    nodes.set(id, {
      id,
      kind: "assembly_bom_item",
      name: item.name,
      cad_assembly_bom_item_id: item.cad_assembly_bom_item_id,
      source_component_id: sourceId,
      cad_component_ids: item.cad_component_ids
        ? [...item.cad_component_ids]
        : undefined,
      quantity: item.quantity,
      total_quantity: item.quantity,
      supplier_part_numbers: normalizePartNumbers(
        item.supplier_part_numbers ?? source?.supplier_part_numbers,
      ),
      purchase_urls: [...new Set(item.purchase_urls ?? [])],
      row: sourceId ? rowsBySource.get(sourceId) : undefined,
      children: [],
    })
    if (item.parent_cad_assembly_bom_item_id)
      parents.set(id, `bom:${item.parent_cad_assembly_bom_item_id}`)
  }

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
        kind: "subcircuit",
        name: group.name || "Unnamed subcircuit",
        source_group_id: groupId,
        quantity: 1,
        total_quantity: 1,
        purchase_urls: [],
        children: [],
      })
      if (parent) parents.set(id, parent)
    }
    return id
  }

  for (const row of rows) {
    const sourceId = row.source_component_id!
    if (representedSources.has(sourceId)) continue
    const source = sources.get(sourceId)!
    const id = `component:${sourceId}`
    const parent = ensureGroup(
      source.source_group_id ??
        subcircuitGroups.get(source.subcircuit_id ?? ""),
    )
    nodes.set(id, {
      id,
      kind: "pcb_component",
      name: source.display_name || source.name || "Unnamed component",
      source_component_id: sourceId,
      quantity: 1,
      total_quantity: 1,
      supplier_part_numbers: normalizePartNumbers(source.supplier_part_numbers),
      purchase_urls: [],
      row,
      children: [],
    })
    if (parent) parents.set(id, parent)
  }

  const resolved = new Set<string>()
  const resolving = new Set<string>()
  const resolveQuantity = (node: AssemblyBomNode): number => {
    if (resolved.has(node.id)) return node.total_quantity
    if (resolving.has(node.id))
      throw new Error("Cycle in assembly BOM ancestry")
    resolving.add(node.id)
    const parent = nodes.get(parents.get(node.id) ?? "")
    node.total_quantity = node.quantity * (parent ? resolveQuantity(parent) : 1)
    if (!Number.isSafeInteger(node.total_quantity))
      throw new Error("Assembly BOM quantity exceeds the safe integer range")
    resolving.delete(node.id)
    resolved.add(node.id)
    return node.total_quantity
  }
  const roots: AssemblyBomNode[] = []
  for (const node of nodes.values()) {
    resolveQuantity(node)
    const parent = nodes.get(parents.get(node.id) ?? "")
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}
