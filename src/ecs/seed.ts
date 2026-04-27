import { ecsApi } from './api';
import { ENTITY_TYPES } from './entities';
import { v4 as uuidv4 } from 'uuid';

export const SeedSystem = {
  async seedIfEmpty() {
    const todos = await ecsApi.getEntitiesByType(ENTITY_TYPES.TODO);
    if (todos.length === 0) {
      // Seed Todos
      const t1 = await ecsApi.createEntity(ENTITY_TYPES.TODO);
      await ecsApi.setComponent(t1.id, 'title', { title: 'Complete Math Assignment' });
      await ecsApi.setComponent(t1.id, 'status', { status: 'todo' });
      await ecsApi.setComponent(t1.id, 'priority', { priority: 'high' });
      await ecsApi.setComponent(t1.id, 'tag', { tags: ['school', 'math'] });

      const t2 = await ecsApi.createEntity(ENTITY_TYPES.TODO);
      await ecsApi.setComponent(t2.id, 'title', { title: 'Read Chapter 4 of Science' });
      await ecsApi.setComponent(t2.id, 'status', { status: 'todo' });
      await ecsApi.setComponent(t2.id, 'priority', { priority: 'medium' });

      // Seed Ideas
      const i1 = await ecsApi.createEntity(ENTITY_TYPES.IDEA);
      await ecsApi.setComponent(i1.id, 'title', { title: 'App for organizing study notes' });
      await ecsApi.setComponent(i1.id, 'content', { content: 'It should use local first architecture with IndexedDB and have a really cool dark mode.' });
      await ecsApi.setComponent(i1.id, 'tag', { tags: ['project', 'dev'] });

      // Seed Study Subjects
      const s1 = await ecsApi.createEntity(ENTITY_TYPES.SUBJECT);
      await ecsApi.setComponent(s1.id, 'title', { title: 'Mathematics' });
      const c1 = await ecsApi.createEntity(ENTITY_TYPES.CHAPTER);
      await ecsApi.setComponent(c1.id, 'title', { title: 'Algebraic Expressions' });
      await ecsApi.setComponent(c1.id, 'relation', { relations: [{ type: 'subject', targetId: s1.id }] });

      // Seed Watch Later
      const w1 = await ecsApi.createEntity(ENTITY_TYPES.VIDEO);
      await ecsApi.setComponent(w1.id, 'title', { title: 'Understanding the Event Loop in JavaScript' });
      await ecsApi.setComponent(w1.id, 'metadata', { url: 'https://www.youtube.com/watch?v=8aGhZQkoFbQ' });
      await ecsApi.setComponent(w1.id, 'status', { status: 'unwatched' });
    }
  }
};
