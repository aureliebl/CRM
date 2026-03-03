import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import type { DocumentationBlock } from "@/lib/documentation-types";
import {
  readBlocksFromDoc,
  replaceBlocksInDoc,
  updateBlockInDoc,
  appendBlockToDoc,
  insertBlockAfterDoc,
  removeBlockFromDoc,
  moveBlockInDoc,
  moveBlockToIndexInDoc,
} from "@/lib/documentation-crdt-serialization";

type TokenPayload = {
  token: string;
  room: string;
  wsUrl: string;
  canWrite: boolean;
  actor: {
    id: string;
    name: string;
    role: "admin" | "operator";
  };
};

export type DocumentationPeer = {
  id: string;
  name: string;
  role: "admin" | "operator";
  color: string;
  cursorBlockId?: string;
};

export type DocumentationCrdtSession = {
  doc: Y.Doc;
  localActorId: string;
  canWrite: boolean;
  updateBlock: (blockId: string, patch: Partial<DocumentationBlock>) => boolean;
  appendBlock: (block: DocumentationBlock) => void;
  insertBlockAfter: (afterBlockId: string | null, block: DocumentationBlock) => void;
  removeBlock: (blockId: string) => boolean;
  moveBlock: (blockId: string, direction: "up" | "down") => boolean;
  moveBlockToIndex: (blockId: string, targetIndex: number) => boolean;
  setCursorBlockId: (blockId: string | null) => void;
  destroy: () => void;
};

function hashColor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 75%, 50%)`;
}

export async function createDocumentationCrdtSession(input: {
  nodeId: string;
  initialBlocks: DocumentationBlock[];
  onBlocksChange: (blocks: DocumentationBlock[]) => void;
  onPeersChange?: (peers: DocumentationPeer[]) => void;
  onStatusChange?: (status: string) => void;
}): Promise<DocumentationCrdtSession> {
  const tokenResponse = await fetch("/api/documentation/crdt/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId: input.nodeId }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Unable to initialize collaborative editing");
  }

  const tokenPayload = (await tokenResponse.json()) as TokenPayload;
  const doc = new Y.Doc();

  const provider = new HocuspocusProvider({
    url: tokenPayload.wsUrl,
    name: tokenPayload.room,
    document: doc,
    token: tokenPayload.token,
  });

  provider.awareness.setLocalStateField("user", {
    id: tokenPayload.actor.id,
    name: tokenPayload.actor.name,
    role: tokenPayload.actor.role,
    color: hashColor(tokenPayload.actor.id),
  });

  provider.on("status", (event: { status: string }) => {
    input.onStatusChange?.(event.status);
  });

  provider.on("synced", (isSynced: boolean) => {
    if (!isSynced) return;
    const blocks = readBlocksFromDoc(doc);
    if (blocks.length === 0 && input.initialBlocks.length > 0 && tokenPayload.canWrite) {
      replaceBlocksInDoc(doc, input.initialBlocks);
      return;
    }
    input.onBlocksChange(blocks);
  });

  const handleDocUpdate = () => {
    input.onBlocksChange(readBlocksFromDoc(doc));
  };
  doc.on("update", handleDocUpdate);

  const handleAwarenessChange = () => {
    const peers: DocumentationPeer[] = [];
    provider.awareness.getStates().forEach((value: unknown) => {
      const user = (value as { user?: DocumentationPeer }).user;
      const cursor = (value as { cursor?: { blockId?: string | null } }).cursor;
      if (!user?.id) return;
      peers.push({
        id: user.id,
        name: user.name || user.id,
        role: user.role || "operator",
        color: user.color || hashColor(user.id),
        cursorBlockId:
          typeof cursor?.blockId === "string" && cursor.blockId.length > 0
            ? cursor.blockId
            : undefined,
      });
    });
    input.onPeersChange?.(peers);
  };
  provider.awareness.on("change", handleAwarenessChange);
  handleAwarenessChange();

  return {
    doc,
    localActorId: tokenPayload.actor.id,
    canWrite: tokenPayload.canWrite,
    updateBlock: (blockId, patch) => (tokenPayload.canWrite ? updateBlockInDoc(doc, blockId, patch) : false),
    appendBlock: (block) => {
      if (!tokenPayload.canWrite) return;
      appendBlockToDoc(doc, block);
    },
    insertBlockAfter: (afterBlockId, block) => {
      if (!tokenPayload.canWrite) return;
      insertBlockAfterDoc(doc, afterBlockId, block);
    },
    removeBlock: (blockId) => (tokenPayload.canWrite ? removeBlockFromDoc(doc, blockId) : false),
    moveBlock: (blockId, direction) => (tokenPayload.canWrite ? moveBlockInDoc(doc, blockId, direction) : false),
    moveBlockToIndex: (blockId, targetIndex) =>
      (tokenPayload.canWrite ? moveBlockToIndexInDoc(doc, blockId, targetIndex) : false),
    setCursorBlockId: (blockId) => {
      provider.awareness.setLocalStateField("cursor", {
        blockId,
      });
    },
    destroy: () => {
      provider.awareness.off("change", handleAwarenessChange);
      doc.off("update", handleDocUpdate);
      provider.destroy();
      doc.destroy();
    },
  };
}
