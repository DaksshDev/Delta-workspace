import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_SYNC_INTERVAL_MS, SYNC_STATE_EVENT, SyncSystem, type SyncStatus } from "@/ecs/sync";
import { toast } from "sonner";
import { RefreshCw, Cloud, Wifi, WifiOff, CheckCircle2, AlertCircle, Clock3, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Hook to check if local data and Firebase data are synchronized
function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    queueCount: 0,
    isOnline: SyncSystem.isOnline,
    isProcessing: false,
    intervalMs: SyncSystem.getSyncIntervalMs(),
    lastSyncAt: null,
    nextSyncAt: null,
    lastVerifiedAt: null,
    lastVerificationError: null,
    verificationMismatches: [],
  });

  useEffect(() => {
    const updateStatus = async () => {
      try {
        setStatus(await SyncSystem.getStatus());
      } catch (e) {
        console.error(e);
      }
    };
    updateStatus();
    
    const handleOnline = () => updateStatus();
    const handleOffline = () => updateStatus();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(SYNC_STATE_EVENT, updateStatus);

    const interval = setInterval(updateStatus, 1500);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(SYNC_STATE_EVENT, updateStatus);
    };
  }, []);

  return {
    ...status,
    isDirty: status.queueCount > 0,
    isVerified: status.queueCount === 0 && status.lastVerifiedAt !== null && status.verificationMismatches.length === 0 && !status.lastVerificationError,
  };
}

export function SyncPage() {
  const {
    isDirty,
    isVerified,
    queueCount,
    isOnline,
    isProcessing,
    intervalMs,
    nextSyncAt,
    lastVerifiedAt,
    lastVerificationError,
    verificationMismatches,
  } = useSyncStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(() => String(SyncSystem.getSyncIntervalMs() / 60_000));

  useEffect(() => {
    setIntervalMinutes(String(intervalMs / 60_000));
  }, [intervalMs]);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await SyncSystem.processQueue();
      const queue = await SyncSystem.getQueueCount();
      const verification = queue === 0 ? await SyncSystem.verifySync() : null;
      if (queue === 0 && verification?.ok) {
        toast.success("Local data matches Firebase");
      } else {
        toast.warning("Some items are still waiting to sync");
      }
    } catch (error) {
      toast.error("Sync failed. Check connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleIntervalSave = () => {
    const minutes = Number(intervalMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      toast.error("Enter a valid sync interval.");
      return;
    }
    const interval = Math.max(minutes * 60_000, MIN_SYNC_INTERVAL_MS);
    SyncSystem.setSyncIntervalMs(interval);
    toast.success(`Background sync interval set to ${formatDuration(interval)}`);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cloud Sync</h1>
          <p className="text-muted-foreground">Manage background Firebase synchronization.</p>
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
              ? "Local changes are saved and waiting for the next background sync."
              : isVerified
                ? "IndexedDB and Firebase were verified after the last sync."
                : "No local writes are pending, but verification needs attention."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={cn(
            "flex flex-col sm:flex-row items-center justify-between p-6 rounded-xl border",
            isDirty || !isVerified ? "bg-amber-500/10 border-amber-500/20" : "bg-green-500/10 border-green-500/20"
          )}>
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
              <div className={cn(
                "p-3 rounded-full",
                isDirty || !isVerified ? "bg-amber-500/20 text-amber-500" : "bg-green-500/20 text-green-500"
              )}>
                {isDirty || !isVerified ? <AlertCircle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
              </div>
              <div>
                <p className={cn(
                  "font-semibold text-lg",
                  isDirty || !isVerified ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                )}>
                  {isDirty ? "Waiting for Background Sync" : isVerified ? "Verified Synced" : "Verification Needed"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isDirty 
                    ? `${queueCount} operation${queueCount > 1 ? 's' : ''} queued.`
                    : lastVerifiedAt
                      ? `Last verified ${formatTime(lastVerifiedAt)}.`
                      : "No verification has completed yet."}
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
              <span>{isProcessing ? "Syncing" : isDirty ? "Queued" : isVerified ? "Verified" : "Check needed"}</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-500",
                  isDirty || !isVerified ? "bg-amber-500 w-1/2" : "bg-green-500 w-full"
                )} 
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock3 className="h-4 w-4 text-primary" />
                Background interval
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {nextSyncAt ? `Next run ${formatTime(nextSyncAt)}.` : "Timer starts after sign-in."}
              </p>
              <div className="mt-3 flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="sync-interval">Minutes</Label>
                  <Input
                    id="sync-interval"
                    type="number"
                    min={MIN_SYNC_INTERVAL_MS / 60_000}
                    step="0.25"
                    value={intervalMinutes}
                    onChange={(event) => setIntervalMinutes(event.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={handleIntervalSave}>Save</Button>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Verification
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {lastVerificationError || (verificationMismatches.length > 0
                  ? verificationMismatches.slice(0, 2).join("; ")
                  : lastVerifiedAt
                    ? "Local records match Firebase."
                    : "Waiting for the first check.")}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button 
            onClick={handleSyncNow} 
            disabled={isSyncing || !isOnline} 
            className="w-full gap-2 shadow-sm"
          >
            <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing..." : isDirty ? "Sync Now" : "Verify Now"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function formatDuration(ms: number) {
  const minutes = ms / 60_000;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(2)} minute${minutes === 1 ? "" : "s"}`;
}
