import { getDB } from "@/ecs/store";
import { SyncSystem } from "@/ecs/sync";

export type IdeaFolder = {
  id: string;
  name: string;
  ideaIds: string[];
  color: string;
  isVault?: boolean;
};

const SETTINGS_ID = "idea-folders";

export const ideaFoldersApi = {
  async getFolders(): Promise<IdeaFolder[]> {
    const db = await getDB();
    const record = await db.get("settings", SETTINGS_ID);
    return Array.isArray(record?.folders) ? record.folders : [];
  },

  async saveFolders(folders: IdeaFolder[]): Promise<void> {
    const db = await getDB();
    const record = { id: SETTINGS_ID, folders, updatedAt: new Date().toISOString() };
    await db.put("settings", record);
    await SyncSystem.queueWrite({ type: "settings_put", data: record });
  },
};
