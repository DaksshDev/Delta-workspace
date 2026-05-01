import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function QuizEditor({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto flex flex-col">
      <div className="flex items-center gap-4 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Quiz Editor</h1>
      </div>
      <div className="p-6 flex-1 flex items-center justify-center text-muted-foreground">
        Quiz Editor for {fileId} (Coming Soon)
      </div>
    </div>
  );
}
