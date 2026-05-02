import { useEffect, useRef, useState } from "react";
import { Database, Download, Lock, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES } from "@/ecs/entities";
import { getDB } from "@/ecs/store";
import { BackupSystem } from "@/ecs/systems";
import { SyncSystem } from "@/ecs/sync";
import { ideaFoldersApi, type IdeaFolder } from "@/lib/idea-folders-api";

type LegacyIdea = {
  id: string | number;
  content: string;
  createdAt?: string;
};

type LegacyGroup = {
  id: string | number;
  name: string;
  ideaIds?: Array<string | number>;
};

type LegacyIdeaDump = {
  ideas: LegacyIdea[];
  groups?: LegacyGroup[];
};

type BackupPreview = {
  json: string;
  fileName: string;
  counts: {
    entities: number;
    components: number;
    studyItems: number;
    tags: number;
    ideaTags: number;
    settings: number;
  };
};

const LEGACY_IMPORT_SETTING_ID = "legacy-idea-dump-imported";

function isLegacyIdeaDump(value: unknown): value is LegacyIdeaDump {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<LegacyIdeaDump>;
  return Array.isArray(data.ideas) && data.ideas.every((idea) => (
    idea &&
    typeof idea === "object" &&
    "id" in idea &&
    typeof (idea as LegacyIdea).content === "string"
  ));
}

async function hasLegacyImportRun() {
  const db = await getDB();
  const setting = await db.get("settings", LEGACY_IMPORT_SETTING_ID);
  return Boolean(setting?.imported);
}

async function lockLegacyImport() {
  const db = await getDB();
  const record = {
    id: LEGACY_IMPORT_SETTING_ID,
    imported: true,
    importedAt: new Date().toISOString(),
  };
  await db.put("settings", record);
  await SyncSystem.queueWrite({ type: "settings_put", data: record });
}

export function Data() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [legacyImported, setLegacyImported] = useState(true);
  const [cleanupReport, setCleanupReport] = useState<string | null>(null);
  const [cleanConfirmOpen, setCleanConfirmOpen] = useState(false);
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    hasLegacyImportRun().then(setLegacyImported);
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await BackupSystem.exportAll();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `delta-board-export-${new Date().toISOString().split("T")[0]}.json`;
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

  const importLegacyIdeaDump = async (file: File) => {
    if (legacyImported) return;

    setIsImporting(true);
    try {
      const json = JSON.parse(await file.text()) as unknown;
      if (!isLegacyIdeaDump(json)) {
        throw new Error("Invalid legacy idea.dump JSON");
      }

      const idMap = new Map<string, string>();

      for (const legacyIdea of json.ideas) {
        const content = legacyIdea.content.trim();
        if (!content) continue;

        const idea = await ecsApi.createEntity(ENTITY_TYPES.IDEA);
        idMap.set(String(legacyIdea.id), idea.id);
        await ecsApi.setComponent(idea.id, "content", { content });
        await ecsApi.setComponent(idea.id, "createdAt", {
          createdAt: legacyIdea.createdAt ?? new Date().toISOString(),
        });
      }

      const existingFolders = await ideaFoldersApi.getFolders();
      const importedFolders: IdeaFolder[] = (json.groups ?? [])
        .map((group): IdeaFolder => ({
          id: `legacy-${String(group.id)}`,
          name: group.name || "Imported Group",
          color: "#6366f1",
          ideaIds: (group.ideaIds ?? [])
            .map((id) => idMap.get(String(id)))
            .filter((id): id is string => Boolean(id)),
        }))
        .filter((folder) => folder.ideaIds.length > 0);

      await ideaFoldersApi.saveFolders([...existingFolders, ...importedFolders]);
      await lockLegacyImport();
      setLegacyImported(true);
      toast.success(`Imported ${idMap.size} ideas from legacy idea.dump`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import legacy idea.dump");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLegacyFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) importLegacyIdeaDump(file);
  };

  const handleCleanDatabase = async () => {
    setIsCleaning(true);
    try {
      const report = await cleanUnusedDatabaseData();
      setCleanupReport(report.summary);
      toast.success(report.summary);
      window.dispatchEvent(new Event("delta-data-changed"));
      setCleanConfirmOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clean database");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleRestoreFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const json = await file.text();
      const data = JSON.parse(json);
      setRestorePreview({
        json,
        fileName: file.name,
        counts: {
          entities: arrayCount(data.entities),
          components: arrayCount(data.components),
          studyItems: arrayCount(data.studyItems),
          tags: arrayCount(data.tags),
          ideaTags: arrayCount(data.ideaTags),
          settings: arrayCount(data.settings),
        },
      });
    } catch (error) {
      toast.error("Failed to read backup. Choose a valid JSON file.");
      if (restoreInputRef.current) restoreInputRef.current.value = "";
    }
  };

  const handleRestoreBackup = async () => {
    if (!restorePreview) return;

    setIsRestoring(true);
    try {
      await BackupSystem.importAll(restorePreview.json);
      await SyncSystem.clearQueue();
      await SyncSystem.pushAllToCloud();
      const verification = await SyncSystem.verifySync();
      if (!verification.ok) {
        throw new Error(verification.mismatches[0] || "Restored workspace did not match Firebase after sync.");
      }

      toast.success("Workspace restored, verified, and synced to Firebase. Reloading...");
      setRestorePreview(null);
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore workspace.");
    } finally {
      setIsRestoring(false);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data</h1>
        <p className="text-muted-foreground">Import legacy data and export this workspace.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Legacy idea.dump Import
            </CardTitle>
            <CardDescription>
              Import one legacy idea.dump JSON file into the Study Mode Ideas page.
              This importer locks permanently after it succeeds once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              disabled={legacyImported || isImporting}
              onChange={handleLegacyFileChange}
              className="cursor-pointer disabled:cursor-not-allowed"
            />
            {legacyImported && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                Legacy import has already been used and is now frozen.
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              disabled={legacyImported || isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="w-full gap-2"
            >
              <Upload className="h-4 w-4" />
              {legacyImported ? "Legacy Import Frozen" : isImporting ? "Importing..." : "Choose Legacy JSON"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Full Export
            </CardTitle>
            <CardDescription>
              Download all entities, components, study items, and settings in a single JSON file.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleExport} disabled={isExporting} className="w-full gap-2">
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting..." : "Download JSON"}
            </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-2 border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Sparkles className="h-5 w-5" />
              Clean Database
            </CardTitle>
            <CardDescription>
              Removes broken references and orphaned ECS components only. Ideas, tasks, study cards, folders, and tag definitions are preserved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cleanupReport && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {cleanupReport}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => setCleanConfirmOpen(true)} disabled={isCleaning} variant="outline" className="w-full gap-2">
              <Sparkles className="h-4 w-4" />
              {isCleaning ? "Cleaning..." : "Clean unused data"}
            </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Upload className="h-5 w-5" />
              Restore Workspace Backup
            </CardTitle>
            <CardDescription>
              Upload a previously downloaded JSON backup. This will completely rewrite your local database and sync it to Firebase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input 
              ref={restoreInputRef}
              type="file" 
              accept=".json" 
              disabled={isRestoring}
              onChange={handleRestoreFileChange}
              className="cursor-pointer"
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={cleanConfirmOpen} onOpenChange={setCleanConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clean unused database references?</DialogTitle>
            <DialogDescription>
              This removes broken links and orphan ECS components only. Ideas, tasks, study cards, folders, and tag definitions are preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Safe cleanup targets: orphan components, broken todo parent links, missing subject links, dead tag references, and dead idea IDs inside idea folders.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCleanConfirmOpen(false)} disabled={isCleaning}>Cancel</Button>
            <Button onClick={handleCleanDatabase} disabled={isCleaning}>
              <Sparkles className="h-4 w-4" />
              {isCleaning ? "Cleaning..." : "Clean database"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!restorePreview} onOpenChange={(open) => !open && !isRestoring && setRestorePreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore workspace backup?</DialogTitle>
            <DialogDescription>
              This will replace the local workspace with the selected backup, clear pending sync operations, upload it to Firebase, and verify the result.
            </DialogDescription>
          </DialogHeader>
          {restorePreview && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{restorePreview.fileName}</p>
                <p className="text-muted-foreground">
                  {restorePreview.counts.entities} entities, {restorePreview.counts.components} components, {restorePreview.counts.studyItems} study items
                </p>
                <p className="text-muted-foreground">
                  {restorePreview.counts.tags} todo tags, {restorePreview.counts.ideaTags} idea tags, {restorePreview.counts.settings} settings
                </p>
              </div>
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-muted-foreground">
                Current local data and Firebase data will be overwritten by this backup after confirmation.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestorePreview(null)} disabled={isRestoring}>Cancel</Button>
            <Button onClick={handleRestoreBackup} disabled={isRestoring}>
              <Upload className="h-4 w-4" />
              {isRestoring ? "Restoring..." : "Restore and sync"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function arrayCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

async function cleanUnusedDatabaseData() {
  const db = await getDB();
  const [entities, components, todoTags, ideaTags, settings, studyItems] = await Promise.all([
    db.getAll("entities"),
    db.getAll("components"),
    db.getAll("tags"),
    db.getAll("idea-tags"),
    db.getAll("settings"),
    db.getAll("studyItems"),
  ]);

  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const todoTagIds = new Set(todoTags.map((tag) => tag.id));
  const ideaTagIds = new Set(ideaTags.map((tag) => tag.id));
  const subjectIds = new Set([
    ...entities.filter((entity) => entity.type === ENTITY_TYPES.SUBJECT).map((entity) => entity.id),
    ...studyItems.filter((item) => item.type === "folder").map((item) => item.id),
  ]);

  let orphanComponents = 0;
  let repairedComponents = 0;
  let repairedFolders = 0;

  for (const component of components) {
    const owner = entityById.get(component.entityId);
    if (!owner) {
      await ecsApi.deleteComponent(component.entityId, component.type);
      orphanComponents++;
      continue;
    }

    if (component.type === "parentTodo") {
      const parentId = component.data?.parentId;
      const parent = parentId ? entityById.get(parentId) : null;
      if (!parent || parent.type !== ENTITY_TYPES.TODO || owner.type !== ENTITY_TYPES.TODO) {
        await ecsApi.deleteComponent(component.entityId, component.type);
        repairedComponents++;
      }
      continue;
    }

    if (component.type === "subject") {
      const subjectId = component.data?.subjectId;
      if (!subjectId || !subjectIds.has(subjectId)) {
        await ecsApi.deleteComponent(component.entityId, component.type);
        repairedComponents++;
      }
      continue;
    }

    if (component.type === "tag") {
      const tags = Array.isArray(component.data?.tags) ? component.data.tags : [];
      const cleanedTags = tags.filter((id: string) => todoTagIds.has(id));
      if (cleanedTags.length !== tags.length) {
        await ecsApi.setComponent(component.entityId, component.type, { ...component.data, tags: cleanedTags });
        repairedComponents++;
      }
      continue;
    }

    if (component.type === "idea-tag") {
      const tags = Array.isArray(component.data?.tags) ? component.data.tags : [];
      const verifiedTags = Array.isArray(component.data?.verifiedTags) ? component.data.verifiedTags : [];
      const cleanedTags = tags.filter((id: string) => ideaTagIds.has(id));
      const cleanedVerifiedTags = verifiedTags.filter((id: string) => ideaTagIds.has(id));
      if (cleanedTags.length !== tags.length || cleanedVerifiedTags.length !== verifiedTags.length) {
        await ecsApi.setComponent(component.entityId, component.type, {
          ...component.data,
          tags: cleanedTags,
          verifiedTags: cleanedVerifiedTags,
        });
        repairedComponents++;
      }
    }
  }

  const ideaFolderRecord = settings.find((setting) => setting.id === "idea-folders");
  if (Array.isArray(ideaFolderRecord?.folders)) {
    const ideaIds = new Set(entities.filter((entity) => entity.type === ENTITY_TYPES.IDEA).map((entity) => entity.id));
    const folders = ideaFolderRecord.folders.map((folder: IdeaFolder) => {
      const originalIds = Array.isArray(folder.ideaIds) ? folder.ideaIds : [];
      const cleanIds = originalIds.filter((id) => ideaIds.has(id));
      if (cleanIds.length !== originalIds.length) repairedFolders++;
      return { ...folder, ideaIds: cleanIds };
    });

    if (repairedFolders > 0) {
      await ideaFoldersApi.saveFolders(folders);
    }
  }

  return {
    summary: `Cleaned ${orphanComponents} orphan component${orphanComponents === 1 ? "" : "s"}, repaired ${repairedComponents} broken reference${repairedComponents === 1 ? "" : "s"}, and cleaned ${repairedFolders} idea folder${repairedFolders === 1 ? "" : "s"}.`,
  };
}
