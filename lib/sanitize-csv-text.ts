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
