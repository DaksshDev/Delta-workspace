import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BackupSystem } from "@/ecs/systems";
import { toast } from "sonner";
import { Save, Upload, CloudOff } from "lucide-react";

export function Backups() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const data = await BackupSystem.exportAll();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `delta-board-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded successfully");
    } catch (error) {
      toast.error("Failed to create backup");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonStr = event.target?.result as string;
        await BackupSystem.importAll(jsonStr);
        toast.success("Backup restored successfully. Reloading...");
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        toast.error("Failed to restore backup. Invalid file format.");
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Backups</h1>
        <p className="text-muted-foreground">Manage your local data snapshots.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create Backup</CardTitle>
            <CardDescription>
              Download a complete snapshot of your workspace.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleBackup} disabled={isBackingUp} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {isBackingUp ? "Creating..." : "Download Backup"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Restore Backup</CardTitle>
            <CardDescription>
              Upload a previous backup file to restore your workspace. Warning: This will overwrite current data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input 
              type="file" 
              accept=".json" 
              onChange={handleRestore} 
              disabled={isRestoring} 
              className="cursor-pointer"
            />
          </CardContent>
        </Card>

        <Card className="col-span-full border-dashed bg-muted/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudOff className="h-5 w-5 text-muted-foreground" />
              Cloud Sync
            </CardTitle>
            <CardDescription>
              Sync your workspace across devices using cloud storage.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="outline" onClick={() => toast("Cloud sync coming soon — local backups work now")} className="flex-1">
              Connect Google Drive
            </Button>
            <Button variant="outline" onClick={() => toast("Cloud sync coming soon — local backups work now")} className="flex-1">
              Connect OneDrive
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
