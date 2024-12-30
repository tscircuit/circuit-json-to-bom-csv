import type {
  AnyCircuitElement,
  PcbComponent,
  SourceComponentBase,
  SourceSimpleCapacitor,
  SourceSimpleResistor,
  SupplierName,
} from "circuit-json"
// @ts-ignore
import { formatSI } from "format-si-prefix"

import Papa from "papaparse"

type SupplierPartNumberColumn = "JLCPCB Part #"

interface BomRow {
  designator: string
  comment: string
  value: string
  footprint: string
  quantity: number
  supplier_part_number_columns?: Partial<Record<SupplierPartNumberColumn, string>>
  manufacturer_mpn_pairs?: Array<{
    manufacturer: string
    mpn: string
  }>
  extra_columns?: Record<string, string>
}

interface ResolvedPart {
  part_number?: string
  footprint?: string
  comment?: string
  supplier_part_number_columns?: Record<SupplierPartNumberColumn, string>
  manufacturer_mpn_pairs?: Array<{
    manufacturer: string
    mpn: string
  }>
  extra_columns?: Record<string, string>
}

export const convertCircuitJsonToBomRows = async ({
  circuitJson,
  resolvePart,
  supplier_part_numbers,
}: {
  circuitJson: AnyCircuitElement[];
  resolvePart?: (part_info: {
    source_component: SourceComponentBase;
    pcb_component: PcbComponent;
  }) => Promise<ResolvedPart | null>;
  supplier_part_numbers: Partial<Record<SupplierName, string[]>> | undefined;
}): Promise<BomRow[]> => {
  const bomMap = new Map<string, BomRow>();

  for (const elm of circuitJson) {
    if (elm.type !== "source_component") continue;

    const source_component = elm;

    let comment = "";

    if (source_component.ftype === "simple_resistor") {
      comment = si((source_component as SourceSimpleResistor).resistance);
    }
    if (source_component.ftype === "simple_capacitor") {
      comment = si((source_component as SourceSimpleCapacitor).capacitance);
    }

    const supplier_part_number_columns: Partial<BomRow["supplier_part_number_columns"]> = {};
    if (source_component.supplier_part_numbers?.jlcpcb) {
      supplier_part_number_columns["JLCPCB Part #"] = source_component.supplier_part_numbers.jlcpcb[0];
    }

    const jlcpcbPartNumber = supplier_part_number_columns["JLCPCB Part #"];

    if (jlcpcbPartNumber) {
      if (bomMap.has(jlcpcbPartNumber)) {
        const existingRow = bomMap.get(jlcpcbPartNumber)!;

        const newDesignator = source_component.name ?? elm.source_component_id;
        existingRow.designator = `${existingRow.designator}, ${newDesignator}`;
        existingRow.quantity += 1;
      } else {
        bomMap.set(jlcpcbPartNumber, {
          designator: source_component.name ?? elm.source_component_id,
          comment,
          value: comment,
          footprint: "",
          quantity: 1,
          supplier_part_number_columns: supplier_part_number_columns,
        });
      }
    } else {
      // If no JLCPCB Part # found, create individual row for each component
      bomMap.set(source_component.name ?? elm.source_component_id, {
        designator: source_component.name ?? elm.source_component_id,
        comment,
        value: comment,
        footprint: "",
        quantity: 1,
        supplier_part_number_columns: supplier_part_number_columns,
      });
    }
  }

  return Array.from(bomMap.values());
};


function convertSupplierPartNumbersIntoColumns(
  supplier_part_numbers: Partial<Record<SupplierName, string[]>> | undefined
): BomRow["supplier_part_number_columns"] {
  const supplier_part_number_columns: Partial<BomRow["supplier_part_number_columns"]> = {};

  if (supplier_part_numbers?.jlcpcb) {
    supplier_part_number_columns["JLCPCB Part #"] =
      supplier_part_numbers.jlcpcb[0];  // Ensure the JLCPCB Part # is correctly assigned
  }

  return supplier_part_number_columns;
}
function si(v: string | number | undefined | null) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  return formatSI(v);
}

export const convertBomRowsToCsv = (bom_rows: BomRow[]): string => {
  const groupedRows: Record<string, BomRow> = {};

  for (const row of bom_rows) {
    const partNumber = row.supplier_part_number_columns?.["JLCPCB Part #"];
    if (!partNumber) continue; // Skip if no part number
    if (!groupedRows[partNumber]) {
      groupedRows[partNumber] = {
        ...row,
        designator: row.designator,
        quantity: row.quantity,
      };
    } else {
      // If part number already exists, concatenate designators and sum quantities
      groupedRows[partNumber].designator += `, ${row.designator}`;
      groupedRows[partNumber].quantity += row.quantity;
    }
  }
  const csv_data = Object.values(groupedRows).map((row) => {
    const supplier_part_number_columns = row.supplier_part_number_columns || {};
    return {
      Designator: row.designator,
      Comment: row.comment || "",
      Value: row.value || "",
      Footprint: row.footprint || "",
      Quantity: row.quantity,
      ...supplier_part_number_columns,
    };
  });
  const columnHeaders: string[] = [
    "Designator",
    "Comment",
    "Value",
    "Footprint",
    "Quantity",
  ];
  for (const row of csv_data) {
    for (const key in row) {
      if (!columnHeaders.includes(key)) {
        columnHeaders.push(key);
      }
    }
  }
  return Papa.unparse(csv_data, { columns: columnHeaders });
};
