import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"

// BOM-relevant F1 records from gokul/macro-six-usbc v0.1.6 (MIT).
// https://tscircuit.com/gokul/macro-six-usbc
// Display aliases and routing/group-placement fields are omitted.
// Numeric ratings, part identity, and footprint dimensions are unchanged.
const macroSixFuse: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "source_component_6",
    name: "F1",
    ftype: "simple_fuse",
    manufacturer_part_number: "nSMD050",
    supplier_part_numbers: { jlcpcb: ["C69688"] },
    current_rating_amps: 0.5,
    voltage_rating_volts: 6,
    source_group_id: "source_group_0",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_6",
    source_component_id: "source_component_6",
    center: { x: -20, y: 27 },
    width: 4.080103600000001,
    height: 1.7279874000000035,
    layer: "top",
    rotation: 0,
    do_not_place: false,
  },
]

test("repro: F1 BOM Value falls back to supplier number despite available fuse ratings", async () => {
  const fuse = macroSixFuse.find(
    (element) => element.type === "source_component",
  )
  expect(fuse).toMatchObject({
    current_rating_amps: 0.5,
    voltage_rating_volts: 6,
  })

  const rows = await convertCircuitJsonToBomRows({ circuitJson: macroSixFuse })
  expect(rows).toHaveLength(1)
  // Record the current omission, not a desired long-term Value convention.
  // The manufacturer and supplier identifiers still select the correct part.
  expect(rows[0]).toMatchObject({
    designator: "F1",
    comment: "nSMD050",
    value: "C69688",
    supplier_part_number_columns: { "JLCPCB Part #": "C69688" },
  })
  expect(convertBomRowsToCsv(rows)).toMatchInlineSnapshot(`
    "\"Designator\",\"Comment\",\"Value\",\"Footprint\",\"JLCPCB Part #\"
    \"F1\",\"nSMD050\",\"C69688\",\"C69688\",\"C69688\""
  `)
})
