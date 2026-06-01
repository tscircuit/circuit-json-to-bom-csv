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
      comment: "1k",
      value: "1k",
      footprint: "",
    })
  })

  test("should filter out non-placeable components (vias, bare pads)", async () => {
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
        resistance: 100,
      } as SourceComponentBase,
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_6",
        source_component_id: "source_component_6",
      } as PcbComponent,
      {
        type: "source_component",
        source_component_id: "source_component_6",
        name: "pcb_component_6",
      } as any,
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_7",
        source_component_id: "source_component_7",
      } as PcbComponent,
      {
        type: "source_component",
        source_component_id: "source_component_7",
        name: "pcb_component_7",
      } as any,
    ] as AnyCircuitElement[]

    const bomRows = await convertCircuitJsonToBomRows({ circuitJson })

    expect(bomRows).toHaveLength(1)
    expect(bomRows[0].designator).toBe("R1")
  })

  test("should include footprint from source_component props", async () => {
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
        resistance: 56,
        footprint: "0603",
      } as any,
    ] as AnyCircuitElement[]

    const bomRows = await convertCircuitJsonToBomRows({ circuitJson })

    expect(bomRows).toHaveLength(1)
    expect(bomRows[0].footprint).toBe("0603")
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
      "Designator,Comment,Value,Footprint,JLCPCB Part #
      C1,10µ,10µ,,C12345"
    `)
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
      "Designator,Comment,Value,Footprint,JLCPCB Part #
      R1,1k,1k,0805,C17513"
    `)
  })
})
