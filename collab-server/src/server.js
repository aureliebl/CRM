import { Server } from "@hocuspocus/server";
import * as Y from "yjs";
import { verifyCrdtToken } from "./auth.js";
import { loadDocument, storeSnapshot, storeUpdate } from "./persistence.js";

const PORT = Number(process.env.DOCS_CRDT_PORT || 1234);
const snapshotIntervalMs = Number(process.env.DOCS_CRDT_SNAPSHOT_INTERVAL_MS || 10000);

const lastSnapshotByDoc = new Map();

const server = Server.configure({
  port: PORT,
  async onAuthenticate(data) {
    const token =
      (typeof data.token === "string" ? data.token : null) ||
      (typeof data.requestParameters?.token === "string" ? data.requestParameters.token : null);
    const payload = verifyCrdtToken(token);

    if (!payload) {
      throw new Error("Invalid token");
    }

    if (payload.nodeId !== data.documentName) {
      throw new Error("Token/doc mismatch");
    }

    data.context.token = payload;
  },
  async onLoadDocument(data) {
    const encoded = await loadDocument(data.documentName);
    if (!encoded) return;
    Y.applyUpdate(data.document, encoded);
  },
  async onChange(data) {
    const token = data.context.token;
    if (!token?.canWrite) {
      throw new Error("Readonly token");
    }

    const actorId = token.actorId || null;
    await storeUpdate(data.documentName, data.update, actorId);

    const now = Date.now();
    const last = lastSnapshotByDoc.get(data.documentName) ?? 0;
    if (now - last >= snapshotIntervalMs) {
      const state = Y.encodeStateAsUpdate(data.document);
      await storeSnapshot(data.documentName, state);
      lastSnapshotByDoc.set(data.documentName, now);
    }
  },
  async onDisconnect(data) {
    if (!data.document) return;
    const state = Y.encodeStateAsUpdate(data.document);
    await storeSnapshot(data.documentName, state);
  },
});

server.listen();
console.log(`[docs-collab] running on ws://localhost:${PORT}`);
