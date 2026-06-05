import { describe, expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbComponent,
  SourceComponentBase,
} from "circuit-json"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "./index"

describe("convertCircuitJsonToBomRows", () => {
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
      quantity: 1,
      comment: "1k",
      value: "1k",
      footprint: "",
    })
  })

  test("should map lcsc to JLCPCB Part # when lcsc is present", async () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_component",
        pcb_component_id: "C1",
        source_component_id: "source_C1",
        width: 2,
        height: 1.5,
        rotation: 0,
        center: { x: 10, y: 5 },
        layer: "top",
      },
      {
        type: "source_component",
        source_component_id: "source_C1",
        name: "C1",
        ftype: "simple_capacitor",
        capacitance: 10e-6,
        supplier_part_numbers: {
          lcsc: ["C12345"],
        },
      },
    ]

    const bomRowsFromJson = await convertCircuitJsonToBomRows({ circuitJson })
    const csv = convertBomRowsToCsv(bomRowsFromJson)
    expect(csv).toMatchInlineSnapshot(`
      "Designator,Quantity,Comment,Value,Footprint,JLCPCB Part #
      C1,1,10µ,10µ,,C12345"
    `)
  })

  test("should combine matching parts and count quantity", async () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_1",
        source_component_id: "source_component_1",
      } as PcbComponent,
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_2",
        source_component_id: "source_component_2",
      } as PcbComponent,
      {
        type: "cad_component",
        pcb_component_id: "pcb_component_1",
        footprinter_string: "res0603",
      },
      {
        type: "cad_component",
        pcb_component_id: "pcb_component_2",
        footprinter_string: "res0603",
      },
      {
        type: "source_component",
        source_component_id: "source_component_1",
        name: "R1",
        ftype: "simple_resistor",
        resistance: 22,
        supplier_part_numbers: {
          jlcpcb: ["C23345"],
        },
      } as SourceComponentBase,
      {
        type: "source_component",
        source_component_id: "source_component_2",
        name: "R2",
        ftype: "simple_resistor",
        resistance: 22,
        supplier_part_numbers: {
          jlcpcb: ["C23345"],
        },
      } as SourceComponentBase,
    ] as AnyCircuitElement[]

    const bomRows = await convertCircuitJsonToBomRows({ circuitJson })

    expect(bomRows).toEqual([
      {
        designator: "R1, R2",
        quantity: 2,
        comment: "22",
        value: "22",
        footprint: "res0603",
        supplier_part_number_columns: {
          "JLCPCB Part #": "C23345",
        },
      },
    ])
  })
})

describe("convertBomRowsToCsv", () => {
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

    expect(csv).toMatchInlineSnapshot(`
      "Designator,Quantity,Comment,Value,Footprint,JLCPCB Part #
      R1,1,1k,1k,0805,C17513"
    `)
  })
})
