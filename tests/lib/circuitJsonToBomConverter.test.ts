import { expect, test } from "bun:test"
import {
  convertCircuitJsonToBomRows,
  convertBomRowsToCsv,
} from "../../lib/circuitJsonToBomConverter"
import type {
  AnyCircuitElement,
  PcbComponent,
  SourceComponentBase,
} from "circuit-json"

test("should convert circuit JSON to BOM rows", async () => {
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
    } as SourceComponentBase,
  ] as AnyCircuitElement[]

  const bomRows = await convertCircuitJsonToBomRows({ circuitJson })

  expect(bomRows).toHaveLength(1)
  expect(bomRows[0]).toEqual({
    designator: "R1",
    comment: "1k",
    value: "1k",
    footprint: "",
  })
})

test("should convert BOM rows to CSV", () => {
  const bomRows = [
    {
      designator: "R1",
      comment: "1k",
      value: "1k",
      footprint: "0805",
      supplier_part_number_columns: {
        "JLCPCB Part #": "C17513",
      },
    },
  ]

  const csv = convertBomRowsToCsv(bomRows)

  expect(csv).toBe(
    "Designator,Comment,Value,Footprint,JLCPCB Part #\r\nR1,1k,1k,0805,C17513",
  )
})
