import type { AttachmentExtractionSource } from "@/lib/attachment-extraction";

export type AttachmentTag = "Image" | "PDF" | "Text" | "Data" | "Scanned PDF" | "OCR" | "Text layer";

export function categorizeAttachment(file: Pick<File, "name" | "type">, extractionSource?: AttachmentExtractionSource): AttachmentTag[] {
  const tags: AttachmentTag[] = [];
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const isPdf = type === "application/pdf" || name.endsWith(".pdf");
  const isImage = type.startsWith("image/");
  const isData = type === "text/csv" || type === "application/json" || /\.(csv|json)$/i.test(name);
  const isText = type.startsWith("text/") || /\.(txt|md)$/i.test(name);

  if (isImage) tags.push("Image");
  else if (isPdf) tags.push("PDF");
  else if (isData) tags.push("Data");
  else if (isText) tags.push("Text");

  if (isPdf && extractionSource === "ocr") tags.push("Scanned PDF");
  if (extractionSource === "ocr") tags.push("OCR");
  if (isPdf && extractionSource === "pdf-text") tags.push("Text layer");
  return tags.length > 0 ? tags : ["Text"];
}
