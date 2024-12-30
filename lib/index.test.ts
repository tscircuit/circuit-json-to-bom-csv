import { expect, test, describe } from "bun:test"
import { convertCircuitJsonToBomRows, convertBomRowsToCsv } from "./index"
import type {
  AnyCircuitElement,
  PcbComponent,
  SourceComponentBase,
} from "circuit-json"

describe("convertCircuitJsonToBomRows", () => {
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
    };

    const bomRows = await convertCircuitJsonToBomRows({ circuitJson, supplier_part_numbers: supplierPartNumbers })

    expect(bomRows).toHaveLength(1)
    expect(bomRows[0]).toEqual({
      designator: "R1, R2",
      comment: "1k",
      value: "1k",
      footprint: "",
      quantity: 2,
      supplier_part_number_columns: {
        "JLCPCB Part #": "C17513",
      },
    })
  })
})

describe("convertBomRowsToCsv", () => {
  test("should convert BOM rows to CSV including quantity", () => {
    const bomRows = [
      {
        designator: "R1, R2",
        comment: "1k",
        value: "1k",
        footprint: "0805",
        quantity: 2,
        supplier_part_number_columns: {
          "JLCPCB Part #": "C17513",
        },
      },
    ]

    const csv = convertBomRowsToCsv(bomRows)

    expect(csv).toBe(
      "Designator,Comment,Value,Footprint,Quantity,JLCPCB Part #\r\n\"R1, R2\",1k,1k,0805,2,C17513",
    )
  })
})
