export type AttachmentExtractionSource = "text" | "pdf-text" | "docx-text" | "xlsx-text" | "ocr" | "none";
export type AttachmentExtractionStatus = "reading" | "ocr" | "ready" | "empty" | "failed";
export type OcrLanguage = "eng" | "ben" | "hin" | "eng+ben" | "eng+hin";

export interface AttachmentExtractionResult {
  status: AttachmentExtractionStatus;
  source: AttachmentExtractionSource;
  text: string;
  characterCount: number;
  pageCount?: number;
  language?: OcrLanguage;
  message?: string;
}

export async function extractAttachmentText(file: File, onProgress?: (progress: number) => void, language: OcrLanguage = "eng"): Promise<AttachmentExtractionResult> {
  try {
    if (isPlainTextFile(file)) {
      const text = await file.text();
      return makeTextResult(text, "text");
    }
    if (isPdfFile(file)) return await extractPdfText(file, onProgress, language);
    if (file.type.startsWith("image/")) return await extractImageText(file, onProgress, language);
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

function makeTextResult(text: string, source: "text" | "pdf-text" | "ocr", pageCount?: number, language?: OcrLanguage): AttachmentExtractionResult {
  const normalized = text.replace(/\u0000/g, "").trim();
  if (!normalized) return { status: "empty", source, text: "", characterCount: 0, pageCount, language, message: "No readable text was found." };
  return { status: "ready", source, text: normalized.slice(0, 120_000), characterCount: normalized.length, pageCount, language };
}

async function extractPdfText(file: File, onProgress?: (progress: number) => void, language: OcrLanguage = "eng"): Promise<AttachmentExtractionResult> {
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
  const ocrText = await ocrPdfPages(document, onProgress, language);
  return makeTextResult(ocrText, "ocr", document.numPages, language);
}

async function extractImageText(file: File, onProgress?: (progress: number) => void, language: OcrLanguage = "eng"): Promise<AttachmentExtractionResult> {
  const text = await runOcr([file], onProgress, language);
  return makeTextResult(text, "ocr", undefined, language);
}

async function ocrPdfPages(document: { numPages: number; getPage: (pageNumber: number) => Promise<unknown> }, onProgress: ((progress: number) => void) | undefined, language: OcrLanguage): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(language, 1, { logger: (event) => { if (event.status === "recognizing text") onProgress?.(35 + Math.round(event.progress * 65)); } });
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

async function runOcr(inputs: Blob[], onProgress: ((progress: number) => void) | undefined, language: OcrLanguage): Promise<string> {
  onProgress?.(5);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(language, 1, { logger: (event) => { if (event.status === "recognizing text") onProgress?.(Math.round(event.progress * 100)); } });
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
