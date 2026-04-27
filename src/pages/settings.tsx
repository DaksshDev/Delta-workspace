import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";
import { getDB } from "@/ecs/store";
import { toast } from "sonner";
import { Monitor, Moon, Sun, Trash2, Database } from "lucide-react";

export function Settings() {
  const { theme, setTheme } = useTheme();
  const [stats, setStats] = useState<{ entities: number, components: number, storage: string }>({
    entities: 0,
    components: 0,
    storage: "Calculating..."
  });
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      const db = await getDB();
      const entities = await db.count("entities");
      const components = await db.count("components");
      let storage = "N/A";
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage) {
          storage = (estimate.usage / 1024 / 1024).toFixed(2) + " MB";
        }
      }
      setStats({ entities, components, storage });
    };
    fetchStats();
  }, []);

  const handleReset = async () => {
    if (!confirm("Are you sure you want to completely wipe your workspace? This cannot be undone.")) return;
    
    setIsResetting(true);
    try {
      const db = await getDB();
      const tx = db.transaction(["entities", "components", "folders", "tags", "settings", "bugs", "syncQueue"], "readwrite");
      await tx.objectStore("entities").clear();
      await tx.objectStore("components").clear();
      await tx.objectStore("folders").clear();
      await tx.objectStore("tags").clear();
      await tx.objectStore("settings").clear();
      await tx.objectStore("bugs").clear();
      await tx.objectStore("syncQueue").clear();
      await tx.done;
      
      toast.success("Workspace reset successfully. Reloading...");
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast.error("Failed to reset workspace");
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dev Settings</h1>
        <p className="text-muted-foreground">Manage your workspace configuration and data.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize the look and feel of Delta Board.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button 
              variant={theme === "light" ? "default" : "outline"} 
              className="flex-1" 
              onClick={() => setTheme("light")}
            >
              <Sun className="mr-2 h-4 w-4" /> Light
            </Button>
            <Button 
              variant={theme === "dark" ? "default" : "outline"} 
              className="flex-1" 
              onClick={() => setTheme("dark")}
            >
              <Moon className="mr-2 h-4 w-4" /> Dark
            </Button>
            <Button 
              variant={theme === "system" ? "default" : "outline"} 
              className="flex-1" 
              onClick={() => setTheme("system")}
            >
              <Monitor className="mr-2 h-4 w-4" /> System
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Stats</CardTitle>
            <CardDescription>Current IndexedDB storage metrics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground flex items-center gap-2"><Database className="h-4 w-4" /> Entities</span>
              <span className="font-mono font-medium">{stats.entities}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground flex items-center gap-2"><Database className="h-4 w-4" /> Components</span>
              <span className="font-mono font-medium">{stats.components}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground flex items-center gap-2"><Database className="h-4 w-4" /> Estimated Size</span>
              <span className="font-mono font-medium">{stats.storage}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Permanently delete all your local data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleReset} disabled={isResetting} className="w-full">
              <Trash2 className="mr-2 h-4 w-4" />
              {isResetting ? "Resetting..." : "Reset Workspace"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
