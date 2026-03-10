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
  subtitle: string;
  coverMediaId: string | null;
  isPublic: boolean;
  ownerId: string;
  folderVisibility: DocumentationFolderVisibility;
  groupId: string | null;
  sharedGroupIds: string[];
  sharedUserIds: string[];
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
  subtitle: string;
  coverMediaId: string | null;
  isPublic: boolean;
  isPrivate: boolean;
  folderVisibility: DocumentationFolderVisibility;
  groupId: string | null;
  sharedGroupIds: string[];
  sharedUserIds: string[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};
