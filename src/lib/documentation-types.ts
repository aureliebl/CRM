export type DocumentationNodeKind = "folder" | "page";

export type DocumentationFolderVisibility = "public" | "group";

export type DocumentationBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "subtitle"
  | "info"
  | "code"
  | "image"
  | "link";

export type DocumentationBlock = {
  id: string;
  type: DocumentationBlockType;
  text?: string;
  language?: string;
  mediaId?: string;
  targetNodeId?: string;
  targetLabel?: string;
  widthPct?: number;
};

export type DocumentationNode = {
  id: string;
  parentId: string | null;
  kind: DocumentationNodeKind;
  title: string;
  ownerId: string;
  folderVisibility: DocumentationFolderVisibility;
  groupId: string | null;
  isPrivate: boolean;
  content: DocumentationBlock[];
  createdAt: string;
  updatedAt: string;
};

export type DocumentationMedia = {
  id: string;
  nodeId: string;
  ownerId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentationTreeItem = {
  id: string;
  parentId: string | null;
  kind: DocumentationNodeKind;
  title: string;
  isPrivate: boolean;
  folderVisibility: DocumentationFolderVisibility;
  groupId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};
