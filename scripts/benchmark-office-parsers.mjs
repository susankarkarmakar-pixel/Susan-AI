import { performance } from "node:perf_hooks";
import { Packer, Document, Paragraph, Table, TableRow, TableCell } from "docx";
import ExcelJS from "exceljs";
import mammoth from "mammoth";

const ITERATIONS = Number(process.env.BENCHMARK_ITERATIONS || 5);
const ROWS = Number(process.env.BENCHMARK_ROWS || 500);
const SHEETS = Number(process.env.BENCHMARK_SHEETS || 3);

const docxBuffer = await makeDocxFixture();
const xlsxBuffer = await makeXlsxFixture();
const docxRuns = await measure("DOCX", () => extractDocx(docxBuffer));
const xlsxRuns = await measure("XLSX", () => extractXlsx(xlsxBuffer));

console.log(JSON.stringify({
  iterations: ITERATIONS,
  fixtures: { docxBytes: docxBuffer.byteLength, xlsxBytes: xlsxBuffer.byteLength, xlsxSheets: SHEETS, xlsxRowsPerSheet: ROWS },
  results: { DOCX: summarize(docxRuns), XLSX: summarize(xlsxRuns) },
  memory: { rssMb: round(process.memoryUsage().rss / 1024 / 1024), heapUsedMb: round(process.memoryUsage().heapUsed / 1024 / 1024) },
}, null, 2));

async function makeDocxFixture() {
  const rows = Array.from({ length: 30 }, (_, index) => new TableRow({ children: [
    new TableCell({ children: [new Paragraph(`Row ${index + 1}`)] }),
    new TableCell({ children: [new Paragraph("Susan AI document parser benchmark text with searchable content.")] }),
  ] }));
  const document = new Document({ sections: [{ children: [
    new Paragraph("DOCX parser benchmark fixture with searchable content and repeated terms."),
    new Table({ rows }),
  ] }] });
  return Buffer.from(await Packer.toBuffer(document));
}

async function makeXlsxFixture() {
  const workbook = new ExcelJS.Workbook();
  for (let sheetIndex = 0; sheetIndex < SHEETS; sheetIndex += 1) {
    const sheet = workbook.addWorksheet(`Sheet ${sheetIndex + 1}`);
    sheet.addRow(["ID", "Title", "Description", "Value"]);
    for (let row = 1; row <= ROWS; row += 1) sheet.addRow([row, `Record ${row}`, "XLSX parser benchmark searchable content", row * 1.25]);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.length;
}

async function extractXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toArrayBuffer(buffer));
  let characters = 0;
  for (const sheet of workbook.worksheets.slice(0, 20)) {
    sheet.eachRow({ includeEmpty: false }, (row) => { characters += (Array.isArray(row.values) ? row.values.slice(1) : []).join(" | ").length; });
  }
  return characters;
}

async function measure(name, operation) {
  await operation();
  const samples = [];
  for (let index = 0; index < ITERATIONS; index += 1) {
    const start = performance.now();
    const characters = await operation();
    samples.push({ ms: performance.now() - start, characters });
  }
  console.error(`${name} benchmark complete: ${samples.length} measured runs`);
  return samples;
}

function summarize(samples) {
  const values = samples.map((sample) => sample.ms).sort((a, b) => a - b);
  return { minMs: round(values[0]), medianMs: round(values[Math.floor(values.length / 2)]), maxMs: round(values.at(-1)), indexedCharacters: samples[0].characters };
}

function toArrayBuffer(value) { return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength); }
function round(value) { return Math.round(value * 100) / 100; }
