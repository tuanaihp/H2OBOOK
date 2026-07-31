import type { BulkCsvRow } from "./types";

export function parseCreativeCsv(input: string): BulkCsvRow[] {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const rows = lines.map(parseCsvLine);
  const headers = rows[0].map((value) => value.trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

export function mergeSmartFields(template: string, row: BulkCsvRow): string {
  return template.replace(/{{\s*([^}]+?)\s*}}/g, (_match, key: string) => row[key.trim()] ?? "");
}
