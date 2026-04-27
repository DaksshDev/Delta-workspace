import { useState, useRef, useEffect } from "react";
import { useEcsQuery } from "@/ecs/hooks";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES } from "@/ecs/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenTool, Plus, Trash2 } from "lucide-react";

export function NamesAndWhiteboard() {
  const { data: names, refetch: refetchNames } = useEcsQuery(() => ecsApi.getEntitiesByType(ENTITY_TYPES.NAME_IDEA));
  const [newName, setNewName] = useState("");

  const handleAddName = async () => {
    if (!newName.trim()) return;
    const entity = await ecsApi.createEntity(ENTITY_TYPES.NAME_IDEA);
    await ecsApi.setComponent(entity.id, 'title', { title: newName });
    setNewName("");
    refetchNames();
  };

  const handleDeleteName = async (id: string) => {
    await ecsApi.deleteEntity(id);
    refetchNames();
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Names & Whiteboard</h1>
          <p className="text-muted-foreground">Brainstorming space.</p>
        </div>
      </div>

      <Tabs defaultValue="whiteboard" className="w-full flex-1 flex flex-col">
        <TabsList>
          <TabsTrigger value="whiteboard">Whiteboard</TabsTrigger>
          <TabsTrigger value="names">Name Dump</TabsTrigger>
        </TabsList>
        <TabsContent value="whiteboard" className="flex-1 mt-4">
          <Card className="h-full min-h-[500px] flex items-center justify-center bg-muted/20">
            <WhiteboardCanvas />
          </Card>
        </TabsContent>
        <TabsContent value="names" className="mt-4">
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="New name idea..." 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddName(); }}
                />
                <Button onClick={handleAddName}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {names?.map(name => (
              <NameCard key={name.id} nameId={name.id} onDelete={() => handleDeleteName(name.id)} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NameCard({ nameId, onDelete }: { nameId: string, onDelete: () => void }) {
  const { data: titleComp } = useEcsQuery(() => ecsApi.getComponent(nameId, 'title'));
  return (
    <Card className="group flex items-center justify-between p-4">
      <span className="font-medium">{titleComp?.data?.title}</span>
      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </Card>
  );
}

function WhiteboardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set proper size
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'hsl(var(--foreground))';
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);
  };

  return (
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        className="w-full h-full cursor-crosshair touch-none"
      />
      <div className="absolute bottom-4 right-4 flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => {
          const canvas = canvasRef.current;
          if (canvas) {
             const ctx = canvas.getContext('2d');
             if (ctx) ctx.clearRect(0,0, canvas.width, canvas.height);
          }
        }}>Clear</Button>
      </div>
    </div>
  );
}
