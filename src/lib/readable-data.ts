import { collection, getDocs } from "firebase/firestore";
import { db as firebaseDb } from "@/lib/firebase";
import { getDB } from "@/ecs/store";
import { ENTITY_TYPES, type Component, type Entity } from "@/ecs/entities";

type RawWorkspaceData = {
  entities: Entity[];
  components: Component[];
  studyItems: any[];
  tags: any[];
  bucketTags: any[];
  ideaTags: any[];
  folders: any[];
  settings: any[];
  bugs: any[];
};

type ReadableItem = {
  key: string;
  label: string;
  value: any;
};

const CLOUD_COLLECTIONS: Array<{ firestoreName: string; rawKey: keyof RawWorkspaceData }> = [
  { firestoreName: "entities", rawKey: "entities" },
  { firestoreName: "components", rawKey: "components" },
  { firestoreName: "studyItems", rawKey: "studyItems" },
  { firestoreName: "tags", rawKey: "tags" },
  { firestoreName: "bucketTags", rawKey: "bucketTags" },
  { firestoreName: "ideaTags", rawKey: "ideaTags" },
  { firestoreName: "folders", rawKey: "folders" },
  { firestoreName: "settings", rawKey: "settings" },
  { firestoreName: "bugs", rawKey: "bugs" },
];

export async function getLocalRawWorkspaceData(): Promise<RawWorkspaceData> {
  const db = await getDB();
  const [entities, components, studyItems, tags, bucketTags, ideaTags, folders, settings, bugs] = await Promise.all([
    db.getAll("entities"),
    db.getAll("components"),
    db.getAll("studyItems"),
    db.getAll("tags"),
    db.getAll("bucket-tags"),
    db.getAll("idea-tags"),
    db.getAll("folders"),
    db.getAll("settings"),
    db.getAll("bugs"),
  ]);

  return { entities, components, studyItems, tags, bucketTags, ideaTags, folders, settings, bugs };
}

export async function getCloudRawWorkspaceData(uid: string): Promise<RawWorkspaceData> {
  const entries = await Promise.all(
    CLOUD_COLLECTIONS.map(async (config) => {
      const snapshot = await getDocs(collection(firebaseDb, `users/${uid}/${config.firestoreName}`));
      return [config.rawKey, snapshot.docs.map((doc) => doc.data())] as const;
    })
  );

  return Object.fromEntries(entries) as RawWorkspaceData;
}

export async function getReadableExport(scope: "ideas" | "todos" | "all" = "all") {
  const raw = await getLocalRawWorkspaceData();
  const readable = toReadableWorkspace(raw);
  if (scope === "ideas") return { exportedAt: new Date().toISOString(), ideas: readable.ideas };
  if (scope === "todos") return { exportedAt: new Date().toISOString(), todos: readable.todos };
  return { exportedAt: new Date().toISOString(), ...readable };
}

export function toReadableWorkspace(raw: RawWorkspaceData) {
  const componentMap = groupComponents(raw.components);
  const studyItems = raw.studyItems.map((item) => ({
    id: item.id,
    type: item.type,
    name: item.name,
    parentId: item.parentId,
    color: item.color,
    order: item.order,
    updatedAt: item.updatedAt,
  }));

  return {
    ideas: buildIdeas(raw, componentMap),
    todos: buildTodos(raw, componentMap),
    studyPage: {
      items: studyItems,
      folders: studyItems.filter((item) => item.type === "folder"),
      cards: studyItems.filter((item) => item.type !== "folder"),
    },
  };
}

export function summarizeReadableDifferences(localRaw: RawWorkspaceData, cloudRaw: RawWorkspaceData) {
  const localItems = flattenReadableItems(toReadableWorkspace(localRaw));
  const cloudItems = flattenReadableItems(toReadableWorkspace(cloudRaw));
  const localByKey = new Map(localItems.map((item) => [item.key, item]));
  const cloudByKey = new Map(cloudItems.map((item) => [item.key, item]));
  const summaries: string[] = [];

  localByKey.forEach((localItem, key) => {
    const cloudItem = cloudByKey.get(key);
    if (!cloudItem) {
      summaries.push(`${localItem.label} exists on this device but not in Firebase.`);
      return;
    }
    if (stableStringify(localItem.value) !== stableStringify(cloudItem.value)) {
      summaries.push(`${localItem.label} changed.`);
    }
  });

  cloudByKey.forEach((cloudItem, key) => {
    if (!localByKey.has(key)) {
      summaries.push(`${cloudItem.label} exists in Firebase but not on this device.`);
    }
  });

  return summaries;
}

function buildIdeas(raw: RawWorkspaceData, componentMap: Map<string, Map<string, any>>) {
  const foldersRecord = raw.settings.find((item) => item.id === "idea-folders");
  const folders = Array.isArray(foldersRecord?.folders) ? foldersRecord.folders : [];
  const tagNameById = new Map(raw.ideaTags.map((tag) => [tag.id, tag.name]));

  const ideas = raw.entities
    .filter((entity) => entity.type === ENTITY_TYPES.IDEA)
    .map((entity) => {
      const components = componentMap.get(entity.id);
      const tagIds = asArray(components?.get("idea-tag")?.tags);
      return {
        id: entity.id,
        content: components?.get("content")?.content ?? "",
        createdAt: components?.get("createdAt")?.createdAt ?? entity.createdAt,
        tags: tagIds.map((id) => tagNameById.get(id) ?? id),
        folder: folders.find((folder: any) => asArray(folder.ideaIds).includes(entity.id))?.name ?? null,
      };
    });

  return {
    tags: raw.ideaTags.map(cleanTag),
    folders: folders.map((folder: any) => ({
      id: folder.id,
      name: folder.name,
      color: folder.color,
      isVault: !!folder.isVault,
      ideaCount: asArray(folder.ideaIds).length,
    })),
    ideas,
  };
}

function buildTodos(raw: RawWorkspaceData, componentMap: Map<string, Map<string, any>>) {
  const tags = raw.tags.map(cleanTag);
  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]));
  const studySubjects = raw.studyItems
    .filter((item) => item.type === "folder")
    .map((item) => ({
      id: item.id,
      name: item.name || "Study folder",
      color: item.color || "#3b82f6",
      source: "study-folder",
    }));
  const todoSubjects = raw.entities
    .filter((entity) => entity.type === ENTITY_TYPES.SUBJECT)
    .map((entity) => {
      const components = componentMap.get(entity.id);
      return {
        id: entity.id,
        name: components?.get("title")?.title ?? "Subject",
        color: components?.get("color")?.color ?? "#3b82f6",
        source: "subject",
      };
    });
  const subjects = [...todoSubjects, ...studySubjects];
  const subjectNameById = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const nodes = raw.entities
    .filter((entity) => entity.type === ENTITY_TYPES.TODO)
    .map((entity) => {
      const components = componentMap.get(entity.id);
      const tagIds = asArray(components?.get("tag")?.tags);
      return {
        id: entity.id,
        title: components?.get("title")?.title ?? "Untitled",
        status: components?.get("status")?.status ?? "todo",
        color: components?.get("color")?.color ?? "",
        subjectId: components?.get("subject")?.subjectId ?? null,
        subject: subjectNameById.get(components?.get("subject")?.subjectId) ?? null,
        parentId: components?.get("parentTodo")?.parentId ?? null,
        tags: tagIds.map((id) => tagNameById.get(id) ?? id),
        createdAt: entity.createdAt,
        subtasks: [] as any[],
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt);

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const taskTrees: typeof nodes = [];
  nodes.forEach((node) => {
    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (parent) parent.subtasks.push(node);
    else taskTrees.push(node);
  });

  return { tags, subjects, taskTrees };
}

function flattenReadableItems(readable: ReturnType<typeof toReadableWorkspace>): ReadableItem[] {
  const items: ReadableItem[] = [];

  readable.ideas.tags.forEach((tag) => items.push({ key: `ideas/tag/${tag.id}`, label: `Idea dump > tag "${tag.name}"`, value: tag }));
  readable.ideas.folders.forEach((folder: any) => items.push({ key: `ideas/folder/${folder.id}`, label: `Idea dump > folder "${folder.name}"`, value: folder }));
  readable.ideas.ideas.forEach((idea) => items.push({ key: `ideas/card/${idea.id}`, label: `Idea dump > card "${preview(idea.content)}"`, value: idea }));

  readable.todos.tags.forEach((tag) => items.push({ key: `todos/tag/${tag.id}`, label: `Todos > tag "${tag.name}"`, value: tag }));
  readable.todos.subjects.forEach((subject) => items.push({ key: `todos/subject/${subject.id}`, label: `Todos > subject "${subject.name}"`, value: subject }));
  flattenTasks(readable.todos.taskTrees).forEach((task) => {
    items.push({ key: `todos/task/${task.id}`, label: `Todos > task "${task.title}"`, value: task });
  });

  readable.studyPage.items.forEach((item) => {
    const noun = item.type === "folder" ? "folder" : `${item.type} card`;
    items.push({ key: `study/${item.id}`, label: `Study page > ${noun} "${item.name}"`, value: item });
  });

  return items;
}

function flattenTasks(tasks: any[]): any[] {
  return tasks.flatMap((task) => [task, ...flattenTasks(task.subtasks ?? [])]);
}

function groupComponents(components: Component[]) {
  const groups = new Map<string, Map<string, any>>();
  components.forEach((component) => {
    const entityComponents = groups.get(component.entityId) ?? new Map<string, any>();
    entityComponents.set(component.type, component.data ?? {});
    groups.set(component.entityId, entityComponents);
  });
  return groups;
}

function cleanTag(tag: any) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    isSpecial: !!tag.isSpecial,
    verified: !!tag.verified,
    subtags: Array.isArray(tag.subtags) ? tag.subtags : [],
  };
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function preview(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Untitled";
  return trimmed.length > 48 ? `${trimmed.slice(0, 45)}...` : trimmed;
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.keys(value)
    .sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(",")}}`;
}
