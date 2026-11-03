import { expect, test } from "bun:test"
import type { AnyCircuitElement, SourceSubassembly } from "circuit-json"
import {
  convertCircuitJsonToAssemblyBom,
  convertCircuitJsonToBomRows,
  convertBomRowsToCsv,
} from "../lib"

const part = (
  name: string,
  extra: Partial<SourceSubassembly> = {},
): SourceSubassembly => ({
  type: "source_component",
  ftype: "subassembly",
  source_component_id: name,
  name,
  ...extra,
})

test("physical assemblies preserve non-PCB purchasing links and multiply quantities", async () => {
  const input = [
    part("screw", {
      parent_source_component_id: "housing",
      bom_quantity: 4,
      bom_sources: [
        {
          supplier_name: "amazon",
          url: "https://amazon.com/dp/example",
          pack_quantity: 100,
        },
      ],
    }),
    part("housing", { bom_quantity: 2, bom_assembly_mode: "build" }),
  ]
  const before = JSON.stringify(input)
  const [housing] = await convertCircuitJsonToAssemblyBom({
    circuitJson: input,
  })
  expect(housing.name).toBe("housing")
  expect(housing.total_quantity).toBe(2)
  expect(housing.children[0].total_quantity).toBe(8)
  expect(housing.children[0].sources[0].url).toBe(
    "https://amazon.com/dp/example",
  )
  expect(JSON.stringify(input)).toBe(before)
  expect(await convertCircuitJsonToBomRows({ circuitJson: input })).toEqual([])
})

test("purchased modules retain inspectable children without double counting", async () => {
  const [module] = await convertCircuitJsonToAssemblyBom({
    circuitJson: [
      part("module", { bom_assembly_mode: "buy" }),
      part("chip", { parent_source_component_id: "module" }),
      part("die", { parent_source_component_id: "chip" }),
    ],
  })
  expect(module.included_in_purchase).toBe(true)
  expect(module.children[0].included_in_purchase).toBe(false)
  expect(module.children[0].children[0].included_in_purchase).toBe(false)
})

test("subcircuits group PCB rows by identity and preserve legacy CSV output", async () => {
  const input: AnyCircuitElement[] = [
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
      supplier_part_numbers: { lcsc: ["C123"] },
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
  ]
  const legacy = await convertCircuitJsonToBomRows({ circuitJson: input })
  const identified = await convertCircuitJsonToBomRows({
    circuitJson: input,
    includeSourceIds: true,
  })
  expect(legacy[0]).not.toHaveProperty("source_component_id")
  expect(convertBomRowsToCsv(legacy)).toBe(convertBomRowsToCsv(identified))
  const [board] = await convertCircuitJsonToAssemblyBom({ circuitJson: input })
  expect(board.children.map((n) => n.name)).toEqual(["R1"])
  expect(board.children[0].row?.value).toBe("1k")
  expect(board.children[0].sources).toEqual([
    { supplier_name: "lcsc", supplier_part_number: "C123" },
  ])
  input.push(
    {
      ...input[3],
      pcb_component_id: "pcb-dnp",
      source_component_id: "dnp",
      do_not_place: true,
    } as AnyCircuitElement,
    part("dnp", {
      bom_sources: [{ supplier_name: "store", supplier_part_number: "DNP" }],
    }),
  )
  expect(
    (await convertCircuitJsonToAssemblyBom({ circuitJson: input })).length,
  ).toBe(1)
})

test("missing parents remain visible and malformed ancestry fails clearly", async () => {
  const [orphan] = await convertCircuitJsonToAssemblyBom({
    circuitJson: [part("orphan", { parent_source_component_id: "missing" })],
  })
  expect(orphan.name).toBe("orphan")
  await expect(
    convertCircuitJsonToAssemblyBom({
      circuitJson: [
        part("a", { parent_source_component_id: "b" }),
        part("b", { parent_source_component_id: "a" }),
      ],
    }),
  ).rejects.toThrow("Cycle")
  await expect(
    convertCircuitJsonToAssemblyBom({ circuitJson: [part("a"), part("a")] }),
  ).rejects.toThrow("Duplicate")
  await expect(
    convertCircuitJsonToAssemblyBom({
      circuitJson: [part("a", { bom_quantity: 0 })],
    }),
  ).rejects.toThrow("positive")
  await expect(
    convertCircuitJsonToAssemblyBom({
      circuitJson: [
        {
          type: "source_group",
          source_group_id: "g",
          parent_source_group_id: "g",
          is_subcircuit: true,
        },
        part("a", { source_group_id: "g" }),
      ],
    }),
  ).rejects.toThrow("Cycle")
})
