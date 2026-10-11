import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import Papa from "papaparse"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"
import keyboard from "./assets/nine-key-keyboard.json"

const supplierCases = [
  { label: "omitted", columns: undefined, expected: "C5184526" },
  {
    label: "empty number",
    columns: { "JLCPCB Part #": "" },
    expected: "C5184526",
  },
  {
    label: "whitespace",
    columns: { "JLCPCB Part #": " \t\r\n " },
    expected: "C5184526",
  },
  {
    label: "resolved override",
    columns: { "JLCPCB Part #": " C99999 " },
    expected: "C99999",
  },
]

for (const { label, columns, expected } of supplierCases) {
  test(`keyboard K1 preserves its source supplier when resolver returns ${label}`, async () => {
    const circuitJson = structuredClone(keyboard) as AnyCircuitElement[]
    const original = structuredClone(circuitJson)
    const rows = await convertCircuitJsonToBomRows({
      circuitJson,
      resolvePart: async ({ source_component }) =>
        source_component.name === "K1"
          ? { supplier_part_number_columns: columns, footprint: "0402" }
          : null,
    })
    const row = rows.find((row) => row.designator === "K1")!
    expect(row.supplier_part_number_columns?.["JLCPCB Part #"]).toBe(expected)
    expect(row.footprint).toBe("0402")
    const parsed = Papa.parse<Record<string, string>>(
      convertBomRowsToCsv(rows),
      {
        header: true,
      },
    )
    expect(parsed.errors).toEqual([])
    expect(
      parsed.data.find((row) => row.Designator === "K1")?.["JLCPCB Part #"],
    ).toBe(expected)
    expect(
      rows.find((row) => row.designator === "D1")
        ?.supplier_part_number_columns?.["JLCPCB Part #"],
    ).toBe("C57759")
    expect(circuitJson).toEqual(original)
  })
}

test("resolver null retains the original board supplier numbers", async () => {
  const circuitJson = structuredClone(keyboard) as AnyCircuitElement[]
  const originalRows = await convertCircuitJsonToBomRows({ circuitJson })
  const rows = await convertCircuitJsonToBomRows({
    circuitJson,
    resolvePart: async () => null,
  })
  expect(rows).toEqual(originalRows)
})

test("an empty resolved supplier number also falls back to source LCSC", async () => {
  const circuitJson = structuredClone(keyboard) as AnyCircuitElement[]
  const source = circuitJson.find(
    (e) => e.type === "source_component" && e.name === "K1",
  )!
  if (source.type !== "source_component") throw new Error("K1 source missing")
  source.supplier_part_numbers = { lcsc: ["C5184526"] }
  const rows = await convertCircuitJsonToBomRows({
    circuitJson,
    resolvePart: async () => ({
      supplier_part_number_columns: { "JLCPCB Part #": "" },
    }),
  })
  expect(
    rows.find((row) => row.designator === "K1")?.supplier_part_number_columns?.[
      "JLCPCB Part #"
    ],
  ).toBe("C5184526")
})

test("empty source and resolver do not invent a supplier number", async () => {
  const circuitJson = structuredClone(keyboard) as AnyCircuitElement[]
  const source = circuitJson.find(
    (e) => e.type === "source_component" && e.name === "K1",
  )!
  if (source.type !== "source_component") throw new Error("K1 source missing")
  source.supplier_part_numbers = {}
  const rows = await convertCircuitJsonToBomRows({
    circuitJson,
    resolvePart: async () => ({
      supplier_part_number_columns: { "JLCPCB Part #": " " },
    }),
  })
  expect(
    rows.find((row) => row.designator === "K1")?.supplier_part_number_columns?.[
      "JLCPCB Part #"
    ],
  ).toBe("")
})
