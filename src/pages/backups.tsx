import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BackupSystem } from "@/ecs/systems";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Cloud, Download, HardDrive, Save, Search, Upload } from "lucide-react";
import {
  downloadDriveBackup,
  getDriveBackupHistory,
  getGoogleDriveConfig,
  recordDriveBackupHistory,
  requestDriveToken,
  uploadDriveBackup,
  DRIVE_BACKUP_FILE,
  verifyDriveBackup,
  type DriveBackupHistoryEntry,
  type DriveFile,
} from "@/lib/google-drive";

type DriveProof = {
  status: "verified" | "mismatch" | "failed";
  checkedAt: string;
  file?: DriveFile;
  message: string;
};

const formatBytes = (size?: string) => {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateTime = (value?: string) => {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export function Backups() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isDriveBusy, setIsDriveBusy] = useState(false);
  const [driveProof, setDriveProof] = useState<DriveProof | null>(null);
  const [driveHistory, setDriveHistory] = useState<DriveBackupHistoryEntry[]>([]);
  const driveConfig = getGoogleDriveConfig();

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
        
        // Push newly restored data to cloud so Firebase is updated!
        const { SyncSystem } = await import('@/ecs/sync');
        await SyncSystem.pushAllToCloud();
        
        toast.success("Backup restored and synced successfully. Reloading...");
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        toast.error("Failed to restore backup. Invalid file format.");
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDriveBackup = async () => {
    setIsDriveBusy(true);
    try {
      const token = await requestDriveToken(driveConfig.clientId);
      const data = await BackupSystem.exportAll();
      await uploadDriveBackup(token, data);
      const proof = await verifyDriveBackup(token, data);
      if (!proof.matches) {
        setDriveProof({
          status: "mismatch",
          checkedAt: new Date().toISOString(),
          file: proof.file,
          message: "Drive has a backup file, but its contents do not match the export that was just uploaded.",
        });
        toast.error("Drive backup uploaded, but verification did not match");
        return;
      }

      const history = await recordDriveBackupHistory(token, proof.file, true);
      setDriveHistory(history);
      setDriveProof({
        status: "verified",
        checkedAt: new Date().toISOString(),
        file: proof.file,
        message: "Verified by downloading the hidden Drive backup and matching it to the local export.",
      });
      toast.success(`Verified ${DRIVE_BACKUP_FILE} in Google Drive app data`);
    } catch (error) {
      setDriveProof({
        status: "failed",
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Failed to save Google Drive backup",
      });
      toast.error(error instanceof Error ? error.message : "Failed to save Google Drive backup");
    } finally {
      setIsDriveBusy(false);
    }
  };

  const handleDriveVerify = async () => {
    setIsDriveBusy(true);
    try {
      const token = await requestDriveToken(driveConfig.clientId);
      const data = await BackupSystem.exportAll();
      const [proof, history] = await Promise.all([
        verifyDriveBackup(token, data),
        getDriveBackupHistory(token),
      ]);
      setDriveHistory(history);
      setDriveProof({
        status: proof.matches ? "verified" : "mismatch",
        checkedAt: new Date().toISOString(),
        file: proof.file,
        message: proof.matches
          ? "Drive backup exists and matches your current local data."
          : "Drive backup exists, but it does not match your current local data. That can happen if you changed data after backing up.",
      });
      toast[proof.matches ? "success" : "warning"](
        proof.matches ? "Drive backup matches current data" : "Drive backup exists, but differs from current data"
      );
    } catch (error) {
      setDriveProof({
        status: "failed",
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Failed to verify Google Drive backup",
      });
      toast.error(error instanceof Error ? error.message : "Failed to verify Google Drive backup");
    } finally {
      setIsDriveBusy(false);
    }
  };

  const handleDriveHistoryRefresh = async () => {
    setIsDriveBusy(true);
    try {
      const token = await requestDriveToken(driveConfig.clientId);
      const history = await getDriveBackupHistory(token);
      setDriveHistory(history);
      setDriveProof({
        status: history.length > 0 ? "verified" : "failed",
        checkedAt: new Date().toISOString(),
        message: history.length > 0
          ? "Loaded Google Drive backup history."
          : "No Google Drive backup history found yet. Create a verified Drive backup first.",
      });
      toast[history.length > 0 ? "success" : "warning"](
        history.length > 0 ? "Drive backup history loaded" : "No Drive backup history found"
      );
    } catch (error) {
      setDriveProof({
        status: "failed",
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Failed to load Google Drive backup history",
      });
      toast.error(error instanceof Error ? error.message : "Failed to load Google Drive backup history");
    } finally {
      setIsDriveBusy(false);
    }
  };

  const handleDriveRestore = async () => {
    setIsDriveBusy(true);
    try {
      const token = await requestDriveToken(driveConfig.clientId);
      const data = await downloadDriveBackup(token);
      await BackupSystem.importAll(data);

      const { SyncSystem } = await import("@/ecs/sync");
      await SyncSystem.pushAllToCloud();

      toast.success("Google Drive backup restored and synced. Reloading...");
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore Google Drive backup");
      setIsDriveBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Backups</h1>
        <p className="text-muted-foreground">Manage your local data snapshots and external cloud archives.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Local Backups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-primary" />
              Local Snapshot
            </CardTitle>
            <CardDescription>
              Download a complete JSON snapshot of your current data.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleBackup} disabled={isBackingUp} className="w-full">
              {isBackingUp ? "Creating..." : "Download Backup"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Restore Snapshot
            </CardTitle>
            <CardDescription>
              Upload a previously downloaded JSON file to restore your workspace.
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

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              Google Drive Backup
            </CardTitle>
            <CardDescription>
              Save and restore a hidden app-data backup in your Google Drive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!driveConfig.clientId && (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Missing <code>VITE_GOOGLE_CLIENT_ID</code>. Add it to your environment to enable Drive backup.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-4">
              <Button onClick={handleDriveBackup} disabled={isDriveBusy || !driveConfig.clientId} className="gap-2">
                <Cloud className="h-4 w-4" />
                {isDriveBusy ? "Working..." : "Backup to Drive"}
              </Button>
              <Button onClick={handleDriveVerify} disabled={isDriveBusy || !driveConfig.clientId} variant="secondary" className="gap-2">
                <Search className="h-4 w-4" />
                Verify Drive Backup
              </Button>
              <Button onClick={handleDriveHistoryRefresh} disabled={isDriveBusy || !driveConfig.clientId} variant="outline" className="gap-2">
                <Search className="h-4 w-4" />
                Backup History
              </Button>
              <Button onClick={handleDriveRestore} disabled={isDriveBusy || !driveConfig.clientId} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Restore from Drive
              </Button>
            </div>
            {driveProof && (
              <div
                className={
                  driveProof.status === "verified"
                    ? "rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm"
                    : "rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
                }
              >
                <div className="flex items-start gap-2">
                  {driveProof.status === "verified" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 space-y-1">
                    <div className="font-medium">
                      {driveProof.status === "verified" ? "Drive backup verified" : "Drive backup needs attention"}
                    </div>
                    <div className="text-muted-foreground">{driveProof.message}</div>
                    <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>Checked: {formatDateTime(driveProof.checkedAt)}</div>
                      {driveProof.file && <div>Drive modified: {formatDateTime(driveProof.file.modifiedTime)}</div>}
                      {driveProof.file && <div>File size: {formatBytes(driveProof.file.size)}</div>}
                      {driveProof.file && <div className="truncate">File id: {driveProof.file.id}</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {driveHistory.length > 0 && (
              <div className="rounded-md border p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">Drive backup history</div>
                    <div className="text-xs text-muted-foreground">
                      Last backup: {formatDateTime(driveHistory[0]?.backedUpAt)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{driveHistory.length} recorded</div>
                </div>
                <div className="space-y-2">
                  {driveHistory.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="grid gap-1 rounded-md bg-muted/40 p-2 text-xs sm:grid-cols-3">
                      <div>
                        <span className="text-muted-foreground">Backed up: </span>
                        {formatDateTime(entry.backedUpAt)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Verified: </span>
                        {formatDateTime(entry.verifiedAt)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Size: </span>
                        {formatBytes(entry.size)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Uses the Drive <code>appDataFolder</code>, so the backup is hidden from normal Drive browsing and only available to this app.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
