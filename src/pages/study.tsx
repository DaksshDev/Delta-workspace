import { useEffect, useMemo, useState } from "react";
import { FaFolder } from "react-icons/fa";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  HelpCircle,
  Home,
  Layers,
  MoreVertical,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { FlashcardEditor } from "@/components/flashcard-editor";
import { KeyPointCreator } from "@/components/key-point-creator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DEFAULT_STUDY_IDS,
  STUDY_ROOT_ID,
  studyStorage,
  type StudyItem,
  type StudyItemType,
} from "@/lib/study-storage";
import { toast } from "sonner";

function ItemIcon({ type, color, className }: { type: StudyItemType; color: string; className?: string }) {
  switch (type) {
    case "flashcard":
      return <Layers className={className} style={{ color }} />;

    case "keypoints":
      return <FileText className={className} style={{ color }} />;
    default:
      return <FaFolder className={className} style={{ color }} />;
  }
}

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
                aria-label={`Use ${c}`}
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
            placeholder="Name..."
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

function FolderContextMenu({
  isDefault,
  itemType,
  onRename,
  onChangeColor,
  onDelete,
  onClose,
}: {
  isDefault: boolean;
  itemType: StudyItemType;
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
        {!isDefault && (
          <>
            <div className="my-1 border-t" />
            <button
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-destructive/10 text-destructive transition-colors"
              onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete {itemType === "folder" ? "folder" : "item"}
            </button>
          </>
        )}
      </div>
    </>
  );
}

function FolderRow({
  item,
  onOpen,
  onRename,
  onChangeColor,
  onDelete,
  onHoverEnter,
  onHoverLeave,
  isSelected,
  onSelect,
}: {
  item: StudyItem;
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
  const isDefault = DEFAULT_STUDY_IDS.has(item.id);

  const handleClick = () => {
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
      style={{ borderColor: `${item.color}44`, ...(isSelected ? { ringColor: item.color } : {}) }}
      onClick={handleClick}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      <ItemIcon type={item.type} color={item.color} className="h-5 w-5 shrink-0 ml-2" />
      <span className="text-sm font-medium flex-1 min-w-0 truncate">{item.name}</span>
      {item.type === "folder" && (
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
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
            itemType={item.type}
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

export function StudyManager() {
  const [items, setItems] = useState<StudyItem[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<StudyItem[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<StudyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const [hoveredFolder, setHoveredFolder] = useState<StudyItem | null>(null);
  const [tappedFolder, setTappedFolder] = useState<StudyItem | null>(null);
  const [statusCount, setStatusCount] = useState<number | null>(null);
  const statusFolder = hoveredFolder ?? tappedFolder;

  const [creating, setCreating] = useState<StudyItemType | null>(null);
  const [renaming, setRenaming] = useState<StudyItem | null>(null);
  const [colorTarget, setColorTarget] = useState<StudyItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openedFile, setOpenedFile] = useState<StudyItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        await studyStorage.ensureDefaults();
        const [children, path, results] = await Promise.all([
          studyStorage.getChildren(currentId ?? STUDY_ROOT_ID),
          studyStorage.getBreadcrumb(currentId),
          search.trim() ? studyStorage.search(search.trim()) : Promise.resolve([]),
        ]);

        if (!cancelled) {
          setItems(children);
          setBreadcrumb(path);
          setSearchResults(results);
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load study items");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [currentId, revision, search]);

  useEffect(() => {
    let cancelled = false;

    async function loadCount() {
      if (!statusFolder || statusFolder.type !== "folder") {
        setStatusCount(null);
        return;
      }

      const count = await studyStorage.countDescendants(statusFolder.id);
      if (!cancelled) setStatusCount(count);
    }

    loadCount();
    return () => {
      cancelled = true;
    };
  }, [statusFolder]);

  const isSearching = search.trim().length > 0;
  const displayList = useMemo(
    () => (isSearching ? searchResults : items),
    [isSearching, items, searchResults]
  );

  const refresh = () => setRevision((value) => value + 1);

  const handleCreate = async (name: string) => {
    if (!creating) return;
    await studyStorage.createItem(creating, name, currentId ?? STUDY_ROOT_ID);
    setCreating(null);
    refresh();
  };

  const handleRename = async (id: string, name: string) => {
    await studyStorage.renameItem(id, name);
    setRenaming(null);
    refresh();
  };

  const handleChangeColor = async (id: string, color: string) => {
    await studyStorage.changeColor(id, color);
    setColorTarget(null);
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (DEFAULT_STUDY_IDS.has(id)) return;
    await studyStorage.deleteSubtree(id);
    if (currentId === id || breadcrumb.some((item) => item.id === id)) setCurrentId(null);
    setTappedFolder(null);
    setHoveredFolder(null);
    refresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await handleDelete(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleResetColors = async () => {
    await studyStorage.resetDefaultColors();
    refresh();
  };

  const handleResetNames = async () => {
    await studyStorage.resetDefaultNames();
    refresh();
  };

  const navigateTo = (id: string | null) => {
    setCurrentId(id);
    setSearch("");
    setTappedFolder(null);
  };

  return (
    <div className="space-y-6 pb-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Study Vault</h1>
          <p className="text-muted-foreground text-sm tracking-widest uppercase mt-1">
            File-explorer style subject keeper for all your study needs!
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
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="default" className="gap-2">
                <Plus className="h-4 w-4" />
                New Item
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="end">
              {[
                { id: "folder", label: "Folder", icon: Folder },
                { id: "flashcard", label: "Flashcard", icon: Layers },
                { id: "keypoints", label: "Keypoints", icon: FileText },

              ].map((item) => (
                <button
                  key={item.id}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted/60 transition-colors rounded-md text-left"
                  onClick={() => setCreating(item.id as StudyItemType)}
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search all folders and files..."
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

      {!isSearching && (
        <nav className="flex items-center gap-1 text-sm flex-wrap">
          <button
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigateTo(null)}
          >
            <Home className="h-3.5 w-3.5" />
            <span>Root</span>
          </button>
          {breadcrumb.map((item, index) => (
            <span key={item.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                className={`transition-colors hover:text-foreground ${
                  index === breadcrumb.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
                style={index === breadcrumb.length - 1 ? { color: item.color } : {}}
                onClick={() => navigateTo(item.id)}
              >
                {item.name}
              </button>
            </span>
          ))}
        </nav>
      )}

      {isSearching && (
        <p className="text-xs text-muted-foreground tracking-widest uppercase">
          Search results for &quot;{search}&quot; - {searchResults.length} found
        </p>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 border rounded-lg border-dashed text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4 opacity-20 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading study items...</p>
        </div>
      ) : displayList.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border rounded-lg border-dashed text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <p className="text-sm text-muted-foreground">
            {isSearching ? "No items match your search." : "No Items Here"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {displayList.map((item) => (
            <FolderRow
              key={item.id}
              item={item}
              onOpen={() => {
                if (item.type === "folder") navigateTo(item.id);
                else setOpenedFile(item);
              }}
              onRename={() => setRenaming(item)}
              onChangeColor={() => setColorTarget(item)}
              onDelete={() => setDeleteTarget(item)}
              onHoverEnter={() => setHoveredFolder(item)}
              onHoverLeave={() => setHoveredFolder(null)}
              isSelected={statusFolder?.id === item.id}
              onSelect={() => setTappedFolder(item)}
            />
          ))}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 h-10 border-t bg-background/90 backdrop-blur-md flex items-center px-6 z-40 text-sm">
        {statusFolder ? (
          <div className="flex items-center gap-3 text-foreground min-w-0">
            <ItemIcon type={statusFolder.type} color={statusFolder.color} className="h-4 w-4 shrink-0" />
            <span className="font-semibold truncate">{statusFolder.name}</span>
            <span className="text-foreground/30 mx-1">|</span>
            <span className="text-muted-foreground whitespace-nowrap">
              {statusFolder.type === "folder"
                ? `${statusCount ?? "..."} ${statusCount === 1 ? "item" : "items"} total`
                : statusFolder.type}
            </span>
            {!DEFAULT_STUDY_IDS.has(statusFolder.id) && (
              <>
                <span className="text-foreground/30 mx-1">|</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  Created{" "}
                  {new Date(statusFolder.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Hover over an item to view details</span>
        )}
      </div>

      {creating && (
        <NameDialog
          title={`New ${creating === "folder" ? "Folder" : creating.charAt(0).toUpperCase() + creating.slice(1)}`}
          onConfirm={handleCreate}
          onClose={() => setCreating(null)}
        />
      )}
      {renaming && (
        <NameDialog
          title="Rename Item"
          initial={renaming.name}
          onConfirm={(name) => handleRename(renaming.id, name)}
          onClose={() => setRenaming(null)}
        />
      )}
      {colorTarget && (
        <ColorPickerModal
          color={colorTarget.color}
          onChange={(color) => handleChangeColor(colorTarget.id, color)}
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <Card className="w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Delete {deleteTarget.type === "folder" ? "folder" : "file"}?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete &quot;{deleteTarget.name}&quot;?
                  {deleteTarget.type === "folder" ? " Everything inside this folder will also be deleted." : ""}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {openedFile?.type === "flashcard" && (
        <FlashcardEditor fileId={openedFile.id} onClose={() => setOpenedFile(null)} />
      )}

      {openedFile?.type === "keypoints" && (
        <KeyPointCreator fileId={openedFile.id} onClose={() => setOpenedFile(null)} />
      )}
    </div>
  );
}
