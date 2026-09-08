import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"

const makeCircuit = (supplierPartNumbers: {
  jlcpcb?: string[]
  lcsc?: string[]
}): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source_R1",
    name: "R1",
    ftype: "simple_resistor",
    resistance: 1000,
    supplier_part_numbers: supplierPartNumbers,
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_R1",
    source_component_id: "source_R1",
    width: 2,
    height: 1,
    center: { x: 0, y: 0 },
    rotation: 0,
    layer: "top",
  },
]

for (const lcsc of [[], [""], ["   "]] as string[][]) {
  test(`empty LCSC entry ${JSON.stringify(lcsc)} preserves the JLCPCB part number`, async () => {
    const rows = await convertCircuitJsonToBomRows({
      circuitJson: makeCircuit({ jlcpcb: [" C12345 "], lcsc }),
    })
    expect(rows[0]?.supplier_part_number_columns).toEqual({
      "JLCPCB Part #": "C12345",
    })
    expect(convertBomRowsToCsv(rows)).toBe(
      '"Designator","Comment","Value","Footprint","JLCPCB Part #"\r\n"R1","1k","1k","C12345","C12345"',
    )
  })
}

test("a populated LCSC entry retains precedence over JLCPCB", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: makeCircuit({ jlcpcb: ["C12345"], lcsc: [" C67890 "] }),
  })
  expect(rows[0]?.supplier_part_number_columns).toEqual({
    "JLCPCB Part #": "C67890",
  })
})

test("LCSC-only parts still export their supplier number", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: makeCircuit({ lcsc: ["C67890"] }),
  })
  expect(rows[0]?.supplier_part_number_columns).toEqual({
    "JLCPCB Part #": "C67890",
  })
})

test("resolved supplier numbers still override source supplier numbers", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: makeCircuit({ jlcpcb: ["C12345"], lcsc: ["C67890"] }),
    resolvePart: async () => ({
      supplier_part_number_columns: { "JLCPCB Part #": "C99999" },
    }),
  })
  expect(rows[0]?.supplier_part_number_columns).toEqual({
    "JLCPCB Part #": "C99999",
  })
})
