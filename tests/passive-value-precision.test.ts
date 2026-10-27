import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import Papa from "papaparse"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"

const cases = [
  ["simple_resistor", "resistance", 1001, "1.001k"],
  ["simple_resistor", "resistance", 4999, "4.999k"],
  ["simple_resistor", "resistance", 0.1001, "100.1m"],
  ["simple_resistor", "resistance", 999.9, "999.9"],
  ["simple_capacitor", "capacitance", 1.234e-6, "1.234µ"],
  ["simple_inductor", "inductance", 1.234e-3, "1.234m"],
  ["simple_resistor", "resistance", 0, "0"],
  ["simple_resistor", "resistance", 1000, "1k"],
  ["simple_capacitor", "capacitance", 4.7e-6, "4.7µ"],
] as const

const makeCircuit = (
  ftype: (typeof cases)[number][0],
  property: (typeof cases)[number][1],
  value: number,
): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source1",
    name: "P1",
    ftype,
    [property]: value,
  } as AnyCircuitElement,
  {
    type: "pcb_component",
    pcb_component_id: "pcb1",
    source_component_id: "source1",
    center: { x: 0, y: 0 },
    width: 1,
    height: 0.5,
    rotation: 0,
    layer: "top",
  },
]

test.each(cases)(
  "preserves %s %s=%f as %s in rows and CSV",
  async (ftype, property, value, expected) => {
    const rows = await convertCircuitJsonToBomRows({
      circuitJson: makeCircuit(ftype, property, value),
    })

    expect(rows[0]).toMatchObject({ value: expected, comment: expected })
    const parsed = Papa.parse<Record<string, string>>(
      convertBomRowsToCsv(rows),
      { header: true },
    )
    expect(parsed.errors).toEqual([])
    expect(parsed.data[0]).toMatchObject({
      Value: expected.replace("µ", "u"),
      Comment: expected.replace("µ", "u"),
    })
  },
)

test("keeps the precise value alongside resolved manufacturer and supplier data", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: makeCircuit("simple_resistor", "resistance", 1001),
    resolvePart: async () => ({
      manufacturer_mpn_pairs: [{ manufacturer: "Example", mpn: "R-1001" }],
      supplier_part_number_columns: { "JLCPCB Part #": "C12345" },
      footprint: "0805",
    }),
  })

  expect(rows[0]).toMatchObject({
    value: "1.001k",
    comment: "R-1001",
    footprint: "0805",
    supplier_part_number_columns: { "JLCPCB Part #": "C12345" },
  })
  expect(convertBomRowsToCsv(rows)).toContain(
    '"P1","R-1001","1.001k","0805","C12345"',
  )
})
