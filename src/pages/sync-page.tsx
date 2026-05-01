import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncSystem } from "@/ecs/sync";
import { toast } from "sonner";
import { RefreshCw, Cloud, Database, Wifi, WifiOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Hook to check if local data and Firebase data are synchronized
function useSyncStatus() {
  const [queueCount, setQueueCount] = useState(0);
  const [isOnline, setIsOnline] = useState(SyncSystem.isOnline);

  useEffect(() => {
    const updateCount = async () => {
      try {
        const count = await SyncSystem.getQueueCount();
        setQueueCount(count);
        setIsOnline(SyncSystem.isOnline);
      } catch (e) {
        console.error(e);
      }
    };
    updateCount();
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(updateCount, 1500);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isDirty: queueCount > 0,
    queueCount,
    isOnline
  };
}

export function SyncPage() {
  const { isDirty, queueCount, isOnline } = useSyncStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await SyncSystem.processQueue();
      if (await SyncSystem.getQueueCount() === 0) {
        toast.success("All data is now synchronized");
      } else {
        toast.warning("Some items are still waiting to sync");
      }
    } catch (error) {
      toast.error("Sync failed. Check connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cloud Sync</h1>
          <p className="text-muted-foreground">Manage real-time Firebase synchronization.</p>
        </div>
        <Badge variant={isOnline ? "default" : "destructive"} className="gap-1.5 px-3 py-1 text-sm">
          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {isOnline ? "Connected" : "Offline"}
        </Badge>
      </div>

      <Card className="border-primary/20 shadow-lg bg-gradient-to-br from-background to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            Synchronization Status
          </CardTitle>
          <CardDescription>
            {isDirty 
              ? "Your local data is dirty. There are unsaved changes waiting to be synced to Firebase."
              : "Your local data is perfectly synchronized with Firebase."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={cn(
            "flex flex-col sm:flex-row items-center justify-between p-6 rounded-xl border",
            isDirty ? "bg-amber-500/10 border-amber-500/20" : "bg-green-500/10 border-green-500/20"
          )}>
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
              <div className={cn(
                "p-3 rounded-full",
                isDirty ? "bg-amber-500/20 text-amber-500" : "bg-green-500/20 text-green-500"
              )}>
                {isDirty ? <AlertCircle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
              </div>
              <div>
                <p className={cn(
                  "font-semibold text-lg",
                  isDirty ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                )}>
                  {isDirty ? "Unsynced Changes" : "Fully Synced"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isDirty 
                    ? `${queueCount} operation${queueCount > 1 ? 's' : ''} waiting to push to the cloud.`
                    : "No pending operations."}
                </p>
              </div>
            </div>
            
            <div className="text-3xl font-mono font-bold px-4 py-2 bg-background rounded-lg shadow-sm border border-border/50">
              {queueCount}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium px-1">
              <span>Sync Progress</span>
              <span>{isDirty ? "Pending" : "Synchronized"}</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-500",
                  isDirty ? "bg-amber-500 w-1/2" : "bg-green-500 w-full"
                )} 
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button 
            onClick={handleSyncNow} 
            disabled={isSyncing || !isOnline || !isDirty} 
            className="w-full gap-2 shadow-sm"
          >
            <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing..." : isDirty ? "Sync Now" : "Everything is Up to Date"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
