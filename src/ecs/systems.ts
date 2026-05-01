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
    const studyItems = await db.getAll('studyItems');
    const tags = await db.getAll('tags');
    const bucketTags = await db.getAll('bucket-tags');
    const ideaTags = await db.getAll('idea-tags');
    const folders = await db.getAll('folders');
    const settings = await db.getAll('settings');
    const bugs = await db.getAll('bugs');
    return JSON.stringify({ entities, components, studyItems, tags, bucketTags, ideaTags, folders, settings, bugs });
  },
  async importAll(jsonStr: string) {
    const data = JSON.parse(jsonStr);
    const { getDB } = await import('./store');
    const db = await getDB();
    const tx = db.transaction(['entities', 'components', 'studyItems', 'tags', 'bucket-tags', 'idea-tags', 'folders', 'settings', 'bugs'], 'readwrite');
    await tx.objectStore('entities').clear();
    await tx.objectStore('components').clear();
    await tx.objectStore('studyItems').clear();
    await tx.objectStore('tags').clear();
    await tx.objectStore('bucket-tags').clear();
    await tx.objectStore('idea-tags').clear();
    await tx.objectStore('folders').clear();
    await tx.objectStore('settings').clear();
    await tx.objectStore('bugs').clear();
    for (const e of data.entities) await tx.objectStore('entities').put(e);
    for (const c of data.components) await tx.objectStore('components').put(c);
    for (const item of data.studyItems ?? []) await tx.objectStore('studyItems').put(item);
    for (const tag of data.tags ?? []) await tx.objectStore('tags').put(tag);
    for (const tag of data.bucketTags ?? []) await tx.objectStore('bucket-tags').put(tag);
    for (const tag of data.ideaTags ?? []) await tx.objectStore('idea-tags').put(tag);
    for (const folder of data.folders ?? []) await tx.objectStore('folders').put(folder);
    for (const setting of data.settings ?? []) await tx.objectStore('settings').put(setting);
    for (const bug of data.bugs ?? []) await tx.objectStore('bugs').put(bug);
    await tx.done;
  }
}
