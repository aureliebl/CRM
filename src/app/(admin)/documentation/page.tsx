"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import hljs from "highlight.js";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { useLocale } from "@/lib/use-locale";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import type {
  DocumentationBlock,
  DocumentationBlockType,
  DocumentationNode,
  DocumentationTreeItem,
} from "@/lib/documentation-types";
import {
  createDocumentationCrdtSession,
  type DocumentationCrdtSession,
  type DocumentationPeer,
} from "@/lib/documentation-crdt-client";

type TreePayload = {
  tree: DocumentationTreeItem[];
  pages: DocumentationTreeItem[];
};

const TEXT_BLOCK_TYPES: DocumentationBlockType[] = [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "subtitle",
  "info",
  "code",
  "link",
];

const SLASH_BLOCK_TYPES: DocumentationBlockType[] = [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "subtitle",
  "info",
  "code",
  "link",
  "image",
];

function makeBlock(type: DocumentationBlockType): DocumentationBlock {
  const id = `blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  if (type === "image") {
    return { id, type, widthPct: 100 };
  }
  if (type === "link") {
    return { id, type, targetLabel: "" };
  }
  if (type === "code") {
    return { id, type, text: "" };
  }
  return { id, type, text: "" };
}

function detectLanguage(code: string): string {
  if (!code.trim()) return "plaintext";
  const result = hljs.highlightAuto(code);
  return result.language || "plaintext";
}

function getInlineTextBlockStyle(type: DocumentationBlockType): React.CSSProperties {
  if (type === "heading1") {
    return {
      fontFamily: "inherit",
      fontSize: "2.05rem",
      fontWeight: 650,
      lineHeight: 1.25,
      letterSpacing: "-0.02em",
      paddingTop: "0.34rem",
      paddingBottom: "0.28rem",
    };
  }
  if (type === "heading2") {
    return {
      fontFamily: "inherit",
      fontSize: "1.58rem",
      fontWeight: 620,
      lineHeight: 1.32,
      letterSpacing: "-0.018em",
      paddingTop: "0.28rem",
      paddingBottom: "0.22rem",
    };
  }
  if (type === "heading3") {
    return {
      fontFamily: "inherit",
      fontSize: "1.26rem",
      fontWeight: 600,
      lineHeight: 1.35,
      letterSpacing: "-0.014em",
      paddingTop: "0.22rem",
      paddingBottom: "0.18rem",
    };
  }
  if (type === "subtitle") {
    return {
      fontFamily: "inherit",
      fontSize: "1.02rem",
      fontWeight: 500,
      lineHeight: 1.5,
      letterSpacing: "-0.006em",
      color: "var(--text-secondary)",
    };
  }
  if (type === "info") {
    return {
      fontFamily: "inherit",
      fontSize: "0.95rem",
      fontWeight: 500,
      lineHeight: 1.5,
      background: "var(--bg-hover)",
      border: "1px solid var(--border-color)",
      borderRadius: "0.5rem",
      padding: "0.42rem 0.6rem",
    };
  }
  return {
    fontFamily: "inherit",
    fontSize: "1rem",
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: "-0.01em",
  };
}

export default function DocumentationPage() {
  const { locale } = useLocale();
  const labels =
    locale === "fr"
      ? {
          title: "Documentation",
          description: "Créez des dossiers/pages, éditez en blocs et ajoutez des images comme dans Notion.",
          treeTitle: "Arborescence",
          newFolder: "Nouveau dossier",
          newPage: "Nouvelle page",
          root: "Racine",
          move: "Déplacer",
          delete: "Supprimer",
          save: "Enregistrer",
          privatePage: "Page privée (visible uniquement par vous)",
          folderPublic: "Dossier public",
          folderGroup: "Dossier groupe",
          noSelection: "Sélectionnez une page pour éditer son contenu.",
          addBlock: "Ajouter bloc",
          dropImage: "Glissez une image ici",
          importImage: "Importer une image",
          loading: "Chargement...",
          emptyTree: "Aucun document",
          blocks: "Blocs",
          pageSettings: "Paramètres page",
          folderSettings: "Paramètres dossier",
          access: "Partage",
          linkToPage: "Lien vers page",
          linkLabel: "Texte du lien",
          codePreview: "Aperçu code",
          noPages: "Aucune page disponible",
          untitled: "Sans titre",
        }
      : {
          title: "Documentation",
          description: "Create folders/pages, edit with blocks, and add Notion-like images.",
          treeTitle: "Tree",
          newFolder: "New folder",
          newPage: "New page",
          root: "Root",
          move: "Move",
          delete: "Delete",
          save: "Save",
          privatePage: "Private page (visible only to you)",
          folderPublic: "Public folder",
          folderGroup: "Group folder",
          noSelection: "Select a page to edit content.",
          addBlock: "Add block",
          dropImage: "Drop an image here",
          importImage: "Import image",
          loading: "Loading...",
          emptyTree: "No documents",
          blocks: "Blocks",
          pageSettings: "Page settings",
          folderSettings: "Folder settings",
          access: "Sharing",
          linkToPage: "Link to page",
          linkLabel: "Link label",
          codePreview: "Code preview",
          noPages: "No page available",
          untitled: "Untitled",
        };

  const [tree, setTree] = useState<DocumentationTreeItem[]>([]);
  const [pages, setPages] = useState<DocumentationTreeItem[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<DocumentationNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [crdtStatus, setCrdtStatus] = useState("disconnected");
  const [crdtPeers, setCrdtPeers] = useState<DocumentationPeer[]>([]);
  const [crdtCanWrite, setCrdtCanWrite] = useState(true);
  const [localActorId, setLocalActorId] = useState<string | null>(null);
  const [crdtReconnectTick, setCrdtReconnectTick] = useState(0);
  const [slashMenu, setSlashMenu] = useState<{
    blockId: string;
    selectedIndex: number;
  } | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | null>(null);
  const crdtSessionRef = useRef<DocumentationCrdtSession | null>(null);
  const initialBlocksRef = useRef<DocumentationBlock[]>([]);
  const blockInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const autoResizeTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.max(28, element.scrollHeight)}px`;
  };

  const refreshTree = useCallback(async () => {
    const res = await fetch("/api/documentation/tree", { cache: "no-store" });
    if (!res.ok) {
      setTree([]);
      setPages([]);
      return;
    }
    const payload = (await res.json()) as TreePayload;
    setTree(payload.tree ?? []);
    setPages(payload.pages ?? []);

    if (!selectedNodeId && payload.tree?.length) {
      const firstPage = payload.tree.find((node) => node.kind === "page") ?? payload.tree[0];
      setSelectedNodeId(firstPage.id);
    }
  }, [selectedNodeId]);

  const loadNode = useCallback(async (nodeId: string | null) => {
    if (!nodeId) {
      setSelectedNode(null);
      return;
    }
    const res = await fetch(`/api/documentation/nodes/${nodeId}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setSelectedNode(null);
      return;
    }
    const node = (await res.json()) as DocumentationNode;
    setSelectedNode(node);
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      await refreshTree();
      if (!mounted) return;
      setLoading(false);
    };
    run();
    return () => {
      mounted = false;
    };
  }, [refreshTree]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      setSelectedNode(null);
      await loadNode(selectedNodeId);
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [selectedNodeId, loadNode]);

  useEffect(() => {
    if (selectedNode?.kind === "page" && selectedNode.id === selectedNodeId) {
      initialBlocksRef.current = selectedNode.content;
    }
  }, [selectedNodeId, selectedNode?.id, selectedNode?.kind, selectedNode?.content]);

  useEffect(() => {
    if (selectedNode?.kind !== "page") return;
    for (const block of selectedNode.content) {
      if (block.type === "code") continue;
      autoResizeTextarea(blockInputRefs.current[block.id] ?? null);
    }
  }, [selectedNode?.kind, selectedNode?.content]);

  useEffect(() => {
    if (!selectedNodeId || selectedNode?.kind !== "page" || selectedNode.id !== selectedNodeId) {
      crdtSessionRef.current?.destroy();
      crdtSessionRef.current = null;
      queueMicrotask(() => {
        setLocalActorId(null);
      });
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setCrdtStatus("connecting");
        const session = await createDocumentationCrdtSession({
          nodeId: selectedNodeId,
          initialBlocks: initialBlocksRef.current,
          onBlocksChange: (blocks) => {
            setSelectedNode((current) => {
              if (!current || current.kind !== "page" || current.id !== selectedNodeId) {
                return current;
              }
              return { ...current, content: blocks };
            });
          },
          onPeersChange: setCrdtPeers,
          onStatusChange: setCrdtStatus,
        });

        if (cancelled) {
          session.destroy();
          return;
        }

        crdtSessionRef.current?.destroy();
        crdtSessionRef.current = session;
        setCrdtCanWrite(session.canWrite);
        setLocalActorId(session.localActorId);
      } catch {
        if (cancelled) return;
        setCrdtStatus("error");
        setCrdtPeers([]);
        setLocalActorId(null);
      }
    };

    void run();

    return () => {
      cancelled = true;
      crdtSessionRef.current?.destroy();
      crdtSessionRef.current = null;
      setCrdtPeers([]);
      setCrdtStatus("disconnected");
      setLocalActorId(null);
    };
  }, [selectedNodeId, selectedNode?.id, selectedNode?.kind, crdtReconnectTick]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, DocumentationTreeItem[]>();
    for (const node of tree) {
      const key = node.parentId ?? null;
      const current = map.get(key) ?? [];
      current.push(node);
      map.set(key, current);
    }

    for (const [key, value] of map.entries()) {
      value.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
        return a.title.localeCompare(b.title, locale === "fr" ? "fr" : "en", {
          sensitivity: "base",
        });
      });
      map.set(key, value);
    }

    return map;
  }, [tree, locale]);

  const folderOptions = useMemo(
    () => [{ id: "", title: labels.root }, ...tree.filter((node) => node.kind === "folder").map((node) => ({ id: node.id, title: node.title }))],
    [tree, labels.root]
  );

  const handleCreateNode = async (kind: "folder" | "page") => {
    const title = window.prompt(kind === "folder" ? labels.newFolder : labels.newPage);
    if (!title) return;

    const parentId = selectedNode?.kind === "folder" ? selectedNode.id : selectedNode?.parentId ?? null;

    const res = await fetch("/api/documentation/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        title,
        parentId,
        isPrivate: kind === "page" ? false : undefined,
      }),
    });

    if (!res.ok) {
      alert("Creation failed");
      return;
    }

    const created = (await res.json()) as DocumentationNode;
    await refreshTree();
    setSelectedNodeId(created.id);
  };

  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    const confirmed = window.confirm(`${labels.delete} \"${selectedNode.title}\" ?`);
    if (!confirmed) return;

    const res = await fetch(`/api/documentation/nodes/${selectedNode.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Delete failed");
      return;
    }

    setSelectedNodeId(null);
    setSelectedNode(null);
    await refreshTree();
  };

  const handleMoveNode = async (parentId: string | null) => {
    if (!selectedNode) return;

    const res = await fetch(`/api/documentation/nodes/${selectedNode.id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId }),
    });

    if (!res.ok) {
      alert("Move failed");
      return;
    }

    await refreshTree();
    await loadNode(selectedNode.id);
  };

  const handleSaveNode = async () => {
    if (!selectedNode) return;
    setSaving(true);

    const res = await fetch(`/api/documentation/nodes/${selectedNode.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selectedNode.title,
        isPrivate: selectedNode.kind === "page" ? selectedNode.isPrivate : undefined,
        folderVisibility:
          selectedNode.kind === "folder" ? selectedNode.folderVisibility : undefined,
        content: selectedNode.kind === "page" ? selectedNode.content : undefined,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      alert("Save failed");
      return;
    }

    const updated = (await res.json()) as DocumentationNode;
    setSelectedNode(updated);
    await refreshTree();
  };

  const handleExportNode = async (format: "pdf" | "doc") => {
    if (!selectedNode || selectedNode.kind !== "page") return;

    const res = await fetch("/api/documentation/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeId: selectedNode.id,
        format,
        content: selectedNode.content,
      }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      alert(payload?.error || "Export failed");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const defaultName = `${selectedNode.title || "Documentation"}.${format === "pdf" ? "pdf" : "docx"}`;
    link.href = url;
    link.download = defaultName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const updateSelectedBlock = (blockId: string, patch: Partial<DocumentationBlock>) => {
    if (selectedNode?.kind === "page" && crdtSessionRef.current) {
      crdtSessionRef.current.updateBlock(blockId, patch);
      return;
    }

    setSelectedNode((current) => {
      if (!current || current.kind !== "page") return current;
      const nextBlocks = current.content.map((block) =>
        block.id === blockId ? { ...block, ...patch } : block
      );
      return { ...current, content: nextBlocks };
    });
  };

  const focusBlockInput = (blockId: string) => {
    requestAnimationFrame(() => {
      const target = blockInputRefs.current[blockId];
      if (!target) return;
      target.focus();
      const length = target.value.length;
      target.setSelectionRange(length, length);
    });
  };

  const insertBlockAfter = (
    afterBlockId: string | null,
    type: DocumentationBlockType,
    initialPatch?: Partial<DocumentationBlock>
  ) => {
    const block = { ...makeBlock(type), ...initialPatch } as DocumentationBlock;

    if (selectedNode?.kind === "page" && crdtSessionRef.current) {
      crdtSessionRef.current.insertBlockAfter(afterBlockId, block);
      return block.id;
    }

    setSelectedNode((current) => {
      if (!current || current.kind !== "page") return current;

      const index = afterBlockId
        ? current.content.findIndex((item) => item.id === afterBlockId)
        : current.content.length - 1;
      const nextIndex = index >= 0 ? index + 1 : current.content.length;
      const nextContent = [...current.content];
      nextContent.splice(nextIndex, 0, block);

      return { ...current, content: nextContent };
    });

    return block.id;
  };

  const addBlock = (type: DocumentationBlockType) => {
    const lastBlockId = selectedNode?.kind === "page"
      ? selectedNode.content[selectedNode.content.length - 1]?.id ?? null
      : null;
    const blockId = insertBlockAfter(lastBlockId, type);
    if (type !== "image") {
      focusBlockInput(blockId);
    }
    setSlashMenu(null);
  };

  const removeBlock = (blockId: string) => {
    if (selectedNode?.kind === "page" && crdtSessionRef.current) {
      crdtSessionRef.current.removeBlock(blockId);
      return;
    }

    setSelectedNode((current) => {
      if (!current || current.kind !== "page") return current;
      return {
        ...current,
        content: current.content.filter((block) => block.id !== blockId),
      };
    });
  };

  const moveBlockToIndex = (blockId: string, targetIndex: number) => {
    if (selectedNode?.kind === "page" && crdtSessionRef.current) {
      crdtSessionRef.current.moveBlockToIndex(blockId, targetIndex);
      return;
    }

    setSelectedNode((current) => {
      if (!current || current.kind !== "page") return current;
      const fromIndex = current.content.findIndex((item) => item.id === blockId);
      if (fromIndex < 0) return current;

      const nextContent = [...current.content];
      const [moved] = nextContent.splice(fromIndex, 1);
      if (!moved) return current;

      const boundedTarget = Math.max(0, Math.min(nextContent.length, targetIndex));
      nextContent.splice(boundedTarget, 0, moved);

      return { ...current, content: nextContent };
    });
  };

  const getDropTargetIndex = (
    content: DocumentationBlock[],
    sourceBlockId: string,
    targetBlockId: string,
    position: "before" | "after"
  ) => {
    if (sourceBlockId === targetBlockId) return null;
    const remaining = content.filter((item) => item.id !== sourceBlockId);
    const targetIndex = remaining.findIndex((item) => item.id === targetBlockId);
    if (targetIndex < 0) return null;
    return position === "before" ? targetIndex : targetIndex + 1;
  };

  const handleDragEnd = () => {
    setDraggingBlockId(null);
    setDragOverBlockId(null);
    setDragOverPosition(null);
  };

  const handleDropOnBlock = (
    targetBlockId: string,
    position: "before" | "after",
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();

    if (!crdtCanWrite || selectedNode?.kind !== "page" || !draggingBlockId) {
      handleDragEnd();
      return;
    }

    const targetIndex = getDropTargetIndex(
      selectedNode.content,
      draggingBlockId,
      targetBlockId,
      position
    );

    if (targetIndex !== null) {
      moveBlockToIndex(draggingBlockId, targetIndex);
    }

    handleDragEnd();
  };

  const publishCursorBlock = (blockId: string | null) => {
    if (blockId && crdtStatus === "disconnected") {
      setCrdtReconnectTick((current) => current + 1);
    }
    crdtSessionRef.current?.setCursorBlockId(blockId);
  };

  const applySlashCommand = (blockId: string, type: DocumentationBlockType) => {
    setSlashMenu(null);

    if (type === "image") {
      insertBlockAfter(blockId, "image");
      return;
    }

    updateSelectedBlock(blockId, {
      type,
    });
    focusBlockInput(blockId);
  };

  const handleTextBlockKeyDown = (
    block: DocumentationBlock,
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (!crdtCanWrite || selectedNode?.kind !== "page") return;

    const currentText = block.text ?? "";

    if (event.key === "Escape") {
      setSlashMenu(null);
      return;
    }

    if (slashMenu?.blockId === block.id) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashMenu((current) => {
          if (!current || current.blockId !== block.id) return current;
          return {
            ...current,
            selectedIndex: (current.selectedIndex + 1) % SLASH_BLOCK_TYPES.length,
          };
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashMenu((current) => {
          if (!current || current.blockId !== block.id) return current;
          return {
            ...current,
            selectedIndex:
              (current.selectedIndex - 1 + SLASH_BLOCK_TYPES.length) % SLASH_BLOCK_TYPES.length,
          };
        });
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selectedType = SLASH_BLOCK_TYPES[slashMenu.selectedIndex] ?? "paragraph";
        applySlashCommand(block.id, selectedType);
        return;
      }
    }

    if (event.key === "/" && currentText.trim().length === 0) {
      event.preventDefault();
      setSlashMenu({ blockId: block.id, selectedIndex: 0 });
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && block.type !== "code") {
      event.preventDefault();
      const nextId = insertBlockAfter(block.id, "paragraph");
      focusBlockInput(nextId);
      setSlashMenu(null);
      return;
    }

    if (event.key === "Backspace" && currentText.length === 0) {
      const content = selectedNode.content;
      const index = content.findIndex((item) => item.id === block.id);
      if (index <= 0) return;

      event.preventDefault();
      const previous = content[index - 1];
      removeBlock(block.id);
      focusBlockInput(previous.id);
      setSlashMenu(null);
    }
  };

  const uploadImage = async (file: File) => {
    if (!selectedNode || selectedNode.kind !== "page") return;

    const form = new FormData();
    form.set("nodeId", selectedNode.id);
    form.set("file", file);

    const res = await fetch("/api/documentation/media/upload", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      alert("Upload failed");
      return;
    }

    const payload = (await res.json()) as { id: string };
    const lastBlockId =
      selectedNode.content[selectedNode.content.length - 1]?.id ?? null;
    insertBlockAfter(lastBlockId, "image", {
      mediaId: payload.id,
      widthPct: 100,
    });
  };

  const handleDropImage: React.DragEventHandler<HTMLDivElement> = async (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await uploadImage(file);
  };

  const handleImageInputChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadImage(file);
    event.currentTarget.value = "";
  };

  const renderTree = (parentId: string | null, depth = 0): React.ReactNode => {
    const items = childrenByParent.get(parentId) ?? [];
    if (items.length === 0) return null;

    return items.map((node) => {
      const isSelected = node.id === selectedNodeId;
      return (
        <div key={node.id}>
          <button
            type="button"
            onClick={() => setSelectedNodeId(node.id)}
            style={{
              width: "100%",
              textAlign: "left",
              border: "1px solid var(--border-color)",
              borderRadius: "0.5rem",
              background: isSelected ? "var(--bg-hover)" : "var(--button-bg)",
              color: "var(--text-primary)",
              padding: "0.35rem 0.5rem",
              marginBottom: "0.25rem",
              marginLeft: `${depth * 12}px`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <MaterialSymbol
              name={node.kind === "folder" ? "folder" : "description"}
              size={16}
              weight={500}
              opticalSize={20}
            />
            <span>{node.title || labels.untitled}</span>
            {node.isPrivate && (
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginLeft: "auto" }}>
                private
              </span>
            )}
          </button>
          {renderTree(node.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div>
      <h1 className="admin-page-title">{labels.title}</h1>
      <p className="admin-page-description">{labels.description}</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 360px) minmax(0, 1fr)",
          gap: "1rem",
        }}
      >
        <section className="admin-placeholder-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div className="admin-placeholder-title">{labels.treeTitle}</div>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <button className="admin-btn admin-btn-secondary" type="button" onClick={() => handleCreateNode("folder")}>
                {labels.newFolder}
              </button>
              <button className="admin-btn admin-btn-secondary" type="button" onClick={() => handleCreateNode("page")}>
                {labels.newPage}
              </button>
            </div>
          </div>

          <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
            {loading ? (
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{labels.loading}</div>
            ) : tree.length === 0 ? (
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{labels.emptyTree}</div>
            ) : (
              renderTree(null)
            )}
          </div>
        </section>

        <section className="admin-placeholder-card">
          {!selectedNode ? (
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>{labels.noSelection}</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {selectedNode.kind === "page" && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.5rem",
                    border: "1px solid var(--border-color)",
                    borderRadius: "0.65rem",
                    padding: "0.45rem 0.6rem",
                  }}
                >
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    CRDT · {crdtStatus} · {crdtCanWrite ? "write" : "read-only"}
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    {crdtStatus === "disconnected" && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        onClick={() => setCrdtReconnectTick((current) => current + 1)}
                      >
                        reconnect
                      </button>
                    )}
                    {crdtPeers.map((peer) => (
                      <span
                        key={peer.id}
                        style={{
                          fontSize: "0.72rem",
                          border: "1px solid var(--border-color)",
                          borderRadius: "999px",
                          padding: "0.18rem 0.45rem",
                          color: "var(--text-primary)",
                          background: peer.color,
                        }}
                      >
                        {peer.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  value={selectedNode.title}
                  onChange={(e) =>
                    setSelectedNode((current) =>
                      current ? { ...current, title: e.target.value } : current
                    )
                  }
                  style={{
                    flex: 1,
                    border: "1px solid var(--border-color)",
                    borderRadius: "0.6rem",
                    padding: "0.5rem 0.65rem",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                    fontSize: "0.95rem",
                  }}
                />
                <button className="admin-btn admin-btn-secondary" type="button" onClick={handleSaveNode} disabled={saving}>
                  {labels.save}
                </button>
                <button className="admin-btn admin-btn-secondary" type="button" onClick={handleDeleteNode}>
                  {labels.delete}
                </button>
                {selectedNode.kind === "page" && (
                  <>
                    <button
                      className="admin-btn admin-btn-secondary"
                      type="button"
                      onClick={() => handleExportNode("pdf")}
                    >
                      Export PDF
                    </button>
                    <button
                      className="admin-btn admin-btn-secondary"
                      type="button"
                      onClick={() => handleExportNode("doc")}
                    >
                      Export DOC
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                    {labels.move}
                  </div>
                  <select
                    value={selectedNode.parentId ?? ""}
                    onChange={(e) => handleMoveNode(e.target.value || null)}
                    style={{
                      width: "100%",
                      border: "1px solid var(--border-color)",
                      borderRadius: "0.55rem",
                      padding: "0.4rem 0.5rem",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {folderOptions
                      .filter((option) => option.id !== selectedNode.id)
                      .map((option) => (
                        <option key={option.id || "root"} value={option.id}>
                          {option.title}
                        </option>
                      ))}
                  </select>
                </div>

                {selectedNode.kind === "folder" ? (
                  <div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                      {labels.access}
                    </div>
                    <select
                      value={selectedNode.folderVisibility}
                      onChange={(e) =>
                        setSelectedNode((current) =>
                          current && current.kind === "folder"
                            ? {
                                ...current,
                                folderVisibility: e.target.value as "public" | "group",
                              }
                            : current
                        )
                      }
                      style={{
                        width: "100%",
                        border: "1px solid var(--border-color)",
                        borderRadius: "0.55rem",
                        padding: "0.4rem 0.5rem",
                        background: "var(--input-bg)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="public">{labels.folderPublic}</option>
                      <option value="group">{labels.folderGroup}</option>
                    </select>
                  </div>
                ) : (
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.35rem" }}>
                    <input
                      type="checkbox"
                      checked={selectedNode.isPrivate}
                      onChange={(e) =>
                        setSelectedNode((current) =>
                          current && current.kind === "page"
                            ? { ...current, isPrivate: e.target.checked }
                            : current
                        )
                      }
                    />
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {labels.privatePage}
                    </span>
                  </label>
                )}
              </div>

              {selectedNode.kind === "page" && (
                <>
                  <div
                    onDrop={handleDropImage}
                    onDragOver={(e) => e.preventDefault()}
                    style={{
                      border: "1px dashed var(--border-color)",
                      borderRadius: "0.7rem",
                      padding: "0.8rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.7rem",
                    }}
                  >
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{labels.dropImage}</span>
                    <label className="admin-btn admin-btn-secondary" style={{ cursor: "pointer" }}>
                      {labels.importImage}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={handleImageInputChange} />
                    </label>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.45rem" }}>
                      {labels.addBlock}
                    </div>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      {[...TEXT_BLOCK_TYPES, "image"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          onClick={() => addBlock(type as DocumentationBlockType)}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="doc-editor-surface">
                    {selectedNode.content.map((block) => {
                      const blockPeers = crdtPeers.filter(
                        (peer) => peer.id !== localActorId && peer.cursorBlockId === block.id
                      );
                      const isDropTarget = dragOverBlockId === block.id;
                      const blockClassName = [
                        "doc-editor-block",
                        draggingBlockId === block.id ? "doc-editor-block-dragging" : "",
                        isDropTarget && dragOverPosition === "before" ? "doc-editor-block-drop-before" : "",
                        isDropTarget && dragOverPosition === "after" ? "doc-editor-block-drop-after" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                      <div
                        key={block.id}
                        className={blockClassName}
                        onDragOver={(event) => {
                          if (!crdtCanWrite || !draggingBlockId || draggingBlockId === block.id) return;
                          event.preventDefault();
                          const rect = event.currentTarget.getBoundingClientRect();
                          const nextPosition: "before" | "after" =
                            event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                          if (dragOverBlockId !== block.id || dragOverPosition !== nextPosition) {
                            setDragOverBlockId(block.id);
                            setDragOverPosition(nextPosition);
                          }
                        }}
                        onDragLeave={(event) => {
                          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                          if (dragOverBlockId === block.id) {
                            setDragOverBlockId(null);
                            setDragOverPosition(null);
                          }
                        }}
                        onDrop={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const position: "before" | "after" =
                            event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                          handleDropOnBlock(block.id, position, event);
                        }}
                      >
                        <div className="doc-editor-handle-col">
                          <button
                            type="button"
                            className="doc-editor-handle"
                            title="Block actions"
                            draggable={crdtCanWrite}
                            onClick={() => publishCursorBlock(block.id)}
                            onDragStart={(event) => {
                              if (!crdtCanWrite) return;
                              event.dataTransfer.effectAllowed = "move";
                              setDraggingBlockId(block.id);
                              setDragOverBlockId(null);
                              setDragOverPosition(null);
                              setSlashMenu(null);
                              publishCursorBlock(block.id);
                            }}
                            onDragEnd={handleDragEnd}
                          >
                            <MaterialSymbol name="drag_indicator" size={16} weight={500} opticalSize={20} />
                          </button>
                        </div>

                        <div className="doc-editor-block-body">
                          <div className="doc-editor-block-toolbar">
                            <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginLeft: "auto" }}>
                              {blockPeers.map((peer) => (
                                <span
                                  key={`${block.id}_${peer.id}`}
                                  className="doc-editor-peer-badge"
                                  style={{ borderColor: peer.color, color: peer.color }}
                                >
                                  {peer.name}
                                </span>
                              ))}
                            </div>
                          </div>

                          {block.type === "image" ? (
                          <div style={{ display: "grid", gap: "0.45rem" }} onFocus={() => publishCursorBlock(block.id)}>
                            {block.mediaId ? (
                              <img
                                src={`/api/documentation/media/${block.mediaId}`}
                                alt="Documentation"
                                style={{
                                  width: `${Math.max(20, Math.min(100, block.widthPct ?? 100))}%`,
                                  borderRadius: "0.55rem",
                                  border: "1px solid var(--border-color)",
                                }}
                              />
                            ) : (
                              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{labels.importImage}</div>
                            )}
                            <input
                              type="range"
                              min={20}
                              max={100}
                              value={Math.max(20, Math.min(100, block.widthPct ?? 100))}
                              disabled={!crdtCanWrite}
                              onChange={(e) => updateSelectedBlock(block.id, { widthPct: Number(e.target.value) })}
                            />
                          </div>
                          ) : block.type === "link" ? (
                          <div style={{ display: "grid", gap: "0.35rem" }}>
                            <input
                              value={block.targetLabel ?? ""}
                              disabled={!crdtCanWrite}
                              onFocus={() => publishCursorBlock(block.id)}
                              onChange={(e) => updateSelectedBlock(block.id, { targetLabel: e.target.value })}
                              placeholder={labels.linkLabel}
                              style={{
                                border: "1px solid var(--border-color)",
                                borderRadius: "0.5rem",
                                padding: "0.4rem",
                                background: "var(--input-bg)",
                                color: "var(--text-primary)",
                              }}
                            />
                            <select
                              value={block.targetNodeId ?? ""}
                              disabled={!crdtCanWrite}
                              onFocus={() => publishCursorBlock(block.id)}
                              onChange={(e) => updateSelectedBlock(block.id, { targetNodeId: e.target.value || undefined })}
                              style={{
                                border: "1px solid var(--border-color)",
                                borderRadius: "0.5rem",
                                padding: "0.4rem",
                                background: "var(--input-bg)",
                                color: "var(--text-primary)",
                              }}
                            >
                              <option value="">{labels.linkToPage}</option>
                              {pages.map((page) => (
                                <option key={page.id} value={page.id}>{page.title || labels.untitled}</option>
                              ))}
                            </select>
                            {pages.length === 0 && (
                              <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)" }}>{labels.noPages}</div>
                            )}
                          </div>
                          ) : block.type === "code" ? (
                          <>
                            <textarea
                              ref={(element) => {
                                blockInputRefs.current[block.id] = element;
                              }}
                              value={block.text ?? ""}
                              readOnly={!crdtCanWrite}
                              onFocus={() => publishCursorBlock(block.id)}
                              onKeyDown={(event) => handleTextBlockKeyDown(block, event)}
                              onChange={(e) => {
                                const nextText = e.target.value;
                                updateSelectedBlock(block.id, {
                                  text: nextText,
                                  language: detectLanguage(nextText),
                                });
                              }}
                              rows={6}
                              style={{
                                width: "100%",
                                border: "1px solid var(--border-color)",
                                borderRadius: "0.55rem",
                                padding: "0.55rem",
                                background: "var(--input-bg)",
                                color: "var(--text-primary)",
                                resize: "vertical",
                                boxSizing: "border-box",
                              }}
                            />
                            <div>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", margin: "0.35rem 0" }}>
                                {labels.codePreview} · {block.language || "plaintext"}
                              </div>
                              <SyntaxHighlighter
                                language={block.language || "plaintext"}
                                style={atomOneDark}
                                customStyle={{ borderRadius: "0.55rem", margin: 0 }}
                              >
                                {block.text || ""}
                              </SyntaxHighlighter>
                            </div>
                          </>
                          ) : (
                            <textarea
                              ref={(element) => {
                                blockInputRefs.current[block.id] = element;
                                autoResizeTextarea(element);
                              }}
                              value={block.text ?? ""}
                              readOnly={!crdtCanWrite}
                              onFocus={() => publishCursorBlock(block.id)}
                              onKeyDown={(event) => handleTextBlockKeyDown(block, event)}
                              onChange={(e) => {
                                autoResizeTextarea(e.currentTarget);
                                updateSelectedBlock(block.id, { text: e.target.value });
                              }}
                              className={`doc-editor-inline-input doc-editor-inline-input-${block.type}`}
                              rows={1}
                              style={getInlineTextBlockStyle(block.type)}
                            />
                          )}

                          {slashMenu?.blockId === block.id && (
                            <div className="doc-editor-slash-menu">
                              {SLASH_BLOCK_TYPES.map((type, index) => (
                                <button
                                  key={`${block.id}_${type}`}
                                  type="button"
                                  className={[
                                    "doc-editor-slash-item",
                                    slashMenu.selectedIndex === index ? "doc-editor-slash-item-active" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  onClick={() => applySlashCommand(block.id, type)}
                                >
                                  / {type}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )})}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
