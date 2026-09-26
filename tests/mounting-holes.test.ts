import { expect, test } from "bun:test"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"
import { mountingHoleCircuit } from "./fixtures/mounting-hole-circuit"

test.failing("excludes bare MH mounting-hole footprints from BOM rows and CSV", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: mountingHoleCircuit,
  })
  expect(rows.map((row) => row.designator)).toEqual(["R1"])
  const csv = convertBomRowsToCsv(rows)
  for (const name of ["MH1", "MH2", "MH3", "MH4"])
    expect(csv).not.toContain(name)
  expect(csv).toContain('"R1"')
})
