import { TagDef } from '@/types/tags';
import { getDB } from '@/ecs/store';
import { SyncSystem } from '@/ecs/sync';

// Separate tag storage for Idea Dump — completely isolated from Todo tags.
export const ideaTagsApi = {
  async getTags(): Promise<TagDef[]> {
    const db = await getDB();
    return db.getAll('idea-tags');
  },

  async saveTag(tag: TagDef): Promise<void> {
    const db = await getDB();
    await db.put('idea-tags', tag);
    await SyncSystem.queueWrite({ type: 'idea_tag_put', data: tag });
  },

  async deleteTag(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('idea-tags', id);
    await SyncSystem.queueWrite({ type: 'idea_tag_delete', data: { id } });
  }
};
