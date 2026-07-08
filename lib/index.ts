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
import { sanitizeCsvText } from "./sanitize-csv-text"

type SupplierPartNumberColumn = "JLCPCB Part #"

interface BomRow {
  designator: string
  comment: string
  value: string
  footprint: string
  supplier_part_number_columns?: Partial<
    Record<SupplierPartNumberColumn, string>
  >
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

const trimText = (value: string | undefined): string => value?.trim() ?? ""

const trimColumnValues = <T extends string>(
  columns: Partial<Record<T, string>> | undefined,
): Partial<Record<T, string>> | undefined => {
  if (!columns) return undefined

  return Object.fromEntries(
    Object.entries(columns).map(([key, value]) => [
      trimText(key),
      trimText(value as string | undefined),
    ]),
  ) as Partial<Record<T, string>>
}

const getManufacturerPartNumberComment = (
  pairs: ResolvedPart["manufacturer_mpn_pairs"],
): string => pairs?.map(({ mpn }) => trimText(mpn)).find(Boolean) ?? ""

const getJlcpcbPartNumber = (
  columns: BomRow["supplier_part_number_columns"],
): string => trimText(columns?.["JLCPCB Part #"])

const isTestPoint = (source_component: SourceComponentBase): boolean =>
  source_component.ftype === "simple_test_point"

// HEADERS FROM DIFFERENT bom.csv FILES
// Comment Designator Footprint "JLCPCB Part #(optional)"
// Designator Value Footprint Populate MPN Manufacturer MPN Manufacturer MPN Manufacturer MPN Manufacturer MPN Manufacturer

const NON_PLACEABLE_FTYPES = new Set([
  "simple_net",
  "simple_ground",
  "simple_power",
])

function isPlaceableComponent(
  source: SourceComponentBase,
  pcb: PcbComponent,
): boolean {
  if (NON_PLACEABLE_FTYPES.has((source as any).ftype ?? "")) return false

  const name = source.name ?? pcb.pcb_component_id ?? ""
  if (/^pcb_component_\d+$/.test(name)) return false

  const hasMeaningfulName =
    !!source.name && !source.name.startsWith("pcb_component_")
  const hasFtype = !!(source as any).ftype
  const hasFootprint =
    !!(source as any).footprint || !!(source as any).footprinter_string

  if (!hasMeaningfulName && !hasFtype && !hasFootprint) return false

  return true
}

export const convertCircuitJsonToBomRows = async ({
  circuitJson,
  resolvePart,
}: {
  circuitJson: AnyCircuitElement[]
  resolvePart?: (part_info: {
    source_component: SourceComponentBase
    pcb_component: PcbComponent
  }) => Promise<ResolvedPart | null>
}): Promise<BomRow[]> => {
  const bom: BomRow[] = []
  for (const elm of circuitJson) {
    if (elm.type !== "pcb_component") continue

    const source_component = circuitJson.find(
      (e) =>
        e.type === "source_component" &&
        e.source_component_id === elm.source_component_id,
    ) as any as SourceComponentBase
    const cad_component = circuitJson.find(
      (e) =>
        e.type === "cad_component" &&
        e.pcb_component_id === elm.pcb_component_id,
    ) as any

    if (!source_component) continue
    if (isTestPoint(source_component)) continue
    if (!isPlaceableComponent(source_component, elm)) continue

    const part_info: Partial<ResolvedPart> =
      (await resolvePart?.({ pcb_component: elm, source_component })) ?? {}

    let value = ""

    if (source_component.ftype === "simple_resistor")
      value = si((source_component as SourceSimpleResistor).resistance)
    if (source_component.ftype === "simple_capacitor")
      value = si((source_component as SourceSimpleCapacitor).capacitance)

    const comment = getManufacturerPartNumberComment(
      part_info.manufacturer_mpn_pairs,
    )

    const isDoNotPlace = Boolean(
      (elm as PcbComponent & { do_not_place?: boolean }).do_not_place,
    )

    const supplier_part_number_columns = isDoNotPlace
      ? undefined
      : trimColumnValues(
          part_info.supplier_part_number_columns ??
            (source_component.supplier_part_numbers
              ? convertSupplierPartNumbersIntoColumns(
                  source_component.supplier_part_numbers,
                )
              : undefined),
        )
    const jlcpcbPartNumber = getJlcpcbPartNumber(supplier_part_number_columns)
    const footprint = trimText(
      part_info.footprint ||
        cad_component?.footprinter_string ||
        (source_component as any).footprint ||
        "",
    )
    const trimmedValue = trimText(value)

    bom.push({
      // TODO, use designator from source_component when it's introduced
      designator: trimText(source_component.name ?? elm.pcb_component_id),
      comment: trimText(isDoNotPlace ? "DNP" : comment || trimmedValue),
      value: trimText(isDoNotPlace ? "DNP" : trimmedValue || jlcpcbPartNumber),
      footprint: trimText(footprint || jlcpcbPartNumber),
      supplier_part_number_columns,
    })
  }

  return bom
}

function convertSupplierPartNumbersIntoColumns(
  supplier_part_numbers: Partial<Record<SupplierName, string[]>> | undefined,
): BomRow["supplier_part_number_columns"] {
  const supplier_part_number_columns: Partial<
    BomRow["supplier_part_number_columns"]
  > = {}

  if (supplier_part_numbers?.jlcpcb) {
    supplier_part_number_columns["JLCPCB Part #"] = trimText(
      supplier_part_numbers.jlcpcb[0],
    )
  }

  if (supplier_part_numbers?.lcsc) {
    supplier_part_number_columns["JLCPCB Part #"] = trimText(
      supplier_part_numbers.lcsc[0],
    )
  }

  return supplier_part_number_columns
}

function si(v: string | number | undefined | null) {
  if (v === null || v === undefined) return ""
  if (typeof v === "string") return v
  return formatSI(v)
}

export const convertBomRowsToCsv = (bom_rows: BomRow[]): string => {
  const csv_data = bom_rows.map((row) => {
    const supplier_part_number_columns = row.supplier_part_number_columns
    const sanitized_supplier_part_number_columns = Object.fromEntries(
      Object.entries(supplier_part_number_columns || {}).map(([key, value]) => [
        sanitizeCsvText(trimText(key)),
        sanitizeCsvText(trimText(value)),
      ]),
    )

    const jlcpcbPartNumber = getJlcpcbPartNumber(
      row.supplier_part_number_columns,
    )

    return {
      Designator: sanitizeCsvText(trimText(row.designator)),
      Comment: sanitizeCsvText(trimText(row.comment)),
      Value: sanitizeCsvText(trimText(row.value) || jlcpcbPartNumber),
      Footprint:
        sanitizeCsvText(trimText(row.footprint) || jlcpcbPartNumber) || " ",
      ...sanitized_supplier_part_number_columns,
    }
  })

  const columnHeaders: string[] = [
    "Designator",
    "Comment",
    "Value",
    "Footprint",
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
