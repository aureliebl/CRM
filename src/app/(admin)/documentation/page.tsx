"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import hljs from "highlight.js";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { useLocale } from "@/lib/use-locale";
import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import { DashboardGraphCard, type DashboardGraphWithData } from "@/components/admin/DashboardGraphCard";
import type {
  DocumentationBlock,
  DocumentationBlockType,
  DocumentationNode,
  DocumentationTreeItem,
} from "@/lib/documentation-types";
import type { DashboardGraph, UserGroup } from "@/lib/types";
import {
  createDocumentationCrdtSession,
  type DocumentationCrdtSession,
  type DocumentationPeer,
} from "@/lib/documentation-crdt-client";

type TreePayload = {
  tree: DocumentationTreeItem[];
  pages: DocumentationTreeItem[];
};

type SafeAccount = {
  id: string;
  fullName: string;
  email: string;
  role: "admin" | "operator";
  profileImage?: string | null;
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

type SlashCommand = {
  id: string;
  label: string;
  blockType?: DocumentationBlockType;
  action?: "create-page";
};

const INFO_TONES = ["default", "muted", "accent"] as const;
const INFO_ICONS = ["info", "lightbulb", "warning", "priority_high", "tips_and_updates"];

function makeBlock(type: DocumentationBlockType): DocumentationBlock {
  const id = `blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  if (type === "image") {
    return { id, type, widthPct: 100 };
  }
  if (type === "link") {
    return { id, type, targetLabel: "" };
  }
  if (type === "graph") {
    return { id, type, graphId: "" };
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
      paddingTop: "0.1rem",
      paddingBottom: "0.02rem",
    };
  }
  if (type === "heading2") {
    return {
      fontFamily: "inherit",
      fontSize: "1.58rem",
      fontWeight: 620,
      lineHeight: 1.32,
      letterSpacing: "-0.018em",
      paddingTop: "0.08rem",
      paddingBottom: "0.02rem",
    };
  }
  if (type === "heading3") {
    return {
      fontFamily: "inherit",
      fontSize: "1.26rem",
      fontWeight: 600,
      lineHeight: 1.35,
      letterSpacing: "-0.014em",
      paddingTop: "0.06rem",
      paddingBottom: "0.01rem",
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
      padding: "0.14rem 0.3rem",
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
          subtitlePlaceholder: "Sous-titre",
          unsaved: "Modifications en cours...",
          saved: "Enregistré automatiquement",
          saveError: "Échec de l'enregistrement",
          publish: "Rendre publique",
          unpublish: "Rendre privée",
          uploadCover: "Image de couverture",
          pageActions: "Actions page",
          scopeRoot: "Racine affichée",
          allRoots: "Toutes les racines",
          sharedGroups: "Groupes autorisés",
          sharedUsers: "Utilisateurs autorisés",
          noGroups: "Aucun groupe",
          noUsers: "Aucun utilisateur",
          graphBlock: "Graphique dashboard",
          selectGraph: "Sélectionner un graphique",
          noGraphs: "Aucun graphique",
          graphMissing: "Graphique introuvable",
          openGraph: "Ouvrir le graphique",
          quickPages: "Pages",
          infoStyle: "Style info",
          tone: "Ton",
          icon: "Icône",
          removeBlock: "Supprimer le bloc",
          slashNewPage: "Créer une sous-page",
          newPageDefaultTitle: "Nouvelle page",
          openLinkedPage: "Ouvrir la page liée",
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
          subtitlePlaceholder: "Subtitle",
          unsaved: "Saving changes...",
          saved: "Saved automatically",
          saveError: "Save failed",
          publish: "Make public",
          unpublish: "Make private",
          uploadCover: "Cover image",
          pageActions: "Page actions",
          scopeRoot: "Visible root",
          allRoots: "All roots",
          sharedGroups: "Shared groups",
          sharedUsers: "Shared users",
          noGroups: "No groups",
          noUsers: "No users",
          graphBlock: "Dashboard graph",
          selectGraph: "Select a graph",
          noGraphs: "No graphs",
          graphMissing: "Graph not found",
          openGraph: "Open graph",
          quickPages: "Pages",
          infoStyle: "Info style",
          tone: "Tone",
          icon: "Icon",
          removeBlock: "Delete block",
          slashNewPage: "Create sub-page",
          newPageDefaultTitle: "New page",
          openLinkedPage: "Open linked page",
        };

  const [tree, setTree] = useState<DocumentationTreeItem[]>([]);
  const [pages, setPages] = useState<DocumentationTreeItem[]>([]);
  const [selectedRootId, setSelectedRootId] = useState<string>("__all__");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<DocumentationNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pageMenuOverlay, setPageMenuOverlay] = useState<{
    kind: "page" | "folder";
    x: number;
    y: number;
  } | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [crdtStatus, setCrdtStatus] = useState("disconnected");
  const [crdtPeers, setCrdtPeers] = useState<DocumentationPeer[]>([]);
  const [crdtCanWrite, setCrdtCanWrite] = useState(true);
  const [localActorId, setLocalActorId] = useState<string | null>(null);
  const [crdtReconnectTick, setCrdtReconnectTick] = useState(0);
  const [slashMenu, setSlashMenu] = useState<{
    blockId: string;
    selectedIndex: number;
    x: number;
    y: number;
  } | null>(null);
  const [blockContextMenu, setBlockContextMenu] = useState<{
    blockId: string;
    x: number;
    y: number;
  } | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | null>(null);
  const [groupOptions, setGroupOptions] = useState<UserGroup[]>([]);
  const [userOptions, setUserOptions] = useState<SafeAccount[]>([]);
  const [graphOptions, setGraphOptions] = useState<DashboardGraphWithData[]>([]);
  const crdtSessionRef = useRef<DocumentationCrdtSession | null>(null);
  const initialBlocksRef = useRef<DocumentationBlock[]>([]);
  const lastSavedSnapshotRef = useRef("");
  const blockInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const nodeSnapshot = useCallback((node: DocumentationNode | null) => {
    if (!node) return "";
    return JSON.stringify({
      id: node.id,
      title: node.title,
      subtitle: node.subtitle,
      coverMediaId: node.coverMediaId,
      isPublic: node.isPublic,
      isPrivate: node.isPrivate,
      folderVisibility: node.folderVisibility,
      groupId: node.groupId,
      sharedGroupIds: [...node.sharedGroupIds].sort(),
      sharedUserIds: [...node.sharedUserIds].sort(),
      content: node.kind === "page" ? node.content : [],
    });
  }, []);

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

    const loadSharingOptions = async () => {
      const res = await fetch("/api/security/overview", { cache: "no-store" });
      if (!res.ok || !mounted) return;
      const payload = (await res.json()) as {
        groups?: UserGroup[];
        accounts?: SafeAccount[];
      };
      if (!mounted) return;
      setGroupOptions(payload.groups ?? []);
      setUserOptions(payload.accounts ?? []);
    };

    const loadGraphOptions = async () => {
      const res = await fetch("/api/dashboard/graphs?includeShared=1", { cache: "no-store" });
      if (!res.ok || !mounted) return;

      const payload = (await res.json()) as
        | DashboardGraphWithData[]
        | { own?: DashboardGraphWithData[]; shared?: DashboardGraphWithData[] };

      if (!mounted) return;

      if (Array.isArray(payload)) {
        setGraphOptions(payload);
        return;
      }

      const combined = [...(payload.own ?? []), ...(payload.shared ?? [])];
      const unique = new Map<string, DashboardGraphWithData>();
      for (const graph of combined) {
        unique.set(graph.id, graph);
      }
      setGraphOptions(Array.from(unique.values()));
    };

    void Promise.allSettled([loadSharingOptions(), loadGraphOptions()]);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      setSelectedNode(null);
      setPageMenuOverlay(null);
      setEditingTitle(false);
      setEditingSubtitle(false);
      setSaveStatus("idle");
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
    if (!selectedNode) {
      lastSavedSnapshotRef.current = "";
      return;
    }
    lastSavedSnapshotRef.current = nodeSnapshot(selectedNode);
  }, [selectedNodeId, selectedNode?.id, nodeSnapshot]);

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

  const graphById = useMemo(() => {
    const map = new Map<string, DashboardGraphWithData>();
    for (const graph of graphOptions) {
      map.set(graph.id, graph);
    }
    return map;
  }, [graphOptions]);

  const slashCommands = useMemo<SlashCommand[]>(
    () => [
      { id: "new-page", label: labels.slashNewPage, action: "create-page" },
      { id: "paragraph", label: "paragraph", blockType: "paragraph" },
      { id: "heading1", label: "heading1", blockType: "heading1" },
      { id: "heading2", label: "heading2", blockType: "heading2" },
      { id: "heading3", label: "heading3", blockType: "heading3" },
      { id: "subtitle", label: "subtitle", blockType: "subtitle" },
      { id: "info", label: "info", blockType: "info" },
      { id: "code", label: "code", blockType: "code" },
      { id: "link", label: "link", blockType: "link" },
      { id: "image", label: "image", blockType: "image" },
      { id: "graph", label: "graph", blockType: "graph" },
    ],
    [labels.slashNewPage]
  );

  const visiblePeers = useMemo(() => {
    if (crdtPeers.length > 0) return crdtPeers;
    if (!localActorId) return [] as DocumentationPeer[];
    return [
      {
        id: localActorId,
        name: locale === "fr" ? "Vous" : "You",
        role: "operator",
        color: "var(--accent-primary)",
      },
    ] as DocumentationPeer[];
  }, [crdtPeers, localActorId, locale]);

  const accountById = useMemo(() => {
    const map = new Map<string, SafeAccount>();
    for (const account of userOptions) {
      map.set(account.id, account);
    }
    return map;
  }, [userOptions]);

  const folderOptions = useMemo(
    () => [{ id: "", title: labels.root }, ...tree.filter((node) => node.kind === "folder").map((node) => ({ id: node.id, title: node.title }))],
    [tree, labels.root]
  );

  const treeById = useMemo(() => {
    const map = new Map<string, DocumentationTreeItem>();
    for (const node of tree) {
      map.set(node.id, node);
    }
    return map;
  }, [tree]);

  const rootNodes = useMemo(() => childrenByParent.get(null) ?? [], [childrenByParent]);

  const selectedPath = useMemo(() => {
    if (!selectedNode) return [] as DocumentationTreeItem[];

    const path: DocumentationTreeItem[] = [];
    let cursor = treeById.get(selectedNode.id);

    while (cursor) {
      path.unshift(cursor);
      cursor = cursor.parentId ? treeById.get(cursor.parentId) : undefined;
    }

    if (path.length === 0) {
      path.push({
        id: selectedNode.id,
        parentId: selectedNode.parentId,
        kind: selectedNode.kind,
        title: selectedNode.title,
        subtitle: selectedNode.subtitle,
        coverMediaId: selectedNode.coverMediaId,
        isPublic: selectedNode.isPublic,
        isPrivate: selectedNode.isPrivate,
        folderVisibility: selectedNode.folderVisibility,
        groupId: selectedNode.groupId,
        sharedGroupIds: selectedNode.sharedGroupIds,
        sharedUserIds: selectedNode.sharedUserIds,
        ownerId: selectedNode.ownerId,
        createdAt: selectedNode.createdAt,
        updatedAt: selectedNode.updatedAt,
      });
    }

    return path;
  }, [selectedNode, treeById]);

  const isNodeWithinRoot = useCallback(
    (nodeId: string, rootId: string) => {
      let cursor = treeById.get(nodeId);
      while (cursor) {
        if (cursor.id === rootId) return true;
        cursor = cursor.parentId ? treeById.get(cursor.parentId) : undefined;
      }
      return false;
    },
    [treeById]
  );

  const activeRootId = useMemo(() => {
    if (selectedRootId !== "__all__") return selectedRootId;
    return selectedPath[0]?.id ?? rootNodes[0]?.id ?? "";
  }, [selectedRootId, selectedPath, rootNodes]);

  const quickNavItems = useMemo(() => {
    if (!activeRootId) return [] as DocumentationTreeItem[];
    const children = childrenByParent.get(activeRootId) ?? [];
    return children.filter((node) => node.kind === "page");
  }, [activeRootId, childrenByParent]);

  useEffect(() => {
    if (selectedRootId === "__all__") return;
    if (!treeById.has(selectedRootId)) {
      setSelectedRootId("__all__");
    }
  }, [selectedRootId, treeById]);

  useEffect(() => {
    if (!selectedNodeId || selectedRootId === "__all__") return;
    if (!isNodeWithinRoot(selectedNodeId, selectedRootId)) {
      setSelectedNodeId(selectedRootId);
    }
  }, [selectedNodeId, selectedRootId, isNodeWithinRoot]);

  const handleCreateNode = async (kind: "folder" | "page") => {
    const title = window.prompt(kind === "folder" ? labels.newFolder : labels.newPage);
    if (!title) return;

    const parentId = selectedNode ? selectedNode.id : null;

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
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      alert(payload?.error || "Creation failed");
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

  const handleSaveNode = async (options?: { silent?: boolean }) => {
    if (!selectedNode) return;
    setSaving(true);
    setSaveStatus("saving");

    const res = await fetch(`/api/documentation/nodes/${selectedNode.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selectedNode.title,
        subtitle: selectedNode.subtitle,
        coverMediaId: selectedNode.coverMediaId,
        isPublic: selectedNode.kind === "page" ? selectedNode.isPublic : undefined,
        sharedGroupIds: selectedNode.sharedGroupIds,
        sharedUserIds: selectedNode.sharedUserIds,
        isPrivate: selectedNode.kind === "page" ? selectedNode.isPrivate : undefined,
        folderVisibility:
          selectedNode.kind === "folder" ? selectedNode.folderVisibility : undefined,
        groupId: selectedNode.kind === "folder" ? selectedNode.groupId : undefined,
        content: selectedNode.kind === "page" ? selectedNode.content : undefined,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      setSaveStatus("error");
      if (!options?.silent) {
        alert("Save failed");
      }
      return;
    }

    const updated = (await res.json()) as DocumentationNode;
    setSelectedNode(updated);
    lastSavedSnapshotRef.current = nodeSnapshot(updated);
    setSaveStatus("saved");
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

  useEffect(() => {
    if (!selectedNode) return;

    const snapshot = nodeSnapshot(selectedNode);
    if (!snapshot || snapshot === lastSavedSnapshotRef.current) return;

    setSaveStatus("saving");
    const timeout = window.setTimeout(() => {
      void handleSaveNode({ silent: true });
    }, 800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [selectedNode, nodeSnapshot]);

  useEffect(() => {
    const closeOverlays = () => {
      setSlashMenu(null);
      setBlockContextMenu(null);
      setPageMenuOverlay(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeOverlays();
      }
    };

    window.addEventListener("pointerdown", closeOverlays);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", closeOverlays);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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

  const createSubPageFromSlash = async (blockId: string) => {
    if (!selectedNode || selectedNode.kind !== "page") return;

    const sourceBlock = selectedNode.content.find((item) => item.id === blockId);
    const rawTitle = (sourceBlock?.text ?? "").trim();
    const promptedTitle =
      rawTitle.length === 0
        ? window.prompt(labels.slashNewPage, labels.newPageDefaultTitle)?.trim()
        : rawTitle;
    const title = promptedTitle || labels.newPageDefaultTitle;

    if (!promptedTitle && rawTitle.length === 0) {
      return;
    }

    const res = await fetch("/api/documentation/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "page",
        title,
        parentId: selectedNode.id,
      }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      alert(payload?.error || "Creation failed");
      return;
    }

    const created = (await res.json()) as DocumentationNode;

    const nextContent = selectedNode.content.map((block) =>
      block.id === blockId
        ? {
            ...block,
            type: "link" as const,
            targetNodeId: created.id,
            targetLabel: title,
            text: undefined,
            language: undefined,
            mediaId: undefined,
            graphId: undefined,
            infoTone: undefined,
            infoIcon: undefined,
          }
        : block
    );

    setSelectedNode((current) =>
      current && current.kind === "page" && current.id === selectedNode.id
        ? { ...current, content: nextContent }
        : current
    );

    if (crdtSessionRef.current && crdtCanWrite) {
      crdtSessionRef.current.updateBlock(blockId, {
        type: "link",
        targetNodeId: created.id,
        targetLabel: title,
        text: undefined,
        language: undefined,
        mediaId: undefined,
        graphId: undefined,
        infoTone: undefined,
        infoIcon: undefined,
      });
    }

    const saveRes = await fetch(`/api/documentation/nodes/${selectedNode.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selectedNode.title,
        subtitle: selectedNode.subtitle,
        coverMediaId: selectedNode.coverMediaId,
        isPublic: selectedNode.isPublic,
        sharedGroupIds: selectedNode.sharedGroupIds,
        sharedUserIds: selectedNode.sharedUserIds,
        isPrivate: selectedNode.isPrivate,
        content: nextContent,
      }),
    });

    if (!saveRes.ok) {
      alert("Save failed");
      return;
    }

    await refreshTree();
    setSelectedNodeId(created.id);
  };

  const applySlashCommand = (blockId: string, type: DocumentationBlockType) => {
    setSlashMenu(null);

    if (type === "image") {
      insertBlockAfter(blockId, "image");
      return;
    }

    updateSelectedBlock(blockId, {
      type,
      infoTone: type === "info" ? "default" : undefined,
      infoIcon: type === "info" ? "info" : undefined,
    });

    if (type !== "graph") {
      focusBlockInput(blockId);
    }
  };

  const applySlashMenuItem = async (blockId: string, command: SlashCommand) => {
    setSlashMenu(null);

    if (command.action === "create-page") {
      await createSubPageFromSlash(blockId);
      return;
    }

    if (command.blockType) {
      applySlashCommand(blockId, command.blockType);
    }
  };

  const getOverlayPosition = (
    anchor: DOMRect,
    dimensions: { width: number; height: number },
    gap = 8
  ) => {
    let x = anchor.left;
    let y = anchor.bottom + gap;

    if (x + dimensions.width > window.innerWidth - gap) {
      x = Math.max(gap, window.innerWidth - dimensions.width - gap);
    }

    if (y + dimensions.height > window.innerHeight - gap) {
      y = Math.max(gap, anchor.top - dimensions.height - gap);
    }

    return { x, y };
  };

  const openSlashMenu = (blockId: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const { x, y } = getOverlayPosition(rect, { width: 240, height: 280 });

    setSlashMenu({ blockId, selectedIndex: 0, x, y });
    setBlockContextMenu(null);
  };

  const openBlockContextMenu = (blockId: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const { x, y } = getOverlayPosition(rect, { width: 260, height: 220 });
    setBlockContextMenu({ blockId, x, y });
    setSlashMenu(null);
  };

  const openPageActionsOverlay = (kind: "page" | "folder", target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const { x, y } = getOverlayPosition(rect, { width: 280, height: 420 });

    setPageMenuOverlay((current) => {
      if (current?.kind === kind) {
        const sameSpot = Math.abs(current.x - x) < 4 && Math.abs(current.y - y) < 4;
        if (sameSpot) {
          return null;
        }
      }
      return { kind, x, y };
    });

    setSlashMenu(null);
    setBlockContextMenu(null);
  };

  const getInfoVisualStyle = (block: DocumentationBlock): React.CSSProperties => {
    const tone = block.infoTone ?? "default";
    if (tone === "muted") {
      return {
        background: "var(--card-bg)",
        border: "1px solid var(--border-color)",
      };
    }
    if (tone === "accent") {
      return {
        background: "var(--bg-hover)",
        border: "1px solid var(--accent-primary)",
      };
    }
    return {
      background: "var(--bg-hover)",
      border: "1px solid var(--border-color)",
    };
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
            selectedIndex: (current.selectedIndex + 1) % slashCommands.length,
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
              (current.selectedIndex - 1 + slashCommands.length) % slashCommands.length,
          };
        });
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selectedCommand = slashCommands[slashMenu.selectedIndex] ?? slashCommands[0];
        if (!selectedCommand) return;
        void applySlashMenuItem(block.id, selectedCommand);
        return;
      }
    }

    if (event.key === "/" && currentText.trim().length === 0) {
      event.preventDefault();
      openSlashMenu(block.id, event.currentTarget);
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

  const uploadCoverImage = async (file: File) => {
    if (!selectedNode || selectedNode.kind !== "page") return;

    setCoverUploading(true);
    try {
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
      setSelectedNode((current) =>
        current && current.kind === "page" ? { ...current, coverMediaId: payload.id } : current
      );
    } finally {
      setCoverUploading(false);
    }
  };

  const handleDropImage: React.DragEventHandler<HTMLDivElement> = async (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await uploadImage(file);
  };

  const handleImageInputChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const input = event.currentTarget;
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadImage(file);
    input.value = "";
  };

  const handleCoverInputChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const input = event.currentTarget;
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadCoverImage(file);
    input.value = "";
  };

  return (
    <div>
      <div style={{ minHeight: "78vh", width: "100%" }}>
        {selectedNode?.kind !== "page" && (
        <div style={{ display: "grid", gap: "0.45rem", marginBottom: "0.85rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
              <select
                value={selectedRootId}
                onChange={(e) => setSelectedRootId(e.target.value)}
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: "0.55rem",
                  padding: "0.38rem 0.48rem",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  fontSize: "0.8rem",
                }}
              >
                <option value="__all__">{labels.allRoots}</option>
                {rootNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.title || labels.untitled}
                  </option>
                ))}
              </select>

              <button className="admin-btn admin-btn-secondary" type="button" onClick={() => handleCreateNode("folder")}>
                {labels.newFolder}
              </button>
              <button className="admin-btn admin-btn-secondary" type="button" onClick={() => handleCreateNode("page")}>
                {labels.newPage}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>{labels.quickPages}</span>
            {quickNavItems.map((node) => (
              <button
                key={`quick_${node.id}`}
                type="button"
                onClick={() => setSelectedNodeId(node.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: node.id === selectedNodeId ? "var(--text-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  padding: "0.1rem 0.2rem",
                }}
              >
                {node.title || labels.untitled}
              </button>
            ))}
          </div>
        </div>
        )}

          {!selectedNode ? (
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>{labels.noSelection}</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>

              {selectedNode.kind === "page" && (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div
                    style={{
                      minHeight: "210px",
                      borderRadius: "0.2rem",
                      border: "1px solid var(--border-color)",
                      background: selectedNode.coverMediaId ? "transparent" : "var(--bg-hover)",
                      position: "relative",
                      overflow: "hidden",
                      margin: "-0.2rem -0.2rem 0.65rem",
                    }}
                  >
                    {selectedNode.coverMediaId && (
                      <img
                        src={`/api/documentation/media/${selectedNode.coverMediaId}`}
                        alt="Cover"
                        style={{ width: "100%", height: "230px", objectFit: "cover", display: "block" }}
                      />
                    )}

                    <div
                      style={{
                        position: "absolute",
                        top: "0.55rem",
                        left: "0.55rem",
                        display: "grid",
                        gap: "0.35rem",
                        maxWidth: "65%",
                        background: "var(--card-bg)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "0.6rem",
                        padding: "0.45rem 0.55rem",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      {selectedPath.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.2rem", flexWrap: "wrap" }}>
                          {selectedPath.map((item, index) => (
                            <div key={`cover_path_${item.id}_${index}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.22rem" }}>
                              {index > 0 && <MaterialSymbol name="chevron_right" size={14} weight={500} opticalSize={20} />}
                              <button
                                type="button"
                                onClick={() => setSelectedNodeId(item.id)}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: item.id === selectedNode.id ? "var(--text-primary)" : "var(--text-secondary)",
                                  padding: 0,
                                  cursor: "pointer",
                                  fontSize: "0.76rem",
                                  fontWeight: item.id === selectedNode.id ? 600 : 500,
                                }}
                              >
                                {item.title || labels.untitled}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ position: "absolute", top: "0.55rem", right: "0.55rem", display: "flex", gap: "0.4rem" }}>
                      <label className="admin-btn admin-btn-secondary" style={{ cursor: "pointer" }}>
                        {coverUploading ? labels.loading : labels.uploadCover}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          hidden
                          onChange={handleCoverInputChange}
                        />
                      </label>
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          onClick={(event) => {
                            openPageActionsOverlay("page", event.currentTarget);
                          }}
                        >
                          <MaterialSymbol name="more_horiz" size={16} weight={500} opticalSize={20} />
                        </button>
                        {pageMenuOverlay?.kind === "page" && (
                          <div
                            style={{
                              position: "fixed",
                              left: `${pageMenuOverlay.x}px`,
                              top: `${pageMenuOverlay.y}px`,
                              zIndex: 1250,
                              width: "280px",
                              maxHeight: "70vh",
                              overflowY: "auto",
                              background: "var(--card-bg)",
                              border: "1px solid var(--border-color)",
                              borderRadius: "0.65rem",
                              padding: "0.35rem",
                              display: "grid",
                              gap: "0.25rem",
                            }}
                            onPointerDown={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="admin-btn admin-btn-secondary"
                              onClick={() => {
                                setSelectedNode((current) =>
                                  current && current.kind === "page" ? { ...current, isPublic: !current.isPublic } : current
                                );
                                setPageMenuOverlay(null);
                              }}
                            >
                              {selectedNode.isPublic ? labels.unpublish : labels.publish}
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-secondary"
                              onClick={() => {
                                setPageMenuOverlay(null);
                                void handleExportNode("pdf");
                              }}
                            >
                              Export PDF
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-secondary"
                              onClick={() => {
                                setPageMenuOverlay(null);
                                void handleExportNode("doc");
                              }}
                            >
                              Export DOC
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-secondary"
                              onClick={() => {
                                setPageMenuOverlay(null);
                                void handleDeleteNode();
                              }}
                            >
                              {labels.delete}
                            </button>

                            <div style={{ borderTop: "1px solid var(--border-color)", margin: "0.2rem 0", opacity: 0.7 }} />

                            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.2rem 0.2rem" }}>
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
                              <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                                {labels.privatePage}
                              </span>
                            </label>

                            <select
                              value={selectedNode.parentId ?? ""}
                              onChange={(e) => {
                                void handleMoveNode(e.target.value || null);
                              }}
                              style={{
                                width: "100%",
                                border: "1px solid var(--border-color)",
                                borderRadius: "0.5rem",
                                padding: "0.35rem 0.45rem",
                                background: "var(--input-bg)",
                                color: "var(--text-primary)",
                                fontSize: "0.78rem",
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

                            <select
                              multiple
                              value={selectedNode.sharedGroupIds}
                              onChange={(e) => {
                                const nextIds = Array.from(e.target.selectedOptions).map((option) => option.value);
                                setSelectedNode((current) =>
                                  current && current.kind === "page"
                                    ? { ...current, sharedGroupIds: nextIds }
                                    : current
                                );
                              }}
                              style={{
                                width: "100%",
                                minHeight: "4.2rem",
                                border: "1px solid var(--border-color)",
                                borderRadius: "0.5rem",
                                padding: "0.25rem 0.35rem",
                                background: "var(--input-bg)",
                                color: "var(--text-primary)",
                                fontSize: "0.75rem",
                              }}
                            >
                              {groupOptions.map((group) => (
                                <option key={group.id} value={group.id}>
                                  {group.name}
                                </option>
                              ))}
                            </select>

                            <select
                              multiple
                              value={selectedNode.sharedUserIds}
                              onChange={(e) => {
                                const nextIds = Array.from(e.target.selectedOptions).map((option) => option.value);
                                setSelectedNode((current) =>
                                  current && current.kind === "page"
                                    ? { ...current, sharedUserIds: nextIds }
                                    : current
                                );
                              }}
                              style={{
                                width: "100%",
                                minHeight: "4.2rem",
                                border: "1px solid var(--border-color)",
                                borderRadius: "0.5rem",
                                padding: "0.25rem 0.35rem",
                                background: "var(--input-bg)",
                                color: "var(--text-primary)",
                                fontSize: "0.75rem",
                              }}
                            >
                              {userOptions.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.fullName || account.email}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingTitle ? (
                        <input
                          value={selectedNode.title}
                          autoFocus
                          onBlur={() => setEditingTitle(false)}
                          onChange={(e) =>
                            setSelectedNode((current) =>
                              current ? { ...current, title: e.target.value } : current
                            )
                          }
                          style={{
                            width: "100%",
                            border: "1px solid var(--border-color)",
                            borderRadius: "0.6rem",
                            padding: "0.45rem 0.6rem",
                            background: "var(--input-bg)",
                            color: "var(--text-primary)",
                            fontSize: "1.65rem",
                            fontWeight: 650,
                          }}
                        />
                      ) : (
                        <h2
                          onClick={() => setEditingTitle(true)}
                          style={{ margin: 0, fontSize: "1.65rem", fontWeight: 650, cursor: "text" }}
                        >
                          {selectedNode.title || labels.untitled}
                        </h2>
                      )}

                      {editingSubtitle ? (
                        <input
                          value={selectedNode.subtitle}
                          autoFocus
                          onBlur={() => setEditingSubtitle(false)}
                          onChange={(e) =>
                            setSelectedNode((current) =>
                              current ? { ...current, subtitle: e.target.value } : current
                            )
                          }
                          placeholder={labels.subtitlePlaceholder}
                          style={{
                            width: "100%",
                            marginTop: "0.25rem",
                            border: "1px solid var(--border-color)",
                            borderRadius: "0.55rem",
                            padding: "0.35rem 0.55rem",
                            background: "var(--input-bg)",
                            color: "var(--text-secondary)",
                            fontSize: "0.98rem",
                          }}
                        />
                      ) : (
                        <p
                          onClick={() => setEditingSubtitle(true)}
                          style={{ margin: "0.3rem 0 0", color: "var(--text-secondary)", cursor: "text" }}
                        >
                          {selectedNode.subtitle || labels.subtitlePlaceholder}
                        </p>
                      )}
                    </div>

                    <div style={{ display: "grid", justifyItems: "end", gap: "0.3rem" }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        {saveStatus === "saving"
                          ? labels.unsaved
                          : saveStatus === "error"
                          ? labels.saveError
                          : labels.saved}
                      </span>

                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {crdtStatus === "disconnected" && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary"
                            onClick={() => setCrdtReconnectTick((current) => current + 1)}
                          >
                            reconnect
                          </button>
                        )}
                        {visiblePeers.map((peer) => {
                          const profileImage = accountById.get(peer.id)?.profileImage;
                          return (
                          <span
                            key={peer.id}
                            title={peer.name}
                            style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "999px",
                              border: "2px solid var(--card-bg)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              color: "#ffffff",
                              background: peer.color,
                              overflow: "hidden",
                            }}
                          >
                            {profileImage ? (
                              <img
                                src={profileImage}
                                alt={peer.name}
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              />
                            ) : (
                              peer.name.slice(0, 1).toUpperCase()
                            )}
                          </span>
                        )})}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.kind === "folder" && (
                <div style={{ display: "grid", gap: "0.4rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{labels.folderSettings}</div>
                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        onClick={(event) => {
                          openPageActionsOverlay("folder", event.currentTarget);
                        }}
                      >
                        <MaterialSymbol name="more_horiz" size={16} weight={500} opticalSize={20} />
                      </button>

                      {pageMenuOverlay?.kind === "folder" && (
                        <div
                          style={{
                            position: "fixed",
                            left: `${pageMenuOverlay.x}px`,
                            top: `${pageMenuOverlay.y}px`,
                            zIndex: 1250,
                            width: "280px",
                            maxHeight: "70vh",
                            overflowY: "auto",
                            background: "var(--card-bg)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "0.65rem",
                            padding: "0.35rem",
                            display: "grid",
                            gap: "0.25rem",
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary"
                            onClick={() => {
                              setPageMenuOverlay(null);
                              void handleDeleteNode();
                            }}
                          >
                            {labels.delete}
                          </button>

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
                              borderRadius: "0.5rem",
                              padding: "0.35rem 0.45rem",
                              background: "var(--input-bg)",
                              color: "var(--text-primary)",
                              fontSize: "0.78rem",
                            }}
                          >
                            <option value="public">{labels.folderPublic}</option>
                            <option value="group">{labels.folderGroup}</option>
                          </select>

                          <select
                            value={selectedNode.parentId ?? ""}
                            onChange={(e) => {
                              void handleMoveNode(e.target.value || null);
                            }}
                            style={{
                              width: "100%",
                              border: "1px solid var(--border-color)",
                              borderRadius: "0.5rem",
                              padding: "0.35rem 0.45rem",
                              background: "var(--input-bg)",
                              color: "var(--text-primary)",
                              fontSize: "0.78rem",
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

                          <select
                            multiple
                            value={selectedNode.sharedGroupIds}
                            onChange={(e) => {
                              const nextIds = Array.from(e.target.selectedOptions).map((option) => option.value);
                              setSelectedNode((current) =>
                                current && current.kind === "folder"
                                  ? { ...current, sharedGroupIds: nextIds }
                                  : current
                              );
                            }}
                            style={{
                              width: "100%",
                              minHeight: "4.2rem",
                              border: "1px solid var(--border-color)",
                              borderRadius: "0.5rem",
                              padding: "0.25rem 0.35rem",
                              background: "var(--input-bg)",
                              color: "var(--text-primary)",
                              fontSize: "0.75rem",
                            }}
                          >
                            {groupOptions.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>

                          <select
                            multiple
                            value={selectedNode.sharedUserIds}
                            onChange={(e) => {
                              const nextIds = Array.from(e.target.selectedOptions).map((option) => option.value);
                              setSelectedNode((current) =>
                                current && current.kind === "folder"
                                  ? { ...current, sharedUserIds: nextIds }
                                  : current
                              );
                            }}
                            style={{
                              width: "100%",
                              minHeight: "4.2rem",
                              border: "1px solid var(--border-color)",
                              borderRadius: "0.5rem",
                              padding: "0.25rem 0.35rem",
                              background: "var(--input-bg)",
                              color: "var(--text-primary)",
                              fontSize: "0.75rem",
                            }}
                          >
                            {userOptions.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.fullName || account.email}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                  <input
                    value={selectedNode.title}
                    onChange={(e) =>
                      setSelectedNode((current) =>
                        current ? { ...current, title: e.target.value } : current
                      )
                    }
                    style={{
                      border: "1px solid var(--border-color)",
                      borderRadius: "0.6rem",
                      padding: "0.5rem 0.65rem",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      fontSize: "1rem",
                    }}
                  />
                </div>
              )}

              {selectedNode.kind === "page" && (
                <>
                  <div
                    className="doc-editor-surface"
                    onDrop={handleDropImage}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => {
                      if (!crdtCanWrite || selectedNode.content.length > 0) return;
                      const newId = insertBlockAfter(null, "paragraph");
                      focusBlockInput(newId);
                    }}
                  >
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
                            onContextMenu={(event) => {
                              event.preventDefault();
                              openBlockContextMenu(block.id, event.currentTarget);
                            }}
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
                            <button
                              type="button"
                              onFocus={() => publishCursorBlock(block.id)}
                              onClick={() => {
                                if (block.targetNodeId) {
                                  setSelectedNodeId(block.targetNodeId);
                                }
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.28rem",
                                border: "none",
                                background: "transparent",
                                color: "var(--text-primary)",
                                cursor: block.targetNodeId ? "pointer" : "default",
                                width: "fit-content",
                                textDecoration: "underline",
                                textDecorationColor: "var(--text-secondary)",
                                fontSize: "0.95rem",
                                padding: 0,
                              }}
                              title={labels.openLinkedPage}
                            >
                              <MaterialSymbol name="subdirectory_arrow_right" size={16} weight={500} opticalSize={20} />
                              <span>{block.targetLabel || labels.linkToPage}</span>
                            </button>
                            {pages.length === 0 && (
                              <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)" }}>{labels.noPages}</div>
                            )}
                          </div>
                          ) : block.type === "graph" ? (
                          <div style={{ display: "grid", gap: "0.35rem" }}>
                            <select
                              value={block.graphId ?? ""}
                              disabled={!crdtCanWrite}
                              onFocus={() => publishCursorBlock(block.id)}
                              onChange={(e) => updateSelectedBlock(block.id, { graphId: e.target.value || undefined })}
                              style={{
                                border: "1px solid var(--border-color)",
                                borderRadius: "0.5rem",
                                padding: "0.4rem",
                                background: "var(--input-bg)",
                                color: "var(--text-primary)",
                              }}
                            >
                              <option value="">{labels.selectGraph}</option>
                              {graphOptions.map((graph) => (
                                <option key={graph.id} value={graph.id}>
                                  {graph.title}
                                </option>
                              ))}
                            </select>
                            {block.graphId && graphById.get(block.graphId) && (
                              <div
                                style={{
                                  display: "grid",
                                  gap: "0.3rem",
                                }}
                              >
                                <DashboardGraphCard
                                  graph={graphById.get(block.graphId)!}
                                  locale={locale === "fr" ? "fr" : "en"}
                                  showActions={false}
                                />
                                <a
                                  href={`/dashboard/graphs/${block.graphId}/edit`}
                                  className="admin-btn admin-btn-secondary"
                                  style={{ width: "fit-content" }}
                                >
                                  {labels.openGraph}
                                </a>
                              </div>
                            )}
                            {block.graphId && !graphById.get(block.graphId) && (
                              <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)" }}>{labels.graphMissing}</div>
                            )}
                            {graphOptions.length === 0 && (
                              <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)" }}>{labels.noGraphs}</div>
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
                                padding: "0.35rem 0.45rem",
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
                          ) : block.type === "info" ? (
                            <div
                              style={{
                                ...getInfoVisualStyle(block),
                                borderRadius: "0.5rem",
                                padding: "0.14rem 0.2rem",
                                display: "grid",
                                gridTemplateColumns: "22px minmax(0, 1fr)",
                                alignItems: "start",
                                gap: "0.22rem",
                              }}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                openBlockContextMenu(block.id, event.currentTarget);
                              }}
                            >
                              <span style={{ color: "var(--text-secondary)", paddingTop: "0.28rem" }}>
                                <MaterialSymbol name={block.infoIcon ?? "info"} size={16} weight={500} opticalSize={20} />
                              </span>
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
                                className="doc-editor-inline-input doc-editor-inline-input-info"
                                rows={1}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  padding: "0.06rem 0",
                                  minHeight: "1.2rem",
                                }}
                              />
                            </div>
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

                        </div>
                      </div>
                    )})}
                  </div>

                  {slashMenu && (
                    <div
                      className="doc-editor-slash-menu"
                      style={{
                        position: "fixed",
                        left: `${slashMenu.x}px`,
                        top: `${slashMenu.y}px`,
                        width: "240px",
                        maxHeight: "280px",
                        overflowY: "auto",
                        zIndex: 1200,
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      {slashCommands.map((command, index) => (
                        <button
                          key={`slash_${command.id}`}
                          type="button"
                          className={[
                            "doc-editor-slash-item",
                            slashMenu.selectedIndex === index ? "doc-editor-slash-item-active" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => {
                            void applySlashMenuItem(slashMenu.blockId, command);
                          }}
                        >
                          / {command.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {blockContextMenu && selectedNode.content.some((block) => block.id === blockContextMenu.blockId) && (
                    <div
                      className="doc-editor-slash-menu"
                      style={{
                        position: "fixed",
                        left: `${blockContextMenu.x}px`,
                        top: `${blockContextMenu.y}px`,
                        width: "260px",
                        zIndex: 1250,
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      {selectedNode.content.find((block) => block.id === blockContextMenu.blockId)?.type === "info" && (
                        <>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", padding: "0.2rem 0.3rem 0.1rem" }}>
                            {labels.infoStyle}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", padding: "0.1rem 0.3rem" }}>
                            {labels.tone}
                          </div>
                          <div style={{ display: "flex", gap: "0.2rem", flexWrap: "wrap", padding: "0 0.3rem 0.2rem" }}>
                            {INFO_TONES.map((tone) => (
                              <button
                                key={`tone_${tone}`}
                                type="button"
                                className="doc-editor-slash-item"
                                onClick={() => {
                                  updateSelectedBlock(blockContextMenu.blockId, { infoTone: tone });
                                  setBlockContextMenu(null);
                                }}
                              >
                                {tone}
                              </button>
                            ))}
                          </div>

                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", padding: "0.1rem 0.3rem" }}>
                            {labels.icon}
                          </div>
                          <div style={{ display: "flex", gap: "0.2rem", flexWrap: "wrap", padding: "0 0.3rem 0.2rem" }}>
                            {INFO_ICONS.map((iconName) => (
                              <button
                                key={`icon_${iconName}`}
                                type="button"
                                className="doc-editor-slash-item"
                                onClick={() => {
                                  updateSelectedBlock(blockContextMenu.blockId, { infoIcon: iconName });
                                  setBlockContextMenu(null);
                                }}
                              >
                                <MaterialSymbol name={iconName} size={14} weight={500} opticalSize={20} />
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      <button
                        type="button"
                        className="doc-editor-slash-item"
                        onClick={() => {
                          removeBlock(blockContextMenu.blockId);
                          setBlockContextMenu(null);
                        }}
                      >
                        {labels.removeBlock}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
