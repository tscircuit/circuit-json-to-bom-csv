import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbComponent,
  SourceComponentBase,
} from "circuit-json"
import { convertCircuitJsonToBomRows } from "../lib"

const resistorCircuit = (
  supplier_part_numbers: SourceComponentBase["supplier_part_numbers"],
): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source_component_1",
    ftype: "simple_resistor",
    name: "R1",
    resistance: 1000,
    supplier_part_numbers,
  } as SourceComponentBase,
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_1",
    source_component_id: "source_component_1",
  } as PcbComponent,
]

test("ignores an empty lcsc array instead of wiping a valid jlcpcb value", async () => {
  const bomRows = await convertCircuitJsonToBomRows({
    circuitJson: resistorCircuit({ jlcpcb: ["C12345"], lcsc: [] }),
  })

  expect(bomRows[0]?.supplier_part_number_columns?.["JLCPCB Part #"]).toBe(
    "C12345",
  )
})

test("trims whitespace around supplier part numbers", async () => {
  const bomRows = await convertCircuitJsonToBomRows({
    circuitJson: resistorCircuit({ jlcpcb: [" C12345 "] }),
  })

  expect(bomRows[0]?.supplier_part_number_columns?.["JLCPCB Part #"]).toBe(
    "C12345",
  )
})

test("falls back to source supplier part numbers when resolver columns are blank", async () => {
  const bomRows = await convertCircuitJsonToBomRows({
    circuitJson: resistorCircuit({ jlcpcb: ["C12345"] }),
    resolvePart: async () => ({
      supplier_part_number_columns: { "JLCPCB Part #": "   " },
    }),
  })

  expect(bomRows[0]?.supplier_part_number_columns?.["JLCPCB Part #"]).toBe(
    "C12345",
  )
})
