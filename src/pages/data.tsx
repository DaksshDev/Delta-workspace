import { useEffect, useRef, useState } from "react";
import { Database, Download, Lock, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [legacyImported, setLegacyImported] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
              type="file" 
              accept=".json" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (event) => {
                  try {
                    const jsonStr = event.target?.result as string;
                    await BackupSystem.importAll(jsonStr);
                    // Push newly restored data to cloud so Firebase is updated!
                    const { SyncSystem } = await import('@/ecs/sync');
                    await SyncSystem.pushAllToCloud();
                    
                    toast.success("Workspace restored and synced to cloud successfully. Reloading...");
                    setTimeout(() => window.location.reload(), 1500);
                  } catch (error) {
                    toast.error("Failed to restore workspace. Invalid file format.");
                  }
                };
                reader.readAsText(file);
              }} 
              className="cursor-pointer"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
