import { useState } from "react";
import { useEcsQuery } from "@/ecs/hooks";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES } from "@/ecs/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TagEditor } from "@/components/tag-editor";
import { bucketTagsApi } from "@/lib/bucket-tags-api";
import type { TagDef } from "@/types/tags";
import { Check, CheckSquare, Plus, Tags, Trash2, X } from "lucide-react";
import { cn, getContrastColor } from "@/lib/utils";

export function BucketList() {
  const { data: goals, refetch } = useEcsQuery(() => ecsApi.getEntitiesByType(ENTITY_TYPES.GOAL));
  const { data: allTags = [], refetch: refetchTags } = useEcsQuery(() => bucketTagsApi.getTags());
  const [newTitle, setNewTitle] = useState("");

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const goal = await ecsApi.createEntity(ENTITY_TYPES.GOAL);
    await ecsApi.setComponent(goal.id, 'title', { title: newTitle });
    await ecsApi.setComponent(goal.id, 'status', { status: 'todo' });
    setNewTitle("");
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bucket List</h1>
          <p className="text-muted-foreground">Long-term goals and dreams.</p>
        </div>
        <TagEditor
          api={bucketTagsApi}
          buttonLabel="Bucket Tags"
          dialogTitle="Bucket Tag Manager"
          newTagPlaceholder="Travel, Skills, Dreams..."
          onChange={refetchTags}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Input 
              placeholder="What's a life goal you have?" 
              value={newTitle} 
              onChange={(e) => setNewTitle(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            />
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {goals?.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed">
            <CheckSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium">Empty bucket</h3>
            <p className="text-sm text-muted-foreground mt-1">Dream big. Add a goal.</p>
          </div>
        )}
        
        {goals?.map((goal) => (
          <GoalItem key={goal.id} goalId={goal.id} allTags={allTags} refetchList={refetch} refetchTags={refetchTags} />
        ))}
      </div>
    </div>
  );
}

function GoalItem({
  goalId,
  allTags,
  refetchList,
  refetchTags,
}: {
  goalId: string;
  allTags: TagDef[];
  refetchList: () => void;
  refetchTags: () => void;
}) {
  const { data: titleComp } = useEcsQuery(() => ecsApi.getComponent(goalId, 'title'));
  const { data: statusComp, refetch: refetchStatus } = useEcsQuery(() => ecsApi.getComponent(goalId, 'status'));
  const { data: tagComp, refetch: refetchGoalTags } = useEcsQuery(() => ecsApi.getComponent(goalId, 'tag'));
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  const isDone = statusComp?.data?.status === 'done';
  const selectedTagIds: string[] = tagComp?.data?.tags || [];
  const selectedTags = selectedTagIds
    .map((id) => allTags.find((tag) => tag.id === id))
    .filter((tag): tag is TagDef => !!tag);

  const toggleStatus = async () => {
    const newStatus = isDone ? 'todo' : 'done';
    await ecsApi.setComponent(goalId, 'status', { status: newStatus });
    refetchStatus();
  };

  const handleDelete = async () => {
    await ecsApi.deleteEntity(goalId);
    refetchList();
  };

  const toggleTag = async (tagId: string) => {
    const tags = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    await ecsApi.setComponent(goalId, 'tag', { tags });
    setActiveTagId(null);
    refetchGoalTags();
  };

  return (
    <Card className={cn("group transition-all", isDone && "bg-success/5 border-success/20")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
        <Checkbox 
          checked={isDone} 
          onCheckedChange={toggleStatus} 
          className={cn(isDone && "data-[state=checked]:bg-success data-[state=checked]:border-success")}
        />
        <div className="flex-1">
          <span className={cn("text-lg font-medium", isDone && "line-through text-muted-foreground")}>
            {titleComp?.data?.title || 'Untitled'}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { refetchTags(); setTagDialogOpen(true); }}>
          <Tags className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 opacity-100 text-destructive sm:opacity-0 sm:group-hover:opacity-100"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        </div>
        {selectedTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 pl-9">
            {selectedTags.map((tag) => (
              <Badge
                key={tag.id}
                role="button"
                tabIndex={0}
                className={cn(
                  "group/tag cursor-pointer gap-1 overflow-hidden rounded-full text-[10px] font-bold transition-all",
                  activeTagId === tag.id && "pr-1"
                )}
                style={{ backgroundColor: tag.color, color: getContrastColor(tag.color) }}
                onClick={() => setActiveTagId((current) => current === tag.id ? null : tag.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveTagId((current) => current === tag.id ? null : tag.id);
                  }
                }}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleTag(tag.id);
                  }}
                  className={cn(
                    "grid h-4 w-4 max-w-0 place-items-center overflow-hidden rounded-full bg-black/20 opacity-0 transition-all group-hover/tag:max-w-4 group-hover/tag:opacity-100 group-focus-within/tag:max-w-4 group-focus-within/tag:opacity-100",
                    activeTagId === tag.id && "max-w-4 opacity-100"
                  )}
                  aria-label={`Remove ${tag.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bucket tags</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[360px] pr-3">
            <div className="space-y-2">
              {allTags.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No tags yet.</p>}
              {allTags.map((tag) => (
                <button
                  key={tag.id}
                  className={cn("flex w-full items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted", selectedTagIds.includes(tag.id) && "bg-muted")}
                  onClick={() => toggleTag(tag.id)}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 text-left">{tag.name}</span>
                  {selectedTagIds.includes(tag.id) && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setTagDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
