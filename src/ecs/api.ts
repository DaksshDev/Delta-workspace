import { getDB } from './store';
import { Entity, Component, ENTITY_TYPES } from './entities';
import { v4 as uuidv4 } from 'uuid';

export const ecsApi = {
  async getEntitiesByType(type: string): Promise<Entity[]> {
    const db = await getDB();
    return db.getAllFromIndex('entities', 'by-type', type);
  },

  async getEntity(id: string): Promise<Entity | undefined> {
    const db = await getDB();
    return db.get('entities', id);
  },

  async createEntity(type: string): Promise<Entity> {
    const db = await getDB();
    const entity: Entity = {
      id: uuidv4(),
      type,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await db.put('entities', entity);
    return entity;
  },

  async deleteEntity(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['entities', 'components'], 'readwrite');
    await tx.objectStore('entities').delete(id);
    const comps = await tx.objectStore('components').index('by-entity').getAll(id);
    for (const comp of comps) {
      await tx.objectStore('components').delete([comp.type, comp.entityId]);
    }
    await tx.done;
  },

  async getComponents(entityId: string): Promise<Component[]> {
    const db = await getDB();
    return db.getAllFromIndex('components', 'by-entity', entityId);
  },

  async getComponent<T extends Component>(entityId: string, type: string): Promise<T | undefined> {
    const db = await getDB();
    return db.get('components', [type, entityId]) as Promise<T | undefined>;
  },

  async setComponent<T extends Component>(entityId: string, type: string, data: any): Promise<void> {
    const db = await getDB();
    const comp = { entityId, type, data };
    await db.put('components', comp);
    
    // Update entity updatedAt
    const entity = await db.get('entities', entityId);
    if (entity) {
      entity.updatedAt = Date.now();
      await db.put('entities', entity);
    }
  },

  async getEntitiesWithComponent(type: string): Promise<Component[]> {
    const db = await getDB();
    return db.getAllFromIndex('components', 'by-type', type);
  }
};
