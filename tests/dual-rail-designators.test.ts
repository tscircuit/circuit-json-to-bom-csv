import { expect, test } from "bun:test"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"
import { dualRailPowerIndicator } from "./fixtures/dual-rail-power-indicator"

test("records ambiguous BOM designators from the dual-rail indicator", async () => {
  expect(
    dualRailPowerIndicator.filter((element) => element.type.endsWith("_error")),
  ).toEqual([])
  const resistorGroups = dualRailPowerIndicator.flatMap((element) =>
    element.type === "source_component" && element.ftype === "simple_resistor"
      ? [element.source_group_id]
      : [],
  )
  expect(new Set(resistorGroups).size).toBe(2)
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: dualRailPowerIndicator,
    includeSourceIds: true,
  })

  expect(rows).toHaveLength(5)
  expect(new Set(rows.map((row) => row.source_component_id)).size).toBe(5)
  expect(
    rows.filter((row) => row.designator === "R1").map((row) => row.value),
  ).toEqual(["1k", "470"])
  expect(convertBomRowsToCsv(rows)).toMatchSnapshot()
})
