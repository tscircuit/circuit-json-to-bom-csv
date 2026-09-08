import { expect, test, mock } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import Papa from "papaparse"
import { convertCircuitJsonToBomRows, convertBomRowsToCsv } from "../lib"

const circuitJson: AnyCircuitElement[] = [true, false, undefined].flatMap(
  (doNotPlace, index): AnyCircuitElement[] => [
    {
      type: "source_component",
      source_component_id: `source_${index}`,
      name: `R${index + 1}`,
      ftype: "simple_resistor",
      resistance: 1000,
      supplier_part_numbers: { jlcpcb: ["C123"] },
    },
    {
      type: "pcb_component",
      pcb_component_id: `pcb_${index}`,
      source_component_id: `source_${index}`,
      center: { x: 10, y: 20 },
      width: 2,
      height: 1,
      layer: "top",
      rotation: 90,
      ...(doNotPlace === undefined ? {} : { do_not_place: doNotPlace }),
    },
  ],
)

const allDnp = circuitJson.map((element) =>
  element.type === "pcb_component"
    ? { ...element, do_not_place: true }
    : element,
)

test("DNP parts are omitted from BOM rows and CSV before resolving parts", async () => {
  const original = structuredClone(circuitJson)
  const resolvePart = mock(
    async (part: { pcb_component: { pcb_component_id: string } }) => ({
      footprint: "0402",
    }),
  )
  const rows = await convertCircuitJsonToBomRows({ circuitJson, resolvePart })
  expect(rows.map((row) => row.designator)).toEqual(["R2", "R3"])
  expect(resolvePart).toHaveBeenCalledTimes(2)
  expect(
    resolvePart.mock.calls.map(([part]) => part.pcb_component.pcb_component_id),
  ).toEqual(["pcb_1", "pcb_2"])
  const csv = Papa.parse(convertBomRowsToCsv(rows), { header: true }).data
  expect(csv).toEqual(
    ["R2", "R3"].map((Designator) => ({
      Designator,
      Comment: "1k",
      Value: "1k",
      Footprint: "0402",
      "JLCPCB Part #": "C123",
    })),
  )
  expect(circuitJson).toEqual(original)
})

test("all-DNP boards produce no BOM entries and never resolve parts", async () => {
  const resolvePart = mock(async () => {
    throw new Error("DNP must not resolve")
  })
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: allDnp,
    resolvePart,
  })
  expect(rows).toEqual([])
  expect(resolvePart).not.toHaveBeenCalled()
  expect(convertBomRowsToCsv(rows)).toBe("")
})
