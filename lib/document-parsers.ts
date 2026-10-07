import mammoth from "mammoth";
import ExcelJS from "exceljs";
import type { AttachmentExtractionResult } from "@/lib/attachment-extraction";

const DOCX_MAX_TEXT = 120_000;
const XLSX_MAX_SHEETS = 20;
const XLSX_MAX_ROWS_PER_SHEET = 500;
const XLSX_MAX_CELL_LENGTH = 2_000;

export async function extractDocxText(file: Blob): Promise<AttachmentExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = normalizeOfficeText(result.value).slice(0, DOCX_MAX_TEXT);
  return {
    status: text ? "ready" : "empty",
    source: "docx-text",
    text,
    characterCount: text.length,
    message: text ? "DOCX text indexed successfully." : "This DOCX does not contain readable text.",
  };
}

export async function extractXlsxText(file: Blob): Promise<AttachmentExtractionResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheets = workbook.worksheets.slice(0, XLSX_MAX_SHEETS);
  const sections: string[] = [];

  for (const sheet of sheets) {
    const rows: string[] = [`Sheet: ${sheet.name}`];
    let rowCount = 0;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (rowCount >= XLSX_MAX_ROWS_PER_SHEET) return;
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const line = values.map(cellToText).join(" | ").trim();
      if (line) rows.push(line);
      rowCount += 1;
    });
    sections.push(rows.join("\n"));
  }

  const text = normalizeOfficeText(sections.join("\n\n")).slice(0, DOCX_MAX_TEXT);
  const skippedSheets = workbook.worksheets.length - sheets.length;
  return {
    status: text ? "ready" : "empty",
    source: "xlsx-text",
    text,
    characterCount: text.length,
    language: "eng",
    message: text
      ? `XLSX text indexed from ${sheets.length} of ${workbook.worksheets.length} worksheet${workbook.worksheets.length === 1 ? "" : "s"}${skippedSheets > 0 ? `; ${skippedSheets} skipped to keep indexing bounded.` : ""}.`
      : "This XLSX workbook does not contain readable cell values.",
  };
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const candidate = value as { text?: unknown; result?: unknown; formula?: unknown; hyperlink?: unknown; error?: unknown };
    if (typeof candidate.text === "string") return candidate.text.slice(0, XLSX_MAX_CELL_LENGTH);
    if (candidate.result !== undefined) return cellToText(candidate.result);
    if (typeof candidate.formula === "string") return candidate.formula.slice(0, XLSX_MAX_CELL_LENGTH);
    if (typeof candidate.hyperlink === "string") return candidate.hyperlink.slice(0, XLSX_MAX_CELL_LENGTH);
    if (typeof candidate.error === "string") return candidate.error;
  }
  return String(value).slice(0, XLSX_MAX_CELL_LENGTH);
}

function normalizeOfficeText(value: string): string {
  return value.replace(/\u0000/g, "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
