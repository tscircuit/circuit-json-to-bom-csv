import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToBomRows } from "../lib"

test("keeps the first source and CAD record when IDs are repeated", async () => {
  const circuitJson = [
    {
      type: "pcb_component",
      pcb_component_id: "pcb_1",
      source_component_id: "source_1",
    },
    {
      type: "source_component",
      source_component_id: "source_1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    },
    {
      type: "source_component",
      source_component_id: "source_1",
      name: "R2",
      ftype: "simple_resistor",
      resistance: 2000,
    },
    {
      type: "cad_component",
      cad_component_id: "cad_1",
      pcb_component_id: "pcb_1",
      footprinter_string: "0805",
    },
    {
      type: "cad_component",
      cad_component_id: "cad_2",
      pcb_component_id: "pcb_1",
      footprinter_string: "0603",
    },
  ] as AnyCircuitElement[]

  const rows = await convertCircuitJsonToBomRows({ circuitJson })

  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({
    designator: "R1",
    value: "1k",
    footprint: "0805",
  })
})

test("resolves out-of-order records and skips PCB components without a source", async () => {
  const circuitJson = [
    {
      type: "pcb_component",
      pcb_component_id: "pcb_2",
      source_component_id: "source_2",
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_missing",
      source_component_id: "source_missing",
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_1",
      source_component_id: "source_1",
    },
    {
      type: "source_component",
      source_component_id: "source_1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    },
    {
      type: "source_component",
      source_component_id: "source_2",
      name: "R2",
      ftype: "simple_resistor",
      resistance: 2000,
    },
    {
      type: "cad_component",
      cad_component_id: "cad_2",
      pcb_component_id: "pcb_2",
      footprinter_string: "0603",
    },
  ] as AnyCircuitElement[]
  const resolvedNames: string[] = []

  const rows = await convertCircuitJsonToBomRows({
    circuitJson,
    resolvePart: async ({ source_component }) => {
      resolvedNames.push(source_component.name!)
      return null
    },
  })

  expect(resolvedNames).toEqual(["R2", "R1"])
  expect(
    rows.map(({ designator, value, footprint }) => ({
      designator,
      value,
      footprint,
    })),
  ).toEqual([
    { designator: "R2", value: "2k", footprint: "0603" },
    { designator: "R1", value: "1k", footprint: "" },
  ])
})
