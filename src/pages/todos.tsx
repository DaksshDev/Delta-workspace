import { useEffect, useMemo, useState, type CSSProperties } from "react";
import confetti from "canvas-confetti";
import { Check, CheckCircle2, ChevronDown, ChevronRight, Folder, MoreVertical, Palette, Plus, Tags, Trash2, X } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES } from "@/ecs/entities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TagEditor } from "@/components/tag-editor";
import { cn, getContrastColor } from "@/lib/utils";
import { tagsApi } from "@/lib/tags-api";
import type { TagDef } from "@/types/tags";
import {
  calculateNodeProgress,
  createSubject,
  deleteTodoTree,
  getSubjects,
  getTodoTree,
  reconcileTodoAncestors,
  setTodoTreeStatus,
  updateSubject,
  type Subject,
  type TodoNode,
} from "@/lib/progress-api";

const DEFAULT_SUBJECT_COLOR = "#3b82f6";

export function Todos() {
  const [todos, setTodos] = useState<TodoNode[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tags, setTags] = useState<TagDef[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [subjectFolders, setSubjectFolders] = useState<Record<string, boolean>>({});
  const [revision, setRevision] = useState(0);

  const refresh = () => setRevision((value) => value + 1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [todoTree, subjectList, tagList] = await Promise.all([
        getTodoTree(),
        getSubjects(),
        tagsApi.getTags(),
      ]);
      if (!cancelled) {
        setTodos(todoTree);
        setSubjects(subjectList);
        setTags(tagList);
      }
    }
    load();
    const handleDataChange = () => refresh();
    window.addEventListener("delta-data-changed", handleDataChange);
    return () => {
      cancelled = true;
      window.removeEventListener("delta-data-changed", handleDataChange);
    };
  }, [revision]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const todo = await ecsApi.createEntity(ENTITY_TYPES.TODO);
    await ecsApi.setComponent(todo.id, "title", { title: newTitle.trim() });
    await ecsApi.setComponent(todo.id, "status", { status: "todo" });
    setNewTitle("");
    refresh();
  };

  const groupedTodos = useMemo(() => buildSubjectGroups(todos, subjects), [todos, subjects]);
  const visibleGroups = useMemo(() => {
    if (subjectFilter === "all") return [];
    if (subjectFilter === "grouped") return groupedTodos.filter((group) => group.tasks.length > 0);
    return groupedTodos.filter((group) => group.id === subjectFilter && group.tasks.length > 0);
  }, [groupedTodos, subjectFilter]);

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Todos</h1>
          <p className="text-muted-foreground">Tasks, subtasks, and subject progress.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SubjectManager subjects={subjects} onRefresh={refresh} />
          <TagEditor api={tagsApi} dialogTitle="Todo Tag Manager" />
          <select
            className="h-8 rounded-md border bg-background px-3 text-xs"
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
          >
            <option value="all">All tasks</option>
            <option value="grouped">Group by subject</option>
            {groupedTodos.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
            <Input
              className="h-10"
              placeholder="What needs to be done?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
            <Button onClick={handleAdd} aria-label="Add task">
              <Plus className="h-4 w-4" />
            </Button>
        </div>
      </div>

      {todos.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium">No tasks</h3>
          <p className="text-sm text-muted-foreground mt-1">You're all caught up!</p>
        </div>
      ) : subjectFilter === "all" ? (
        <div className="space-y-3">
          {todos.map((todo) => (
            <TodoItem
              key={todo.entity.id}
              node={todo}
              level={0}
              allTags={tags}
              subjects={subjects}
              onRefresh={refresh}
            />
          ))}
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed">
          <Folder className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium">No tasks in this subject</h3>
          <p className="text-sm text-muted-foreground mt-1">Add a subject to a task from its menu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleGroups.map((group) => (
            <SubjectTaskFolder
              key={group.id}
              group={group}
              open={subjectFolders[group.id] ?? true}
              onToggle={() => setSubjectFolders((value) => ({ ...value, [group.id]: !(value[group.id] ?? true) }))}
              allTags={tags}
              subjects={subjects}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type SubjectTaskGroup = {
  id: string;
  name: string;
  color: string;
  tasks: TodoNode[];
};

function SubjectTaskFolder({
  group,
  open,
  onToggle,
  allTags,
  subjects,
  onRefresh,
}: {
  group: SubjectTaskGroup;
  open: boolean;
  onToggle: () => void;
  allTags: TagDef[];
  subjects: Subject[];
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card" style={{ borderColor: group.color === "transparent" ? undefined : `${group.color}66` }}>
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={onToggle}>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="min-w-0 flex-1 truncate font-semibold">{group.name}</span>
        <Badge variant="secondary" className="rounded-full">{group.tasks.length}</Badge>
      </button>
      {open && (
        <div className="space-y-2 border-t p-3">
          {group.tasks.map((todo) => (
            <TodoItem
              key={todo.entity.id}
              node={todo}
              level={0}
              allTags={allTags}
              subjects={subjects}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubjectManager({ subjects, onRefresh }: { subjects: Subject[]; onRefresh: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_SUBJECT_COLOR);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createSubject(name.trim(), color);
    setName("");
    onRefresh();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Tags className="h-4 w-4" />
          Subjects
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end">
        <div className="border-b p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Subject Tags</div>
            <Badge variant="secondary" className="rounded-full">{subjects.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Physics, Maths..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 w-9 p-0" style={{ backgroundColor: color }} />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3">
                <HexColorPicker color={color} onChange={setColor} />
              </PopoverContent>
            </Popover>
            <Button size="icon" onClick={handleCreate} className="h-9 w-9">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[340px]">
          <div className="p-3 space-y-2">
            {subjects.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No subjects yet.</p>
            )}
            {subjects.map((subject) => (
              <SubjectManagerRow key={subject.id} subject={subject} onRefresh={onRefresh} />
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function SubjectManagerRow({ subject, onRefresh }: { subject: Subject; onRefresh: () => void }) {
  const [name, setName] = useState(subject.name);
  const [color, setColor] = useState(subject.color);

  useEffect(() => {
    setName(subject.name);
    setColor(subject.color);
  }, [subject.name, subject.color]);

  const save = async (updates: Partial<Subject> = {}) => {
    await updateSubject({ ...subject, name, color, ...updates });
    onRefresh();
  };

  return (
    <div className="rounded-md border bg-background/40 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <Input className="h-8" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => save()} />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="end">
            <HexColorPicker color={color} onChange={setColor} />
            <Button className="mt-3 w-full" size="sm" onClick={() => save()}>
              Apply color
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function TodoItem({
  node,
  level,
  inheritedColor,
  allTags,
  subjects,
  onRefresh,
}: {
  node: TodoNode;
  level: number;
  inheritedColor?: string;
  allTags: TagDef[];
  subjects: Subject[];
  onRefresh: () => void;
}) {
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const progress = useMemo(() => calculateNodeProgress(node), [node]);
  const subtaskCount = useMemo(() => countDescendants(node), [node]);
  const showProgress = node.children.length > 0;
  const isDone = node.status === "done";
  const hasChildren = node.children.length > 0;
  const detailIndent = hasChildren ? "pl-9 sm:pl-16" : "pl-7";
  const subject = subjects.find((item) => node.subjectId && item.aliases.includes(node.subjectId));
  const effectiveColor = inheritedColor || node.color;
  const descendantColor = effectiveColor || node.color;
  const specialTags = node.tags
    .map((id) => allTags.find((tag) => tag.id === id))
    .filter((tag): tag is TagDef => !!tag?.isSpecial);

  const toggleStatus = async () => {
    const newStatus = isDone ? "todo" : "done";
    if (node.children.length > 0) {
      await setTodoTreeStatus(node.entity.id, newStatus);
    } else {
      await ecsApi.setComponent(node.entity.id, "status", { status: newStatus });
    }
    if (newStatus === "done") {
      confetti({
        particleCount: 100,
        spread: 65,
        origin: { y: 0.7 },
        colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"],
      });
    }
    await reconcileTodoAncestors(node.parentId);
    onRefresh();
  };

  const renameTask = async (title: string) => {
    if (!title.trim()) return;
    await ecsApi.setComponent(node.entity.id, "title", { title: title.trim() });
    onRefresh();
  };

  const addSubtask = async () => {
    if (!subtaskTitle.trim()) return;
    const todo = await ecsApi.createEntity(ENTITY_TYPES.TODO);
    await ecsApi.setComponent(todo.id, "title", { title: subtaskTitle.trim() });
    await ecsApi.setComponent(todo.id, "status", { status: "todo" });
    await ecsApi.setComponent(todo.id, "parentTodo", { parentId: node.entity.id });
    if (node.subjectId) await ecsApi.setComponent(todo.id, "subject", { subjectId: node.subjectId });
    if (descendantColor) await ecsApi.setComponent(todo.id, "color", { color: descendantColor });
    if (node.status === "done") await ecsApi.setComponent(node.entity.id, "status", { status: "todo" });
    await reconcileTodoAncestors(node.entity.id);
    setSubtaskTitle("");
    setShowSubtaskInput(false);
    setExpanded(true);
    await reconcileTodoAncestors(node.entity.id);
    onRefresh();
  };

  const toggleTag = async (tagId: string) => {
    const tags = node.tags.includes(tagId)
      ? node.tags.filter((id) => id !== tagId)
      : [...node.tags, tagId];
    await ecsApi.setComponent(node.entity.id, "tag", { tags });
    setActiveTagId(null);
    onRefresh();
  };

  const setSubject = async (subjectId: string) => {
    if (!subjectId) await ecsApi.deleteComponent(node.entity.id, "subject");
    else await ecsApi.setComponent(node.entity.id, "subject", { subjectId });
    onRefresh();
  };

  const setColor = async (color: string) => {
    await ecsApi.setComponent(node.entity.id, "color", { color });
    onRefresh();
  };

  const cardSurface = taskSurface(effectiveColor);
  const borderStyle: CSSProperties = specialTags.length
    ? {
        borderColor: "transparent",
        background: `${cardSurface} padding-box, ${splitBorderGradient(specialTags)} border-box`,
        boxShadow: specialTags.map((tag) => `0 0 14px ${tag.color}35`).join(", "),
      }
    : {
        borderColor: effectiveColor ? `${effectiveColor}88` : undefined,
        background: cardSurface,
      };

  return (
    <div className={cn("relative space-y-2", level > 0 && "ml-5 pl-5 sm:ml-7 sm:pl-6")}>
      {level > 0 && (
        <>
          <span className="absolute bottom-3 left-0 top-0 w-px bg-border" style={{ backgroundColor: effectiveColor ? `${effectiveColor}77` : undefined }} />
          <span className="absolute left-0 top-6 h-px w-5 sm:w-6 bg-border" style={{ backgroundColor: effectiveColor ? `${effectiveColor}77` : undefined }} />
        </>
      )}
      <Card
        className={cn(
          "group/task overflow-hidden rounded-lg border shadow-none transition-all hover:-translate-y-0.5 hover:shadow-lg",
          !effectiveColor && !specialTags.length && "border-border"
        )}
        style={borderStyle}
      >
        <CardContent className="p-3 space-y-3">
          <div className="flex items-start gap-2">
            {hasChildren && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-8 shrink-0 flex-col gap-0 px-0"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="text-[10px] leading-none text-muted-foreground">{subtaskCount}</span>
              </Button>
            )}
            <Checkbox checked={isDone} onCheckedChange={toggleStatus} className="h-5 w-5" />
            <div className="min-w-0 flex-1">
              <span className={cn("block break-words pt-1 text-sm font-medium leading-5", isDone && "line-through text-muted-foreground")}>
                {node.title}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSubtaskInput((value) => !value)}>
              <Plus className="h-4 w-4" />
            </Button>
            <TodoMenu
              node={node}
              subjects={subjects}
              allTags={allTags}
              onRename={renameTask}
              onTagToggle={toggleTag}
              onSubjectChange={setSubject}
              onColorChange={setColor}
              onDelete={async () => {
                const parentId = node.parentId;
                await deleteTodoTree(node.entity.id);
                await reconcileTodoAncestors(parentId);
                onRefresh();
              }}
            />
            </div>
          </div>

          {(showProgress || node.tags.length > 0 || subject) && (
          <div className={cn("space-y-2", detailIndent)}>
            {showProgress && (
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress.percent}%`, backgroundColor: subject?.color }}
                />
              </div>
              <span className="w-20 text-right text-xs text-muted-foreground">
                {progress.percent}% - {progress.done}/{progress.total}
              </span>
            </div>
            )}
            <div className="flex min-h-6 flex-wrap items-center gap-2">
              {node.tags.map((tagId) => {
                const tag = allTags.find((item) => item.id === tagId);
                if (!tag) return null;
                return (
                  <button
                    type="button"
                    key={tag.id}
                    className={cn(
                      "group/tag inline-flex h-6 items-center gap-1 overflow-hidden rounded-full border px-2 text-[10px] font-bold transition-all hover:pr-1 focus:pr-1 active:pr-1",
                      activeTagId === tag.id && "pr-1",
                      tag.isSpecial && "shadow-lg"
                    )}
                    style={{
                      backgroundColor: tag.color,
                      borderColor: tag.color,
                      color: getContrastColor(tag.color),
                      boxShadow: tag.isSpecial ? `0 0 12px ${tag.color}80` : undefined,
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveTagId((current) => current === tag.id ? null : tag.id);
                    }}
                  >
                    <span>{tag.name}</span>
                    <span
                      className={cn(
                        "grid h-4 w-4 max-w-0 place-items-center overflow-hidden rounded-full bg-black/25 opacity-0 transition-all group-hover/tag:max-w-4 group-hover/tag:opacity-100 group-focus/tag:max-w-4 group-focus/tag:opacity-100",
                        activeTagId === tag.id && "max-w-4 opacity-100"
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleTag(tag.id);
                      }}
                      aria-label={`Remove ${tag.name}`}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
              {subject && (
                <Badge
                  className="ml-auto rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: subject.color, color: getContrastColor(subject.color) }}
                >
                  {subject.name}
                </Badge>
              )}
            </div>
          </div>
          )}

          {showSubtaskInput && (
            <div className={cn("flex items-center gap-2", detailIndent)}>
              <Input
                placeholder="Add a subtask..."
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addSubtask();
                  if (e.key === "Escape") setShowSubtaskInput(false);
                }}
                autoFocus
              />
              <Button size="sm" onClick={addSubtask}>Add</Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setShowSubtaskInput(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {expanded && node.children.length > 0 && (
        <div className="space-y-2">
          {node.children.map((child) => (
            <TodoItem
              key={child.entity.id}
              node={child}
              level={level + 1}
              inheritedColor={descendantColor}
              allTags={allTags}
              subjects={subjects}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TodoMenu({
  node,
  subjects,
  allTags,
  onRename,
  onTagToggle,
  onSubjectChange,
  onColorChange,
  onDelete,
}: {
  node: TodoNode;
  subjects: Subject[];
  allTags: TagDef[];
  onRename: (title: string) => void;
  onTagToggle: (tagId: string) => void;
  onSubjectChange: (subjectId: string) => void;
  onColorChange: (color: string) => void;
  onDelete: () => Promise<void>;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [color, setColor] = useState(node.color || "#3b82f6");

  useEffect(() => {
    setTitle(node.title);
    setColor(node.color || "#3b82f6");
  }, [node.title, node.color]);

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="end">
          <div className="grid gap-1">
            <Button variant="ghost" className="justify-start" onClick={() => { setMenuOpen(false); setRenameOpen(true); }}>Rename task</Button>
            <Button variant="ghost" className="justify-start" onClick={() => { setMenuOpen(false); setColorOpen(true); }}>Change task color</Button>
            <Button variant="ghost" className="justify-start" onClick={() => { setMenuOpen(false); setTagsOpen(true); }}>Add tags</Button>
            <Button variant="ghost" className="justify-start" onClick={() => { setMenuOpen(false); setSubjectOpen(true); }}>Add subject</Button>
            <Button variant="ghost" className="justify-start text-destructive" onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}>
              Delete task tree
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename task</DialogTitle></DialogHeader>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onRename(title);
                setRenameOpen(false);
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={() => { onRename(title); setRenameOpen(false); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={colorOpen} onOpenChange={setColorOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader><DialogTitle>Change task color</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <HexColorPicker color={color} onChange={setColor} />
            <Input value={color} onChange={(event) => setColor(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColorOpen(false)}>Cancel</Button>
            <Button onClick={() => { onColorChange(color); setColorOpen(false); }}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add tags</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[360px] pr-3">
            <div className="space-y-2">
              {allTags.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No tags yet.</p>}
              {allTags.map((tag) => (
                <button
                  key={tag.id}
                  className={cn("flex w-full items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted", node.tags.includes(tag.id) && "bg-muted")}
                  onClick={() => onTagToggle(tag.id)}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 text-left">{tag.name}</span>
                  {node.tags.includes(tag.id) && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setTagsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subjectOpen} onOpenChange={setSubjectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add subject</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[360px] pr-3">
            <div className="space-y-2">
              <button
                className={cn("flex w-full items-center rounded-md border p-3 text-sm hover:bg-muted", !node.subjectId && "bg-muted")}
                onClick={() => onSubjectChange("")}
              >
                <span className="flex-1 text-left">No subject</span>
                {!node.subjectId && <Check className="h-4 w-4" />}
              </button>
              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  className={cn("flex w-full items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted", node.subjectId && subject.aliases.includes(node.subjectId) && "bg-muted")}
                  onClick={() => onSubjectChange(subject.id)}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} />
                  <span className="flex-1 text-left">{subject.name}</span>
                  {node.subjectId && subject.aliases.includes(node.subjectId) && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setSubjectOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete task tree?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This deletes this task and every subtask under it.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await onDelete();
                setDeleteOpen(false);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function splitBorderGradient(tags: TagDef[]) {
  const slice = 100 / tags.length;
  const stops = tags.flatMap((tag, index) => {
    const start = index * slice;
    const end = (index + 1) * slice;
    return [`${tag.color} ${start}%`, `${tag.color} ${end}%`];
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

function taskSurface(color?: string) {
  if (!color) return "linear-gradient(hsl(var(--card)), hsl(var(--card)))";
  return `linear-gradient(color-mix(in srgb, ${color} 18%, hsl(var(--card))), color-mix(in srgb, ${color} 18%, hsl(var(--card))))`;
}

function countDescendants(node: TodoNode): number {
  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}

function buildSubjectGroups(todos: TodoNode[], subjects: Subject[]): SubjectTaskGroup[] {
  const allTodos = flattenTodoNodes(todos);
  const byId = new Map(allTodos.map((todo) => [todo.entity.id, todo]));

  const groups = subjects.map((subject) => {
    const subjectIds = new Set([subject.id, ...subject.aliases]);
    const tasks = allTodos.filter((todo) => {
      if (!todo.subjectId || !subjectIds.has(todo.subjectId)) return false;
      const parent = todo.parentId ? byId.get(todo.parentId) : null;
      return !parent?.subjectId || !subjectIds.has(parent.subjectId);
    });

    return {
      id: subject.id,
      name: subject.name,
      color: subject.color,
      tasks,
    };
  });

  const unassigned = allTodos.filter((todo) => {
    if (todo.subjectId) return false;
    const parent = todo.parentId ? byId.get(todo.parentId) : null;
    return !!todo.parentId ? !!parent?.subjectId : true;
  });

  return [
    ...groups,
    {
      id: "__no_subject__",
      name: "No subject",
      color: "hsl(var(--muted-foreground))",
      tasks: unassigned,
    },
  ];
}

function flattenTodoNodes(nodes: TodoNode[]): TodoNode[] {
  return nodes.flatMap((node) => [node, ...flattenTodoNodes(node.children)]);
}
