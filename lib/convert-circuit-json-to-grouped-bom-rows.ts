import type {
  AnyCircuitElement,
  PcbComponent,
  SourceComponentBase,
} from "circuit-json"
import Papa from "papaparse"
import {
  type BomRow,
  type ResolvedPart,
  type SupplierPartNumberColumn,
  convertCircuitJsonToBomRows,
} from "./convert-circuit-json-to-bom-rows"
import { sanitizeCsvText } from "./sanitize-csv-text"

export interface GroupedBomRow {
  designators: string
  comment: string
  value: string
  footprint: string
  quantity: number
  supplier_part_number_columns?: Partial<
    Record<SupplierPartNumberColumn, string>
  >
  manufacturer_mpn_pairs?: Array<{
    manufacturer: string
    mpn: string
  }>
  extra_columns?: Record<string, string>
}

const trimText = (value: string | undefined): string => value?.trim() ?? ""

const normalizeSupplierColumns = (
  columns: BomRow["supplier_part_number_columns"],
): Partial<Record<SupplierPartNumberColumn, string>> | undefined => {
  if (!columns) return undefined
  const entries = Object.entries(columns)
    .map(([key, value]) => [trimText(key), trimText(value)] as const)
    .filter(([key]) => Boolean(key))
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries) as Partial<
    Record<SupplierPartNumberColumn, string>
  >
}

export const groupBomRowsByPart = (bomRows: BomRow[]): GroupedBomRow[] => {
  const groups = new Map<
    string,
    {
      designators: string[]
      row: GroupedBomRow
    }
  >()

  for (const [index, row] of bomRows.entries()) {
    const normalizedSupplierColumns = normalizeSupplierColumns(
      row.supplier_part_number_columns,
    )
    const jlcpcbPartNumber = trimText(
      normalizedSupplierColumns?.["JLCPCB Part #"],
    )
    const comment = trimText(row.comment)
    const value = trimText(row.value) || jlcpcbPartNumber
    const footprint = trimText(row.footprint) || jlcpcbPartNumber
    const designator = trimText(row.designator)

    const supplierSignature = normalizedSupplierColumns
      ? Object.entries(normalizedSupplierColumns)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join("&")
      : ""
    const hasSupplierNumber = Boolean(
      normalizedSupplierColumns &&
        Object.values(normalizedSupplierColumns).some(Boolean),
    )
    const hasIdentifyingPartData = Boolean(
      comment || value || footprint || hasSupplierNumber,
    )

    const groupKey = hasIdentifyingPartData
      ? JSON.stringify([comment, value, footprint, supplierSignature])
      : `unidentified:${index}`

    const existing = groups.get(groupKey)
    if (existing) {
      if (designator) existing.designators.push(designator)
      existing.row.quantity += 1
      existing.row.designators = existing.designators.join(", ")
    } else {
      const groupedRow: GroupedBomRow = {
        designators: designator,
        comment,
        value,
        footprint,
        quantity: 1,
        ...(normalizedSupplierColumns
          ? { supplier_part_number_columns: normalizedSupplierColumns }
          : {}),
        ...(row.manufacturer_mpn_pairs
          ? { manufacturer_mpn_pairs: row.manufacturer_mpn_pairs }
          : {}),
        ...(row.extra_columns ? { extra_columns: row.extra_columns } : {}),
      }
      groups.set(groupKey, {
        designators: designator ? [designator] : [],
        row: groupedRow,
      })
    }
  }

  return Array.from(groups.values(), (entry) => entry.row)
}

export const convertCircuitJsonToGroupedBomRows = async ({
  circuitJson,
  resolvePart,
}: {
  circuitJson: AnyCircuitElement[]
  resolvePart?: (part_info: {
    source_component: SourceComponentBase
    pcb_component: PcbComponent
  }) => Promise<ResolvedPart | null>
}): Promise<GroupedBomRow[]> => {
  const bomRows = await convertCircuitJsonToBomRows({
    circuitJson,
    resolvePart,
  })
  return groupBomRowsByPart(bomRows)
}

export const convertGroupedBomRowsToCsv = (
  bom_rows: GroupedBomRow[],
): string => {
  const csv_data = bom_rows.map((row) => {
    const normalizedSupplierColumns = normalizeSupplierColumns(
      row.supplier_part_number_columns,
    )
    const sanitized_supplier_part_number_columns = Object.fromEntries(
      Object.entries(normalizedSupplierColumns || {}).map(([key, value]) => [
        sanitizeCsvText(trimText(key)),
        sanitizeCsvText(trimText(value)),
      ]),
    )
    const jlcpcbPartNumber = trimText(
      normalizedSupplierColumns?.["JLCPCB Part #"],
    )

    return {
      Designators: sanitizeCsvText(trimText(row.designators)),
      Comment: sanitizeCsvText(trimText(row.comment)),
      Value: sanitizeCsvText(trimText(row.value) || jlcpcbPartNumber),
      Footprint:
        sanitizeCsvText(trimText(row.footprint) || jlcpcbPartNumber) || " ",
      Quantity: String(row.quantity),
      ...sanitized_supplier_part_number_columns,
    }
  })

  const columnHeaders: string[] = [
    "Designators",
    "Comment",
    "Value",
    "Footprint",
    "Quantity",
  ]
  for (const row of csv_data) {
    for (const key in row) {
      if (!columnHeaders.includes(key)) {
        columnHeaders.push(key)
      }
    }
  }

  return Papa.unparse(csv_data, {
    columns: columnHeaders,
    newline: "\r\n",
    quotes: true,
  })
}
