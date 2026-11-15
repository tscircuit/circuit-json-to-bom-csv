import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbComponent,
  SourceComponentBase,
} from "circuit-json"
import {
  convertBomRowsToCsv,
  convertCircuitJsonToBomRows,
  convertCircuitJsonToGroupedBomRows,
  convertGroupedBomRowsToCsv,
} from "../lib"
import nineKeyKeyboardCircuitJson from "./assets/nine-key-keyboard.json"

test("groups identical components with combined designators and quantity", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_component",
      obstructs_within_bounds: true,
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
      obstructs_within_bounds: true,
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
    {
      type: "pcb_component",
      obstructs_within_bounds: true,
      pcb_component_id: "pcb_component_3",
      source_component_id: "source_component_3",
    } as PcbComponent,
    {
      type: "source_component",
      source_component_id: "source_component_3",
      name: "R3",
      ftype: "simple_resistor",
      resistance: 4700,
      supplier_part_numbers: {
        jlcpcb: ["C23162"],
      },
    } as SourceComponentBase,
  ]

  const groupedRows = await convertCircuitJsonToGroupedBomRows({ circuitJson })

  expect(groupedRows).toEqual([
    {
      designators: "R1, R2",
      comment: "1k",
      value: "1k",
      footprint: "C17513",
      quantity: 2,
      supplier_part_number_columns: {
        "JLCPCB Part #": "C17513",
      },
    },
    {
      designators: "R3",
      comment: "4.7k",
      value: "4.7k",
      footprint: "C23162",
      quantity: 1,
      supplier_part_number_columns: {
        "JLCPCB Part #": "C23162",
      },
    },
  ])
})

test("serializes grouped BOM rows and opt-in convertBomRowsToCsv flag with Designators and Quantity columns", async () => {
  const ungroupedRows = await convertCircuitJsonToBomRows({
    circuitJson: nineKeyKeyboardCircuitJson as AnyCircuitElement[],
  })
  const groupedRows = await convertCircuitJsonToGroupedBomRows({
    circuitJson: nineKeyKeyboardCircuitJson as AnyCircuitElement[],
  })

  expect(ungroupedRows).toHaveLength(28)
  expect(groupedRows).toHaveLength(12)
  expect(groupedRows.find((row) => row.designators === "U1")?.quantity).toBe(1)
  expect(groupedRows.find((row) => row.value === "C5184526")).toMatchObject({
    designators: "K1, K2, K3, K4, K5, K6, K7, K8, K9",
    quantity: 9,
  })
  expect(groupedRows.find((row) => row.value === "C57759")).toMatchObject({
    designators: "D1, D2, D3, D4, D5, D6, D7, D8, D9",
    quantity: 9,
  })

  const csvFromGrouped = convertGroupedBomRowsToCsv(groupedRows)
  const csvFromFlag = convertBomRowsToCsv(ungroupedRows, {
    includeQuantity: true,
  })
  const csvFromGroupByPartFlag = convertBomRowsToCsv(ungroupedRows, {
    groupByPart: true,
  })

  expect(csvFromFlag).toBe(csvFromGrouped)
  expect(csvFromGroupByPartFlag).toBe(csvFromGrouped)
  expect(csvFromGrouped).toContain(
    '"Designators","Comment","Value","Footprint","Quantity","JLCPCB Part #"',
  )
  expect(csvFromGrouped).toContain(
    '"K1, K2, K3, K4, K5, K6, K7, K8, K9","","C5184526","C5184526","9","C5184526"',
  )
  expect(csvFromGrouped).toContain(
    '"D1, D2, D3, D4, D5, D6, D7, D8, D9","","C57759","C57759","9","C57759"',
  )
})

test("does not merge distinct components that have no identifying value, footprint, or part number", () => {
  const csv = convertBomRowsToCsv(
    [
      {
        designator: "U1",
        comment: "",
        value: "",
        footprint: "",
      },
      {
        designator: "U2",
        comment: "",
        value: "",
        footprint: "",
      },
    ],
    { groupByPart: true },
  )

  expect(csv).toBe(
    '"Designators","Comment","Value","Footprint","Quantity"\r\n"U1","",""," ","1"\r\n"U2","",""," ","1"',
  )
})
