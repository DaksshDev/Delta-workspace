import { useState } from "react";
import { useEcsQuery } from "@/ecs/hooks";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES } from "@/ecs/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function BucketList() {
  const { data: goals, refetch } = useEcsQuery(() => ecsApi.getEntitiesByType(ENTITY_TYPES.GOAL));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bucket List</h1>
          <p className="text-muted-foreground">Long-term goals and dreams.</p>
        </div>
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
          <GoalItem key={goal.id} goalId={goal.id} refetchList={refetch} />
        ))}
      </div>
    </div>
  );
}

function GoalItem({ goalId, refetchList }: { goalId: string, refetchList: () => void }) {
  const { data: titleComp } = useEcsQuery(() => ecsApi.getComponent(goalId, 'title'));
  const { data: statusComp, refetch: refetchStatus } = useEcsQuery(() => ecsApi.getComponent(goalId, 'status'));

  const isDone = statusComp?.data?.status === 'done';

  const toggleStatus = async () => {
    const newStatus = isDone ? 'todo' : 'done';
    await ecsApi.setComponent(goalId, 'status', { status: newStatus });
    refetchStatus();
  };

  const handleDelete = async () => {
    await ecsApi.deleteEntity(goalId);
    refetchList();
  };

  return (
    <Card className={cn("group transition-all", isDone && "bg-success/5 border-success/20")}>
      <CardContent className="p-4 flex items-center gap-4">
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
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
