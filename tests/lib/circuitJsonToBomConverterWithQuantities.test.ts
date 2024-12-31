import { expect, test } from "bun:test"
import {
  convertCircuitJsonToBomRowsWithQuantities,
  convertBomRowsToCsvsWithQuantities,
} from "../../lib/circuitJsonToBomConverterWithQuantities"
import type {
  AnyCircuitElement,
  PcbComponent,
  SourceComponentBase,
} from "circuit-json"

declare module "bun:test" {
  interface Matchers<T = unknown> {
    toMatchInlineSnapshot(snapshot?: string | null): Promise<MatcherResult>
  }
}

// Test 2: Convert circuit JSON to BOM rows and handle quantities
test("should convert circuit JSON to BOM rows and handle quantities", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_1",
      source_component_id: "source_component_1",
    } as PcbComponent,
    {
      type: "source_component",
      source_component_id: "source_component_1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
      supplier_part_numbers: {
        jlcpcb: ["C17513"],
      },
    } as SourceComponentBase,
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_2",
      source_component_id: "source_component_2",
    } as PcbComponent,
    {
      type: "source_component",
      source_component_id: "source_component_2",
      name: "R2",
      ftype: "simple_resistor",
      resistance: 1000,
      supplier_part_numbers: {
        jlcpcb: ["C17513"],
      },
    } as SourceComponentBase,
  ] as AnyCircuitElement[]

  const supplierPartNumbers = {
    jlcpcb: ["C17513"],
  }

  const bomRows = await convertCircuitJsonToBomRowsWithQuantities({
    circuitJson,
    supplier_part_numbers: supplierPartNumbers,
  })

  expect(bomRows).toMatchInlineSnapshot(`
[
  {
    "designators": "R1, R2",
    "comment": "1k",
    "footprint": "",
    "quantity": 2,
    "supplier_part_number_columns": {
      "JLCPCB Part #": "C17513",
    },
      "value": "1k",
  },
]
`)
})

// Test 3: Convert BOM rows to CSV including quantity
test("should convert BOM rows to CSV including quantity", () => {
  const bomRows = [
    {
      designators: "R1, R2",
      comment: "1k",
      value: "1k",
      footprint: "0805",
      quantity: 2,
      supplier_part_number_columns: {
        "JLCPCB Part #": "C17513",
      },
    },
  ]

  const csv = convertBomRowsToCsvsWithQuantities(bomRows)

  // Normalize line endings to \n
  const normalizedCsv = csv.replace(/\r\n/g, "\n")

  expect(normalizedCsv).toMatchInlineSnapshot(`
    "Designators,Comment,Value,Footprint,Quantity,JLCPCB Part #\n\"R1, R2\",1k,1k,0805,2,C17513"
  `)
})
