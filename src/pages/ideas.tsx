import { useState, useRef, useCallback } from "react";
import { useEcsQuery } from "@/ecs/hooks";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES } from "@/ecs/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Folder,
  MoreVertical,
  Pencil,
  Palette,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { HexColorPicker } from "react-colorful";

// ─── Types ────────────────────────────────────────────────────────────────────

type FolderType = {
  id: string;
  name: string;
  ideaIds: string[];
  color: string;
};

// ─── Drag Context ─────────────────────────────────────────────────────────────

// We use a simple ref-based approach — no external DnD library needed.
// draggedIdeaId is stored in a module-level ref passed via props/callbacks.

// ─── Folder Creation / Rename Dialog ─────────────────────────────────────────

function FolderNameDialog({
  initialName = "",
  title,
  onClose,
  onConfirm,
}: {
  initialName?: string;
  title: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
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
              {title === "New Folder" ? "Create" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Color Picker Popover ─────────────────────────────────────────────────────

function ColorPickerPopover({
  color,
  onChange,
  onClose,
}: {
  color: string;
  onChange: (c: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <Card className="shadow-xl w-auto">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Folder Colour</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <HexColorPicker color={color} onChange={onChange} />
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-full border"
              style={{ background: color }}
            />
            <span className="text-xs font-mono text-muted-foreground">{color}</span>
          </div>
          {/* Quick presets */}
          <div className="flex gap-2 flex-wrap">
            {[
              "#ef4444", "#f97316", "#eab308", "#22c55e",
              "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
            ].map((c) => (
              <button
                key={c}
                className="h-5 w-5 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                style={{ background: c }}
                onClick={() => onChange(c)}
              />
            ))}
          </div>
          <Button size="sm" className="w-full" onClick={onClose}>
            Done
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Folder 3-dot Menu ────────────────────────────────────────────────────────

function FolderMenu({
  onRename,
  onDelete,
  onChangeColor,
  onClose,
}: {
  onRename: () => void;
  onDelete: () => void;
  onChangeColor: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* backdrop to close */}
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
        <div className="my-1 border-t" />
        <button
          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-destructive/10 text-destructive transition-colors"
          onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete folder
        </button>
      </div>
    </>
  );
}

// ─── Add Thought Card ─────────────────────────────────────────────────────────

function AddThoughtCard({ onAdd }: { onAdd: (title: string, content: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd(title, content);
    setTitle("");
    setContent("");
    setOpen(false);
  };

  if (!open) {
    return (
      <Card
        className="flex flex-col items-center justify-center cursor-pointer min-h-[140px] border-dashed hover:border-primary/50 transition-colors"
        onClick={() => setOpen(true)}
      >
        <CardContent className="flex flex-col items-center justify-center gap-2 pt-6">
          <div className="rounded-full border-2 border-muted-foreground/40 p-2">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <span className="text-xs tracking-widest text-muted-foreground font-medium uppercase">
            Add Thought
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-h-[140px]">
      <CardContent className="pt-4 space-y-3">
        <Input
          autoFocus
          placeholder="Title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <Textarea
          placeholder="Details (markdown supported)..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[60px] text-sm"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} className="flex-1">Add</Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Idea Card ────────────────────────────────────────────────────────────────

function IdeaCard({
  ideaId,
  onDelete,
  onEdit,
  onDragStart,
  onDragEnd,
}: {
  ideaId: string;
  onDelete: () => void;
  onEdit: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const { data: titleComp } = useEcsQuery(() => ecsApi.getComponent(ideaId, "title"));
  const { data: contentComp } = useEcsQuery(() => ecsApi.getComponent(ideaId, "content"));
  const { data: tsComp } = useEcsQuery(() => ecsApi.getComponent(ideaId, "createdAt"));

  const title = titleComp?.data?.title || "Untitled";
  const content = contentComp?.data?.content || "";
  const createdAt = tsComp?.data?.createdAt
    ? new Date(tsComp.data.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
    : "just now";

  return (
    <Card
      className="group relative flex flex-col min-h-[140px] overflow-hidden cursor-grab active:cursor-grabbing active:opacity-60 active:scale-95 transition-all select-none"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(ideaId);
      }}
      onDragEnd={onDragEnd}
    >
      <CardContent className="pt-4 flex flex-col flex-1 gap-2">
        <p className="font-medium text-sm leading-snug">{title}</p>
        {content && (
          <div className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none line-clamp-4 flex-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="text-xs tracking-widest text-muted-foreground uppercase">{createdAt}</span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onEdit(ideaId); }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Edit Idea Dialog ─────────────────────────────────────────────────────────

function EditIdeaDialog({
  ideaId,
  onClose,
  onSave,
}: {
  ideaId: string;
  onClose: () => void;
  onSave: (id: string, title: string, content: string) => void;
}) {
  const { data: titleComp } = useEcsQuery(() => ecsApi.getComponent(ideaId, "title"));
  const { data: contentComp } = useEcsQuery(() => ecsApi.getComponent(ideaId, "content"));

  const [title, setTitle] = useState(titleComp?.data?.title || "");
  const [content, setContent] = useState(contentComp?.data?.content || "");

  // Sync once loaded
  const titleSynced = useRef(false);
  if (!titleSynced.current && titleComp) {
    setTitle(titleComp.data?.title || "");
    titleSynced.current = true;
  }

  const contentSynced = useRef(false);
  if (!contentSynced.current && contentComp) {
    setContent(contentComp.data?.content || "");
    contentSynced.current = true;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-lg shadow-xl">
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-semibold">Edit Idea</h2>
          <Input
            autoFocus
            placeholder="Title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Details (markdown supported)..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => {
                if (title.trim()) onSave(ideaId, title.trim(), content);
              }}
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({
  onDrop,
  isDragging,
}: {
  onDrop: () => void;
  isDragging: boolean;
}) {
  const [over, setOver] = useState(false);

  if (!isDragging) return null;

  return (
    <div
      className={`border-2 border-dashed rounded-lg py-4 text-center text-xs tracking-widest uppercase transition-colors ${over
          ? "border-primary bg-primary/10 text-primary"
          : "border-muted-foreground/30 text-muted-foreground"
        }`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(); }}
    >
      {over ? "Release to add" : "Drop idea here"}
    </div>
  );
}

// ─── Draggable Ideas Grid ─────────────────────────────────────────────────────

function DraggableIdeaGrid({
  ideaIds,
  onDelete,
  onEdit,
  onDragStart,
  onDragEnd,
  onReorder,
}: {
  ideaIds: string[];
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onReorder: (from: string, to: string) => void;
}) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const draggingId = useRef<string | null>(null);

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {ideaIds.map((id) => (
        <div
          key={id}
          className={`transition-transform ${dragOverId === id ? "scale-105 opacity-70" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOverId(id); }}
          onDragLeave={() => setDragOverId(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverId(null);
            const fromId = e.dataTransfer.getData("text/plain");
            if (fromId && fromId !== id) onReorder(fromId, id);
          }}
        >
          <IdeaCard
            ideaId={id}
            onDelete={() => onDelete(id)}
            onEdit={onEdit}
            onDragStart={(dragId) => {
              draggingId.current = dragId;
              onDragStart(dragId);
            }}
            onDragEnd={() => {
              draggingId.current = null;
              onDragEnd();
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Folder Section ───────────────────────────────────────────────────────────

function FolderSection({
  folder,
  onDeleteFolder,
  onDeleteIdea,
  onEditIdea,
  onRenameFolder,
  onChangeColor,
  onDropIdea,
  onReorderInsideFolder,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  folder: FolderType;
  onDeleteFolder: (id: string) => void;
  onDeleteIdea: (id: string) => void;
  onEditIdea: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onDropIdea: (folderId: string) => void;
  onReorderInsideFolder: (folderId: string, fromId: string, toId: string) => void;
  isDragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [localColor, setLocalColor] = useState(folder.color);

  const accentColor = folder.color;

  return (
    <>
      <div
        className="border rounded-lg overflow-visible relative"
        style={{ borderColor: `${accentColor}55` }}
      >
        {/* Colour accent strip */}
        <div
          className="h-1 w-full rounded-t-lg"
          style={{ background: accentColor }}
        />

        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors select-none group"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <Folder className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
          <span className="text-sm font-medium flex-1">{folder.name}</span>
          <span className="text-xs text-muted-foreground mr-1">{folder.ideaIds.length}</span>

          {/* 3-dot menu button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>

            {menuOpen && (
              <FolderMenu
                onRename={() => setRenaming(true)}
                onDelete={() => onDeleteFolder(folder.id)}
                onChangeColor={() => setColorPickerOpen(true)}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Ideas grid */}
        {expanded && (
          <div className="p-4 pt-0 space-y-3">
            {folder.ideaIds.length === 0 && !isDragging && (
              <p className="text-xs text-muted-foreground py-3 text-center">
                No ideas yet — drag ideas here.
              </p>
            )}

            <DraggableIdeaGrid
              ideaIds={folder.ideaIds}
              onDelete={onDeleteIdea}
              onEdit={onEditIdea}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onReorder={(from, to) => onReorderInsideFolder(folder.id, from, to)}
            />

            <DropZone onDrop={() => onDropIdea(folder.id)} isDragging={isDragging} />
          </div>
        )}
      </div>

      {/* Rename dialog */}
      {renaming && (
        <FolderNameDialog
          title="Rename Folder"
          initialName={folder.name}
          onClose={() => setRenaming(false)}
          onConfirm={(name) => {
            onRenameFolder(folder.id, name);
            setRenaming(false);
          }}
        />
      )}

      {/* Colour picker */}
      {colorPickerOpen && (
        <ColorPickerPopover
          color={localColor}
          onChange={(c) => {
            setLocalColor(c);
            onChangeColor(folder.id, c);
          }}
          onClose={() => setColorPickerOpen(false)}
        />
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Ideas() {
  const { data: ideas, refetch } = useEcsQuery(() =>
    ecsApi.getEntitiesByType(ENTITY_TYPES.IDEA)
  );

  const [folders, setFolders] = useState<FolderType[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);

  // Drag state — id of the card currently being dragged
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // IDs that belong to some folder
  const assignedIds = new Set(folders.flatMap((f) => f.ideaIds));
  const unassignedIdeas = (ideas ?? []).filter((i) => !assignedIds.has(i.id));
  const unassignedIds = unassignedIdeas.map((i) => i.id);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleAdd = async (title: string, content: string) => {
    const idea = await ecsApi.createEntity(ENTITY_TYPES.IDEA);
    await ecsApi.setComponent(idea.id, "title", { title });
    await ecsApi.setComponent(idea.id, "content", { content });
    await ecsApi.setComponent(idea.id, "createdAt", { createdAt: new Date().toISOString() });
    refetch();
  };

  const handleDelete = async (id: string) => {
    await ecsApi.deleteEntity(id);
    setFolders((prev) =>
      prev.map((f) => ({ ...f, ideaIds: f.ideaIds.filter((i) => i !== id) }))
    );
    refetch();
  };

  const handleEdit = async (id: string, title: string, content: string) => {
    await ecsApi.setComponent(id, "title", { title });
    await ecsApi.setComponent(id, "content", { content });
    // createdAt intentionally NOT updated
    setEditingIdeaId(null);
    refetch();
  };

  // ── Folders ───────────────────────────────────────────────────────────────

  const handleCreateFolder = (name: string) => {
    setFolders((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name, ideaIds: [], color: "#6366f1" },
    ]);
    setShowCreateFolder(false);
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
  };

  const handleRenameFolder = (folderId: string, name: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, name } : f))
    );
  };

  const handleChangeColor = (folderId: string, color: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, color } : f))
    );
  };

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragEnd = () => setDraggingId(null);

  // Drop into a folder
  const handleDropIntoFolder = (folderId: string) => {
    if (!draggingId) return;
    const id = draggingId;
    setDraggingId(null);
    setFolders((prev) =>
      prev.map((f) => {
        // Remove from any folder first
        const without = f.ideaIds.filter((i) => i !== id);
        if (f.id === folderId) return { ...f, ideaIds: [...without, id] };
        return { ...f, ideaIds: without };
      })
    );
  };

  // Reorder inside a folder
  const handleReorderInsideFolder = (folderId: string, fromId: string, toId: string) => {
    setFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        const ids = [...f.ideaIds];
        const fi = ids.indexOf(fromId);
        const ti = ids.indexOf(toId);
        if (fi === -1 || ti === -1) return f;
        ids.splice(fi, 1);
        ids.splice(ti, 0, fromId);
        return { ...f, ideaIds: ids };
      })
    );
  };

  // Reorder unassigned ideas
  const handleReorderUnassigned = (fromId: string, toId: string) => {
    // We can't directly mutate `ideas` from ECS, but we can track a local order
    // For simplicity, remove from folder assignments (already unassigned) — no-op needed
    // The grid handles visual reorder via DOM; since ECS controls order, we just ignore for now
    // If ECS supports ordering, that could be implemented here.
  };

  // Drop on unassigned area — remove from folder
  const handleDropOnUnassigned = () => {
    if (!draggingId) return;
    const id = draggingId;
    setDraggingId(null);
    setFolders((prev) =>
      prev.map((f) => ({ ...f, ideaIds: f.ideaIds.filter((i) => i !== id) }))
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">idea.dump</h1>
          <p className="text-muted-foreground text-sm tracking-widest uppercase mt-1">
            Capture everything. Forget nothing.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)}>
          <FolderPlus className="h-4 w-4 mr-2" />
          Create Folder
        </Button>
      </div>

      {/* Unassigned ideas grid */}
      <div
        className="space-y-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleDropOnUnassigned(); }}
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AddThoughtCard onAdd={handleAdd} />
          {unassignedIds.map((id) => (
            <div
              key={id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const fromId = e.dataTransfer.getData("text/plain");
                if (fromId && fromId !== id) handleReorderUnassigned(fromId, id);
              }}
            >
              <IdeaCard
                ideaId={id}
                onDelete={() => handleDelete(id)}
                onEdit={(id) => setEditingIdeaId(id)}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            </div>
          ))}
        </div>

        {/* Drop zone to unassign from folders */}
        {draggingId && folders.some((f) => f.ideaIds.includes(draggingId)) && (
          <DropZone
            onDrop={handleDropOnUnassigned}
            isDragging={!!draggingId}
          />
        )}
      </div>

      {/* Folders */}
      {folders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs tracking-widest text-muted-foreground uppercase font-medium">
            Folders
          </h2>
          <div className="space-y-3">
            {folders.map((folder) => (
              <FolderSection
                key={folder.id}
                folder={folder}
                onDeleteFolder={handleDeleteFolder}
                onDeleteIdea={handleDelete}
                onEditIdea={(id) => setEditingIdeaId(id)}
                onRenameFolder={handleRenameFolder}
                onChangeColor={handleChangeColor}
                onDropIdea={handleDropIntoFolder}
                onReorderInsideFolder={handleReorderInsideFolder}
                isDragging={!!draggingId}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(ideas?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed">
          <p className="text-sm text-muted-foreground">Your next big idea goes here.</p>
        </div>
      )}

      {/* Dialogs */}
      {showCreateFolder && (
        <FolderNameDialog
          title="New Folder"
          onClose={() => setShowCreateFolder(false)}
          onConfirm={handleCreateFolder}
        />
      )}

      {editingIdeaId && (
        <EditIdeaDialog
          ideaId={editingIdeaId}
          onClose={() => setEditingIdeaId(null)}
          onSave={handleEdit}
        />
      )}
    </div>
  );
}