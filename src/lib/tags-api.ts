import { TagDef } from '@/types/tags';
import { getDB } from '@/ecs/store';
import { SyncSystem } from '@/ecs/sync';

export const tagsApi = {
  async getTags(): Promise<TagDef[]> {
    const db = await getDB();
    return db.getAll('tags');
  },

  async saveTag(tag: TagDef): Promise<void> {
    const db = await getDB();
    await db.put('tags', tag);
    await SyncSystem.queueWrite({ type: 'tag_put', data: tag });
  },

  async deleteTag(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('tags', id);
    await SyncSystem.queueWrite({ type: 'tag_delete', data: { id } });
  }
};
