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

## Assembly BOM

`convertCircuitJsonToAssemblyBom({ circuitJson })` returns a tree of
`AssemblyBomNode` records from `cad_assembly_bom_item` entries and existing PCB
materials. It performs no network requests.

Explicit BOM entries retain their IDs, names, supplier identifiers, all
`purchase_urls`, and optional CAD/source references. Their parent BOM-item IDs
form the tree; positive integer quantities multiply through ancestors. Geometry
count never changes the quantity. Missing parents leave the entry at the root;
cycles, duplicate identities and unsafe quantities report errors.

An explicit entry replaces fallback PCB rows associated with its source or CAD
references. It can reuse the linked source's part numbers and PCB row details,
but its own part-number map takes precedence, including an explicitly empty map.
Separate explicit uses of the same source retain their separate BOM identities.
Unrepresented PCB parts retain their existing exclusions and are grouped under
source groups marked `is_subcircuit`. Ordinary layout groups remain transparent.
Source/CAD geometry alone does not introduce non-PCB BOM materials.

`kind` distinguishes explicit `assembly_bom_item` entries, fallback `pcb_component`
items, and structural `subcircuit` display rows. The converter does not prescribe
purchasing modes or suppress descendant costs. Consumers can quote each material
entry once; display groups have no independent material cost. Product links do
not select or correspond positionally to supplier identifiers.

The existing manufacturing rows and CSV retain their default output. Opt into
`convertCircuitJsonToBomRows({ circuitJson, includeSourceIds: true })` for stable
component identity; those IDs are never serialized into the manufacturing CSV.
Explicit BOM entries do not add items to the manufacturing CSV.

This API uses released `circuit-json@0.0.543`, including the schema merged in
[tscircuit/circuit-json#958](https://github.com/tscircuit/circuit-json/pull/958).
The PR preview workflow supports downstream UI review before converter release.

## License

This project is licensed under the MIT License.
