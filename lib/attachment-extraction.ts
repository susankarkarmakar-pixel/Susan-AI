export type AttachmentExtractionSource = "text" | "pdf-text" | "ocr" | "none";
export type AttachmentExtractionStatus = "reading" | "ocr" | "ready" | "empty" | "failed";

export interface AttachmentExtractionResult {
  status: AttachmentExtractionStatus;
  source: AttachmentExtractionSource;
  text: string;
  characterCount: number;
  pageCount?: number;
  message?: string;
}

export async function extractAttachmentText(file: File, onProgress?: (progress: number) => void): Promise<AttachmentExtractionResult> {
  try {
    if (isPlainTextFile(file)) {
      const text = await file.text();
      return makeTextResult(text, "text");
    }
    if (isPdfFile(file)) return await extractPdfText(file, onProgress);
    if (file.type.startsWith("image/")) return await extractImageText(file, onProgress);
    return { status: "empty", source: "none", text: "", characterCount: 0, message: "Text extraction is not available for this file type." };
  } catch {
    return { status: "failed", source: "none", text: "", characterCount: 0, message: "Could not extract readable text from this file." };
  }
}

function isPlainTextFile(file: File): boolean {
  return file.type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(file.name);
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function makeTextResult(text: string, source: "text" | "pdf-text" | "ocr", pageCount?: number): AttachmentExtractionResult {
  const normalized = text.replace(/\u0000/g, "").trim();
  if (!normalized) return { status: "empty", source, text: "", characterCount: 0, pageCount, message: "No readable text was found." };
  return { status: "ready", source, text: normalized.slice(0, 120_000), characterCount: normalized.length, pageCount };
}

async function extractPdfText(file: File, onProgress?: (progress: number) => void): Promise<AttachmentExtractionResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    onProgress?.(Math.round((pageNumber / document.numPages) * 100));
  }
  return makeTextResult(pages.join("\n\n"), "pdf-text", document.numPages);
}

async function extractImageText(file: File, onProgress?: (progress: number) => void): Promise<AttachmentExtractionResult> {
  onProgress?.(5);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { logger: (event) => { if (event.status === "recognizing text") onProgress?.(Math.round(event.progress * 100)); } });
  try {
    const result = await worker.recognize(file);
    return makeTextResult(result.data.text, "ocr");
  } finally {
    await worker.terminate();
  }
}
