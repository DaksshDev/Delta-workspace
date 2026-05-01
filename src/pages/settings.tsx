import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";
import { getDB } from "@/ecs/store";
import { toast } from "sonner";
import { Monitor, Moon, Sun, Trash2, Database, UserIcon, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  
  const [stats, setStats] = useState<{ entities: number, components: number, storage: string }>({
    entities: 0,
    components: 0,
    storage: "Calculating..."
  });
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

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
      setShowResetModal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dev Settings</h1>
        <p className="text-muted-foreground">Manage your workspace configuration and data.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your display name and manage your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {user?.photoURL && (
                <img src={user.photoURL} alt="Profile" className="w-16 h-16 rounded-full border border-border" />
              )}
              <div>
                <p className="font-medium text-lg">{user?.displayName}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-4 border-t px-6 py-4">
            <Button variant="outline" onClick={logout} className="gap-2 text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </CardFooter>
        </Card>

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

        <Card className="border-destructive/50 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Permanently delete all your local data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setShowResetModal(true)} disabled={isResetting} className="w-full md:w-auto">
              <Trash2 className="mr-2 h-4 w-4" />
              {isResetting ? "Resetting..." : "Reset Workspace"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Reset Workspace</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your entire local workspace, including all ideas, todos, and study materials.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm font-medium mb-2">Please type <span className="font-bold">delete</span> to confirm.</p>
            <Input 
              value={resetConfirmText} 
              onChange={(e) => setResetConfirmText(e.target.value)} 
              placeholder="Type 'delete' here..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetModal(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleReset} 
              disabled={resetConfirmText.toLowerCase() !== "delete" || isResetting}
            >
              {isResetting ? "Deleting..." : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
