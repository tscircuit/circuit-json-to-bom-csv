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
`AssemblyBomNode` records, including assembly materials without PCB footprints.
Nodes preserve source IDs, purchasing sources, local and accumulated quantities,
and existing PCB row details. This API does not perform network requests.

Physical `parent_source_component_id` takes precedence over electrical groups.
Otherwise, `source_group` records marked `is_subcircuit` become display groups;
ordinary layout groups are transparent. Missing parents fall back to electrical
grouping or the root; cycles and duplicate component IDs report errors.

`bom_assembly_mode: "buy"` keeps children inspectable but marks them
`included_in_purchase: false`. A built assembly sums its descendants; a purchased
assembly uses its own quote. Consumers must not count both. Source arrays contain
alternative purchasing options, not additional materials. Quantities are integer
item counts for one root build, not manufacturing panel counts or length units.

The existing manufacturing rows and CSV are unchanged by default. Opt into
`convertCircuitJsonToBomRows({ circuitJson, includeSourceIds: true })` when stable
component identity is needed; IDs are never serialized into the manufacturing CSV.
PCB exclusions (DNP, test points and bare mounting holes) still apply.

This draft pins the schema preview from tscircuit/circuit-json#958. Replace the
preview with its published version before merging. The PR preview workflow lets
Runframe review and test this API before the converter is released.

## License

This project is licensed under the MIT License.
