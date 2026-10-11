import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"

test("resolver comment survives BOM row and CSV export", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "source_R1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
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
  ]
  const rows = await convertCircuitJsonToBomRows({
    circuitJson,
    resolvePart: async () => ({
      comment: "1k 0.1% precision resistor",
      footprint: "0805",
    }),
  })
  const csv = convertBomRowsToCsv(rows)
  expect(rows[0]?.comment).toBe("1k 0.1% precision resistor")
  expect(csv).toContain("1k 0.1% precision resistor")
  for (const comment of [undefined, "", "   "]) {
    const fallback = await convertCircuitJsonToBomRows({
      circuitJson,
      resolvePart: async () => ({
        comment,
        manufacturer_mpn_pairs: [
          { manufacturer: "Example", mpn: "R-PRECISION" },
        ],
      }),
    })
    expect(fallback[0]?.comment).toBe("R-PRECISION")
  }
  const explicit = await convertCircuitJsonToBomRows({
    circuitJson,
    resolvePart: async () => ({
      comment: "  precision resistor  ",
      manufacturer_mpn_pairs: [{ manufacturer: "Example", mpn: "R-PRECISION" }],
    }),
  })
  expect(explicit[0]?.comment).toBe("precision resistor")
  expect(explicit[0]?.value).toBe("1k")
})
