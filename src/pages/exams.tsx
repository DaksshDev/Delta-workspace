import { useState } from "react";
import { useEcsQuery } from "@/ecs/hooks";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES } from "@/ecs/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, Plus, Trash2 } from "lucide-react";

export function Exams() {
  const { data: exams, refetch } = useEcsQuery(() => ecsApi.getEntitiesByType(ENTITY_TYPES.EXAM_SET));
  const [newTitle, setNewTitle] = useState("");

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const exam = await ecsApi.createEntity(ENTITY_TYPES.EXAM_SET);
    await ecsApi.setComponent(exam.id, 'title', { title: newTitle });
    await ecsApi.setComponent(exam.id, 'metadata', { year: new Date().getFullYear(), url: '' });
    setNewTitle("");
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exam Directory</h1>
          <p className="text-muted-foreground">Keep track of past board papers.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Input 
              placeholder="Exam Subject & Year..." 
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exams?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed">
            <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium">No exams stored</h3>
            <p className="text-sm text-muted-foreground mt-1">Add your first past paper.</p>
          </div>
        )}
        
        {exams?.map((exam) => (
          <ExamCard key={exam.id} examId={exam.id} refetchList={refetch} />
        ))}
      </div>
    </div>
  );
}

function ExamCard({ examId, refetchList }: { examId: string, refetchList: () => void }) {
  const { data: titleComp } = useEcsQuery(() => ecsApi.getComponent(examId, 'title'));
  const { data: metaComp } = useEcsQuery(() => ecsApi.getComponent(examId, 'metadata'));

  const handleDelete = async () => {
    await ecsApi.deleteEntity(examId);
    refetchList();
  };

  return (
    <Card className="group relative overflow-hidden transition-all hover:border-primary/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{titleComp?.data?.title || 'Untitled Exam'}</CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          Year: {metaComp?.data?.year || 'N/A'}
        </div>
      </CardContent>
    </Card>
  );
}
