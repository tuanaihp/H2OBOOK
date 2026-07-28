import type { BrandProfile, H2OBook } from "@/types/editor";
import type { BulkDesignRow, DesignFormatKey, DesignTemplateDefinition } from "@/types/design-library";
import { buildDesignBook } from "@/lib/design-library/build-design-book";

export function parseDesignCsv(input: string): BulkDesignRow[] {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const parseLine = (line: string) => {
    const cells: string[] = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; continue; }
      if (char === '"') { quoted = !quoted; continue; }
      if (char === "," && !quoted) { cells.push(value.trim()); value = ""; continue; }
      value += char;
    }
    cells.push(value.trim());
    return cells;
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

export function buildBulkDesignBooks(input: {
  rows: BulkDesignRow[];
  template: DesignTemplateDefinition;
  brand: BrandProfile;
  defaultValues: Record<string, string>;
  targetFormat: DesignFormatKey;
  useBrandKit: boolean;
}): H2OBook[] {
  return input.rows.map((row) => buildDesignBook({
    template: input.template,
    brand: input.brand,
    values: { ...input.defaultValues, ...row },
    targetFormat: input.targetFormat,
    useBrandKit: input.useBrandKit
  }).book);
}
