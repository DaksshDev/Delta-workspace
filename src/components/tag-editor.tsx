import { useState, useEffect } from "react";
import { TagDef } from "@/types/tags";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Settings2, Check, X, Settings, CheckCircle2 } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { v4 as uuidv4 } from 'uuid';
import { cn, getContrastColor } from "@/lib/utils";

type TagApi = {
  getTags: () => Promise<TagDef[]>;
  saveTag: (tag: TagDef) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
};

type TagEditorProps = {
  api: TagApi;
  buttonLabel?: string;
  dialogTitle?: string;
  newTagPlaceholder?: string;
  onChange?: () => void;
};

export function TagEditor({
  api,
  buttonLabel = "Tags",
  dialogTitle = "Tag Manager",
  newTagPlaceholder = "Work, Personal...",
  onChange,
}: TagEditorProps) {
  const [tags, setTags] = useState<TagDef[]>([]);
  const [editingTag, setEditingTag] = useState<TagDef | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");

  const loadTags = async () => {
    const allTags = await api.getTags();
    setTags(allTags);
  };

  useEffect(() => {
    loadTags();
  }, [api]);

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    const newTag: TagDef = {
      id: uuidv4(),
      name: newTagName,
      color: newTagColor,
    };
    await api.saveTag(newTag);
    setNewTagName("");
    await loadTags();
    onChange?.();
  };

  const handleDeleteTag = async (id: string) => {
    await api.deleteTag(id);
    await loadTags();
    onChange?.();
  };

  const handleUpdateTag = async (tag: TagDef) => {
    await api.saveTag(tag);
    await loadTags();
    if (editingTag?.id === tag.id) setEditingTag(tag);
    onChange?.();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex items-end gap-2 py-4 border-b">
          <div className="grid gap-2 flex-1">
            <Label htmlFor="tagName">New Tag Name</Label>
            <Input
              id="tagName"
              placeholder={newTagPlaceholder}
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
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

        <ScrollArea className="flex-1 mt-4 pr-4">
          <div className="space-y-4">
            {tags.map((tag) => (
              <TagItem
                key={tag.id}
                tag={tag}
                onDelete={() => handleDeleteTag(tag.id)}
                onUpdate={handleUpdateTag}
              />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function TagItem({ tag, onDelete, onUpdate }: {
  tag: TagDef,
  onDelete: () => void,
  onUpdate: (tag: TagDef) => void
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    setName(tag.name);
    setColor(tag.color);
  }, [tag.name, tag.color]);

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
                <Input
                  className="mt-2"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                />
              </PopoverContent>
            </Popover>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <Badge
              className={cn(
                "rounded-full font-bold text-[10px] px-3 py-1 shadow-sm transition-all",
                tag.isSpecial && "shadow-[0_0_10px_rgba(var(--tag-rgb),0.5)]"
              )}
              style={{
                backgroundColor: tag.color,
                color: getContrastColor(tag.color),
                // @ts-ignore
                "--tag-rgb": tag.color.startsWith('#') ? `${parseInt(tag.color.slice(1,3),16)}, ${parseInt(tag.color.slice(3,5),16)}, ${parseInt(tag.color.slice(5,7),16)}` : '59, 130, 246'
              }}
            >
              <div className="flex items-center gap-1">
                {tag.name}
                {tag.isSpecial && tag.showVerified && <CheckCircle2 className="h-3 w-3" />}
              </div>
            </Badge>
            <div className="flex-1" />
            
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Tag Settings: {tag.name}</DialogTitle>
                </DialogHeader>
                <div className="py-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Special Tag</Label>
                      <p className="text-xs text-muted-foreground">Make tag glow and override card borders</p>
                    </div>
                    <Switch 
                      checked={!!tag.isSpecial} 
                      onCheckedChange={(val) => onUpdate({ ...tag, isSpecial: val })} 
                    />
                  </div>
                  {tag.isSpecial && (
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Show Verified</Label>
                        <p className="text-xs text-muted-foreground">Show a verified symbol after the name</p>
                      </div>
                      <Switch 
                        checked={!!tag.showVerified} 
                        onCheckedChange={(val) => onUpdate({ ...tag, showVerified: val })} 
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={() => setIsSettingsOpen(false)}>Done</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(true)}>
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
