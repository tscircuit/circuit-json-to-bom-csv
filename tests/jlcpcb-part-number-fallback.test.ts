import { expect, test } from "bun:test"
import { convertBomRowsToCsv } from "../lib"

test("uses JLCPCB part number for missing value/footprint even when the column key needs trimming", () => {
  const bomRows = [
    {
      designator: "D1",
      comment: "",
      value: "",
      footprint: "",
      supplier_part_number_columns: {
        " JLCPCB Part # ": "C57759",
      },
    },
  ] as unknown as Parameters<typeof convertBomRowsToCsv>[0]

  const csv = convertBomRowsToCsv(bomRows)
  expect(csv).toBe(
    '"Designator","Comment","Value","Footprint","JLCPCB Part #"\r\n"D1","","C57759","C57759","C57759"',
  )
})
