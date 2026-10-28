import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"

const crystalCircuit: AnyCircuitElement[] = [
  {
    type: "pcb_component",
    pcb_component_id: "pc_1",
    source_component_id: "sc_1",
    width: 1,
    height: 0.5,
    rotation: 0,
    center: { x: 0, y: 0 },
    layer: "top",
  },
  {
    type: "source_component",
    source_component_id: "sc_1",
    name: "Y1",
    ftype: "simple_crystal",
    frequency: 32768,
  },
]

test.failing("exports crystal frequency into BOM rows and CSV", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: crystalCircuit,
  })

  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({
    designator: "Y1",
    value: "32.8k",
    comment: "32.8k",
  })
  expect(convertBomRowsToCsv(rows)).toContain('"Y1","32.8k","32.8k"')
})

test.failing("preserves resolved crystal MPN and supplier number", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: crystalCircuit,
    resolvePart: async () => ({
      manufacturer_mpn_pairs: [{ manufacturer: "Example", mpn: "XTAL-32768" }],
      supplier_part_number_columns: { "JLCPCB Part #": "C12345" },
    }),
  })

  expect(rows[0]).toMatchObject({
    value: "32.8k",
    comment: "XTAL-32768",
    supplier_part_number_columns: { "JLCPCB Part #": "C12345" },
  })
  expect(convertBomRowsToCsv(rows)).toContain(
    '"Y1","XTAL-32768","32.8k","C12345","C12345"',
  )
})
