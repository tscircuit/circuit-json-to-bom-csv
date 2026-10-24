import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"

const inductorCircuit = (supplierPartNumbers?: {
  jlcpcb: string[]
}): AnyCircuitElement[] => [
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
    name: "L1",
    ftype: "simple_inductor",
    inductance: 10e-6,
    ...(supplierPartNumbers
      ? { supplier_part_numbers: supplierPartNumbers }
      : {}),
  },
]

test("extracts SI-formatted inductance into the Value column", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: inductorCircuit(),
  })

  expect(rows).toHaveLength(1)
  expect(rows[0].designator).toBe("L1")
  expect(rows[0].value).toBe("10µ")
  expect(rows[0].comment).toBe("10µ")

  const csv = convertBomRowsToCsv(rows)
  expect(csv).toContain('"L1","10u","10u"')
})

test("keeps inductance in Value when a supplier part number exists", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: inductorCircuit({ jlcpcb: ["C12345"] }),
  })

  expect(rows[0]).toMatchObject({
    designator: "L1",
    value: "10µ",
    comment: "10µ",
    supplier_part_number_columns: { "JLCPCB Part #": "C12345" },
  })
  expect(convertBomRowsToCsv(rows)).toContain(
    '"L1","10u","10u","C12345","C12345"',
  )
})

test("preserves a resolved manufacturer comment", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: inductorCircuit(),
    resolvePart: async () => ({
      manufacturer_mpn_pairs: [{ manufacturer: "Example", mpn: "IND-10U" }],
    }),
  })

  expect(rows[0]).toMatchObject({ value: "10µ", comment: "IND-10U" })
})
