import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import type { AnyCircuitElement } from "circuit-json"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"

// Reduced crystal records from krishnax12/watchy-eink-smartwatch,
// krishnax12/mtr-tiny-md and gokul/macro-six-usbc.
const watchyCrystals: AnyCircuitElement[] = JSON.parse(
  readFileSync(`${import.meta.dir}/assets/watchy-crystals.json`, "utf8"),
)
const mtrCrystal: AnyCircuitElement[] = JSON.parse(
  readFileSync(`${import.meta.dir}/assets/mtr-crystal.json`, "utf8"),
)
const macroSixCrystal: AnyCircuitElement[] = JSON.parse(
  readFileSync(`${import.meta.dir}/assets/macro-six-crystal.json`, "utf8"),
)

test.failing(
  "exports Watchy crystal frequencies into BOM Value and Comment",
  async () => {
    const rows = await convertCircuitJsonToBomRows({
      circuitJson: watchyCrystals,
    })

    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.designator === "Y1")).toMatchObject({
      value: "32.768k",
      comment: "32.768k",
    })
    expect(rows.find((row) => row.designator === "Y2")).toMatchObject({
      value: "40M",
      comment: "40M",
    })
  },
)

test.failing("exports Watchy crystal frequencies into CSV", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: watchyCrystals,
  })
  const csv = convertBomRowsToCsv(rows)

  expect(csv).toContain('"Y1","32.768k","32.768k"')
  expect(csv).toContain('"Y2","40M","40M"')
})

test.failing(
  "preserves the MTR crystal MPN while exporting frequency",
  async () => {
    const rows = await convertCircuitJsonToBomRows({ circuitJson: mtrCrystal })

    expect(rows).toHaveLength(1)
    expect(rows[0].comment).toBe("8Z-12.000MAAJ-T")
    expect(rows[0].value).toBe("12M")
  },
)

test.failing(
  "keeps supplier numbers separate from crystal frequency",
  async () => {
    const rows = await convertCircuitJsonToBomRows({
      circuitJson: macroSixCrystal,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].comment).toBe("X322516MLB4SI")
    expect(rows[0].supplier_part_number_columns).toEqual({
      "JLCPCB Part #": "C13738",
    })
    expect(rows[0].value).toBe("16M")
  },
)

test("retains the published crystal identities", async () => {
  const watchyRows = await convertCircuitJsonToBomRows({
    circuitJson: watchyCrystals,
  })
  expect(watchyRows.map((row) => row.designator).sort()).toEqual(["Y1", "Y2"])
  const mtrRows = await convertCircuitJsonToBomRows({ circuitJson: mtrCrystal })
  expect(mtrRows[0].comment).toBe("8Z-12.000MAAJ-T")
  const macroSixRows = await convertCircuitJsonToBomRows({
    circuitJson: macroSixCrystal,
  })
  expect(macroSixRows[0].comment).toBe("X322516MLB4SI")
  expect(macroSixRows[0].supplier_part_number_columns).toEqual({
    "JLCPCB Part #": "C13738",
  })
})
