import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupSystem } from "@/ecs/systems";
import { toast } from "sonner";
import { Download } from "lucide-react";

export function Export() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await BackupSystem.exportAll();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `delta-board-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Export downloaded successfully");
    } catch (error) {
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export Data</h1>
        <p className="text-muted-foreground">Download your workspace data as JSON.</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Full Export</CardTitle>
          <CardDescription>
            Download all entities, components, and settings in a single JSON file.
            This file can be used to restore your workspace later.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={handleExport} disabled={isExporting} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Download JSON"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
