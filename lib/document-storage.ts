import { extractAttachmentText, AttachmentExtractionResult, AttachmentExtractionSource, AttachmentExtractionStatus, OcrLanguage } from "@/lib/attachment-extraction";

export interface WorkspaceDocument {
  id: string;
  name: string;
  mediaType: string;
  sizeBytes: number;
  addedAt: number;
  extractionSource?: AttachmentExtractionSource;
  extractionStatus?: AttachmentExtractionStatus;
  language?: OcrLanguage;
  characterCount?: number;
  pageCount?: number;
}

export interface WorkspaceDocumentSearchResult {
  document: WorkspaceDocument;
  score: number;
  matches: number;
  snippet: string;
}

interface StoredDocument extends WorkspaceDocument {
  blob: Blob;
  searchableText?: string;
}

const DB_NAME = "susan-ai-workspace";
const STORE_NAME = "documents";
const DB_VERSION = 2;
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_INDEXED_TEXT = 120_000;
const SUPPORTED_EXTENSION = /\.(txt|md|csv|json|pdf|docx|xlsx)$/i;

export function isSupportedWorkspaceDocument(file: File): boolean {
  return SUPPORTED_EXTENSION.test(file.name);
}

export async function listWorkspaceDocuments(): Promise<WorkspaceDocument[]> {
  const records = await getAllRecords();
  return records.map(toPublicDocument).sort((a, b) => b.addedAt - a.addedAt);
}

export async function saveWorkspaceDocument(file: File): Promise<WorkspaceDocument> {
  if (!isSupportedWorkspaceDocument(file)) throw new Error("Use TXT, Markdown, CSV, JSON, PDF, DOCX, or XLSX files.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Each document must be 4 MB or smaller.");
  const db = await openDatabase();
  const extraction = await extractForIndex(file);
  const record: StoredDocument = {
    id: makeId(),
    name: file.name.slice(0, 180),
    mediaType: file.type || inferMediaType(file.name),
    sizeBytes: file.size,
    addedAt: Date.now(),
    blob: file.slice(0, file.size, file.type || inferMediaType(file.name)),
    searchableText: extraction.text.slice(0, MAX_INDEXED_TEXT),
    extractionSource: extraction.source,
    extractionStatus: extraction.status,
    language: extraction.language,
    characterCount: extraction.characterCount,
    pageCount: extraction.pageCount,
  };
  await requestInTransaction(db, "readwrite", (store) => store.add(record));
  return toPublicDocument(record);
}

export async function searchWorkspaceDocuments(query: string): Promise<WorkspaceDocumentSearchResult[]> {
  const normalizedQuery = normalizeSearchText(query);
  const records = await getAllRecords();
  if (!normalizedQuery) return records.map((record) => ({ document: toPublicDocument(record), score: 0, matches: 0, snippet: "" })).sort((a, b) => b.document.addedAt - a.document.addedAt);

  const queryTokens = tokenize(normalizedQuery);
  return records.map((record) => scoreDocument(record, normalizedQuery, queryTokens)).filter((result): result is WorkspaceDocumentSearchResult => result !== null).sort((a, b) => b.score - a.score || b.document.addedAt - a.document.addedAt);
}

export async function getWorkspaceDocumentBlob(id: string): Promise<Blob | null> {
  const db = await openDatabase();
  const record = await requestInTransaction<StoredDocument | undefined>(db, "readonly", (store) => store.get(id));
  return record?.blob ?? null;
}

export async function deleteWorkspaceDocument(id: string): Promise<void> {
  const db = await openDatabase();
  await requestInTransaction(db, "readwrite", (store) => store.delete(id));
}

async function extractForIndex(file: File): Promise<AttachmentExtractionResult> {
  if (/\.docx$/i.test(file.name) || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const { extractDocxText } = await import("@/lib/document-parsers");
    return extractDocxText(file);
  }
  if (/\.xlsx$/i.test(file.name) || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const { extractXlsxText } = await import("@/lib/document-parsers");
    return extractXlsxText(file);
  }
  if (/\.(txt|md|csv|json|pdf)$/i.test(file.name) || file.type === "application/pdf" || file.type.startsWith("text/")) {
    return extractAttachmentText(file, undefined, "eng");
  }
  return { status: "empty", source: "none", text: "", characterCount: 0, message: "Text extraction is not available for this file type." };
}

function scoreDocument(record: StoredDocument, query: string, queryTokens: string[]): WorkspaceDocumentSearchResult | null {
  const name = normalizeSearchText(record.name);
  const text = normalizeSearchText(record.searchableText || "");
  const combined = `${name} ${text}`;
  if (!queryTokens.every((token) => combined.includes(token))) return null;

  const nameMatches = countOccurrences(name, query);
  const textMatches = queryTokens.reduce((count, token) => count + countOccurrences(text, token), 0);
  const exactNameBonus = name.includes(query) ? 40 : 0;
  const score = exactNameBonus + (nameMatches * 12) + textMatches;
  return { document: toPublicDocument(record), score, matches: nameMatches + textMatches, snippet: makeSnippet(record.searchableText || "", queryTokens) };
}

function makeSnippet(text: string, queryTokens: string[]): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "No extracted text is available for this file type.";
  const lower = normalized.toLocaleLowerCase();
  const position = queryTokens.map((token) => lower.indexOf(token)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, position - 70);
  const end = Math.min(normalized.length, position + 190);
  return `${start > 0 ? "…" : ""}${normalized.slice(start, end)}${end < normalized.length ? "…" : ""}`;
}

function tokenize(value: string): string[] {
  return [...new Set(value.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2))];
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().trim();
}

function countOccurrences(value: string, query: string): number {
  if (!query) return 0;
  let count = 0;
  let position = 0;
  while ((position = value.indexOf(query, position)) >= 0) { count += 1; position += query.length; }
  return count;
}

function toPublicDocument(record: StoredDocument): WorkspaceDocument {
  return {
    id: record.id,
    name: record.name,
    mediaType: record.mediaType,
    sizeBytes: record.sizeBytes,
    addedAt: record.addedAt,
    extractionSource: record.extractionSource,
    extractionStatus: record.extractionStatus,
    language: record.language,
    characterCount: record.characterCount,
    pageCount: record.pageCount,
  };
}

function getAllRecords(): Promise<StoredDocument[]> {
  return openDatabase().then((db) => requestInTransaction<StoredDocument[]>(db, "readonly", (store) => store.getAll()));
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("This browser does not support local document storage."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local document storage."));
    request.onblocked = () => reject(new Error("Document storage is busy in another tab. Close that tab and try again."));
  });
}

function requestInTransaction<T = IDBValidKey>(db: IDBDatabase, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error || new Error("The document operation failed."));
    transaction.onabort = () => reject(transaction.error || new Error("The document operation was cancelled."));
  });
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function inferMediaType(filename: string): string {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === "json") return "application/json";
  if (extension === "csv") return "text/csv";
  if (extension === "md") return "text/markdown";
  return "text/plain";
}
