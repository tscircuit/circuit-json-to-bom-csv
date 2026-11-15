import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import Papa from "papaparse"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"

const circuitJson: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "source_R1",
    name: "R1",
    ftype: "simple_resistor",
    resistance: 1000,
    supplier_part_numbers: { jlcpcb: ["C17513"] },
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_R1",
    source_component_id: "source_R1",
    center: { x: 0, y: 0 },
    width: 2,
    height: 1,
    rotation: 0,
    layer: "top",
  },
  {
    type: "cad_component",
    cad_component_id: "cad_R1",
    pcb_component_id: "pcb_R1",
    footprinter_string: "  0805  ",
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  },
]

test.each([undefined, "", "   ", "\t", "\r\n"])(
  "uses the CAD footprint for blank resolved footprint %s",
  async (footprint) => {
    const rows = await convertCircuitJsonToBomRows({
      circuitJson,
      resolvePart: async () => ({ footprint }),
    })
    expect(rows[0].footprint).toBe("0805")
    const parsed = Papa.parse<Record<string, string>>(
      convertBomRowsToCsv(rows),
      { header: true },
    )
    expect(parsed.errors).toEqual([])
    expect(parsed.data[0]).toMatchObject({
      Footprint: "0805",
      "JLCPCB Part #": "C17513",
    })
  },
)

test("retains a nonblank resolved footprint's precedence", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson,
    resolvePart: async () => ({ footprint: "  0603  " }),
  })
  expect(rows[0].footprint).toBe("0603")
})

test("uses the supplier fallback if neither footprint is populated", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: circuitJson.filter(
      (element) => element.type !== "cad_component",
    ),
    resolvePart: async () => ({ footprint: "   " }),
  })
  expect(rows[0].footprint).toBe("C17513")
})
