import { useState, useRef, useCallback, useEffect } from "react";
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
  Search,
  Archive,
  ArrowLeft,
  Vault,
  BadgeCheck,
  AlertTriangle,
} from "lucide-react";

import { HexColorPicker } from "react-colorful";
import { IdeaTagEditor } from "@/components/idea-tag-editor";
import { ideaTagsApi } from "@/lib/idea-tags-api";
import { ideaFoldersApi, type IdeaFolder } from "@/lib/idea-folders-api";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check } from "lucide-react";
import { cn, getContrastColor } from "@/lib/utils";
import { VaultGrid, ActiveVaultPanel } from "@/components/vault-panel";

// ─── Types ────────────────────────────────────────────────────────────────────

type FolderType = IdeaFolder;

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


// ─── Add Thought Card ─────────────────────────────────────────────────────────

function AddThoughtCard({
  onAdd,
}: {
  onAdd: (content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (!content.trim()) return;
    onAdd(content);
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
        <Textarea
          autoFocus
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className="min-h-[80px] text-sm resize-none"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} className="flex-1">Add</Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IdeaTagBadge({
  tag,
  isVerified,
  onRemove,
}: {
  tag: any;
  isVerified?: boolean;
  onRemove: () => void;
}) {
  const [selected, setSelected] = useState(false);

  return (
    <Badge
      className={cn(
        "group/tag relative flex items-center overflow-hidden rounded-full px-2.5 py-1 text-xs font-bold cursor-pointer transition-all duration-300",

        // base
        "shadow-sm hover:shadow-md",

        // selected state
        selected && "ring-1 ring-offset-1 ring-primary/20 scale-105",

        // 🔥 verified state (main visual)
        isVerified &&
        "ring-2 ring-white/80 shadow-[0_0_10px_rgba(255,255,255,0.9)] scale-[1.03]"
      )}
      style={{
        backgroundColor: tag.color,
        color: getContrastColor(tag.color),
      }}
      onClick={(e) => {
        e.stopPropagation();
        setSelected((v) => !v);
      }}
    >
      {/* Tag name */}
      <span className="truncate max-w-[100px] leading-none">
        {tag.name}
      </span>

      {/* ✅ Verified icon */}
      {isVerified && (
        <BadgeCheck
          className="h-3.5 w-3.5 shrink-0 ml-1"
          style={{
            color: "white",
            filter: "drop-shadow(0 0 4px rgba(255,255,255,0.9))",
          }}
        />
      )}

      {/* ❌ Remove button (expand on hover/select) */}
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden transition-all duration-300",
          selected
            ? "ml-1.5 w-3.5 opacity-100"
            : "w-0 opacity-0 ml-0 group-hover/tag:w-3.5 group-hover/tag:ml-1.5 group-hover/tag:opacity-100"
        )}
      >
        <X
          className="h-3 w-3 shrink-0 hover:scale-125 transition-transform"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      </div>
    </Badge>
  );
}

// ─── Delete Confirmation Dialog ───────────────────────────────────────────────

function IdeaDeleteDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <Card className="w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-semibold">Delete Idea?</h2>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this idea? This action cannot be undone.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" onClick={onConfirm}>Delete</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Folder Delete Confirmation Dialog ────────────────────────────────────────
// Step 1 — ask which kind of delete.
// Step 2 — extra confirm if user chose "delete all ideas too".

type FolderDeleteStep = "choose" | "confirm-all";

function FolderDeleteDialog({
  folderName,
  isVault = false,
  onClose,
  onDeleteFolderOnly,
  onDeleteWithIdeas,
}: {
  folderName: string;
  isVault?: boolean;
  onClose: () => void;
  onDeleteFolderOnly: () => void;
  onDeleteWithIdeas: () => void;
}) {
  const [step, setStep] = useState<FolderDeleteStep>("choose");
  const [confirmText, setConfirmText] = useState("");
  const deleteConfirmed = !isVault || confirmText.trim().toLowerCase() === "delete";
  const itemLabel = isVault ? "vault" : "folder";

  if (step === "confirm-all") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); onClose(); }}>
        <Card className="w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h2 className="text-lg font-semibold">Are you absolutely sure?</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              This will permanently delete <span className="font-semibold text-foreground">"{folderName}"</span> and{" "}
              <span className="font-semibold text-destructive">ALL ideas inside it</span>. This cannot be undone.
            </p>
            {isVault && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Type <span className="font-semibold text-foreground">delete</span> to confirm.
                </p>
                <Input
                  autoFocus
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder="delete"
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="destructive" onClick={onDeleteWithIdeas} disabled={!deleteConfirmed}>
                Yes, delete everything
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <Card className="w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-semibold">Delete {itemLabel}?</h2>
          <p className="text-sm text-muted-foreground">
            How do you want to delete <span className="font-semibold text-foreground">"{folderName}"</span>?
          </p>
          {isVault && (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-xs text-muted-foreground">
                Vault deletion is protected. Type <span className="font-semibold text-foreground">delete</span> before the delete buttons unlock.
              </p>
              <Input
                autoFocus
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder="delete"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button
              variant="destructive"
              className="justify-start"
              onClick={() => setStep("confirm-all")}
              disabled={!deleteConfirmed}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete {itemLabel} AND all ideas in it
            </Button>
            <Button
              variant="outline"
              className="justify-start text-destructive hover:text-destructive"
              onClick={onDeleteFolderOnly}
              disabled={!deleteConfirmed}
            >
              {isVault ? <Vault className="h-4 w-4 mr-2" /> : <Folder className="h-4 w-4 mr-2" />}
              Just delete {itemLabel} (keep ideas)
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
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
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail === ideaId) {
        setUpdateTrigger((prev) => prev + 1);
      }
    };
    window.addEventListener('ecs-updated', handleUpdate);
    return () => window.removeEventListener('ecs-updated', handleUpdate);
  }, [ideaId]);

  useEffect(() => {
    const refresh = () => refetchAllTags();
    window.addEventListener("tags-updated", refresh);
    return () => window.removeEventListener("tags-updated", refresh);
  }, []);

  const { data: contentComp } = useEcsQuery(() => ecsApi.getComponent(ideaId, "content"), [updateTrigger]);
  const { data: tsComp } = useEcsQuery(() => ecsApi.getComponent(ideaId, "createdAt"), [updateTrigger]);
  const { data: tagComp, refetch: refetchTags } = useEcsQuery(() => ecsApi.getComponent(ideaId, 'idea-tag'), [updateTrigger]);
  const { data: allTags = [], refetch: refetchAllTags } = useEcsQuery(() => ideaTagsApi.getTags());

  const currentTags: string[] = tagComp?.data?.tags || [];

  const verifiedTagIds: string[] = tagComp?.data?.verifiedTags || [];

  const hasVerifiedTag = currentTags.some((tagId) => {
    const tag = allTags.find((t: any) => t.id === tagId);
    return tag?.verified;
  });

  const content = contentComp?.data?.content || "";
  const createdAt = tsComp?.data?.createdAt
    ? new Date(tsComp.data.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
    : "just now";

  const toggleTag = async (tagId: string) => {
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter((t: string) => t !== tagId)
      : [...currentTags, tagId];

    await ecsApi.setComponent(ideaId, "idea-tag", {
      tags: newTags,
    });

    refetchTags();
    window.dispatchEvent(new Event("tags-updated"));
    window.dispatchEvent(new CustomEvent("ecs-updated", { detail: ideaId }));
  };

  return (
    <>
      <Card
        className={cn(
          "group relative flex flex-col min-h-[140px] overflow-hidden cursor-grab active:cursor-grabbing active:opacity-60 active:scale-95 transition-all select-none",

          hasVerifiedTag &&
          "ring-1 ring-blue-400/40 shadow-[0_0_8px_rgba(59,130,246,0.25)]"
        )}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart(ideaId);
        }}
        onDragEnd={onDragEnd}
      >
        <CardContent className="pt-4 flex flex-col flex-1 gap-2">
          <div className="text-sm text-foreground max-w-none line-clamp-4 flex-1 whitespace-pre-wrap font-medium leading-snug">
            {content}
          </div>

          {/* Tag badges — always visible below content */}
          {currentTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {currentTags.map((tagId: string) => {
                const tag = allTags.find((t: any) => t.id === tagId);
                if (!tag) return null;
                return (
                  <IdeaTagBadge
                    key={tag.id}
                    tag={tag}
                    isVerified={tag.verified}
                    onRemove={() => toggleTag(tag.id)}
                  />
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between mt-auto pt-2 border-t border-muted/30">
            <span className="text-[10px] tracking-widest text-muted-foreground uppercase">{createdAt}</span>
            <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => { e.stopPropagation(); onEdit(ideaId); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>

              {/* Tag picker — shown on hover next to pencil */}
              <Popover onOpenChange={(open) => open && refetchAllTags()}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0 shadow-xl border-none" align="end" onClick={(e) => e.stopPropagation()}>
                  <div className="p-2 border-b bg-muted/50 space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Add Tags</p>
                    <Input
                      placeholder="Search tags..."
                      className="h-7 text-xs"
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <ScrollArea className="h-[160px] p-1">
                    <div className="space-y-0.5">
                      {allTags
                        .filter(tag => tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((tag) => (
                          <div
                            key={tag.id}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs",
                              currentTags.includes(tag.id)
                                ? "bg-primary/10 text-primary font-semibold"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => toggleTag(tag.id)}
                          >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                            <span className="flex-1 truncate">{tag.name}</span>
                            {currentTags.includes(tag.id) && <Check className="h-3 w-3" />}
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showDeleteConfirm && (
        <IdeaDeleteDialog
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            onDelete();
          }}
        />
      )}
    </>
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
  onSave: (id: string, content: string) => void;
}) {
  const { data: contentComp } = useEcsQuery(() => ecsApi.getComponent(ideaId, "content"));

  const [content, setContent] = useState(contentComp?.data?.content || "");

  const contentSynced = useRef(false);
  if (!contentSynced.current && contentComp) {
    setContent(contentComp.data?.content || "");
    contentSynced.current = true;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-semibold">Edit Idea</h2>
          <Textarea
            autoFocus
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] text-sm resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => {
                if (content.trim()) onSave(ideaId, content.trim());
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
  onRequestDeleteFolder,
  onConvertToVault,
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
  onRequestDeleteFolder: (id: string) => void;
  onConvertToVault: (id: string) => void;
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
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1 z-40" align="end" onClick={(e) => e.stopPropagation()}>
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/60 transition-colors rounded-sm text-sm"
                  onClick={() => { setMenuOpen(false); setRenaming(true); }}
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  Rename
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/60 transition-colors rounded-sm text-sm"
                  onClick={() => { setMenuOpen(false); setColorPickerOpen(true); }}
                >
                  <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                  Change colour
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/60 transition-colors rounded-sm text-sm"
                  onClick={() => { setMenuOpen(false); onConvertToVault(folder.id); }}
                >
                  <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                  Convert to vault
                </button>
                <div className="my-1 border-t" />
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-destructive/10 text-destructive transition-colors rounded-sm text-sm"
                  onClick={() => { setMenuOpen(false); onRequestDeleteFolder(folder.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete folder
                </button>
              </PopoverContent>
            </Popover>
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
  const { data: contentComponents = [], refetch: refetchContentComponents } = useEcsQuery(() => ecsApi.getEntitiesWithComponent("content"));
  const { data: tagComponents = [], refetch: refetchTagComponents } = useEcsQuery(() => ecsApi.getEntitiesWithComponent("idea-tag"));
  const { data: allIdeaTags = [] } = useEcsQuery(() => ideaTagsApi.getTags());

  const [folders, setFolders] = useState<FolderType[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const [showVaultList, setShowVaultList] = useState(false);
  const [search, setSearch] = useState("");
  const [folderToDelete, setFolderToDelete] = useState<FolderType | null>(null);
  const isLoadingFoldersRef = useRef(false);
  const skipNextFolderSaveRef = useRef(false);

  // Drag state — id of the card currently being dragged
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const normalFolders = folders.filter((folder) => !folder.isVault);
  const vaults = folders.filter((folder) => folder.isVault);
  const activeVault = vaults.find((vault) => vault.id === activeVaultId) ?? null;

  const contentByIdeaId = new Map(contentComponents.map((component) => [
    component.entityId,
    String(component.data?.content ?? ""),
  ]));
  const tagIdsByIdeaId = new Map<string, string[]>(tagComponents.map((component) => [
    component.entityId,
    Array.isArray(component.data?.tags) ? component.data.tags : [],
  ]));
  const tagNameById = new Map(allIdeaTags.map((tag) => [tag.id, tag.name]));

  const ideaMatchesSearch = (id: string) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      contentByIdeaId.get(id) ?? "",
      ...(tagIdsByIdeaId.get(id) ?? []).map((tagId) => tagNameById.get(tagId) ?? tagId),
    ].join(" ").toLowerCase();
    return q.split(/\s+/).every((term) => haystack.includes(term));
  };

  const vaultMatchesSearch = (vault: FolderType) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const vaultNameMatches = q.split(/\s+/).every((term) => vault.name.toLowerCase().includes(term));
    return vaultNameMatches || vault.ideaIds.some(ideaMatchesSearch);
  };

  // IDs that belong to some folder or vault
  const assignedIds = new Set(folders.flatMap((f) => f.ideaIds));
  const unassignedIdeas = (ideas ?? []).filter((i) => !assignedIds.has(i.id));
  const unassignedIds = unassignedIdeas.map((i) => i.id).filter(ideaMatchesSearch);

  useEffect(() => {
    let cancelled = false;

    async function loadFolders() {
      isLoadingFoldersRef.current = true;
      try {
        const savedFolders = await ideaFoldersApi.getFolders();
        if (!cancelled) {
          skipNextFolderSaveRef.current = true;
          setFolders(savedFolders);
          setFoldersLoaded(true);
        }
      } finally {
        isLoadingFoldersRef.current = false;
      }
    }

    loadFolders();
    window.addEventListener("delta-data-changed", loadFolders);
    return () => {
      cancelled = true;
      window.removeEventListener("delta-data-changed", loadFolders);
    };
  }, []);

  useEffect(() => {
    if (!foldersLoaded || isLoadingFoldersRef.current) return;
    if (skipNextFolderSaveRef.current) {
      skipNextFolderSaveRef.current = false;
      return;
    }
    ideaFoldersApi.saveFolders(folders);
  }, [folders, foldersLoaded]);

  useEffect(() => {
    const refetchSearchData = () => {
      refetchContentComponents();
      refetchTagComponents();
    };

    window.addEventListener("ecs-updated", refetchSearchData);
    return () => window.removeEventListener("ecs-updated", refetchSearchData);
  }, [refetchContentComponents, refetchTagComponents]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleAdd = async (content: string) => {
    const idea = await ecsApi.createEntity(ENTITY_TYPES.IDEA);
    await ecsApi.setComponent(idea.id, "content", { content });
    await ecsApi.setComponent(idea.id, "createdAt", { createdAt: new Date().toISOString() });

    if (activeVaultId) {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === activeVaultId ? { ...f, ideaIds: [idea.id, ...f.ideaIds] } : f
        )
      );
    }

    refetchContentComponents();
    refetch();
  };

  const handleDelete = async (id: string) => {
    await ecsApi.deleteEntity(id);
    setFolders((prev) =>
      prev.map((f) => ({ ...f, ideaIds: f.ideaIds.filter((i) => i !== id) }))
    );
    refetch();
  };

  const handleEdit = async (id: string, content: string) => {
    await ecsApi.setComponent(id, "content", { content });
    // createdAt intentionally NOT updated
    setEditingIdeaId(null);
    window.dispatchEvent(new CustomEvent('ecs-updated', { detail: id }));
    refetchContentComponents();
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

  // Delete folder only — ideas return to unassigned pool
  const handleDeleteFolderOnly = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (activeVaultId === folderId) setActiveVaultId(null);
    setFolderToDelete(null);
  };

  // Delete folder AND all ideas inside it
  const handleDeleteFolderWithIdeas = async (folder: FolderType) => {
    await Promise.all(folder.ideaIds.map((id) => ecsApi.deleteEntity(id)));
    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    if (activeVaultId === folder.id) setActiveVaultId(null);
    setFolderToDelete(null);
    refetch();
  };

  const handleConvertToVault = (folderId: string) => {
    setFolders((prev) =>
      prev.map((folder) =>
        folder.id === folderId ? { ...folder, isVault: true } : folder
      )
    );
    setActiveVaultId(null);
    setShowVaultList(true);
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
      {/* Header — hidden when activeVault is open (ActiveVaultPanel has its own) */}
      {!activeVault && (
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            {showVaultList && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowVaultList(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-3xl font-bold tracking-tight">
              {showVaultList ? "Vaults" : "idea.dump"}
            </h1>
          </div>
          <p className="text-muted-foreground text-sm tracking-widest uppercase mt-1">
            {showVaultList ? "" : "Capture everything. Forget nothing."}
          </p>
        </div>
        {!showVaultList && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Create Folder
            </Button>
            {vaults.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="relative border-yellow-400/60 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50/60 dark:text-yellow-400 dark:hover:bg-yellow-400/10"
                onClick={() => setShowVaultList(true)}
              >
                <Vault className="h-4 w-4 mr-2" />
                Vaults
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-400 text-[9px] font-bold text-yellow-900 px-1 shadow-sm">
                  {vaults.length}
                </span>
              </Button>
            )}
            <IdeaTagEditor />
          </div>
        )}
      </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search ideas by words or tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch("")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {activeVault && (
        <ActiveVaultPanel
          activeVault={activeVault}
          search={search}
          onBack={() => { setActiveVaultId(null); setShowVaultList(false); }}
        >
          <div
            className="space-y-6"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleDropIntoFolder(activeVault.id); }}
          >
            <AddThoughtCard onAdd={handleAdd} />
            {activeVault.ideaIds.filter(ideaMatchesSearch).length > 0 ? (
              <DraggableIdeaGrid
                ideaIds={activeVault.ideaIds.filter(ideaMatchesSearch)}
                onDelete={handleDelete}
                onEdit={(id) => setEditingIdeaId(id)}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onReorder={(from, to) => handleReorderInsideFolder(activeVault.id, from, to)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed">
                <p className="text-sm text-muted-foreground">
                  {search.trim() ? "No vault ideas match your search." : "This vault is empty."}
                </p>
              </div>
            )}
            <DropZone onDrop={() => handleDropIntoFolder(activeVault.id)} isDragging={!!draggingId} />
          </div>
        </ActiveVaultPanel>
      )}

      {showVaultList && !activeVault && (
        <VaultGrid
          vaults={vaults.filter(vaultMatchesSearch)}
          onOpenVault={(id) => {
            setActiveVaultId(id);
            setShowVaultList(false);
          }}
          onRenameVault={handleRenameFolder}
          onChangeVaultColor={handleChangeColor}
          onRequestDeleteVault={(id) => {
            const vault = folders.find((folder) => folder.id === id);
            if (vault) setFolderToDelete(vault);
          }}
        />
      )}

      {/* Unassigned ideas grid */}
      {!activeVault && !showVaultList && <div
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
      </div>}

      {/* Folders */}
      {!activeVault && !showVaultList && normalFolders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs tracking-widest text-muted-foreground uppercase font-medium">
            Folders
          </h2>
          <div className="space-y-3">
            {normalFolders.map((folder) => (
              <FolderSection
                key={folder.id}
                folder={{ ...folder, ideaIds: folder.ideaIds.filter(ideaMatchesSearch) }}
                onDeleteFolder={handleDeleteFolderOnly}
                onRequestDeleteFolder={(id) => {
                  const f = folders.find((f) => f.id === id);
                  if (f) setFolderToDelete(f);
                }}
                onConvertToVault={handleConvertToVault}
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
      {!activeVault && !showVaultList && (ideas?.length ?? 0) === 0 && (
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

      {/* Folder delete confirmation dialog */}
      {folderToDelete && (
        <FolderDeleteDialog
          folderName={folderToDelete.name}
          isVault={!!folderToDelete.isVault}
          onClose={() => setFolderToDelete(null)}
          onDeleteFolderOnly={() => handleDeleteFolderOnly(folderToDelete.id)}
          onDeleteWithIdeas={() => handleDeleteFolderWithIdeas(folderToDelete)}
        />
      )}
    </div>
  );
}
