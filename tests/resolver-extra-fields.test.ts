import { expect, test } from "bun:test"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"
import { resolverResistorCircuit } from "./fixtures/resolver-resistor-circuit"

test("keeps resolver comment and extra columns in BOM rows and CSV", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: resolverResistorCircuit,
    resolvePart: async () => ({
      comment: "test-comment",
      extra_columns: { Tolerance: "0.1%" },
    }),
  })

  expect(rows).toHaveLength(1)
  expect(rows[0]?.comment).toBe("test-comment")
  expect(rows[0]?.extra_columns).toEqual({ Tolerance: "0.1%" })

  const csv = convertBomRowsToCsv(rows)
  expect(csv).toContain('"Tolerance"')
  expect(csv).toContain('"0.1%"')
})
