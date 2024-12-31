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
  
  // HEADERS FROM DIFFERENT bom.csv FILES
  // Comment Designator Footprint "JLCPCB Part #(optional)"
  // Designator Value Footprint Populate MPN Manufacturer MPN Manufacturer MPN Manufacturer MPN Manufacturer MPN Manufacturer
  
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
  
      if (!source_component) continue
  
      const part_info: Partial<ResolvedPart> =
        (await resolvePart?.({ pcb_component: elm, source_component })) ?? {}
  
      let comment = ""
  
      if (source_component.ftype === "simple_resistor")
        comment = si((source_component as SourceSimpleResistor).resistance)
      if (source_component.ftype === "simple_capacitor")
        comment = si((source_component as SourceSimpleCapacitor).capacitance)
  
      bom.push({
        // TODO, use designator from source_component when it's introduced
        designator: source_component.name ?? elm.pcb_component_id,
        comment,
        value: comment,
        footprint: part_info.footprint || "",
        supplier_part_number_columns:
          (part_info.supplier_part_number_columns ??
          source_component.supplier_part_numbers)
            ? convertSupplierPartNumbersIntoColumns(
                source_component.supplier_part_numbers,
              )
            : undefined,
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
      supplier_part_number_columns["JLCPCB Part #"] =
        supplier_part_numbers.jlcpcb[0]
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
      const supplier_part_numbers = Object.values(
        supplier_part_number_columns || {},
      ).join(", ")
      const extraColumns = Object.entries(row.extra_columns || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")
  
      return {
        Designator: row.designator,
        Comment: row.comment,
        Value: row.value,
        Footprint: row.footprint,
        ...supplier_part_number_columns,
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
  
    return Papa.unparse(csv_data, { columns: columnHeaders })
  }