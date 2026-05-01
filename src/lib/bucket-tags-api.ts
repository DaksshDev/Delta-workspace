import { getDB } from "@/ecs/store";
import type { TagDef } from "@/types/tags";

export const bucketTagsApi = {
  async getTags(): Promise<TagDef[]> {
    const db = await getDB();
    return db.getAll("bucket-tags");
  },

  async saveTag(tag: TagDef): Promise<void> {
    const db = await getDB();
    await db.put("bucket-tags", tag);
  },

  async deleteTag(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("bucket-tags", id);
  },
};
