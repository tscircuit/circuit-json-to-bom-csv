import { any_circuit_element } from "circuit-json"
import boardCircuitJson from "../assets/dual-rail-power-indicator/board.circuit.json"

// Actual locally routed output of the adjacent board.tsx source.
export const dualRailPowerIndicator = boardCircuitJson.map((element) =>
  any_circuit_element.parse(element),
)
