import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES, type Component, type Entity } from "@/ecs/entities";
import { getDB } from "@/ecs/store";
import { studyStorage } from "@/lib/study-storage";

export type Subject = {
  id: string;
  aliases: string[];
  name: string;
  color: string;
  healthyWhenEmpty: boolean;
  order: number;
  createdAt: number;
  source: "subject" | "study-folder";
  parentId: string | null;
};

export type TodoNode = {
  entity: Entity;
  title: string;
  status: string;
  color: string;
  tags: string[];
  subjectId: string | null;
  parentId: string | null;
  children: TodoNode[];
};

export type ProgressStats = {
  total: number;
  done: number;
  percent: number;
};

const getComp = (components: Component[], entityId: string, type: string) =>
  components.find((component) => component.entityId === entityId && component.type === type);

export function calculateNodeProgress(node: TodoNode): ProgressStats {
  if (node.children.length === 0) {
    const done = node.status === "done" ? 1 : 0;
    return { total: 1, done, percent: done * 100 };
  }

  const childStats = node.children.map(calculateNodeProgress);
  const total = childStats.reduce((sum, stat) => sum + stat.total, 0);
  const done = childStats.reduce((sum, stat) => sum + stat.done, 0);
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export async function getTodoTree(): Promise<TodoNode[]> {
  const [todos, components] = await Promise.all([
    ecsApi.getEntitiesByType(ENTITY_TYPES.TODO),
    ecsApi.getComponentsByEntityType(ENTITY_TYPES.TODO),
  ]);

  const nodes = new Map<string, TodoNode>();
  todos
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((todo) => {
      nodes.set(todo.id, {
        entity: todo,
        title: getComp(components, todo.id, "title")?.data?.title || "Untitled",
        status: getComp(components, todo.id, "status")?.data?.status || "todo",
        color: getComp(components, todo.id, "color")?.data?.color || "",
        tags: getComp(components, todo.id, "tag")?.data?.tags || [],
        subjectId: getComp(components, todo.id, "subject")?.data?.subjectId || null,
        parentId: getComp(components, todo.id, "parentTodo")?.data?.parentId || null,
        children: [],
      });
    });

  const roots: TodoNode[] = [];
  nodes.forEach((node) => {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  return roots;
}

export async function getSubjects(): Promise<Subject[]> {
  await studyStorage.ensureDefaults();

  const db = await getDB();
  const [subjects, studyItems, components, folderComponents] = await Promise.all([
    ecsApi.getEntitiesByType(ENTITY_TYPES.SUBJECT),
    db.getAll("studyItems"),
    ecsApi.getComponentsByEntityType(ENTITY_TYPES.SUBJECT),
    ecsApi.getComponentsByEntityType(ENTITY_TYPES.STUDY_FOLDER),
  ]);

  const todoSubjects = subjects.map((subject) => ({
      id: subject.id,
      aliases: [subject.id],
      name: getComp(components, subject.id, "title")?.data?.title || "Untitled Subject",
      color: getComp(components, subject.id, "color")?.data?.color || "#3b82f6",
      healthyWhenEmpty: true,
      order: getComp(components, subject.id, "metadata")?.data?.order ?? subject.createdAt,
      createdAt: subject.createdAt,
      source: "subject" as const,
      parentId: null,
    }));

  const studySubjects = studyItems
    .filter((item) => item.type === "folder")
    .map((folder) => ({
      id: folder.id,
      aliases: [folder.id],
      name: folder.name || getComp(folderComponents, folder.id, "title")?.data?.title || "Study folder",
      color: folder.color || getComp(folderComponents, folder.id, "color")?.data?.color || "#3b82f6",
      healthyWhenEmpty: true,
      order: folder.order ?? getComp(folderComponents, folder.id, "metadata")?.data?.order ?? 0,
      createdAt: Date.parse(folder.createdAt) || Date.now(),
      source: "study-folder" as const,
      parentId: folder.parentId || getComp(folderComponents, folder.id, "metadata")?.data?.parentId || null,
    }));

  const byName = new Map<string, Subject>();
  for (const subject of [...todoSubjects, ...studySubjects]) {
    const key = subject.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, subject);
      continue;
    }

    const keeper = existing.source === "study-folder" ? existing : subject;
    const other = keeper === existing ? subject : existing;
    byName.set(key, {
      ...keeper,
      aliases: Array.from(new Set([...keeper.aliases, other.id, ...other.aliases])),
      healthyWhenEmpty: keeper.healthyWhenEmpty || other.healthyWhenEmpty,
    });
  }

  return Array.from(byName.values())
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function createSubject(name: string, color: string): Promise<void> {
  const subject = await ecsApi.createEntity(ENTITY_TYPES.SUBJECT);
  await ecsApi.setComponent(subject.id, "title", { title: name });
  await ecsApi.setComponent(subject.id, "color", { color });
  await ecsApi.setComponent(subject.id, "metadata", {
    healthyWhenEmpty: true,
    order: subject.createdAt,
    source: "subject",
  });
}

export async function updateSubject(subject: Subject): Promise<void> {
  const existingMetadata = (await ecsApi.getComponent(subject.id, "metadata"))?.data ?? {};

  if (subject.source === "study-folder") {
    await studyStorage.renameItem(subject.id, subject.name);
    await studyStorage.changeColor(subject.id, subject.color);
  }

  await ecsApi.setComponent(subject.id, "title", { title: subject.name });
  await ecsApi.setComponent(subject.id, "color", { color: subject.color });
  await ecsApi.setComponent(subject.id, "metadata", {
    ...existingMetadata,
    healthyWhenEmpty: true,
    order: subject.order,
    source: subject.source,
  });
}

export async function deleteSubject(id: string): Promise<void> {
  const subjectLinks = await ecsApi.getEntitiesWithComponent("subject");
  await Promise.all(
    subjectLinks
      .filter((component) => component.data?.subjectId === id)
      .map((component) => ecsApi.deleteComponent(component.entityId, "subject"))
  );
  await ecsApi.deleteEntity(id);
}

export async function updateSubjectOrder(ids: string[]): Promise<void> {
  const subjects = await getSubjects();
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  await Promise.all(
    ids.map((id, index) => {
      const subject = byId.get(id);
      if (!subject) return Promise.resolve();
      return updateSubject({ ...subject, order: index });
    })
  );
}

export async function deleteTodoTree(id: string): Promise<void> {
  const childLinks = await ecsApi.getEntitiesWithComponent("parentTodo");
  const childIds = childLinks
    .filter((component) => component.data?.parentId === id)
    .map((component) => component.entityId);

  for (const childId of childIds) {
    await deleteTodoTree(childId);
  }

  await ecsApi.deleteEntity(id);
}

export async function reconcileTodoAncestors(parentId: string | null): Promise<void> {
  if (!parentId) return;

  const todoTree = await getTodoTree();
  const todos = flattenTodos(todoTree);
  const byId = new Map(todos.map((todo) => [todo.entity.id, todo]));

  let current = byId.get(parentId);
  while (current) {
    if (current.children.length > 0) {
      const progress = calculateNodeProgress(current);
      const nextStatus = progress.percent === 100 ? "done" : "todo";
      if (current.status !== nextStatus) {
        await ecsApi.setComponent(current.entity.id, "status", { status: nextStatus });
      }
    }
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
}

export async function setTodoTreeStatus(id: string, status: string): Promise<void> {
  const childLinks = await ecsApi.getEntitiesWithComponent("parentTodo");
  const childIds = childLinks
    .filter((component) => component.data?.parentId === id)
    .map((component) => component.entityId);

  await ecsApi.setComponent(id, "status", { status });

  for (const childId of childIds) {
    await setTodoTreeStatus(childId, status);
  }
}

export function flattenTodos(nodes: TodoNode[]): TodoNode[] {
  return nodes.flatMap((node) => [node, ...flattenTodos(node.children)]);
}
