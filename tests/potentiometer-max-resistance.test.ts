import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib"

// Records emitted by tscircuit for
// <potentiometer name="RV1" maxResistance="10k" footprint="pinrow3" />
// Placement-only fields are omitted.
const potentiometerCircuit: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "source_component_0",
    ftype: "simple_potentiometer",
    name: "RV1",
    max_resistance: 10000,
    display_max_resistance: "10kΩ",
    are_pins_interchangeable: true,
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_0",
    source_component_id: "source_component_0",
    center: { x: 0, y: 0 },
    width: 6.58,
    height: 1.5,
    layer: "top",
    rotation: 0,
    do_not_place: false,
    obstructs_within_bounds: true,
  },
]

test.failing(
  "exports potentiometer max resistance into BOM rows and CSV",
  async () => {
    const rows = await convertCircuitJsonToBomRows({
      circuitJson: potentiometerCircuit,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      designator: "RV1",
      value: "10k",
      comment: "10k",
    })
    expect(convertBomRowsToCsv(rows)).toContain('"RV1","10k","10k"')
  },
)

test.failing(
  "keeps potentiometer max resistance when a part is resolved",
  async () => {
    const rows = await convertCircuitJsonToBomRows({
      circuitJson: potentiometerCircuit,
      resolvePart: async () => ({
        manufacturer_mpn_pairs: [{ manufacturer: "Example", mpn: "POT-10K" }],
        supplier_part_number_columns: { "JLCPCB Part #": "C12345" },
      }),
    })

    expect(rows[0]).toMatchObject({
      value: "10k",
      comment: "POT-10K",
      supplier_part_number_columns: { "JLCPCB Part #": "C12345" },
    })
    expect(convertBomRowsToCsv(rows)).toContain(
      '"RV1","POT-10K","10k","C12345","C12345"',
    )
  },
)
