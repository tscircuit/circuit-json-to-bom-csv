import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import Papa from "papaparse"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"

const circuit = (inductance: number, supplier = false): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source_L1",
    name: "L1",
    ftype: "simple_inductor",
    inductance,
    ...(supplier ? { supplier_part_numbers: { jlcpcb: ["C12345"] } } : {}),
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_L1",
    source_component_id: "source_L1",
    center: { x: 0, y: 0 },
    width: 2,
    height: 1,
    rotation: 0,
    layer: "top",
  },
]

test.each([
  [10e-6, "10µ", "10u"],
  [1e-3, "1m", "1m"],
  [1, "1", "1"],
] as const)(
  "exports inductance %s as %s in rows and CSV",
  async (inductance, value, csvValue) => {
    const rows = await convertCircuitJsonToBomRows({
      circuitJson: circuit(inductance),
    })
    expect(rows[0]).toMatchObject({ designator: "L1", value, comment: value })
    const parsed = Papa.parse<Record<string, string>>(
      convertBomRowsToCsv(rows),
      { header: true },
    )
    expect(parsed.errors).toEqual([])
    expect(parsed.data[0]).toMatchObject({
      Designator: "L1",
      Value: csvValue,
      Comment: csvValue,
    })
  },
)

test("keeps the inductance in Value when a supplier part number exists", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: circuit(10e-6, true),
  })
  expect(rows[0]).toMatchObject({
    value: "10µ",
    comment: "10µ",
    supplier_part_number_columns: { "JLCPCB Part #": "C12345" },
  })
  const parsed = Papa.parse<Record<string, string>>(convertBomRowsToCsv(rows), {
    header: true,
  })
  expect(parsed.data[0]).toMatchObject({
    Value: "10u",
    "JLCPCB Part #": "C12345",
  })
})

test("preserves a resolved manufacturer comment alongside the inductance", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: circuit(10e-6),
    resolvePart: async () => ({
      manufacturer_mpn_pairs: [{ manufacturer: "Example", mpn: "IND-10U" }],
    }),
  })
  expect(rows[0]).toMatchObject({ value: "10µ", comment: "IND-10U" })
})
