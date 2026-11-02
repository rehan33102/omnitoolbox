/**
 * Small, dependency-free CSV parser used by the CSV to JSON tool.
 * Handles the cases a naive split(",") gets wrong: quoted fields containing
 * commas, escaped double-quotes (""), and line breaks inside quoted fields.
 * Throws on an unterminated quoted field.
 */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      // A quote only opens a quoted field at the start of a field.
      if (field === "") inQuotes = true;
      else field += ch;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // CRLF: the following \n closes the row; a lone \r is ignored.
      if (text[i + 1] === "\n") continue;
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new Error("Unterminated quoted field — check for a missing closing quote.");
  // Flush the final row (a trailing newline leaves an empty row behind).
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-empty rows (e.g. blank lines at the end of a file).
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function typedValue(raw: string): unknown {
  const v = raw.trim();
  if (v === "") return "";
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  // Numbers, but keep leading-zero codes (007, 0123) and long digit strings
  // as text so IDs and postcodes are not mangled.
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v) && v.replace(/[^0-9]/g, "").length <= 15) {
    return Number(v);
  }
  return raw;
}

export interface CsvToJsonResult {
  data: Record<string, unknown>[];
  rows: number;
  columns: number;
  warnings: string[];
}

export function csvToJson(
  text: string,
  opts: { delimiter: string; hasHeader: boolean; autoType: boolean }
): CsvToJsonResult {
  const rows = parseCsv(text, opts.delimiter);
  if (rows.length === 0) throw new Error("No data found — paste some CSV or upload a file first.");

  const warnings: string[] = [];
  let headers: string[];
  let body: string[][];

  if (opts.hasHeader) {
    headers = rows[0].map((h) => h.trim());
    body = rows.slice(1);
  } else {
    const width = Math.max(...rows.map((r) => r.length));
    headers = Array.from({ length: width }, (_, i) => `column_${i + 1}`);
    body = rows;
  }

  // De-duplicate headers so no row value is silently overwritten.
  const seen = new Map<string, number>();
  headers = headers.map((h, i) => {
    const base = h === "" ? `column_${i + 1}` : h;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count > 1 ? `${base}_${count}` : base;
  });

  const expected = headers.length;
  body.forEach((r, i) => {
    if (r.length !== expected) {
      warnings.push(
        `Row ${opts.hasHeader ? i + 2 : i + 1} has ${r.length} field(s), expected ${expected} — missing fields filled with "".`
      );
    }
  });

  const data = body.map((r) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      const raw = r[i] ?? "";
      obj[h] = opts.autoType ? typedValue(raw) : raw;
    });
    return obj;
  });

  return { data, rows: data.length, columns: headers.length, warnings };
}
