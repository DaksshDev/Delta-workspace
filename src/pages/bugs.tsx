import { useState } from "react";
import { useEcsQuery } from "@/ecs/hooks";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES } from "@/ecs/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bug as BugIcon, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function Bugs() {
  const { data: bugs, refetch } = useEcsQuery(() => ecsApi.getEntitiesByType(ENTITY_TYPES.BUG));
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const bug = await ecsApi.createEntity(ENTITY_TYPES.BUG);
    await ecsApi.setComponent(bug.id, 'title', { title: newTitle });
    await ecsApi.setComponent(bug.id, 'content', { content: newDesc });
    await ecsApi.setComponent(bug.id, 'status', { status: 'open' });
    setNewTitle("");
    setNewDesc("");
    refetch();
  };

  const handleDelete = async (id: string) => {
    await ecsApi.deleteEntity(id);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bug Tracker</h1>
          <p className="text-muted-foreground">Keep track of issues and improvements.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Input 
            placeholder="Bug title..." 
            value={newTitle} 
            onChange={(e) => setNewTitle(e.target.value)} 
          />
          <Textarea 
            placeholder="Description..." 
            value={newDesc} 
            onChange={(e) => setNewDesc(e.target.value)}
            className="min-h-[100px]"
          />
          <Button onClick={handleAdd} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Report Bug
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bugs?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed">
            <BugIcon className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium">No bugs found</h3>
            <p className="text-sm text-muted-foreground mt-1">Your code is perfect (for now).</p>
          </div>
        )}
        
        {bugs?.map((bug) => (
          <BugCard key={bug.id} bugId={bug.id} onDelete={() => handleDelete(bug.id)} />
        ))}
      </div>
    </div>
  );
}

function BugCard({ bugId, onDelete }: { bugId: string, onDelete: () => void }) {
  const { data: titleComp } = useEcsQuery(() => ecsApi.getComponent(bugId, 'title'));
  const { data: contentComp } = useEcsQuery(() => ecsApi.getComponent(bugId, 'content'));
  const { data: statusComp } = useEcsQuery(() => ecsApi.getComponent(bugId, 'status'));

  return (
    <Card className="group relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{titleComp?.data?.title || 'Untitled'}</CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm text-muted-foreground line-clamp-3">
          {contentComp?.data?.content || 'No description provided.'}
        </div>
        <div className="flex gap-2 pt-2">
          <Badge variant={statusComp?.data?.status === 'open' ? 'destructive' : 'secondary'}>
            {statusComp?.data?.status || 'unknown'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
