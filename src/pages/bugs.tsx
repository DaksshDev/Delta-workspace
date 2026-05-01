import { useEffect, useMemo, useState, type DragEvent } from "react";
import confetti from "canvas-confetti";
import { Bug as BugIcon, Check, Flame, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES, type Component, type Entity } from "@/ecs/entities";
import { cn } from "@/lib/utils";

type BugSeverity = "normal" | "critical" | "breaking";

type BugItem = {
  entity: Entity;
  title: string;
  status: "open" | "done";
  severity: BugSeverity;
};

const BUG_FOLDERS: Array<{
  id: BugSeverity;
  name: string;
  color: string;
  icon: typeof BugIcon;
}> = [
  { id: "normal", name: "Normal Bug", color: "#3b82f6", icon: BugIcon },
  { id: "critical", name: "Critical Bug", color: "#f59e0b", icon: ShieldAlert },
  { id: "breaking", name: "App Breaking", color: "#ef4444", icon: Flame },
];

const getComp = (components: Component[], entityId: string, type: string) =>
  components.find((component) => component.entityId === entityId && component.type === type);

export function Bugs() {
  const [bugs, setBugs] = useState<BugItem[]>([]);
  const [drafts, setDrafts] = useState<Record<BugSeverity, string>>({
    normal: "",
    critical: "",
    breaking: "",
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refresh = () => setRevision((value) => value + 1);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [bugEntities, components] = await Promise.all([
        ecsApi.getEntitiesByType(ENTITY_TYPES.BUG),
        ecsApi.getComponentsByEntityType(ENTITY_TYPES.BUG),
      ]);

      if (cancelled) return;
      setBugs(
        bugEntities
          .slice()
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((entity) => ({
            entity,
            title: getComp(components, entity.id, "title")?.data?.title || "Untitled bug",
            status: getComp(components, entity.id, "status")?.data?.status === "done" ? "done" : "open",
            severity: normalizeSeverity(getComp(components, entity.id, "metadata")?.data?.severity),
          }))
      );
    }

    load();
    const handleDataChange = () => refresh();
    window.addEventListener("delta-data-changed", handleDataChange);
    return () => {
      cancelled = true;
      window.removeEventListener("delta-data-changed", handleDataChange);
    };
  }, [revision]);

  const grouped = useMemo(
    () =>
      BUG_FOLDERS.map((folder) => ({
        ...folder,
        bugs: bugs.filter((bug) => bug.severity === folder.id),
      })),
    [bugs]
  );

  const addBug = async (severity: BugSeverity) => {
    const title = drafts[severity].trim();
    if (!title) return;

    const bug = await ecsApi.createEntity(ENTITY_TYPES.BUG);
    await ecsApi.setComponent(bug.id, "title", { title });
    await ecsApi.setComponent(bug.id, "status", { status: "open" });
    await ecsApi.setComponent(bug.id, "metadata", { severity });
    setDrafts((value) => ({ ...value, [severity]: "" }));
    refresh();
  };

  const toggleBug = async (bug: BugItem) => {
    const nextStatus = bug.status === "done" ? "open" : "done";
    await ecsApi.setComponent(bug.entity.id, "status", { status: nextStatus });
    if (nextStatus === "done") {
      confetti({
        particleCount: 100,
        spread: 65,
        origin: { y: 0.7 },
        colors: ["#3b82f6", "#f59e0b", "#ef4444", "#22c55e"],
      });
    }
    refresh();
  };

  const moveBug = async (severity: BugSeverity) => {
    if (!dragId) return;
    await ecsApi.setComponent(dragId, "metadata", { severity });
    setDragId(null);
    refresh();
  };

  const deleteBug = async (id: string) => {
    await ecsApi.deleteEntity(id);
    refresh();
  };

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bug Tracker</h1>
        <p className="text-muted-foreground">Track issues by severity, check them off, and drag them between folders.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {grouped.map((folder) => (
          <BugFolder
            key={folder.id}
            folder={folder}
            draft={drafts[folder.id]}
            dragging={!!dragId}
            onDraftChange={(value) => setDrafts((draft) => ({ ...draft, [folder.id]: value }))}
            onAdd={() => addBug(folder.id)}
            onDragStart={setDragId}
            onDrop={() => moveBug(folder.id)}
            onToggle={toggleBug}
            onDelete={deleteBug}
          />
        ))}
      </div>
    </div>
  );
}

function BugFolder({
  folder,
  draft,
  dragging,
  onDraftChange,
  onAdd,
  onDragStart,
  onDrop,
  onToggle,
  onDelete,
}: {
  folder: (typeof BUG_FOLDERS)[number] & { bugs: BugItem[] };
  draft: string;
  dragging: boolean;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onDragStart: (id: string) => void;
  onDrop: () => void;
  onToggle: (bug: BugItem) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = folder.icon;
  const openCount = folder.bugs.filter((bug) => bug.status === "open").length;

  return (
    <section
      className={cn("rounded-lg border bg-card transition-colors", dragging && "border-dashed")}
      style={{ borderColor: `${folder.color}66` }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-3 border-b p-4">
        <div className="grid h-9 w-9 place-items-center rounded-md" style={{ backgroundColor: `${folder.color}22`, color: folder.color }}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{folder.name}</h2>
          <p className="text-xs text-muted-foreground">{openCount} open / {folder.bugs.length} total</p>
        </div>
        <Badge variant={folder.id === "breaking" ? "destructive" : "secondary"} className="rounded-full">
          {folder.bugs.length}
        </Badge>
      </div>

      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            placeholder={`Add ${folder.name.toLowerCase()}...`}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onAdd();
            }}
          />
          <Button size="icon" onClick={onAdd} aria-label={`Add ${folder.name}`}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {folder.bugs.length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              No bugs here.
            </div>
          ) : (
            folder.bugs.map((bug) => (
              <BugRow
                key={bug.entity.id}
                bug={bug}
                color={folder.color}
                onDragStart={() => onDragStart(bug.entity.id)}
                onToggle={() => onToggle(bug)}
                onDelete={() => onDelete(bug.entity.id)}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function BugRow({
  bug,
  color,
  onDragStart,
  onToggle,
  onDelete,
}: {
  bug: BugItem;
  color: string;
  onDragStart: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      className={cn("cursor-grab rounded-md shadow-none active:cursor-grabbing", bug.status === "done" && "opacity-60")}
      style={{ borderColor: `${color}55` }}
    >
      <CardContent className="flex items-center gap-3 p-3">
        <Checkbox checked={bug.status === "done"} onCheckedChange={onToggle} />
        <span className={cn("min-w-0 flex-1 break-words text-sm font-medium", bug.status === "done" && "line-through text-muted-foreground")}>
          {bug.title}
        </span>
        {bug.status === "done" && <Check className="h-4 w-4 text-green-500" />}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function normalizeSeverity(value: unknown): BugSeverity {
  if (value === "critical" || value === "breaking" || value === "normal") return value;
  return "normal";
}
