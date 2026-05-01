import { useState, useMemo, useEffect } from "react";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Home,
  MoreVertical,
  Pencil,
  Palette,
  Trash2,
  X,
  Search,
  FileText,
  Download,
  Printer,
  ChevronLeft,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { HexColorPicker } from "react-colorful";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { driveDownloadUrl, getGoogleDriveConfig, listPublicDriveFolder, type DriveFile } from "@/lib/google-drive";

// PDF Viewer Imports
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExamNodeType = "folder" | "pdf";

type ExamNode = {
  id: string;
  name: string;
  color: string;
  type: ExamNodeType;
  children: ExamNode[];
  downloadUrl?: string;
  size?: number;
};

type ExamSource = "auto" | "github" | "drive";

// ─── Constants & Seed ────────────────────────────────────────────────────────

const REPO_OWNER = "itzzssh4-sudo";
const REPO_NAME = "CBSE-Class-X-PYQ-Directory";
const BRANCH = "main";
const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

const SUBJECT_COLORS: Record<string, string> = {
  SCIENCE: "#22c55e",
  MATHS: "#ef4444",
  SST: "#f97316",
  ENGLISH: "#3b82f6",
  HINDI: "#8b5cf6",
  IT: "#6b7280",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findNode(nodes: ExamNode[], id: string): ExamNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function buildPath(nodes: ExamNode[], targetId: string): ExamNode[] {
  for (const n of nodes) {
    if (n.id === targetId) return [n];
    const sub = buildPath(n.children, targetId);
    if (sub.length > 0) return [n, ...sub];
  }
  return [];
}

function flatSearch(nodes: ExamNode[], query: string): ExamNode[] {
  const q = query.toLowerCase();
  const results: ExamNode[] = [];
  function walk(list: ExamNode[]) {
    for (const n of list) {
      if (n.name.toLowerCase().includes(q)) results.push(n);
      walk(n.children);
    }
  }
  walk(nodes);
  return results;
}

function formatSize(bytes?: number) {
  if (!bytes) return "N/A";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function getNodeColor(path: string) {
  const parts = path.split("/");
  const subject = parts[0].toUpperCase();
  let color = SUBJECT_COLORS[subject] || "#6b7280";

  if (subject === "MATHS" && parts.length > 1) {
    if (parts[1].toUpperCase() === "STANDARD") color = "#b91c1c";
    if (parts[1].toUpperCase() === "BASIC") color = "#1d4ed8";
  }
  if (subject === "HINDI" && parts.length > 1) {
    if (parts[1].toUpperCase().includes("A - HARD")) color = "#ef4444";
    if (parts[1].toUpperCase().includes("B - EASY")) color = "#3b82f6";
  }

  return color;
}

async function fetchGithubTree(): Promise<ExamNode[]> {
  const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1`);
  if (!response.ok) throw new Error(`GitHub fetch failed (${response.status})`);
  const data = await response.json();
  if (!data.tree) throw new Error("GitHub response did not include a tree");

  const nodes: Record<string, ExamNode> = {};
  const root: ExamNode[] = [];

  data.tree.forEach((item: any) => {
    if (item.path.includes("LICENSE") || item.path.includes("README.md")) return;

    const parts = item.path.split("/");
    const name = parts[parts.length - 1];
    const isDir = item.type === "tree";

    const node: ExamNode = {
      id: item.path,
      name: name.replace(".pdf", ""),
      color: getNodeColor(item.path),
      type: isDir ? "folder" : "pdf",
      children: [],
      downloadUrl: !isDir ? `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${item.path}` : undefined,
      size: item.size,
    };

    nodes[item.path] = node;

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      if (nodes[parentPath]) nodes[parentPath].children.push(node);
    }
  });

  return root;
}

async function fetchDriveTree(): Promise<ExamNode[]> {
  const config = getGoogleDriveConfig();
  const buildFolder = async (folderId: string, pathPrefix = ""): Promise<ExamNode[]> => {
    const files = await listPublicDriveFolder(folderId, config.apiKey);
    const sorted = files.slice().sort((a, b) => Number(b.mimeType === DRIVE_FOLDER_MIME) - Number(a.mimeType === DRIVE_FOLDER_MIME) || a.name.localeCompare(b.name));

    return Promise.all(sorted.map(async (file: DriveFile) => {
      const path = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
      const isDir = file.mimeType === DRIVE_FOLDER_MIME;
      return {
        id: `drive:${file.id}`,
        name: file.name.replace(".pdf", ""),
        color: getNodeColor(path),
        type: isDir ? "folder" : "pdf",
        children: isDir ? await buildFolder(file.id, path) : [],
        downloadUrl: !isDir ? driveDownloadUrl(file.id, config.apiKey) : undefined,
        size: file.size ? Number(file.size) : undefined,
      };
    }));
  };

  return buildFolder(config.examFolderId);
}

// ─── Components ───────────────────────────────────────────────────────────────

function PDFPreview({ 
  url, 
  name, 
  onClose 
}: { 
  url: string; 
  name: string; 
  onClose: () => void 
}) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="font-semibold truncate max-w-md">{name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-4">
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
          <div className="h-full border rounded-lg shadow-2xl bg-white overflow-hidden">
            <Viewer fileUrl={url} plugins={[defaultLayoutPluginInstance]} />
          </div>
        </Worker>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function Exams() {
  const [tree, setTree] = useState<ExamNode[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewPdf, setPreviewPdf] = useState<{ url: string; name: string } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<ExamNode | null>(null);
  const [source, setSource] = useState<ExamSource>("auto");
  const [activeSource, setActiveSource] = useState<"github" | "drive" | null>(null);
  const [sourceError, setSourceError] = useState("");

  // Fetch logic
  useEffect(() => {
    async function fetchDirectory() {
      setLoading(true);
      setSourceError("");
      setCurrentId(null);
      try {
        if (source === "drive") {
          setTree(await fetchDriveTree());
          setActiveSource("drive");
          return;
        }

        try {
          setTree(await fetchGithubTree());
          setActiveSource("github");
        } catch (githubError) {
          if (source === "github") throw githubError;
          setTree(await fetchDriveTree());
          setActiveSource("drive");
          setSourceError("GitHub failed, so Google Drive fallback is active.");
        }
      } catch (error) {
        console.error("Failed to fetch exam directory:", error);
        setTree([]);
        setActiveSource(null);
        setSourceError(error instanceof Error ? error.message : "Failed to fetch exam directory");
      } finally {
        setLoading(false);
      }
    }

    fetchDirectory();
  }, [source]);

  const currentChildren = useMemo(() => {
    if (!currentId) return tree;
    return findNode(tree, currentId)?.children ?? [];
  }, [tree, currentId]);

  const breadcrumb = useMemo(() => {
    if (!currentId) return [];
    return buildPath(tree, currentId);
  }, [tree, currentId]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return flatSearch(tree, search.trim());
  }, [tree, search]);

  const navigateTo = (id: string | null) => {
    setCurrentId(id);
    setSearch("");
  };

  const displayList = search.trim() ? searchResults : currentChildren;

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Syncing with CBSE Directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Board Exam Directory</h1>
            <p className="text-muted-foreground text-sm tracking-widest uppercase mt-1">
              Official PYQs from cbse.gov.in
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeSource && <Badge variant="secondary" className="rounded-full">Using {activeSource === "github" ? "GitHub" : "Google Drive"}</Badge>}
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={source}
              onChange={(event) => setSource(event.target.value as ExamSource)}
            >
              <option value="auto">Auto fallback</option>
              <option value="github">GitHub</option>
              <option value="drive">Google Drive</option>
            </select>
          </div>
        </div>
        {sourceError && (
          <p className="mt-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">{sourceError}</p>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 bg-muted/20"
          placeholder="Search for papers, years or subjects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Breadcrumb */}
      {!search.trim() && (
        <nav className="flex items-center gap-1 text-sm flex-wrap px-1">
          <button
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigateTo(null)}
          >
            <Home className="h-3.5 w-3.5" />
            <span>Directory</span>
          </button>
          {breadcrumb.map((b, i) => (
            <span key={b.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                className={`transition-colors hover:text-foreground ${i === breadcrumb.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}
                style={i === breadcrumb.length - 1 ? { color: b.color } : {}}
                onClick={() => navigateTo(b.id)}
              >
                {b.name}
              </button>
            </span>
          ))}
        </nav>
      )}

      {/* Grid */}
      {displayList.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 border rounded-xl border-dashed opacity-50">
          <FolderOpen className="h-12 w-12 mb-4" />
          <p>No papers found here.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayList.map((node) => (
            <Card
              key={node.id}
              className="group cursor-pointer hover:bg-muted/30 transition-all border shadow-none"
              style={{ borderColor: `${node.color}33` }}
              onClick={() => {
                if (node.type === "folder") navigateTo(node.id);
                else if (node.downloadUrl) setPreviewPdf({ url: node.downloadUrl, name: node.name });
              }}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="shrink-0">
                  {node.type === "folder" ? (
                    <Folder className="h-6 w-6" style={{ color: node.color }} />
                  ) : (
                    <FileText className="h-6 w-6 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate leading-none mb-1">{node.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {node.type === "folder" ? "Directory" : "PDF Document"}
                  </p>
                </div>
                {node.type === "folder" ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-12 border-t bg-background/80 backdrop-blur-md z-40 flex items-center px-6">
        {hoveredNode ? (
          <div className="flex items-center gap-4 text-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: hoveredNode.color }} />
              <span className="font-semibold truncate max-w-[200px]">{hoveredNode.name}</span>
            </div>
            {hoveredNode.type === "pdf" && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-muted-foreground">Size: {formatSize(hoveredNode.size)}</span>
              </>
            )}
            {hoveredNode.type === "folder" && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-muted-foreground">{hoveredNode.children.length} items</span>
              </>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">Hover over an item to see details</span>
        )}
      </div>

      {/* PDF Modal */}
      {previewPdf && (
        <PDFPreview
          url={previewPdf.url}
          name={previewPdf.name}
          onClose={() => setPreviewPdf(null)}
        />
      )}
    </div>
  );
}
