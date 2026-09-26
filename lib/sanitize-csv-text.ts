const csvAsciiReplacements: Record<string, string> = {
  µ: "u",
  μ: "u",
  Ω: "ohm",
  Ω: "ohm",
  "±": "+/-",
  "°": "deg",
  "×": "x",
  "–": "-",
  "—": "-",
  "−": "-",
  " ": " ",
}

export function sanitizeCsvText(value: string): string {
  return value
    .replace(/[µμΩΩ±°×–—− ]/g, (character) => csvAsciiReplacements[character])
    .replace(/[^\x00-\x7F]/g, "")
}

export function sanitizeCsvColumns(
  columns: Record<string, string | undefined> | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(columns ?? {}).map(([header, text]) => [
      sanitizeCsvText(header),
      sanitizeCsvText(text ?? ""),
    ]),
  )
}
