import type { AnyCircuitElement } from "circuit-json"

export const dnpCircuit: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "source_component_1",
    ftype: "simple_resistor",
    name: "R1",
    resistance: 10000,
    supplier_part_numbers: {
      jlcpcb: ["C25804"],
    },
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_1",
    source_component_id: "source_component_1",
    do_not_place: true,
  },
]
