const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Group summaries by the user's local calendar day, newest day first.
 * @param {import("./chat-storage").ConversationSummary[]} conversations
 * @param {Date} [now]
 */
export function groupConversationHistory(conversations, now = new Date()) {
  const todayIndex = localDayIndex(now);
  const groups = new Map();
  const sorted = [...conversations].sort((a, b) => b.date - a.date);

  for (const conversation of sorted) {
    const date = new Date(conversation.date);
    const difference = todayIndex - localDayIndex(date);
    const label = difference === 0
      ? "Today"
      : difference === 1
        ? "Yesterday"
        : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const key = difference === 0 ? "today" : difference === 1 ? "yesterday" : `date-${localDayIndex(date)}`;
    const current = groups.get(key);
    if (current) current.items.push(conversation);
    else groups.set(key, { key, label, items: [conversation], dayIndex: localDayIndex(date) });
  }

  return [...groups.values()].sort((a, b) => b.dayIndex - a.dayIndex).map(({ key, label, items }) => ({ key, label, items }));
}

export function normalizeConversationOrganization(value) {
  const empty = { folders: [], items: {} };
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const source = value;
  const folders = Array.isArray(source.folders)
    ? [...new Set(source.folders.filter((folder) => typeof folder === "string").map((folder) => folder.trim().slice(0, 40)).filter(Boolean))].slice(0, 20)
    : [];
  const sourceItems = source.items && typeof source.items === "object" && !Array.isArray(source.items) ? source.items : {};
  const items = {};
  for (const [id, entry] of Object.entries(sourceItems).slice(0, 500)) {
    if (!id || !entry || typeof entry !== "object") continue;
    const pinned = entry.pinned === true;
    const folder = typeof entry.folder === "string" && folders.includes(entry.folder) ? entry.folder : undefined;
    if (pinned || folder) items[id] = { ...(pinned ? { pinned: true } : {}), ...(folder ? { folder } : {}) };
  }
  return { folders, items };
}

export function createConversationFolder(folders, input) {
  const name = String(input).trim().replace(/\s+/g, " ").slice(0, 40);
  if (!name) throw new Error("Enter a folder name.");
  if (folders.some((folder) => folder.toLowerCase() === name.toLowerCase())) throw new Error("A folder with that name already exists.");
  if (folders.length >= 20) throw new Error("You can create up to 20 history folders.");
  return [...folders, name].sort((a, b) => a.localeCompare(b));
}

export function updateConversationOrganization(organization, id, patch) {
  const current = organization.items[id] || {};
  const next = { ...current };
  if (typeof patch.pinned === "boolean") {
    if (patch.pinned) next.pinned = true;
    else delete next.pinned;
  }
  if (Object.hasOwn(patch, "folder")) {
    const folder = typeof patch.folder === "string" ? patch.folder : "";
    if (folder && !organization.folders.includes(folder)) throw new Error("Choose an existing folder.");
    if (folder) next.folder = folder;
    else delete next.folder;
  }
  const items = { ...organization.items };
  if (Object.keys(next).length) items[id] = next;
  else delete items[id];
  return { folders: [...organization.folders], items };
}

export function sortConversationsPinnedFirst(conversations, organization) {
  return [...conversations].sort((a, b) => Number(Boolean(organization.items[b.id]?.pinned)) - Number(Boolean(organization.items[a.id]?.pinned)) || b.date - a.date);
}

export function removeConversationOrganizationEntry(organization, id) {
  const items = { ...organization.items };
  delete items[id];
  return { folders: [...organization.folders], items };
}

/** @param {import("./chat-storage").Conversation} conversation */
export function conversationToMarkdown(conversation) {
  const title = conversation.title || "New Conversation";
  const date = new Date(conversation.date);
  const model = conversation.model || "Unknown model";
  const turns = conversation.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => `### ${message.role === "user" ? "You" : "Susan AI"}\n\n${message.content.trim()}`)
    .join("\n\n");

  return `# ${title}\n\n- Date: ${Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString()}\n- Model: ${model}\n\n---\n\n${turns}\n`;
}

function localDayIndex(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}
