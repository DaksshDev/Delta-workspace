import { getDB } from "@/ecs/store";

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
    await db.put("settings", { id: SETTINGS_ID, folders, updatedAt: new Date().toISOString() });
  },
};
