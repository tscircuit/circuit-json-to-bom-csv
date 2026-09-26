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

test("resolver custom columns reach BOM rows and CSV without mutating input", async () => {
  const extra_columns = Object.freeze({
    " Tolerance ": " ±5% ",
    "Assembly notes": ' Use "precision", low-noise part\nCheck polarity ',
  })
  const rows = await convertCircuitJsonToBomRows({
    circuitJson,
    resolvePart: async () => ({ footprint: "0805", extra_columns }),
  })

  expect(rows[0]?.extra_columns).toEqual({
    Tolerance: "±5%",
    "Assembly notes": 'Use "precision", low-noise part\nCheck polarity',
  })
  expect(extra_columns[" Tolerance "]).toBe(" ±5% ")
  const parsed = Papa.parse<Record<string, string>>(convertBomRowsToCsv(rows), {
    header: true,
  })
  expect(parsed.errors).toEqual([])
  expect(parsed.data).toEqual([
    {
      Designator: "R1",
      Comment: "1k",
      Value: "1k",
      Footprint: "0805",
      Tolerance: "+/-5%",
      "Assembly notes": 'Use "precision", low-noise part\nCheck polarity',
    },
  ])
})

test("direct BOM rows include the union of custom columns with aligned cells", () => {
  const parsed = Papa.parse<Record<string, string>>(
    convertBomRowsToCsv([
      {
        designator: "R1",
        comment: "1k",
        value: "1k",
        footprint: "0805",
        extra_columns: { " Tolerance ": " ±1% " },
      },
      {
        designator: "R2",
        comment: "2k",
        value: "2k",
        footprint: "0603",
        extra_columns: { "Assembly notes": 'A, "quoted" note\nSecond line' },
      },
      { designator: "R3", comment: "3k", value: "3k", footprint: "0402" },
    ]),
    { header: true },
  )

  expect(parsed.errors).toEqual([])
  expect(parsed.meta.fields).toEqual([
    "Designator",
    "Comment",
    "Value",
    "Footprint",
    "Tolerance",
    "Assembly notes",
  ])
  expect(
    parsed.data.map((row) => [row.Tolerance, row["Assembly notes"]]),
  ).toEqual([
    ["+/-1%", ""],
    ["", 'A, "quoted" note\nSecond line'],
    ["", ""],
  ])
})

test("canonical BOM and supplier headers take precedence over normalized custom headers", () => {
  const parsed = Papa.parse<Record<string, string>>(
    convertBomRowsToCsv([
      {
        designator: "R1",
        comment: "1k",
        value: "1k",
        footprint: "0805",
        supplier_part_number_columns: { "JLCPCB Part #": "C17513" },
        extra_columns: {
          Designator: "wrong component",
          " Comment ": "wrong comment",
          Value: "wrong resistance",
          Footprint: "wrong package",
          "JLCPCB Part #": "wrong supplier",
          " JLCPCB Part # ": "another wrong supplier",
          Notes: "Keep this custom column",
        },
      },
    ]),
    { header: true },
  )

  expect(parsed.errors).toEqual([])
  expect(parsed.data).toEqual([
    {
      Designator: "R1",
      Comment: "1k",
      Value: "1k",
      Footprint: "0805",
      "JLCPCB Part #": "C17513",
      Notes: "Keep this custom column",
    },
  ])
})

test("omitted custom columns preserve the existing CSV format", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson,
    resolvePart: async () => ({ footprint: "0805" }),
  })
  expect(Object.hasOwn(rows[0] ?? {}, "extra_columns")).toBe(false)
  expect(convertBomRowsToCsv(rows)).toBe(
    '"Designator","Comment","Value","Footprint"\r\n"R1","1k","1k","0805"',
  )
})
