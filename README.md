# circuit-json-to-bom-csv

A utility to convert Circuit JSON to Bill of Materials (BOM) CSV format.

## Installation

You can install this package using npm:

```bash
npm install circuit-json-to-bom-csv
```

Or using yarn:

```bash
yarn add circuit-json-to-bom-csv
```

## Usage

This package provides two main functions: `convertCircuitJsonToBomRows` and `convertBomRowsToCsv`.

### Converting Circuit JSON to BOM Rows

```typescript
import { convertCircuitJsonToBomRows } from "circuit-json-to-bom-csv"
import type { AnyCircuitElement } from "circuit-json"

const circuitJson: AnyCircuitElement[] = [
  // Your circuit JSON data here
]

const bomRows = await convertCircuitJsonToBomRows({ circuitJson })
console.log(bomRows)
```

### Converting BOM Rows to CSV

```typescript
import { convertBomRowsToCsv } from "circuit-json-to-bom-csv"

const bomRows = [
  {
    designator: "R1",
    comment: "1k",
    value: "1k",
    footprint: "0805",
    supplier_part_number_columns: {
      "JLCPCB Part #": "C17513",
    },
  },
  // More BOM rows...
]

const csv = convertBomRowsToCsv(bomRows)
console.log(csv)
```

## API Reference

### `convertCircuitJsonToBomRows(options: { circuitJson: AnyCircuitElement[], resolvePart?: Function }): Promise<BomRow[]>`

Converts Circuit JSON to BOM rows.

- `circuitJson`: An array of Circuit JSON elements.
- `resolvePart` (optional): A function to resolve additional part information.

Returns a Promise that resolves to an array of BOM rows.

### `convertBomRowsToCsv(bomRows: BomRow[]): string`

Converts BOM rows to a CSV string.

- `bomRows`: An array of BOM row objects.

Returns a CSV string representation of the BOM.

## Bare mounting holes

Bare mounting holes authored as chips can appear as `pcb_component` records even
though there is no part to assemble. The exporter excludes a `simple_chip` named
`MH<number>` (case-insensitive) when its footprint contains exactly one plated or
non-plated hole, no SMT pads, and it has no manufacturer part number, supplier part
number, or physical CAD model. Other names and multi-pad footprints are preserved.
Assigned mounting hardware is preserved; the BOM exporter also preserves parts
assigned by `resolvePart`.

For custom names or ambiguous footprints, set `doNotPlace` in tscircuit
(`pcb_component.do_not_place` in Circuit JSON) explicitly. This exclusion only
changes assembly rows; it does not remove holes or copper from fabrication data.

## License

This project is licensed under the MIT License.
