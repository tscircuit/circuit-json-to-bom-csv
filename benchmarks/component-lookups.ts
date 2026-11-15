import { convertCircuitJsonToBomRows } from "../lib/index"
import type { AnyCircuitElement } from "circuit-json"

const fixtures = [500, 1000, 3000, 6000].map((count) => {
  const circuit: AnyCircuitElement[] = []
  for (let i = 0; i < count; i++) {
    circuit.push({
      type: "source_component",
      source_component_id: `source_${i}`,
      name: `R${i + 1}`,
      ftype: "simple_resistor",
      resistance: 1000,
      supplier_part_numbers: { jlcpcb: [`C${i + 1}`] },
    } as AnyCircuitElement)
  }
  for (let i = 0; i < count; i++) {
    circuit.push({
      type: "pcb_component",
      pcb_component_id: `pcb_${i}`,
      source_component_id: `source_${i}`,
      center: { x: i, y: 0 },
      width: 2,
      height: 1,
      rotation: 0,
      layer: "top",
    } as AnyCircuitElement)
    circuit.push({
      type: "cad_component",
      cad_component_id: `cad_${i}`,
      pcb_component_id: `pcb_${i}`,
      footprinter_string: "0805",
    } as AnyCircuitElement)
  }
  return { count, circuit }
})

const results = []
for (const { count, circuit } of fixtures) {
  for (let i = 0; i < 2; i++)
    await convertCircuitJsonToBomRows({ circuitJson: circuit })
  const samples: number[] = []
  let hash = ""
  for (let i = 0; i < 5; i++) {
    const start = performance.now()
    const rows = await convertCircuitJsonToBomRows({ circuitJson: circuit })
    samples.push(performance.now() - start)
    if (rows.length !== count) throw new Error("Missing BOM rows")
    hash = new Bun.CryptoHasher("sha256")
      .update(JSON.stringify(rows))
      .digest("hex")
  }
  const sorted = [...samples].sort((a, b) => a - b)
  results.push({
    components: count,
    elements: circuit.length,
    medianMs: sorted[2],
    samplesMs: samples,
    outputSha256: hash,
  })
}
console.log(
  JSON.stringify(
    {
      bun: Bun.version,
      platform: process.platform,
      arch: process.arch,
      results,
    },
    null,
    2,
  ),
)
