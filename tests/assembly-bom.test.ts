import { expect, test } from "bun:test"
import type { AnyCircuitElement, CadAssemblyBomItem } from "circuit-json"
import {
  convertCircuitJsonToAssemblyBom,
  convertCircuitJsonToBomRows,
  convertBomRowsToCsv,
} from "../lib"

const item = (
  name: string,
  extra: Partial<CadAssemblyBomItem> = {},
): CadAssemblyBomItem => ({
  type: "cad_assembly_bom_item",
  cad_assembly_bom_item_id: name,
  name,
  quantity: 1,
  ...extra,
})
const pcbCircuit = (): AnyCircuitElement[] => [
  {
    type: "source_group",
    source_group_id: "board",
    subcircuit_id: "board-circuit",
    is_subcircuit: true,
    name: "Main board",
  },
  {
    type: "source_group",
    source_group_id: "layout",
    parent_source_group_id: "board",
  },
  {
    type: "source_component",
    ftype: "simple_resistor",
    source_component_id: "r",
    name: "R1",
    resistance: 1000,
    source_group_id: "layout",
    supplier_part_numbers: { jlcpcb: ["C123"] },
  },
  {
    type: "pcb_component",
    obstructs_within_bounds: true,
    pcb_component_id: "pcb-r",
    source_component_id: "r",
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
    layer: "top",
    rotation: 0,
  },
  {
    type: "cad_component",
    cad_component_id: "cad-r",
    source_component_id: "r",
    pcb_component_id: "pcb-r",
    position: { x: 0, y: 0, z: 0 },
    anchor_alignment: "center",
    model_object_fit: "contain_within_bounds",
  },
]

test("BOM-only materials retain multiple links and multiply nested quantities regardless of input order", async () => {
  const input = [
    item("screws", {
      parent_cad_assembly_bom_item_id: "housing",
      quantity: 4,
      purchase_urls: [
        "https://amazon.com/dp/example",
        "https://store.example/screws",
      ],
    }),
    item("housing", { quantity: 2 }),
  ]
  const before = JSON.stringify(input)
  const [housing] = await convertCircuitJsonToAssemblyBom({
    circuitJson: input,
  })
  expect(housing.name).toBe("housing")
  expect(housing.total_quantity).toBe(2)
  expect(housing.children[0].total_quantity).toBe(8)
  expect(housing.children[0].purchase_urls).toEqual(input[0].purchase_urls!)
  expect(JSON.stringify(input)).toBe(before)
  expect(await convertCircuitJsonToBomRows({ circuitJson: input })).toEqual([])
})

test("explicit source references replace fallback PCB rows without changing manufacturing CSV", async () => {
  const input = pcbCircuit()
  const csv = convertBomRowsToCsv(
    await convertCircuitJsonToBomRows({ circuitJson: input }),
  )
  input.push(item("Resistor kit", { source_component_id: "r", quantity: 3 }))
  const nodes = await convertCircuitJsonToAssemblyBom({ circuitJson: input })
  expect(nodes).toHaveLength(1)
  expect(nodes[0].kind).toBe("assembly_bom_item")
  expect(nodes[0].quantity).toBe(3)
  expect(nodes[0].row?.value).toBe("1k")
  expect(nodes[0].supplier_part_numbers).toEqual({ jlcpcb: ["C123"] })
  expect(
    convertBomRowsToCsv(
      await convertCircuitJsonToBomRows({ circuitJson: input }),
    ),
  ).toBe(csv)
})

test("CAD references suppress represented PCB rows without setting quantity from geometry count", async () => {
  const input = pcbCircuit()
  input.push(
    item("Resistors", {
      cad_component_ids: ["cad-r", "missing-geometry"],
      quantity: 4,
      supplier_part_numbers: { mouser: ["ALT"] },
    }),
  )
  const nodes = await convertCircuitJsonToAssemblyBom({ circuitJson: input })
  expect(nodes).toHaveLength(1)
  expect(nodes[0].quantity).toBe(4)
  expect(nodes[0].row?.designator).toBe("R1")
  expect(nodes[0].supplier_part_numbers).toEqual({ mouser: ["ALT"] })
})

test("multiple explicit uses of one source retain separate BOM identities", async () => {
  const input = [
    ...pcbCircuit(),
    item("left", { source_component_id: "r" }),
    item("right", { source_component_id: "r", quantity: 2 }),
  ]
  expect(
    (await convertCircuitJsonToAssemblyBom({ circuitJson: input })).map(
      (node) => [node.id, node.total_quantity],
    ),
  ).toEqual([
    ["bom:left", 1],
    ["bom:right", 2],
  ])
})

test("legacy PCB rows keep subcircuit grouping, identity and existing exclusions", async () => {
  const input = pcbCircuit()
  const legacy = await convertCircuitJsonToBomRows({ circuitJson: input })
  const identified = await convertCircuitJsonToBomRows({
    circuitJson: input,
    includeSourceIds: true,
  })
  expect(legacy[0]).not.toHaveProperty("source_component_id")
  expect(convertBomRowsToCsv(legacy)).toBe(convertBomRowsToCsv(identified))
  const [board] = await convertCircuitJsonToAssemblyBom({ circuitJson: input })
  expect(board.kind).toBe("subcircuit")
  expect(board.children.map((node) => node.name)).toEqual(["R1"])
  input.push({
    type: "source_component",
    ftype: "subassembly",
    source_component_id: "geometry-only",
    name: "Geometry only",
  })
  expect(await convertCircuitJsonToAssemblyBom({ circuitJson: input })).toEqual(
    [board],
  )
  const pcb = input.find((element) => element.type === "pcb_component")!
  if (pcb.type === "pcb_component") pcb.do_not_place = true
  expect(await convertCircuitJsonToAssemblyBom({ circuitJson: input })).toEqual(
    [],
  )
  // Explicit BOM intent remains authoritative even without a populated PCB row.
  input.push(item("Explicit", { source_component_id: "r" }))
  expect(
    (await convertCircuitJsonToAssemblyBom({ circuitJson: input }))[0].name,
  ).toBe("Explicit")
})

test("missing parents and component references leave explicit materials visible", async () => {
  const [orphan] = await convertCircuitJsonToAssemblyBom({
    circuitJson: [
      item("orphan", {
        parent_cad_assembly_bom_item_id: "missing",
        source_component_id: "missing-source",
        cad_component_ids: ["missing-cad"],
      }),
    ],
  })
  expect(orphan.total_quantity).toBe(1)
  expect(orphan.row).toBeUndefined()
})

test("malformed BOM graphs and overflowing quantities fail instead of hiding items", async () => {
  for (const input of [
    [
      item("a", { parent_cad_assembly_bom_item_id: "b" }),
      item("b", { parent_cad_assembly_bom_item_id: "a" }),
    ],
    [item("a", { parent_cad_assembly_bom_item_id: "a" })],
  ])
    await expect(
      convertCircuitJsonToAssemblyBom({ circuitJson: input }),
    ).rejects.toThrow("Cycle")
  await expect(
    convertCircuitJsonToAssemblyBom({ circuitJson: [item("a"), item("a")] }),
  ).rejects.toThrow("Duplicate")
  await expect(
    convertCircuitJsonToAssemblyBom({
      circuitJson: [item("a", { quantity: 0 })],
    }),
  ).rejects.toThrow("positive")
  await expect(
    convertCircuitJsonToAssemblyBom({
      circuitJson: [
        item("a", { quantity: Number.MAX_SAFE_INTEGER }),
        item("b", { parent_cad_assembly_bom_item_id: "a", quantity: 2 }),
      ],
    }),
  ).rejects.toThrow("safe integer")
  const input = pcbCircuit()
  const group = input[0]
  if (group.type === "source_group") group.parent_source_group_id = "board"
  await expect(
    convertCircuitJsonToAssemblyBom({ circuitJson: input }),
  ).rejects.toThrow("Cycle")
})

test("supplier identifiers are normalized without inventing associations with product URLs", async () => {
  const [node] = await convertCircuitJsonToAssemblyBom({
    circuitJson: [
      item("module", {
        supplier_part_numbers: { jlcpcb: ["", "  ", " C123 ", "C123"] },
        purchase_urls: [
          "https://amazon.com/dp/example",
          "https://other.example/product",
        ],
      }),
    ],
  })
  expect(node.supplier_part_numbers).toEqual({ jlcpcb: ["C123"] })
  expect(node.purchase_urls).toHaveLength(2)
})

test("an entry referencing multiple geometries covers all linked parts without borrowing one part's data", async () => {
  const input = pcbCircuit()
  const additional = input
    .filter(
      (element) =>
        element.type === "source_component" ||
        element.type === "pcb_component" ||
        element.type === "cad_component",
    )
    .map((element) => {
      if (element.type === "source_component")
        return { ...element, source_component_id: "r2", name: "R2" }
      if (element.type === "pcb_component")
        return {
          ...element,
          source_component_id: "r2",
          pcb_component_id: "pcb-r2",
        }
      if (element.type === "cad_component")
        return {
          ...element,
          source_component_id: "r2",
          pcb_component_id: "pcb-r2",
          cad_component_id: "cad-r2",
        }
      return element
    })
  input.push(
    ...additional,
    item("Kit", { cad_component_ids: ["cad-r", "cad-r2"], quantity: 1 }),
  )
  const nodes = await convertCircuitJsonToAssemblyBom({ circuitJson: input })
  expect(nodes).toHaveLength(1)
  expect(nodes[0].total_quantity).toBe(1)
  expect(nodes[0].row).toBeUndefined()
  expect(nodes[0].supplier_part_numbers).toBeUndefined()
})

test("explicit empty supplier identifiers clear the linked component's default", async () => {
  const [node] = await convertCircuitJsonToAssemblyBom({
    circuitJson: [
      ...pcbCircuit(),
      item("User supplied", {
        source_component_id: "r",
        supplier_part_numbers: {},
      }),
    ],
  })
  expect(node.supplier_part_numbers).toEqual({})
})
