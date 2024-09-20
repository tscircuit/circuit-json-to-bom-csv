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
import { convertCircuitJsonToBomRows } from 'circuit-json-to-bom-csv';
import type { AnyCircuitElement } from 'circuit-json';

const circuitJson: AnyCircuitElement[] = [
  // Your circuit JSON data here
];

const bomRows = await convertCircuitJsonToBomRows({ circuitJson });
console.log(bomRows);
```

### Converting BOM Rows to CSV

```typescript
import { convertBomRowsToCsv } from 'circuit-json-to-bom-csv';

const bomRows = [
  {
    designator: 'R1',
    comment: '1k',
    value: '1k',
    footprint: '0805',
    supplier_part_number_columns: {
      'JLCPCB Part#': 'C17513',
    },
  },
  // More BOM rows...
];

const csv = convertBomRowsToCsv(bomRows);
console.log(csv);
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

## License

This project is licensed under the MIT License.
