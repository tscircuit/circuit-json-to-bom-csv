import type { AnyCircuitElement } from "circuit-json"

export const resolverResistorCircuit: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "source_component_1",
    ftype: "simple_resistor",
    name: "R1",
    resistance: 1000,
    manufacturer_part_number: "DEFAULT-MPN",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_1",
    source_component_id: "source_component_1",
  },
]
