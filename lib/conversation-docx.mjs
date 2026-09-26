import { Document, HeadingLevel, Packer, Paragraph, PageBreak, TextRun } from "docx";

function appendConversation(children, conversation, { pageBreak = false } = {}) {
  if (pageBreak) children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({ text: conversation.title || "New Conversation", heading: HeadingLevel.TITLE }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Date: ${new Date(conversation.date).toLocaleString()}`, italics: true })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Model: ${conversation.model}`, italics: true })] }));
  children.push(new Paragraph(""));

  for (const message of conversation.messages) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    children.push(new Paragraph({ text: message.role === "user" ? "You" : "Susan AI", heading: HeadingLevel.HEADING_2 }));
    for (const line of message.content.split(/\r?\n/)) children.push(new Paragraph(line || " "));
    children.push(new Paragraph(""));
  }
}

/** @param {import("./chat-storage").Conversation} conversation */
export async function conversationToDocxBlob(conversation) {
  const children = [];
  appendConversation(children, conversation);
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}

/** @param {import("./chat-storage").Conversation[]} conversations */
export async function conversationsToDocxBlob(conversations) {
  const children = [new Paragraph({ text: "Susan AI — Chat History", heading: HeadingLevel.TITLE })];
  conversations.forEach((conversation, index) => appendConversation(children, conversation, { pageBreak: index > 0 }));
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}
