import { useState, useEffect } from "react";
import { TagDef, SubtagDef } from "@/types/tags";
import { ideaTagsApi } from "@/lib/idea-tags-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Settings2, Check, X, AlertTriangle } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { v4 as uuidv4 } from "uuid";
import { getContrastColor } from "@/lib/utils";
import { BadgeCheck } from "lucide-react";
import { ecsApi } from "@/ecs/api";
import { useEcsQuery } from "@/ecs/hooks";

// ─── Tag Delete Confirmation Modal ────────────────────────────────────────────

function TagDeleteConfirm({
  tagName,
  tagColor,
  onClose,
  onConfirm,
}: {
  tagName: string;
  tagColor: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <Card className="w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <h2 className="text-lg font-semibold">Delete tag?</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Permanently delete the tag{" "}
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ backgroundColor: tagColor, color: getContrastColor(tagColor) }}
            >
              {tagName}
            </span>
            ? It will be removed from all ideas.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" onClick={onConfirm}>Delete tag</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── IdeaTagEditor ─────────────────────────────────────────────────────────────

export function IdeaTagEditor() {
  const [tags, setTags] = useState<TagDef[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#8b5cf6");
  const [tagToDelete, setTagToDelete] = useState<TagDef | null>(null);

  const loadTags = async () => {
    const allTags = await ideaTagsApi.getTags();
    setTags(allTags);
  };

  useEffect(() => {
    loadTags();
  }, []);

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    const newTag: TagDef = {
      id: uuidv4(),
      name: newTagName,
      color: newTagColor,
      subtags: [],
    };
    await ideaTagsApi.saveTag(newTag);
    setNewTagName("");
    loadTags();
  };

  const handleDeleteTag = async (id: string) => {
    await ideaTagsApi.deleteTag(id);
    setTagToDelete(null);
    loadTags();
  };

  const handleUpdateTag = async (tag: TagDef) => {
    await ideaTagsApi.saveTag(tag);
    loadTags();
  };


  const toggleVerified = async (tag: TagDef) => {
    const updated = { ...tag, verified: !tag.verified };

    await ideaTagsApi.saveTag(updated);
    loadTags();

    window.dispatchEvent(new Event("tags-updated")); // 🔥 THIS
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Idea Tags
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Idea Tag Manager</DialogTitle>
        </DialogHeader>

        <div className="flex items-end gap-2 py-4 border-b">
          <div className="grid gap-2 flex-1">
            <Label htmlFor="ideaTagName">New Tag Name</Label>
            <Input
              id="ideaTagName"
              placeholder="Concept, Project, Priority..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddTag(); }}
            />
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-10 p-0 shadow-sm"
                    style={{ backgroundColor: newTagColor }}
                  />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3">
                  <HexColorPicker color={newTagColor} onChange={setNewTagColor} />
                  <Input
                    className="mt-2"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <Button onClick={handleAddTag}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto mt-4 pr-2 min-h-0">
          <div className="space-y-4">
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No idea tags yet. Create one above.
              </p>
            )}
            {tags.map((tag) => (
              <IdeaTagItem
                key={tag.id}
                tag={tag}
                onDelete={() => setTagToDelete(tag)}
                onUpdate={handleUpdateTag}
                onToggleVerified={toggleVerified}
              />
            ))}
          </div>
        </div>

        {/* Tag delete confirmation — rendered inside the Dialog so z-index stacks correctly */}
        {tagToDelete && (
          <TagDeleteConfirm
            tagName={tagToDelete.name}
            tagColor={tagToDelete.color}
            onClose={() => setTagToDelete(null)}
            onConfirm={() => handleDeleteTag(tagToDelete.id)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function IdeaTagItem({
  tag,
  onDelete,
  onUpdate,
  onToggleVerified
}: {
  tag: TagDef;
  onDelete: () => void;
  onUpdate: (tag: TagDef) => void;
  onToggleVerified: (tag: TagDef) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);

  const isVerified = !!tag.verified;

  const handleSave = () => {
    onUpdate({ ...tag, name, color });
    setIsEditing(false);
  };

  return (
    <div className="space-y-2 border rounded-md p-3">
      <div className="flex items-center gap-2">

        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8"
              autoFocus
            />

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  style={{ backgroundColor: color }}
                />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3">
                <HexColorPicker color={color} onChange={setColor} />
              </PopoverContent>
            </Popover>

            <Button size="icon" variant="ghost" onClick={handleSave}>
              <Check className="h-4 w-4" />
            </Button>

            <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">

            {/* 🔥 VERIFIED VISUAL */}
            <Badge
              onClick={() => onToggleVerified(tag)}
              className={`
                rounded-full font-bold text-xs px-2.5 py-1 flex items-center gap-1 cursor-pointer transition-all
                ${isVerified
                  ? "ring-2 ring-white/80 shadow-[0_0_10px_rgba(255,255,255,0.9)] scale-[1.03]"
                  : "shadow-sm hover:shadow-md"}
              `}
              style={{
                backgroundColor: tag.color,
                color: getContrastColor(tag.color),
              }}
            >
              {tag.name}

              {isVerified && (
                <BadgeCheck
                  className="h-3.5 w-3.5 shrink-0"
                  style={{
                    color: "white",
                    filter: "drop-shadow(0 0 4px rgba(255,255,255,0.9))",
                  }}
                />
              )}
            </Badge>

            <div className="flex-1" />

            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
              <Settings2 className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}