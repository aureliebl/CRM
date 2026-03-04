declare module "@hocuspocus/provider" {
  import * as Y from "yjs";

  export class HocuspocusProvider {
    constructor(config: {
      url: string;
      name: string;
      document: Y.Doc;
      token?: string;
    });
    awareness: {
      setLocalStateField(field: string, value: unknown): void;
      getStates(): Map<number, unknown>;
      on(event: "change", callback: () => void): void;
      off(event: "change", callback: () => void): void;
    };
    on(event: "status", callback: (event: { status: string }) => void): void;
    on(event: "synced", callback: (isSynced: boolean) => void): void;
    destroy(): void;
  }
}
