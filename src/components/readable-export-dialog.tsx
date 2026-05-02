import { useMemo } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function ReadableExportDialog({
  open,
  title,
  filename,
  data,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  filename: string;
  data: unknown;
  onOpenChange: (open: boolean) => void;
}) {
  const json = useMemo(() => JSON.stringify(data, null, 2), [data]);

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    toast.success("Export JSON copied");
  };

  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Textarea className="h-[420px] font-mono text-xs" value={json} readOnly />
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={copy}>
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          <Button onClick={download}>
            <Download className="h-4 w-4" />
            Download JSON
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
