import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"

const potentiometerAndResonatorCircuit: AnyCircuitElement[] = [
  {
    type: "pcb_component",
    pcb_component_id: "pc_pot",
    source_component_id: "sc_pot",
    width: 3,
    height: 3,
    rotation: 0,
    center: { x: 0, y: 0 },
    layer: "top",
  },
  {
    type: "source_component",
    source_component_id: "sc_pot",
    name: "RV1",
    ftype: "simple_potentiometer",
    max_resistance: 10000,
  },
  {
    type: "pcb_component",
    pcb_component_id: "pc_res",
    source_component_id: "sc_res",
    width: 3.2,
    height: 1.3,
    rotation: 0,
    center: { x: 5, y: 0 },
    layer: "top",
  },
  {
    type: "source_component",
    source_component_id: "sc_res",
    name: "Y1",
    ftype: "simple_resonator",
    frequency: 16e6,
    load_capacitance: 15e-12,
  },
]

test("exports potentiometer max_resistance and resonator frequency into BOM rows and CSV", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: potentiometerAndResonatorCircuit,
  })

  expect(rows).toEqual([
    {
      designator: "RV1",
      comment: "10k",
      value: "10k",
      footprint: "",
      supplier_part_number_columns: undefined,
    },
    {
      designator: "Y1",
      comment: "16M",
      value: "16M",
      footprint: "",
      supplier_part_number_columns: undefined,
    },
  ])

  const csv = convertBomRowsToCsv(rows)
  expect(csv).toContain('"RV1","10k","10k"')
  expect(csv).toContain('"Y1","16M","16M"')
})

test("preserves resolved MPN comments and supplier part numbers for potentiometers and resonators", async () => {
  const rows = await convertCircuitJsonToBomRows({
    circuitJson: potentiometerAndResonatorCircuit,
    resolvePart: async ({ source_component }) =>
      source_component.name === "RV1"
        ? {
            manufacturer_mpn_pairs: [
              { manufacturer: "Bourns", mpn: "3362P-1-103LF" },
            ],
            supplier_part_number_columns: { "JLCPCB Part #": "C118987" },
          }
        : {
            manufacturer_mpn_pairs: [
              { manufacturer: "Murata", mpn: "CSTNE16M0V530000R0" },
            ],
            supplier_part_number_columns: { "JLCPCB Part #": "C882604" },
          },
  })

  expect(rows[0]).toMatchObject({
    designator: "RV1",
    comment: "3362P-1-103LF",
    value: "10k",
    supplier_part_number_columns: { "JLCPCB Part #": "C118987" },
  })
  expect(rows[1]).toMatchObject({
    designator: "Y1",
    comment: "CSTNE16M0V530000R0",
    value: "16M",
    supplier_part_number_columns: { "JLCPCB Part #": "C882604" },
  })

  const csv = convertBomRowsToCsv(rows)
  expect(csv).toContain('"RV1","3362P-1-103LF","10k","C118987","C118987"')
  expect(csv).toContain('"Y1","CSTNE16M0V530000R0","16M","C882604","C882604"')
})
