import { test, expect } from "bun:test"
import {
  convertCircuitJsonToBomRows,
  convertBomRowsToCsv,
} from "../lib/circuitJsonToBomConverter"
import nineKeyKeyboardCircuitJson from "./assets/nine-key-keyboard.json"

test("get-bom-for-nine-key-keyboard", async () => {
  const bomRows = await convertCircuitJsonToBomRows({
    circuitJson: nineKeyKeyboardCircuitJson as any,
  })

  // Check microcontroller
  const microcontroller = bomRows.find((row) => row.designator === "U1")
  expect(microcontroller).toBeDefined()
  expect(microcontroller?.comment).toBe("")
  expect(microcontroller?.value).toBe("")

  // Check a key
  const key = bomRows.find((row) => row.designator === "K1")
  expect(key).toBeDefined()
  expect(key?.comment).toBe("")
  expect(key?.value).toBe("")
  expect(key?.supplier_part_number_columns).toBeDefined()
  expect(key?.supplier_part_number_columns?.["JLCPCB Part #"]).toBe("C5184526")

  // Check a diode
  const diode = bomRows.find((row) => row.designator === "D1")
  expect(diode).toBeDefined()
  expect(diode?.comment).toBe("")
  expect(diode?.value).toBe("")
  expect(diode?.supplier_part_number_columns).toBeDefined()
  expect(diode?.supplier_part_number_columns?.["JLCPCB Part #"]).toBe("C57759")

  // Convert to CSV
  const csv = convertBomRowsToCsv(bomRows)
  expect(csv).toContain("Designator,Comment,Value,Footprint,JLCPCB Part #")
  expect(csv).toContain("U1,,,,")
  expect(csv).toContain("K1,,,,C5184526")
  expect(csv).toContain("D1,,,,C57759")
})
