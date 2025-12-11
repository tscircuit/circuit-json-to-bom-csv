import { test, expect } from "bun:test"
import { convertCircuitJsonToBomRows, convertBomRowsToCsv } from "../lib/index"
import nineKeyKeyboardCircuitJson from "./assets/nine-key-keyboard.json"

test("get-bom-for-nine-key-keyboard", async () => {
  const bomRows = await convertCircuitJsonToBomRows({
    circuitJson: nineKeyKeyboardCircuitJson as any,
  })

  // Check microcontroller
  const microcontroller = bomRows.find((row) => row.designator.includes("U1"))
  expect(microcontroller).toBeDefined()
  expect(microcontroller?.comment).toBe("")
  expect(microcontroller?.value).toBe("")
  expect(microcontroller?.quantity).toBe(10)

  // Check keys (grouped)
  const key = bomRows.find(
    (row) =>
      row.designator.includes("K1") && !row.designator.includes("_shaft"),
  )
  expect(key).toBeDefined()
  expect(key?.comment).toBe("")
  expect(key?.value).toBe("")
  expect(key?.quantity).toBe(9)
  expect(key?.supplier_part_number_columns).toBeDefined()
  expect(key?.supplier_part_number_columns?.["JLCPCB Part #"]).toBe("C5184526")

  // Check diodes (grouped)
  const diode = bomRows.find((row) => row.designator.includes("D1"))
  expect(diode).toBeDefined()
  expect(diode?.comment).toBe("")
  expect(diode?.value).toBe("")
  expect(diode?.quantity).toBe(9)
  expect(diode?.supplier_part_number_columns).toBeDefined()
  expect(diode?.supplier_part_number_columns?.["JLCPCB Part #"]).toBe("C57759")

  // Convert to CSV
  const csv = convertBomRowsToCsv(bomRows)
  expect(csv).toContain(
    "Designator,Comment,Value,Footprint,Quantity,JLCPCB Part #",
  )
  expect(csv).toContain(
    '"K1_shaft,K2_shaft,K3_shaft,K4_shaft,K5_shaft,K6_shaft,K7_shaft,K8_shaft,K9_shaft,U1",,,,10,',
  )
  expect(csv).toContain('"K1,K2,K3,K4,K5,K6,K7,K8,K9",,,,9,C5184526')
  expect(csv).toContain('"D1,D2,D3,D4,D5,D6,D7,D8,D9",,,,9,C57759')
})
