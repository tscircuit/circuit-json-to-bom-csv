import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbComponent } from "circuit-json"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"

type ResolvePart = NonNullable<
  Parameters<typeof convertCircuitJsonToBomRows>[0]["resolvePart"]
>
type ResolvedPart = Awaited<ReturnType<ResolvePart>>

const pcbComponent: PcbComponent = {
  type: "pcb_component",
  pcb_component_id: "pcb_component_1",
  source_component_id: "source_component_1",
  center: { x: 0, y: 0 },
  width: 8,
  height: 20,
  rotation: 0,
  layer: "top",
}

test("exports a chip's source MPN without a part resolver", async () => {
  const circuitJson: AnyCircuitElement[] = [
    pcbComponent,
    {
      type: "source_component",
      source_component_id: "source_component_1",
      name: "U1",
      ftype: "simple_chip",
      manufacturer_part_number: "  MCP6004-I/P  ",
    },
  ]
  const rows = await convertCircuitJsonToBomRows({ circuitJson })
  expect(rows).toEqual([
    { designator: "U1", comment: "MCP6004-I/P", value: "", footprint: "" },
  ])
  expect(convertBomRowsToCsv(rows)).toBe(
    '"Designator","Comment","Value","Footprint"\r\n"U1","MCP6004-I/P",""," "',
  )
})

test("resolver MPN takes precedence; missing or blank resolver MPN falls back to source", async () => {
  const circuitJson: AnyCircuitElement[] = [
    pcbComponent,
    {
      type: "source_component",
      source_component_id: "source_component_1",
      name: "U1",
      ftype: "simple_chip",
      manufacturer_part_number: "MCP6004-I/P",
    },
  ]
  for (const [resolvedPart, expectedComment] of [
    [null, "MCP6004-I/P"],
    [{}, "MCP6004-I/P"],
    [{ manufacturer_mpn_pairs: [] }, "MCP6004-I/P"],
    [
      { manufacturer_mpn_pairs: [{ manufacturer: "Microchip", mpn: "  " }] },
      "MCP6004-I/P",
    ],
    [
      {
        manufacturer_mpn_pairs: [
          { manufacturer: "Microchip", mpn: " " },
          { manufacturer: "Microchip", mpn: " MCP6004-E/P " },
        ],
      },
      "MCP6004-E/P",
    ],
  ] satisfies Array<[ResolvedPart, string]>) {
    const rows = await convertCircuitJsonToBomRows({
      circuitJson,
      resolvePart: async () => resolvedPart,
    })
    expect(rows[0].comment).toBe(expectedComment)
    expect(convertBomRowsToCsv(rows)).toBe(
      `"Designator","Comment","Value","Footprint"\r\n"U1","${expectedComment}",""," "`,
    )
  }
})

test("source MPN preserves passive value and supplier number and is escaped in CSV", async () => {
  const circuitJson: AnyCircuitElement[] = [
    pcbComponent,
    {
      type: "source_component",
      source_component_id: "source_component_1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
      manufacturer_part_number: ' PART,"A" ',
      supplier_part_numbers: { jlcpcb: ["C17513"] },
    },
  ]
  const rows = await convertCircuitJsonToBomRows({ circuitJson })
  expect(rows[0]).toMatchObject({
    comment: 'PART,"A"',
    value: "1k",
    supplier_part_number_columns: { "JLCPCB Part #": "C17513" },
  })
  expect(convertBomRowsToCsv(rows)).toBe(
    '"Designator","Comment","Value","Footprint","JLCPCB Part #"\r\n"R1","PART,""A""","1k","C17513","C17513"',
  )
})

test("absent, empty and whitespace-only source MPN retain the passive value fallback", async () => {
  for (const manufacturer_part_number of [undefined, "", " \t "]) {
    const circuitJson: AnyCircuitElement[] = [
      pcbComponent,
      {
        type: "source_component",
        source_component_id: "source_component_1",
        name: "R1",
        ftype: "simple_resistor",
        resistance: 1000,
        manufacturer_part_number,
      },
    ]
    const rows = await convertCircuitJsonToBomRows({ circuitJson })
    expect(rows[0]).toMatchObject({ comment: "1k", value: "1k" })
  }
})
