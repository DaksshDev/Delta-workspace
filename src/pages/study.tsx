import { useState, useMemo } from "react";
import { FaFolder } from "react-icons/fa";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Home,
  Plus,
  MoreVertical,
  Pencil,
  Palette,
  Trash2,
  X,
  Search,
  Settings,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { HexColorPicker } from "react-colorful";

// ─── Types ────────────────────────────────────────────────────────────────────

type FolderNode = {
  id: string;
  name: string;
  color: string;
  children: FolderNode[];
  createdAt?: string; // <-- Added creation date
};

// ─── Default folder IDs (cannot be deleted) ───────────────────────────────────

const DEFAULT_IDS = new Set([
  "science", "maths", "sst", "english", "hindi", "it",
  "physics", "chemistry", "bio",
  "history", "geography", "civics", "economics",
]);

// ─── Seed Data (source of truth for reset) ────────────────────────────────────

const SEED_DEFAULTS: FolderNode[] = [
  {
    id: "science",
    name: "Science",
    color: "#22c55e",
    children: [
      { id: "physics", name: "Physics", color: "#3b82f6", children: [] },
      { id: "chemistry", name: "Chemistry", color: "#f97316", children: [] },
      { id: "bio", name: "Biology", color: "#22c55e", children: [] },
    ],
  },
  { id: "maths", name: "Maths", color: "#ef4444", children: [] },
  {
    id: "sst",
    name: "SST",
    color: "#f97316",
    children: [
      { id: "history", name: "History", color: "#b45309", children: [] },
      { id: "geography", name: "Geography", color: "#0d9488", children: [] },
      { id: "civics", name: "Civics", color: "#eab308", children: [] },
      { id: "economics", name: "Economics", color: "#22c55e", children: [] },
    ],
  },
  { id: "english", name: "English", color: "#3b82f6", children: [] },
  { id: "hindi", name: "Hindi", color: "#8b5cf6", children: [] },
  { id: "it", name: "IT", color: "#6b7280", children: [] },
];

// Deep clone seed preserving any user children inside default folders
function cloneSeed(seed: FolderNode[]): FolderNode[] {
  return seed.map((n) => ({ ...n, children: cloneSeed(n.children) }));
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Deep helpers ─────────────────────────────────────────────────────────────

function findNode(nodes: FolderNode[], id: string): FolderNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function updateNode(
  nodes: FolderNode[],
  id: string,
  updater: (n: FolderNode) => FolderNode
): FolderNode[] {
  return nodes.map((n) => {
    if (n.id === id) return updater(n);
    return { ...n, children: updateNode(n.children, id, updater) };
  });
}

function deleteNode(nodes: FolderNode[], id: string): FolderNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: deleteNode(n.children, id) }));
}

function buildPath(nodes: FolderNode[], targetId: string): FolderNode[] {
  for (const n of nodes) {
    if (n.id === targetId) return [n];
    const sub = buildPath(n.children, targetId);
    if (sub.length > 0) return [n, ...sub];
  }
  return [];
}

function flatSearch(nodes: FolderNode[], query: string): FolderNode[] {
  const q = query.toLowerCase();
  const results: FolderNode[] = [];
  function walk(list: FolderNode[]) {
    for (const n of list) {
      if (n.name.toLowerCase().includes(q)) results.push(n);
      walk(n.children);
    }
  }
  walk(nodes);
  return results;
}

// Reset only colors of default folders, preserve user-created children & custom children
function resetColorsOnly(tree: FolderNode[]): FolderNode[] {
  return tree.map((n) => {
    const seedMatch = findNode(SEED_DEFAULTS, n.id);
    const newColor = seedMatch ? seedMatch.color : n.color;
    return {
      ...n,
      color: newColor,
      children: resetColorsOnly(n.children),
    };
  });
}

// Reset only names of default folders
function resetNamesOnly(tree: FolderNode[]): FolderNode[] {
  return tree.map((n) => {
    const seedMatch = findNode(SEED_DEFAULTS, n.id);
    const newName = seedMatch ? seedMatch.name : n.name;
    return {
      ...n,
      name: newName,
      children: resetNamesOnly(n.children),
    };
  });
}

// Helper to count total nested items
function countTotalItems(node: FolderNode): number {
  return node.children.length + node.children.reduce((acc, child) => acc + countTotalItems(child), 0);
}

// ─── Color Picker Modal ───────────────────────────────────────────────────────

function ColorPickerModal({
  color,
  onChange,
  onClose,
}: {
  color: string;
  onChange: (c: string) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState(color);
  const presets = [
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
    "#0d9488", "#b45309", "#6b7280", "#ffffff",
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="shadow-xl w-auto">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Folder Colour</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <HexColorPicker color={local} onChange={setLocal} />
          <div className="flex flex-wrap gap-2">
            {presets.map((c) => (
              <button
                key={c}
                className="h-5 w-5 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                style={{ background: c }}
                onClick={() => setLocal(c)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full border" style={{ background: local }} />
            <span className="text-xs font-mono text-muted-foreground flex-1">{local}</span>
          </div>
          <Button size="sm" className="w-full" onClick={() => { onChange(local); onClose(); }}>
            Apply
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Name Dialog ──────────────────────────────────────────────────────────────

function NameDialog({
  title,
  initial,
  onConfirm,
  onClose,
}: {
  title: string;
  initial?: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Input
            autoFocus
            placeholder="Folder name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
              if (e.key === "Escape") onClose();
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => name.trim() && onConfirm(name.trim())}>
              {initial ? "Rename" : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({
  onResetColors,
  onResetNames,
  onClose,
}: {
  onResetColors: () => void;
  onResetNames: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Study Manager Settings</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Reset options only affect default subject folders. Your added folders and any content inside folders are never touched.
          </p>

          <div className="space-y-2">
            <button
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border hover:bg-muted/40 transition-colors text-left group"
              onClick={() => { onResetColors(); onClose(); }}
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Palette className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Reset folder colours to default</p>
                <p className="text-xs text-muted-foreground">Restores original colours for all default subject folders.</p>
              </div>
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border hover:bg-muted/40 transition-colors text-left group"
              onClick={() => { onResetNames(); onClose(); }}
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Pencil className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Reset folder names to default</p>
                <p className="text-xs text-muted-foreground">Restores original names for all default subject folders.</p>
              </div>
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

function FolderContextMenu({
  isDefault,
  onRename,
  onChangeColor,
  onDelete,
  onClose,
}: {
  isDefault: boolean;
  onRename: () => void;
  onChangeColor: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-8 z-40 w-44 bg-background border rounded-lg shadow-lg py-1 text-sm">
        <button
          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/60 transition-colors"
          onClick={(e) => { e.stopPropagation(); onRename(); onClose(); }}
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          Rename
        </button>
        <button
          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/60 transition-colors"
          onClick={(e) => { e.stopPropagation(); onChangeColor(); onClose(); }}
        >
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          Change colour
        </button>
        {/* Delete only shown for user-created folders */}
        {!isDefault && (
          <>
            <div className="my-1 border-t" />
            <button
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-destructive/10 text-destructive transition-colors"
              onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete folder
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ─── Folder Row ───────────────────────────────────────────────────────────────

function FolderRow({
  node,
  onOpen,
  onRename,
  onChangeColor,
  onDelete,
  onHoverEnter,
  onHoverLeave,
  isSelected,
  onSelect,
}: {
  node: FolderNode;
  onOpen: () => void;
  onRename: () => void;
  onChangeColor: () => void;
  onDelete: () => void;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isDefault = DEFAULT_IDS.has(node.id);

  const handleClick = () => {
    // On touch: first tap selects (updates status bar), second tap on same folder opens it.
    // On desktop: hover already marks this folder as selected, so first click opens directly.
    if (isSelected) {
      onOpen();
    } else {
      onSelect();
    }
  };

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-all select-none relative ${
        isSelected ? "bg-muted/20 ring-1 ring-inset" : ""
      }`}
      style={{
        borderColor: `${node.color}44`,
        ...(isSelected ? { ringColor: node.color } : {}),
      }}
      onClick={handleClick}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      <FaFolder className="h-5 w-5 shrink-0 ml-2" style={{ color: node.color }} />
      <span className="text-sm font-medium flex-1">{node.name}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* 3-dot menu */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
        {menuOpen && (
          <FolderContextMenu
            isDefault={isDefault}
            onRename={onRename}
            onChangeColor={onChangeColor}
            onDelete={onDelete}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StudyManager() {
  const [tree, setTree] = useState<FolderNode[]>(cloneSeed(SEED_DEFAULTS));
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Hover tracking (desktop) + tap tracking (mobile) for bottom bar
  const [hoveredFolder, setHoveredFolder] = useState<FolderNode | null>(null);
  const [tappedFolder, setTappedFolder] = useState<FolderNode | null>(null);

  // What's shown in the status bar: hover takes priority on desktop; tap used on mobile
  const statusFolder = hoveredFolder ?? tappedFolder;

  // Modal states
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<FolderNode | null>(null);
  const [colorTarget, setColorTarget] = useState<FolderNode | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Derive current view
  const currentChildren: FolderNode[] = useMemo(() => {
    if (!currentId) return tree;
    return findNode(tree, currentId)?.children ?? [];
  }, [tree, currentId]);

  const breadcrumb: FolderNode[] = useMemo(() => {
    if (!currentId) return [];
    return buildPath(tree, currentId);
  }, [tree, currentId]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return flatSearch(tree, search.trim());
  }, [tree, search]);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const handleCreate = (name: string) => {
    // Inject current date when creating the folder
    const newNode: FolderNode = {
      id: generateId(),
      name,
      color: "#6366f1",
      children: [],
      createdAt: new Date().toISOString()
    };

    if (!currentId) {
      setTree((prev) => [...prev, newNode]);
    } else {
      setTree((prev) =>
        updateNode(prev, currentId, (n) => ({ ...n, children: [...n.children, newNode] }))
      );
    }
    setCreating(false);
  };

  const handleRename = (id: string, name: string) => {
    setTree((prev) => updateNode(prev, id, (n) => ({ ...n, name })));
    setRenaming(null);
  };

  const handleChangeColor = (id: string, color: string) => {
    setTree((prev) => updateNode(prev, id, (n) => ({ ...n, color })));
    setColorTarget(null);
  };

  const handleDelete = (id: string) => {
    setTree((prev) => deleteNode(prev, id));
    const pathIds = breadcrumb.map((b) => b.id);
    if (pathIds.includes(id)) setCurrentId(null);
  };

  // ── Reset handlers ──────────────────────────────────────────────────────────

  const handleResetColors = () => {
    setTree((prev) => resetColorsOnly(prev));
  };

  const handleResetNames = () => {
    setTree((prev) => resetNamesOnly(prev));
  };

  // ── Navigate ────────────────────────────────────────────────────────────────

  const navigateTo = (id: string | null) => {
    setCurrentId(id);
    setSearch("");
    setTappedFolder(null); // clear tap selection when navigating
  };

  const isSearching = search.trim().length > 0;
  const displayList = isSearching ? searchResults : currentChildren;

  return (
    // pb-14 ensures content is not hidden behind our new fixed bottom bar
    <div className="space-y-6 pb-14">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Study Manager</h1>
          <p className="text-muted-foreground text-sm tracking-widest uppercase mt-1">
            File-explorer style subject organiser
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search all folders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSearch("")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Breadcrumb */}
      {!isSearching && (
        <nav className="flex items-center gap-1 text-sm flex-wrap">
          <button
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigateTo(null)}
          >
            <Home className="h-3.5 w-3.5" />
            <span>Root</span>
          </button>
          {breadcrumb.map((b, i) => (
            <span key={b.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                className={`transition-colors hover:text-foreground ${i === breadcrumb.length - 1
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
                  }`}
                style={i === breadcrumb.length - 1 ? { color: b.color } : {}}
                onClick={() => navigateTo(b.id)}
              >
                {b.name}
              </button>
            </span>
          ))}
        </nav>
      )}

      {isSearching && (
        <p className="text-xs text-muted-foreground tracking-widest uppercase">
          Search results for &quot;{search}&quot; — {searchResults.length} found
        </p>
      )}

      {/* Folder grid */}
      {displayList.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border rounded-lg border-dashed text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <p className="text-sm text-muted-foreground">
            {isSearching ? "No folders match your search." : "No folders here yet — create one!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {displayList.map((node) => (
            <FolderRow
              key={node.id}
              node={node}
              onOpen={() => navigateTo(node.id)}
              onRename={() => setRenaming(node)}
              onChangeColor={() => setColorTarget(node)}
              onDelete={() => handleDelete(node.id)}
              onHoverEnter={() => setHoveredFolder(node)}
              onHoverLeave={() => setHoveredFolder(null)}
              isSelected={statusFolder?.id === node.id}
              onSelect={() => setTappedFolder(node)}
            />
          ))}
        </div>
      )}

      {/* Bottom Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-10 border-t bg-background/90 backdrop-blur-md flex items-center px-6 z-40 text-sm">
        {hoveredFolder ? (
          <div className="flex items-center gap-3 text-foreground">
            {/* Icon + name — always shown */}
            <FaFolder style={{ color: hoveredFolder.color }} />
            <span className="font-semibold">{hoveredFolder.name}</span>

            <span className="text-foreground/30 mx-1">|</span>

            {/* Total items — always shown for all folders */}
            <span className="text-muted-foreground">
              {countTotalItems(hoveredFolder)}{" "}
              {countTotalItems(hoveredFolder) === 1 ? "item" : "items"} total
            </span>

            {/* Creation date — only for user-created (non-default) folders */}
            {!DEFAULT_IDS.has(hoveredFolder.id) && hoveredFolder.createdAt && (
              <>
                <span className="text-foreground/30 mx-1">|</span>
                <span className="text-muted-foreground">
                  Created{" "}
                  {new Date(hoveredFolder.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Hover over a folder to view details</span>
        )}
      </div>

      {/* Modals */}
      {creating && (
        <NameDialog
          title="New Folder"
          onConfirm={handleCreate}
          onClose={() => setCreating(false)}
        />
      )}

      {renaming && (
        <NameDialog
          title="Rename Folder"
          initial={renaming.name}
          onConfirm={(name) => handleRename(renaming.id, name)}
          onClose={() => setRenaming(null)}
        />
      )}

      {colorTarget && (
        <ColorPickerModal
          color={colorTarget.color}
          onChange={(c) => handleChangeColor(colorTarget.id, c)}
          onClose={() => setColorTarget(null)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          onResetColors={handleResetColors}
          onResetNames={handleResetNames}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}