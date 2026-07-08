import type { AnyCircuitElement } from "circuit-json"
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Table2,
  UploadCloud,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { convertBomRowsToCsv, convertCircuitJsonToBomRows } from "../lib/index"

type BomRow = Awaited<ReturnType<typeof convertCircuitJsonToBomRows>>[number]

interface ConversionResult {
  bomRows: BomRow[]
  csv: string
  fileName: string
  sourceElementCount: number
}

function getCircuitJsonFromUpload(parsedJson: unknown): AnyCircuitElement[] {
  if (Array.isArray(parsedJson)) return parsedJson as AnyCircuitElement[]

  if (
    parsedJson &&
    typeof parsedJson === "object" &&
    "circuitJson" in parsedJson &&
    Array.isArray(parsedJson.circuitJson)
  ) {
    return parsedJson.circuitJson as AnyCircuitElement[]
  }

  if (
    parsedJson &&
    typeof parsedJson === "object" &&
    "circuit_json" in parsedJson &&
    Array.isArray(parsedJson.circuit_json)
  ) {
    return parsedJson.circuit_json as AnyCircuitElement[]
  }

  throw new Error("Upload a Circuit JSON array or an object with circuitJson.")
}

function buildDownloadName(fileName: string) {
  const baseName = fileName.replace(/\.json$/i, "") || "bom"
  return `${baseName}.bom.csv`
}

function downloadCsv(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = buildDownloadName(fileName)
  link.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [copied, setCopied] = useState(false)

  const stats = useMemo(() => {
    if (!result) return null

    return {
      rows: result.bomRows.length,
      dnp: result.bomRows.filter((row) => row.comment === "DNP").length,
      supplierParts: result.bomRows.filter(
        (row) => Object.keys(row.supplier_part_number_columns ?? {}).length > 0,
      ).length,
      csvBytes: new Blob([result.csv]).size,
    }
  }, [result])

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true)
    setError(null)
    setCopied(false)

    try {
      const text = await file.text()
      const circuitJson = getCircuitJsonFromUpload(JSON.parse(text))
      const bomRows = await convertCircuitJsonToBomRows({ circuitJson })
      const csv = convertBomRowsToCsv(bomRows)

      setResult({
        bomRows,
        csv,
        fileName: file.name,
        sourceElementCount: circuitJson.length,
      })
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : "Failed to convert file.")
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      await processFile(file)
      event.target.value = ""
    },
    [processFile],
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()
      setIsDragging(false)

      const file = event.dataTransfer.files?.[0]
      if (!file) return

      if (!file.name.toLowerCase().endsWith(".json")) {
        setError("Upload a .json file.")
        return
      }

      await processFile(file)
    },
    [processFile],
  )

  const handleCopy = useCallback(async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.csv)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }, [result])

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#17202a]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-[#d7dde5] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-[#4d6b5f]">
              tscircuit utility
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-[#111827]">
              Circuit JSON to BOM CSV
            </h1>
          </div>
          {result && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#b9c2ce] bg-white px-4 text-sm font-medium text-[#17202a] shadow-sm hover:bg-[#eef2f5] focus:outline-none focus:ring-2 focus:ring-[#2c6f5c]"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-[#2c6f5c]" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy CSV"}
              </button>
              <button
                type="button"
                onClick={() => downloadCsv(result.csv, result.fileName)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#245f50] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#1d4d42] focus:outline-none focus:ring-2 focus:ring-[#2c6f5c] focus:ring-offset-2"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </button>
            </div>
          )}
        </header>

        <section className="grid min-w-0 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex min-h-[230px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-white px-6 text-center shadow-sm transition ${
                isDragging
                  ? "border-[#245f50] bg-[#edf7f3]"
                  : "border-[#aab5c2] hover:border-[#245f50]"
              }`}
            >
              <UploadCloud
                className={`h-10 w-10 ${
                  isDragging ? "text-[#245f50]" : "text-[#677483]"
                }`}
              />
              <span className="mt-4 text-base font-semibold text-[#111827]">
                {isProcessing ? "Converting file" : "Upload Circuit JSON"}
              </span>
              <span className="mt-2 max-w-[280px] text-sm leading-6 text-[#586675]">
                Drop a .json file here or click to choose one from disk.
              </span>
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                disabled={isProcessing}
                onChange={handleFileUpload}
              />
            </label>

            {error && (
              <div className="flex gap-3 rounded-lg border border-[#e0a8a8] bg-[#fff5f5] p-4 text-sm text-[#8a2424]">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
                <p>{error}</p>
              </div>
            )}

            {stats && (
              <div className="grid grid-cols-2 gap-3">
                <Stat label="BOM rows" value={stats.rows.toString()} />
                <Stat label="DNP" value={stats.dnp.toString()} />
                <Stat
                  label="Supplier refs"
                  value={stats.supplierParts.toString()}
                />
                <Stat
                  label="CSV size"
                  value={`${Math.max(1, Math.ceil(stats.csvBytes / 1024))} KB`}
                />
              </div>
            )}
          </div>

          <div className="min-h-[520px] min-w-0 rounded-lg border border-[#d7dde5] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#d7dde5] px-5 py-4">
              <div className="flex items-center gap-2">
                <Table2 className="h-5 w-5 text-[#245f50]" />
                <h2 className="text-base font-semibold">BOM Preview</h2>
              </div>
              {result && (
                <span className="text-sm text-[#586675]">
                  {result.sourceElementCount} source elements
                </span>
              )}
            </div>

            {result ? (
              <div className="overflow-hidden">
                <div className="max-h-[560px] overflow-auto">
                  <table className="min-w-[760px] border-separate border-spacing-0 text-left text-sm">
                    <thead className="sticky top-0 bg-[#eef2f5] text-xs uppercase text-[#586675]">
                      <tr>
                        <TableHead>Designator</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Footprint</TableHead>
                        <TableHead>JLCPCB Part #</TableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {result.bomRows.map((row, index) => (
                        <tr
                          key={`${row.designator}-${index}`}
                          className="border-b border-[#e4e8ee]"
                        >
                          <TableCell strong>{row.designator}</TableCell>
                          <TableCell>{row.comment || "-"}</TableCell>
                          <TableCell>{row.value || "-"}</TableCell>
                          <TableCell>{row.footprint || "-"}</TableCell>
                          <TableCell>
                            {row.supplier_part_number_columns?.[
                              "JLCPCB Part #"
                            ] || "-"}
                          </TableCell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[460px] flex-col items-center justify-center px-6 text-center text-[#586675]">
                <FileText className="h-12 w-12 text-[#8d99a7]" />
                <p className="mt-4 text-sm">
                  Converted rows will appear here after upload.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d7dde5] bg-white p-4 shadow-sm">
      <div className="text-2xl font-semibold text-[#111827]">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-[#586675]">
        {label}
      </div>
    </div>
  )
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-[#d7dde5] px-4 py-3 font-semibold">
      {children}
    </th>
  )
}

function TableCell({
  children,
  strong = false,
}: {
  children: React.ReactNode
  strong?: boolean
}) {
  return (
    <td
      className={`border-b border-[#e4e8ee] px-4 py-3 align-top ${
        strong ? "font-semibold text-[#111827]" : "text-[#2f3a45]"
      }`}
    >
      {children}
    </td>
  )
}

const rootElement = document.getElementById("root")
if (!rootElement) throw new Error("Root element not found")

createRoot(rootElement).render(<App />)
