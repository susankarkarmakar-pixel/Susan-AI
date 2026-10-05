import { searchWorkspaceDocuments } from "@/lib/document-index.mjs";

export interface WorkspaceDocument {
  id: string;
  name: string;
  mediaType: string;
  sizeBytes: number;
  addedAt: number;
  hasTextIndex: boolean;
}

interface StoredDocument extends WorkspaceDocument {
  blob: Blob;
  searchText: string;
}

const DB_NAME = "susan-ai-workspace";
const STORE_NAME = "documents";
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const SUPPORTED_EXTENSION = /\.(txt|md|csv|json|pdf|docx|xlsx)$/i;
const INDEXED_TEXT_EXTENSION = /\.(txt|md|csv|json)$/i;
const MAX_INDEXED_TEXT = 120_000;

export function isSupportedWorkspaceDocument(file: File): boolean {
  return SUPPORTED_EXTENSION.test(file.name);
}

export async function listWorkspaceDocuments(query = ""): Promise<WorkspaceDocument[]> {
  const records = await getAllRecords();
  const matching = searchWorkspaceDocuments(records, query);
  return matching.map(({ id, name, mediaType, sizeBytes, addedAt, hasTextIndex }) => ({ id, name, mediaType, sizeBytes, addedAt, hasTextIndex: Boolean(hasTextIndex) })).sort((a, b) => b.addedAt - a.addedAt);
}

export async function saveWorkspaceDocument(file: File, searchText = ""): Promise<WorkspaceDocument> {
  if (!isSupportedWorkspaceDocument(file)) throw new Error("Use TXT, Markdown, CSV, JSON, PDF, DOCX, or XLSX files.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Each document must be 4 MB or smaller.");
  const db = await openDatabase();
  const mediaType = file.type || inferMediaType(file.name);
  const normalizedText = INDEXED_TEXT_EXTENSION.test(file.name) ? searchText.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, MAX_INDEXED_TEXT) : "";
  const record: StoredDocument = {
    id: makeId(),
    name: file.name.slice(0, 180),
    mediaType,
    sizeBytes: file.size,
    addedAt: Date.now(),
    hasTextIndex: Boolean(normalizedText),
    searchText: normalizedText,
    blob: file.slice(0, file.size, mediaType),
  };
  await requestInTransaction(db, "readwrite", (store) => store.add(record));
  return { id: record.id, name: record.name, mediaType: record.mediaType, sizeBytes: record.sizeBytes, addedAt: record.addedAt, hasTextIndex: record.hasTextIndex };
}

export async function getWorkspaceDocumentBlob(id: string): Promise<Blob | null> {
  const db = await openDatabase();
  const record = await requestInTransaction<StoredDocument | undefined>(db, "readonly", (store) => store.get(id));
  return record?.blob ?? null;
}

export async function getWorkspaceDocumentText(id: string): Promise<{ name: string; searchText: string } | null> {
  const db = await openDatabase();
  const record = await requestInTransaction<StoredDocument | undefined>(db, "readonly", (store) => store.get(id));
  return record ? { name: record.name, searchText: record.searchText || "" } : null;
}

export async function deleteWorkspaceDocument(id: string): Promise<void> {
  const db = await openDatabase();
  await requestInTransaction(db, "readwrite", (store) => store.delete(id));
}

function getAllRecords(): Promise<StoredDocument[]> {
  return openDatabase().then((db) => requestInTransaction<StoredDocument[]>(db, "readonly", (store) => store.getAll()));
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("This browser does not support local document storage."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
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
