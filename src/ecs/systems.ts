import { ecsApi } from './api';

export const SearchSystem = {
  async search(query: string) {
    if (!query) return [];
    const q = query.toLowerCase();
    const titles = await ecsApi.getEntitiesWithComponent('title');
    const matches = titles.filter(t => t.data.title.toLowerCase().includes(q));
    
    // get full entities for matches
    const results = await Promise.all(
      matches.map(async m => {
        const entity = await ecsApi.getEntity(m.entityId);
        return { entity, title: m.data.title };
      })
    );
    
    return results.filter(r => r.entity !== undefined);
  }
};

export const BackupSystem = {
  async exportAll() {
    const { getDB } = await import('./store');
    const db = await getDB();
    const entities = await db.getAll('entities');
    const components = await db.getAll('components');
    return JSON.stringify({ entities, components });
  },
  async importAll(jsonStr: string) {
    const data = JSON.parse(jsonStr);
    const { getDB } = await import('./store');
    const db = await getDB();
    const tx = db.transaction(['entities', 'components'], 'readwrite');
    await tx.objectStore('entities').clear();
    await tx.objectStore('components').clear();
    for (const e of data.entities) await tx.objectStore('entities').put(e);
    for (const c of data.components) await tx.objectStore('components').put(c);
    await tx.done;
  }
}
