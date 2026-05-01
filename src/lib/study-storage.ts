import { ENTITY_TYPES } from "@/ecs/entities";
import { getDB, type DeltaDB } from "@/ecs/store";

export type StudyItemType = "folder" | "flashcard" | "quiz" | "keypoints";

export type StudyItem = {
  id: string;
  parentId: string;
  type: StudyItemType;
  name: string;
  color: string;
  order: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type SeedItem = Pick<StudyItem, "id" | "name" | "color" | "type"> & {
  children: SeedItem[];
};

export const STUDY_ROOT_ID = "__study_root__";

export const DEFAULT_STUDY_IDS = new Set([
  "science", "maths", "sst", "english", "hindi", "it",
  "physics", "chemistry", "bio",
  "history", "geography", "civics", "economics",
]);

const SEED_DEFAULTS: SeedItem[] = [
  {
    id: "science",
    name: "Science",
    color: "#22c55e",
    type: "folder",
    children: [
      { id: "physics", name: "Physics", color: "#3b82f6", type: "folder", children: [] },
      { id: "chemistry", name: "Chemistry", color: "#f97316", type: "folder", children: [] },
      { id: "bio", name: "Biology", color: "#22c55e", type: "folder", children: [] },
    ],
  },
  { id: "maths", name: "Maths", color: "#ef4444", type: "folder", children: [] },
  {
    id: "sst",
    name: "SST",
    color: "#f97316",
    type: "folder",
    children: [
      { id: "history", name: "History", color: "#b45309", type: "folder", children: [] },
      { id: "geography", name: "Geography", color: "#0d9488", type: "folder", children: [] },
      { id: "civics", name: "Civics", color: "#eab308", type: "folder", children: [] },
      { id: "economics", name: "Economics", color: "#22c55e", type: "folder", children: [] },
    ],
  },
  { id: "english", name: "English", color: "#3b82f6", type: "folder", children: [] },
  { id: "hindi", name: "Hindi", color: "#8b5cf6", type: "folder", children: [] },
  { id: "it", name: "IT", color: "#6b7280", type: "folder", children: [] },
];

function entityTypeForStudyItem(type: StudyItemType) {
  if (type === "folder") return ENTITY_TYPES.STUDY_FOLDER;
  if (type === "keypoints") return ENTITY_TYPES.KEY_POINT;
  if (type === "flashcard") return ENTITY_TYPES.FLASHCARD;
  return ENTITY_TYPES.QUIZ;
}

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function asStudyItems(values: DeltaDB["studyItems"]["value"][]) {
  return values.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

async function putEntityAndComponents(item: StudyItem) {
  const db = await getDB();
  const now = Date.now();
  const entity = await db.get("entities", item.id);

  await db.put("entities", {
    id: item.id,
    type: entityTypeForStudyItem(item.type),
    createdAt: entity?.createdAt ?? now,
    updatedAt: now,
  });

  await db.put("components", { entityId: item.id, type: "title", data: { title: item.name } });
  await db.put("components", { entityId: item.id, type: "color", data: { color: item.color } });
  await db.put("components", {
    entityId: item.id,
    type: "metadata",
    data: {
      studyItemType: item.type,
      parentId: item.parentId,
      order: item.order,
      isDefault: item.isDefault,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    },
  });
  await db.put("components", {
    entityId: item.id,
    type: "relation",
    data: {
      relations: item.parentId === STUDY_ROOT_ID
        ? []
        : [{ type: "parent-folder", targetId: item.parentId }],
    },
  });
}

async function upsertSeedItems(seed: SeedItem[], parentId: string) {
  const db = await getDB();
  for (const [order, seedItem] of seed.entries()) {
    const existing = await db.get("studyItems", seedItem.id);
    if (!existing) {
      const now = new Date().toISOString();
      const item: StudyItem = {
        id: seedItem.id,
        parentId,
        type: seedItem.type,
        name: seedItem.name,
        color: seedItem.color,
        order,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      };
      await db.put("studyItems", item);
      await putEntityAndComponents(item);
    }
    await upsertSeedItems(seedItem.children, seedItem.id);
  }
}

export const studyStorage = {
  async ensureDefaults() {
    await upsertSeedItems(SEED_DEFAULTS, STUDY_ROOT_ID);
  },

  async getItem(id: string) {
    const db = await getDB();
    return db.get("studyItems", id);
  },

  async getChildren(parentId: string = STUDY_ROOT_ID) {
    const db = await getDB();
    return asStudyItems(await db.getAllFromIndex("studyItems", "by-parent", parentId));
  },

  async getBreadcrumb(id: string | null) {
    if (!id) return [];

    const db = await getDB();
    const path: StudyItem[] = [];
    let current = await db.get("studyItems", id);

    while (current) {
      path.unshift(current);
      if (current.parentId === STUDY_ROOT_ID) break;
      current = await db.get("studyItems", current.parentId);
    }

    return path;
  },

  async search(query: string, limit = 200) {
    const db = await getDB();
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: StudyItem[] = [];
    let cursor = await db.transaction("studyItems").store.openCursor();
    while (cursor && results.length < limit) {
      const item = cursor.value;
      if (item.name.toLowerCase().includes(q)) results.push(item);
      cursor = await cursor.continue();
    }

    return asStudyItems(results);
  },

  async createItem(type: StudyItemType, name: string, parentId: string = STUDY_ROOT_ID) {
    const db = await getDB();
    const siblings = await db.getAllFromIndex("studyItems", "by-parent", parentId);
    const maxOrder = siblings.reduce((max, item) => Math.max(max, item.order), -1);
    const now = new Date().toISOString();
    const item: StudyItem = {
      id: generateId(),
      parentId,
      type,
      name,
      color: "#6366f1",
      order: maxOrder + 1,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.put("studyItems", item);
    await putEntityAndComponents(item);
    return item;
  },

  async renameItem(id: string, name: string) {
    const db = await getDB();
    const item = await db.get("studyItems", id);
    if (!item) return;
    const updated = { ...item, name, updatedAt: new Date().toISOString() };
    await db.put("studyItems", updated);
    await putEntityAndComponents(updated);
  },

  async changeColor(id: string, color: string) {
    const db = await getDB();
    const item = await db.get("studyItems", id);
    if (!item) return;
    const updated = { ...item, color, updatedAt: new Date().toISOString() };
    await db.put("studyItems", updated);
    await putEntityAndComponents(updated);
  },

  async deleteSubtree(id: string) {
    const db = await getDB();
    const children = await db.getAllFromIndex("studyItems", "by-parent", id);
    for (const child of children) {
      await this.deleteSubtree(child.id);
    }

    const tx = db.transaction(["studyItems", "entities", "components"], "readwrite");
    await tx.objectStore("studyItems").delete(id);
    await tx.objectStore("entities").delete(id);
    const components = await tx.objectStore("components").index("by-entity").getAll(id);
    for (const component of components) {
      await tx.objectStore("components").delete([component.type, component.entityId]);
    }
    await tx.done;
  },

  async resetDefaultColors() {
    const db = await getDB();
    const flatSeed = flattenSeeds(SEED_DEFAULTS);
    for (const seed of flatSeed) {
      const item = await db.get("studyItems", seed.id);
      if (item) {
        const updated = { ...item, color: seed.color, updatedAt: new Date().toISOString() };
        await db.put("studyItems", updated);
        await putEntityAndComponents(updated);
      }
    }
  },

  async resetDefaultNames() {
    const db = await getDB();
    const flatSeed = flattenSeeds(SEED_DEFAULTS);
    for (const seed of flatSeed) {
      const item = await db.get("studyItems", seed.id);
      if (item) {
        const updated = { ...item, name: seed.name, updatedAt: new Date().toISOString() };
        await db.put("studyItems", updated);
        await putEntityAndComponents(updated);
      }
    }
  },

  async countDescendants(id: string): Promise<number> {
    const db = await getDB();
    const children = await db.getAllFromIndex("studyItems", "by-parent", id);
    let count = children.length;
    for (const child of children) {
      count += await this.countDescendants(child.id);
    }
    return count;
  },
};

function flattenSeeds(seeds: SeedItem[]): SeedItem[] {
  return seeds.flatMap((seed) => [seed, ...flattenSeeds(seed.children)]);
}
