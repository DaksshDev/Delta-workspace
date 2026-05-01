import { TagDef } from '@/types/tags';
import { getDB } from '@/ecs/store';

export const tagsApi = {
  async getTags(): Promise<TagDef[]> {
    const db = await getDB();
    return db.getAll('tags');
  },

  async saveTag(tag: TagDef): Promise<void> {
    const db = await getDB();
    await db.put('tags', tag);
  },

  async deleteTag(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('tags', id);
  }
};
