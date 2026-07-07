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
    expect(csv).toBe(
      '"Designator","Comment","Value","Footprint","JLCPCB Part #"\r\n"C1","10u","10u","C12345","C12345"',
    )
  })

  test("should trim whitespace around source values", async () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_1",
        source_component_id: "source_component_1",
      } as PcbComponent,
      {
        type: "cad_component",
        pcb_component_id: "pcb_component_1",
        footprinter_string: "  0805  ",
      } as any,
      {
        type: "source_component",
        source_component_id: "source_component_1",
        name: "  R1  ",
        ftype: "simple_resistor",
        resistance: "  10k  ",
        supplier_part_numbers: {
          jlcpcb: ["  C25804  "],
        },
      } as SourceComponentBase,
    ] as AnyCircuitElement[]

    const bomRows = await convertCircuitJsonToBomRows({ circuitJson })

    expect(bomRows[0]).toEqual({
      designator: "R1",
      comment: "10k",
      value: "10k",
      footprint: "0805",
      supplier_part_number_columns: {
        "JLCPCB Part #": "C25804",
      },
    })
  })

  test("should use manufacturer part number in comment when available", async () => {
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

    const bomRows = await convertCircuitJsonToBomRows({
      circuitJson,
      resolvePart: async () => ({
        manufacturer_mpn_pairs: [
          {
            manufacturer: "Yageo",
            mpn: "RC0805FR-071KL",
          },
        ],
      }),
    })

    expect(bomRows[0]).toMatchObject({
      comment: "RC0805FR-071KL",
      value: "1k",
    })
  })

  test("should skip test points", async () => {
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
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_2",
        source_component_id: "source_component_2",
      } as PcbComponent,
      {
        type: "source_component",
        source_component_id: "source_component_2",
        name: "TP1",
        ftype: "simple_test_point",
      } as SourceComponentBase,
    ] as AnyCircuitElement[]

    const bomRows = await convertCircuitJsonToBomRows({ circuitJson })

    expect(bomRows).toHaveLength(1)
    expect(bomRows[0]?.designator).toBe("R1")
    expect(bomRows.some((row) => row.designator === "TP1")).toBe(false)
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

    expect(csv).toBe(
      '"Designator","Comment","Value","Footprint","JLCPCB Part #"\r\n"R1","1k","1k","0805","C17513"',
    )
  })

  test("should output ASCII-only CSV text", () => {
    const bomRows = [
      {
        designator: "Cµ1",
        comment: "10µF ±10%",
        value: "4.7μF Ω °C ™",
        footprint: "0805–metric",
        supplier_part_number_columns: {
          "JLCPCB Part #": "C12345",
        },
      },
    ]

    const csv = convertBomRowsToCsv(bomRows)

    expect(csv).toBe(
      '"Designator","Comment","Value","Footprint","JLCPCB Part #"\r\n"Cu1","10uF +/-10%","4.7uF ohm degC ","0805-metric","C12345"',
    )
    expect([...csv].every((character) => character.charCodeAt(0) <= 0x7f)).toBe(
      true,
    )
  })

  test("should trim whitespace around direct BOM row values", () => {
    const bomRows = [
      {
        designator: "  R1  ",
        comment: "  1k  ",
        value: "  1k  ",
        footprint: "  0805  ",
        supplier_part_number_columns: {
          " JLCPCB Part # ": "  C17513  ",
        },
      },
    ]

    const csv = convertBomRowsToCsv(bomRows)

    expect(csv).toBe(
      '"Designator","Comment","Value","Footprint","JLCPCB Part #"\r\n"R1","1k","1k","0805","C17513"',
    )
  })

  test("should use JLCPCB part number for missing value and footprint", () => {
    const bomRows = [
      {
        designator: "D1",
        comment: "",
        value: "",
        footprint: "",
        supplier_part_number_columns: {
          "JLCPCB Part #": "C57759",
        },
      },
    ]

    const csv = convertBomRowsToCsv(bomRows)

    expect(csv).toBe(
      '"Designator","Comment","Value","Footprint","JLCPCB Part #"\r\n"D1","","C57759","C57759","C57759"',
    )
  })
})
