import * as Y from "yjs";
import type { DocumentationBlock } from "@/lib/documentation-types";

const BLOCKS_KEY = "blocks";

function sanitizeBlock(input: unknown): DocumentationBlock | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id : "";
  const type = typeof candidate.type === "string" ? candidate.type : "paragraph";
  if (!id) return null;

  return {
    id,
    type: type as DocumentationBlock["type"],
    text: typeof candidate.text === "string" ? candidate.text : undefined,
    language: typeof candidate.language === "string" ? candidate.language : undefined,
    mediaId: typeof candidate.mediaId === "string" ? candidate.mediaId : undefined,
    targetNodeId: typeof candidate.targetNodeId === "string" ? candidate.targetNodeId : undefined,
    targetLabel: typeof candidate.targetLabel === "string" ? candidate.targetLabel : undefined,
    graphId: typeof candidate.graphId === "string" ? candidate.graphId : undefined,
    infoIcon: typeof candidate.infoIcon === "string" ? candidate.infoIcon : undefined,
    infoTone:
      candidate.infoTone === "default" || candidate.infoTone === "muted" || candidate.infoTone === "accent"
        ? candidate.infoTone
        : undefined,
    widthPct: typeof candidate.widthPct === "number" ? candidate.widthPct : undefined,
  };
}

function mapFromBlock(block: DocumentationBlock) {
  const map = new Y.Map<unknown>();
  map.set("id", block.id);
  map.set("type", block.type);
  if (block.text !== undefined) map.set("text", block.text);
  if (block.language !== undefined) map.set("language", block.language);
  if (block.mediaId !== undefined) map.set("mediaId", block.mediaId);
  if (block.targetNodeId !== undefined) map.set("targetNodeId", block.targetNodeId);
  if (block.targetLabel !== undefined) map.set("targetLabel", block.targetLabel);
  if (block.graphId !== undefined) map.set("graphId", block.graphId);
  if (block.infoIcon !== undefined) map.set("infoIcon", block.infoIcon);
  if (block.infoTone !== undefined) map.set("infoTone", block.infoTone);
  if (block.widthPct !== undefined) map.set("widthPct", block.widthPct);
  return map;
}

function mapToBlock(map: Y.Map<unknown>): DocumentationBlock | null {
  return sanitizeBlock(Object.fromEntries(map.entries()));
}

export function getBlocksArray(doc: Y.Doc) {
  return doc.getArray<Y.Map<unknown>>(BLOCKS_KEY);
}

export function readBlocksFromDoc(doc: Y.Doc): DocumentationBlock[] {
  const array = getBlocksArray(doc);
  const next: DocumentationBlock[] = [];
  for (const map of array.toArray()) {
    const block = mapToBlock(map);
    if (block) next.push(block);
  }
  return next;
}

export function replaceBlocksInDoc(doc: Y.Doc, blocks: DocumentationBlock[]) {
  const array = getBlocksArray(doc);
  doc.transact(() => {
    if (array.length > 0) array.delete(0, array.length);
    const mapped = blocks.map((block) => mapFromBlock(block));
    if (mapped.length > 0) array.insert(0, mapped);
  }, "replace-blocks");
}

export function updateBlockInDoc(doc: Y.Doc, blockId: string, patch: Partial<DocumentationBlock>) {
  const array = getBlocksArray(doc);
  const index = array.toArray().findIndex((item) => item.get("id") === blockId);
  if (index < 0) return false;
  const target = array.get(index);
  if (!target) return false;

  doc.transact(() => {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        target.delete(key);
      } else {
        target.set(key, value);
      }
    }
  }, "update-block");

  return true;
}

export function appendBlockToDoc(doc: Y.Doc, block: DocumentationBlock) {
  const array = getBlocksArray(doc);
  doc.transact(() => {
    array.push([mapFromBlock(block)]);
  }, "append-block");
}

export function insertBlockAfterDoc(
  doc: Y.Doc,
  afterBlockId: string | null,
  block: DocumentationBlock
) {
  const array = getBlocksArray(doc);
  const current = array.toArray();

  let insertIndex = current.length;
  if (afterBlockId) {
    const index = current.findIndex((item) => item.get("id") === afterBlockId);
    if (index >= 0) {
      insertIndex = index + 1;
    }
  }

  doc.transact(() => {
    array.insert(insertIndex, [mapFromBlock(block)]);
  }, "insert-block-after");
}

export function removeBlockFromDoc(doc: Y.Doc, blockId: string) {
  const array = getBlocksArray(doc);
  const index = array.toArray().findIndex((item) => item.get("id") === blockId);
  if (index < 0) return false;

  doc.transact(() => {
    array.delete(index, 1);
  }, "remove-block");

  return true;
}

export function moveBlockInDoc(doc: Y.Doc, blockId: string, direction: "up" | "down") {
  const array = getBlocksArray(doc);
  const current = array.toArray();
  const index = current.findIndex((item) => item.get("id") === blockId);
  if (index < 0) return false;

  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= current.length) return false;

  doc.transact(() => {
    const item = array.get(index);
    if (!item) return;
    array.delete(index, 1);
    array.insert(nextIndex, [item]);
  }, "move-block");

  return true;
}

export function moveBlockToIndexInDoc(doc: Y.Doc, blockId: string, targetIndex: number) {
  const array = getBlocksArray(doc);
  const current = array.toArray();
  const index = current.findIndex((item) => item.get("id") === blockId);
  if (index < 0) return false;

  const boundedTarget = Math.max(0, Math.min(current.length - 1, targetIndex));
  if (boundedTarget === index) return false;

  doc.transact(() => {
    const item = array.get(index);
    if (!item) return;
    array.delete(index, 1);
    const insertAt = Math.max(0, Math.min(array.length, boundedTarget));
    array.insert(insertAt, [item]);
  }, "move-block-to-index");

  return true;
}
