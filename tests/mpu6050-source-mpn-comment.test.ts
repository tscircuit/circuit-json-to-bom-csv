import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"

// Relevant U1 records from gokul/mpu6050-mini v1.0.3 Circuit JSON.
// The inline footprint has no cad_component.footprinter_string.
const mpu6050U1CircuitJson: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "source_component_0",
    ftype: "simple_chip",
    name: "U1",
    manufacturer_part_number: "MPU-6050",
    supplier_part_numbers: { jlcpcb: ["C24112"] },
    source_group_id: "source_group_0",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_0",
    source_component_id: "source_component_0",
    center: { x: 0, y: -0.3500000000000001 },
    width: 4.8500000000000005,
    height: 4.8500000000000005,
    layer: "top",
    rotation: 0,
    do_not_place: false,
  },
  {
    type: "cad_component",
    cad_component_id: "cad_component_0",
    pcb_component_id: "pcb_component_0",
    source_component_id: "source_component_0",
    position: { x: 0, y: -0.3500000000000001, z: 0.8 },
    rotation: { x: 0, y: 0, z: 0 },
  },
]

const bomRows = await convertCircuitJsonToBomRows({
  circuitJson: mpu6050U1CircuitJson,
})
const bomCsv = convertBomRowsToCsv(bomRows)

test("preserves the released board's U1 supplier part number", () => {
  const sourceComponent = mpu6050U1CircuitJson.find(
    (element) => element.type === "source_component",
  )
  expect(sourceComponent?.manufacturer_part_number).toBe("MPU-6050")
  expect(bomRows).toHaveLength(1)
  expect(bomRows[0]?.designator).toBe("U1")
  expect(bomRows[0]?.supplier_part_number_columns?.["JLCPCB Part #"]).toBe(
    "C24112",
  )
})

test("writes the source MPN into U1's BOM Comment column", () => {
  expect(bomCsv).toContain('"U1","MPU-6050",')
})
