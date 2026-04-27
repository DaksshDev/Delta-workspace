import { useState } from "react";
import { useEcsQuery } from "@/ecs/hooks";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES } from "@/ecs/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ListTodo, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Todos() {
  const { data: todos, refetch } = useEcsQuery(() => ecsApi.getEntitiesByType(ENTITY_TYPES.TODO));
  const [newTitle, setNewTitle] = useState("");

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const todo = await ecsApi.createEntity(ENTITY_TYPES.TODO);
    await ecsApi.setComponent(todo.id, 'title', { title: newTitle });
    await ecsApi.setComponent(todo.id, 'status', { status: 'todo' });
    setNewTitle("");
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Todos</h1>
          <p className="text-muted-foreground">Manage your tasks and priorities.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Input 
              placeholder="What needs to be done?" 
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

      <div className="space-y-2">
        {todos?.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed">
            <ListTodo className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium">No tasks</h3>
            <p className="text-sm text-muted-foreground mt-1">You're all caught up!</p>
          </div>
        )}
        
        {todos?.map((todo) => (
          <TodoItem key={todo.id} todoId={todo.id} refetchList={refetch} />
        ))}
      </div>
    </div>
  );
}

function TodoItem({ todoId, refetchList }: { todoId: string, refetchList: () => void }) {
  const { data: titleComp } = useEcsQuery(() => ecsApi.getComponent(todoId, 'title'));
  const { data: statusComp, refetch: refetchStatus } = useEcsQuery(() => ecsApi.getComponent(todoId, 'status'));

  const isDone = statusComp?.data?.status === 'done';

  const toggleStatus = async () => {
    const newStatus = isDone ? 'todo' : 'done';
    await ecsApi.setComponent(todoId, 'status', { status: newStatus });
    refetchStatus();
  };

  const handleDelete = async () => {
    await ecsApi.deleteEntity(todoId);
    refetchList();
  };

  return (
    <Card className="group transition-all hover:bg-muted/50">
      <CardContent className="p-4 flex items-center gap-3">
        <Checkbox checked={isDone} onCheckedChange={toggleStatus} />
        <span className={cn("flex-1 text-sm font-medium", isDone && "line-through text-muted-foreground")}>
          {titleComp?.data?.title || 'Untitled'}
        </span>
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
