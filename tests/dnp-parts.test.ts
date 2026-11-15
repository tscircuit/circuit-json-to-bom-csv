import { expect, test } from "bun:test"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"
import { dnpCircuit } from "./fixtures/dnp-circuit"

test("includes DNP parts and labels them as DNP", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: dnpCircuit,
  })

  expect(rows).toHaveLength(1)
  expect(rows[0]?.designator).toBe("R1")
  expect(rows[0]?.comment).toBe("DNP")
  expect(rows[0]?.value).toBe("DNP")
  expect(rows[0]?.supplier_part_number_columns).toBeUndefined()

  const csv = convertBomRowsToCsv(rows)
  expect(csv).toContain('"R1","DNP","DNP"')
  expect(csv).not.toContain("JLCPCB Part #")
  expect(csv).not.toContain("C25804")
})
