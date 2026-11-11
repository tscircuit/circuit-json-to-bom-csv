import { expect, test } from "bun:test"
import { convertCircuitJsonToBomRows } from "../lib"
import { dualRailPowerIndicator } from "./fixtures/dual-rail-power-indicator"

test.failing(
  "the dual-rail BOM should identify every physical component unambiguously",
  async () => {
    const rows = await convertCircuitJsonToBomRows({
      circuitJson: dualRailPowerIndicator,
    })

    expect(new Set(rows.map((row) => row.designator)).size).toBe(rows.length)
  },
)
