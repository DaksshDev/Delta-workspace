import { getDB } from './store';
import { Entity, Component, ENTITY_TYPES } from './entities';
import { v4 as uuidv4 } from 'uuid';
import { SyncSystem } from './sync';

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
    
    // Sync to cloud
    await SyncSystem.queueWrite({ type: 'entity_put', data: entity });
    
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

    for (const comp of comps) {
      await SyncSystem.queueWrite({ type: 'comp_delete', data: { type: comp.type, entityId: comp.entityId } });
    }
    await SyncSystem.queueWrite({ type: 'entity_delete', data: { id } });
  },

  async deleteComponent(entityId: string, type: string): Promise<void> {
    const db = await getDB();
    await db.delete('components', [type, entityId]);
    await SyncSystem.queueWrite({ type: 'comp_delete', data: { type, entityId } });
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
    await SyncSystem.queueWrite({ type: 'comp_put', data: comp });
    
    // Update entity updatedAt
    const entity = await db.get('entities', entityId);
    if (entity) {
      entity.updatedAt = Date.now();
      await db.put('entities', entity);
      await SyncSystem.queueWrite({ type: 'entity_put', data: entity });
    }
  },

  async getEntitiesWithComponent(type: string): Promise<Component[]> {
    const db = await getDB();
    return db.getAllFromIndex('components', 'by-type', type);
  },

  async getComponentsByEntityType(type: string): Promise<Component[]> {
    const db = await getDB();
    const entities = await db.getAllFromIndex('entities', 'by-type', type);
    const componentGroups = await Promise.all(
      entities.map((entity) => db.getAllFromIndex('components', 'by-entity', entity.id))
    );
    return componentGroups.flat();
  }
};
