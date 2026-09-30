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
    onProgress?.(Math.round((pageNumber / document.numPages) * 35));
  }
  const textResult = makeTextResult(pages.join("\n\n"), "pdf-text", document.numPages);
  if (textResult.status === "ready") return textResult;
  const ocrText = await ocrPdfPages(document, onProgress);
  return makeTextResult(ocrText, "ocr", document.numPages);
}

async function extractImageText(file: File, onProgress?: (progress: number) => void): Promise<AttachmentExtractionResult> {
  const text = await runOcr([file], onProgress);
  return makeTextResult(text, "ocr");
}

async function ocrPdfPages(document: { numPages: number; getPage: (pageNumber: number) => Promise<unknown> }, onProgress?: (progress: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { logger: (event) => { if (event.status === "recognizing text") onProgress?.(35 + Math.round(event.progress * 65)); } });
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber) as PdfRenderPageLike;
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = documentCanvas(viewport.width, viewport.height);
      await page.render({ canvasContext: canvas.context, canvas: canvas.canvas, viewport }).promise;
      const image = await canvas.toBlob();
      if (image) {
        const result = await worker.recognize(image);
        pages.push(result.data.text);
      }
      onProgress?.(35 + Math.round((pageNumber / document.numPages) * 65));
    }
  } finally {
    await worker.terminate();
  }
  return pages.join("\n\n");
}

async function runOcr(inputs: Blob[], onProgress?: (progress: number) => void): Promise<string> {
  onProgress?.(5);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { logger: (event) => { if (event.status === "recognizing text") onProgress?.(Math.round(event.progress * 100)); } });
  const pages: string[] = [];
  try {
    for (const input of inputs) pages.push((await worker.recognize(input)).data.text);
  } finally {
    await worker.terminate();
  }
  return pages.join("\n\n");
}

function documentCanvas(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; toBlob: () => Promise<Blob | null> } {
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
  return { canvas, context, toBlob: () => new Promise((resolve) => canvas.toBlob(resolve, "image/png")) };
}

type PdfRenderPageLike = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: { canvasContext: CanvasRenderingContext2D; canvas: HTMLCanvasElement; viewport: { width: number; height: number } }) => { promise: Promise<void> };
};
