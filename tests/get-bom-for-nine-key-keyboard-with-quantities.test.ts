import { test, expect } from "bun:test"
import {
  convertCircuitJsonToBomRowsWithQuantities,
  convertBomRowsToCsvsWithQuantities,
} from "../lib/circuitJsonToBomConverterWithQuantities"
import nineKeyKeyboardCircuitJson from "./assets/nine-key-keyboard.json"

test("get-bom-for-nine-key-keyboard", async () => {
  const validCircuitJson = nineKeyKeyboardCircuitJson.filter(
    (component: any) =>
      component.type === "source_component" && component.supplier_part_numbers,
  )

  // Convert the circuit JSON to BOM rows
  const bomRows = await convertCircuitJsonToBomRowsWithQuantities({
    circuitJson: validCircuitJson as any,
    supplier_part_numbers: {},
  })

  const key = bomRows.find(
    (row) => row.supplier_part_number_columns?.["JLCPCB Part #"] === "C5184526", // Ensure the correct part number
  )
  // Check if key is found
  expect(key).toBeDefined()
  expect(key?.designators).toBeDefined()
  expect(key?.comment).toBe("")
  expect(key?.value).toBe("")
  expect(key?.supplier_part_number_columns).toBeDefined()
  expect(key?.supplier_part_number_columns?.["JLCPCB Part #"]).toBe("C5184526")

  const diode = bomRows.find(
    (row) => row.supplier_part_number_columns?.["JLCPCB Part #"] === "C57759",
  )

  expect(diode).toBeDefined()
  expect(diode?.designators).toBeDefined()
  expect(diode?.comment).toBe("")
  expect(diode?.value).toBe("")
  expect(diode?.supplier_part_number_columns).toBeDefined()
  expect(diode?.supplier_part_number_columns?.["JLCPCB Part #"]).toBe("C57759")

  // Convert to CSV
  const csv = convertBomRowsToCsvsWithQuantities(bomRows)

  // Check if CSV contains expected headers
  expect(csv).toContain(
    "Designators,Comment,Value,Footprint,Quantity,JLCPCB Part #",
  )
  // Additional assertions for quantity
  const keyRows = bomRows.filter(
    (row) => row.supplier_part_number_columns?.["JLCPCB Part #"] === "C5184526",
  )
  expect(keyRows.length).toBeGreaterThan(0) // There should be at least one key row
  expect(keyRows[0]?.quantity).toBe(9) // Expect quantity to be 1 for this key

  const diodeRows = bomRows.filter(
    (row) => row.supplier_part_number_columns?.["JLCPCB Part #"] === "C57759",
  )
  expect(diodeRows.length).toBeGreaterThan(0) // There should be at least one diode row
  expect(diodeRows[0]?.quantity).toBe(9) // Expect quantity to be 1 for this diode
})
