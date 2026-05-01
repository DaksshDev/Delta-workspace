import { useEffect, useMemo, useState, type DragEvent } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FolderTree,
  GripVertical,
  PieChart,
  Tags,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, getContrastColor } from "@/lib/utils";
import {
  calculateNodeProgress,
  flattenTodos,
  getSubjects,
  getTodoTree,
  updateSubjectOrder,
  type Subject,
  type TodoNode,
} from "@/lib/progress-api";
import { FaFolder } from "react-icons/fa";

type SortMode = "custom" | "percent" | "done" | "tasks" | "created";
type TaskFilter = "all" | "open" | "done";

type SubjectStats = {
  subject: Subject;
  children: SubjectStats[];
  tasks: TodoNode[];
  directTotal: number;
  directDone: number;
  total: number;
  done: number;
  percent: number;
};

export function Progress() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [todos, setTodos] = useState<TodoNode[]>([]);
  const [sort, setSort] = useState<SortMode>("custom");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [chartSubjectId, setChartSubjectId] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refresh = () => setRevision((value) => value + 1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [subjectList, todoTree] = await Promise.all([getSubjects(), getTodoTree()]);
      if (!cancelled) {
        setSubjects(subjectList);
        setTodos(todoTree);
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

  const allTodos = useMemo(() => flattenTodos(todos), [todos]);
  const flatStats = useMemo(() => buildSubjectStats(subjects, allTodos), [subjects, allTodos]);
  const rootStats = useMemo(() => buildStatsTree(flatStats), [flatStats]);
  const sortedRootStats = useMemo(() => sortStats(rootStats, sort), [rootStats, sort]);
  const allStats = useMemo(() => flattenStats(rootStats), [rootStats]);
  const selectedStat = useMemo(
    () => (chartSubjectId === "all" ? null : allStats.find((stat) => stat.subject.id === chartSubjectId) ?? null),
    [allStats, chartSubjectId]
  );
  const chartScope = selectedStat ? [selectedStat] : rootStats;
  const chartRows = selectedStat?.children.length ? selectedStat.children : chartScope;
  const overall = useMemo(() => summarize(chartScope), [chartScope]);
  const analysis = useMemo(() => buildAnalysis(chartRows), [chartRows]);

  const moveSubject = async (targetId: string) => {
    if (!dragId || dragId === targetId || sort !== "custom") return;
    const ids = subjects.map((subject) => subject.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setSubjects(ids.map((id) => subjects.find((subject) => subject.id === id)!).filter(Boolean));
    await updateSubjectOrder(ids);
    setDragId(null);
    refresh();
  };

  return (
    <div className="space-y-5 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
          <p className="text-muted-foreground">Subject groups, task trees, and completion analysis.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="custom">Custom order</option>
            <option value="percent">% completed</option>
            <option value="done">Tasks done</option>
            <option value="tasks">Task count</option>
            <option value="created">Date created</option>
          </select>
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={taskFilter} onChange={(e) => setTaskFilter(e.target.value as TaskFilter)}>
            <option value="all">All tasks</option>
            <option value="open">Open tasks</option>
            <option value="done">Done tasks</option>
          </select>
        </div>
      </div>

      <Tabs defaultValue="subjects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subjects" className="gap-2">
            <FolderTree className="h-4 w-4" />
            Subjects
          </TabsTrigger>
          <TabsTrigger value="charts" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Charts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="space-y-3">
          {subjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <Tags className="mb-4 h-12 w-12 text-muted-foreground opacity-20" />
              <h3 className="text-lg font-medium">No subjects yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Create subject tags from Todos to start tracking progress.</p>
            </div>
          ) : (
            sortedRootStats.map((stat) => (
              <SubjectFolder
                key={stat.subject.id}
                stat={stat}
                expanded={expanded}
                taskFilter={taskFilter}
                canDrag={sort === "custom"}
                dragging={dragId === stat.subject.id}
                onToggle={(id) => setExpanded((value) => ({ ...value, [id]: !(value[id] ?? false) }))}
                onDragStart={() => setDragId(stat.subject.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(event) => {
                  if (sort === "custom") event.preventDefault();
                }}
                onDrop={() => moveSubject(stat.subject.id)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Charts</h2>
              <p className="text-sm text-muted-foreground">View everything, a parent group like Science/SST, or one specific subject.</p>
            </div>
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={chartSubjectId} onChange={(e) => setChartSubjectId(e.target.value)}>
              <option value="all">All subject groups</option>
              {rootStats.map((root) => (
                <SubjectOption key={root.subject.id} stat={root} />
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Completion" value={`${overall.percent}%`} detail={`${overall.done}/${overall.total} done`} />
            <Metric label="Open" value={`${Math.max(overall.total - overall.done, 0)}`} detail="tasks remaining" />
            <Metric label="Tracked" value={`${overall.total}`} detail={selectedStat ? selectedStat.subject.name : "all groups"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PieChart className="h-4 w-4" />
                  Completion Split
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-[170px_1fr]">
                <div className="relative aspect-square rounded-full border" style={{ background: completionDonut(overall) }}>
                  <div className="absolute inset-[22%] grid place-items-center rounded-full bg-card text-center">
                    <div className="text-2xl font-bold">{overall.percent}%</div>
                    <div className="text-xs text-muted-foreground">done</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <LegendDot color="#22c55e" label="Done" value={overall.done} />
                  <LegendDot color="hsl(var(--muted))" label="Open" value={Math.max(overall.total - overall.done, 0)} />
                  {analysis.best && <LegendDot color={analysis.best.subject.color} label={`Best: ${analysis.best.subject.name}`} value={`${analysis.best.percent}%`} />}
                  {analysis.needsWork && <LegendDot color={analysis.needsWork.subject.color} label={`Needs work: ${analysis.needsWork.subject.name}`} value={`${analysis.needsWork.percent}%`} />}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  Subject Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {chartRows.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No chartable subjects yet.</p>
                ) : (
                  sortStats(chartRows, "tasks").map((stat) => <SubjectBar key={stat.subject.id} stat={stat} />)
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Analysis</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <AnalysisRow label="Most complete" stat={analysis.best} empty="No completed progress yet." />
              <AnalysisRow label="Needs attention" stat={analysis.needsWork} empty="No active weak spot yet." />
              <AnalysisRow label="Most work" stat={analysis.biggest} empty="No tracked workload yet." />
              <AnalysisRow label="Empty subjects" text={`${analysis.emptyCount} with no tracked tasks`} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SubjectOption({ stat, depth = 0 }: { stat: SubjectStats; depth?: number }) {
  return (
    <>
      <option value={stat.subject.id}>{`${"  ".repeat(depth)}${stat.subject.name}`}</option>
      {stat.children.map((child) => <SubjectOption key={child.subject.id} stat={child} depth={depth + 1} />)}
    </>
  );
}

function SubjectFolder({
  stat,
  expanded,
  taskFilter,
  canDrag,
  dragging,
  onToggle,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  stat: SubjectStats;
  expanded: Record<string, boolean>;
  taskFilter: TaskFilter;
  canDrag: boolean;
  dragging: boolean;
  onToggle: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
}) {
  const open = expanded[stat.subject.id] ?? false;
  const visibleTasks = stat.tasks.filter((task) => taskMatchesFilter(task, taskFilter));

  return (
    <div
      className={cn("rounded-lg border bg-card transition-opacity", dragging && "opacity-50")}
      draggable={canDrag}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ borderColor: `${stat.subject.color}66` }}
    >
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => onToggle(stat.subject.id)}>
        {canDrag && <GripVertical className="h-4 w-4 text-muted-foreground" />}
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <FaFolder className="text-muted-foreground" style={{ color: stat.subject.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{stat.subject.name}</span>
            {stat.children.length > 0 && <Badge variant="outline" className="text-[10px]">{stat.children.length} subs</Badge>}
            {stat.total === 0 && stat.subject.healthyWhenEmpty && <Badge variant="secondary" className="text-[10px]">healthy</Badge>}
          </div>
          <ProgressLine stat={stat} />
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div>{stat.done}/{stat.total}</div>
          <div className="text-xs">done</div>
        </div>
      </button>
      {open && (
        <div className="space-y-2 border-t p-3">
          {sortStats(stat.children, "custom").map((child) => (
            <SubjectFolder
              key={child.subject.id}
              stat={child}
              expanded={expanded}
              taskFilter={taskFilter}
              canDrag={false}
              dragging={false}
              onToggle={onToggle}
              onDragStart={() => undefined}
              onDragEnd={() => undefined}
              onDragOver={() => undefined}
              onDrop={() => undefined}
            />
          ))}
          {visibleTasks.length === 0 ? (
            stat.children.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No tasks match this filter.</p>
          ) : (
            visibleTasks.map((task) => <ProgressTask key={task.entity.id} node={task} subject={stat.subject} level={0} taskFilter={taskFilter} />)
          )}
        </div>
      )}
    </div>
  );
}

function ProgressTask({ node, subject, level, taskFilter }: { node: TodoNode; subject: Subject; level: number; taskFilter: TaskFilter }) {
  const [open, setOpen] = useState(true);
  if (!treeMatchesFilter(node, taskFilter)) return null;

  const progress = calculateNodeProgress(node);
  const done = node.status === "done";
  const visibleChildren = node.children.filter((child) => treeMatchesFilter(child, taskFilter));

  return (
    <div className="space-y-2" style={{ marginLeft: level ? Math.min(level * 18, 72) : 0 }}>
      <div className="rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={visibleChildren.length === 0} onClick={() => setOpen((value) => !value)}>
            {visibleChildren.length > 0 ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="h-4 w-4" />}
          </Button>
          {done ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
          <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", done && "line-through text-muted-foreground")}>{node.title}</span>
          <Badge className="rounded-full text-[10px]" style={{ backgroundColor: subject.color, color: getContrastColor(subject.color) }}>
            {progress.percent}%
          </Badge>
        </div>
        <div className="ml-16 mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${progress.percent}%`, backgroundColor: subject.color }} />
        </div>
      </div>
      {open && visibleChildren.map((child) => <ProgressTask key={child.entity.id} node={child} subject={subject} level={level + 1} taskFilter={taskFilter} />)}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <div className="mt-1 text-2xl font-bold">{value}</div>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function SubjectBar({ stat }: { stat: SubjectStats }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stat.subject.color }} />
          <span className="truncate font-medium">{stat.subject.name}</span>
        </div>
        <span className="text-muted-foreground">{stat.done}/{stat.total}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${stat.percent}%`, backgroundColor: stat.subject.color }} />
      </div>
    </div>
  );
}

function ProgressLine({ stat }: { stat: SubjectStats }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${stat.percent}%`, backgroundColor: stat.subject.color }} />
      </div>
      <span className="w-12 text-right text-xs text-muted-foreground">{stat.percent}%</span>
    </div>
  );
}

function LegendDot({ color, label, value }: { color: string; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

function AnalysisRow({ label, stat, text, empty }: { label: string; stat?: SubjectStats | null; text?: string; empty?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      {stat ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stat.subject.color }} />
            <span className="truncate font-medium">{stat.subject.name}</span>
          </div>
          <span className="text-sm text-muted-foreground">{stat.percent}% - {stat.done}/{stat.total}</span>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{text ?? empty}</p>
      )}
    </div>
  );
}

function buildSubjectStats(subjects: Subject[], allTodos: TodoNode[]): SubjectStats[] {
  const byId = new Map(allTodos.map((todo) => [todo.entity.id, todo]));
  return subjects.map((subject) => {
    const subjectIds = new Set([subject.id, ...subject.aliases]);
    const tasks = allTodos.filter((todo) => {
      if (!todo.subjectId || !subjectIds.has(todo.subjectId)) return false;
      const parent = todo.parentId ? byId.get(todo.parentId) : null;
      return !parent?.subjectId || !subjectIds.has(parent.subjectId);
    });
    const totals = tasks.map(calculateNodeProgress);
    const directTotal = totals.reduce((sum, stat) => sum + stat.total, 0);
    const directDone = totals.reduce((sum, stat) => sum + stat.done, 0);
    const percent = directTotal === 0 ? (subject.healthyWhenEmpty ? 100 : 0) : Math.round((directDone / directTotal) * 100);
    return { subject, children: [], tasks, directTotal, directDone, total: directTotal, done: directDone, percent };
  });
}

function buildStatsTree(stats: SubjectStats[]) {
  const byId = new Map(stats.map((stat) => [stat.subject.id, { ...stat, children: [] as SubjectStats[] }]));
  const roots: SubjectStats[] = [];

  byId.forEach((stat) => {
    const parent = stat.subject.parentId ? byId.get(stat.subject.parentId) : null;
    if (parent) parent.children.push(stat);
    else roots.push(stat);
  });

  const rollup = (stat: SubjectStats): SubjectStats => {
    stat.children = sortStats(stat.children.map(rollup), "custom");
    stat.total = stat.directTotal + stat.children.reduce((sum, child) => sum + child.total, 0);
    stat.done = stat.directDone + stat.children.reduce((sum, child) => sum + child.done, 0);
    stat.percent = stat.total === 0 ? (stat.subject.healthyWhenEmpty ? 100 : 0) : Math.round((stat.done / stat.total) * 100);
    return stat;
  };

  return roots.map(rollup);
}

function sortStats(stats: SubjectStats[], sort: SortMode) {
  const next = stats.slice();
  if (sort === "percent") next.sort((a, b) => b.percent - a.percent || a.subject.name.localeCompare(b.subject.name));
  if (sort === "done") next.sort((a, b) => b.done - a.done || a.subject.name.localeCompare(b.subject.name));
  if (sort === "tasks") next.sort((a, b) => b.total - a.total || a.subject.name.localeCompare(b.subject.name));
  if (sort === "created") next.sort((a, b) => b.subject.createdAt - a.subject.createdAt);
  if (sort === "custom") next.sort((a, b) => a.subject.order - b.subject.order || a.subject.name.localeCompare(b.subject.name));
  return next;
}

function flattenStats(stats: SubjectStats[]): SubjectStats[] {
  return stats.flatMap((stat) => [stat, ...flattenStats(stat.children)]);
}

function summarize(stats: SubjectStats[]) {
  const total = stats.reduce((sum, stat) => sum + stat.total, 0);
  const done = stats.reduce((sum, stat) => sum + stat.done, 0);
  return { total, done, percent: total === 0 ? 100 : Math.round((done / total) * 100) };
}

function buildAnalysis(stats: SubjectStats[]) {
  const active = stats.filter((stat) => stat.total > 0);
  return {
    best: active.slice().sort((a, b) => b.percent - a.percent || b.done - a.done)[0] ?? null,
    needsWork: active.slice().sort((a, b) => a.percent - b.percent || b.total - a.total)[0] ?? null,
    biggest: active.slice().sort((a, b) => b.total - a.total || a.subject.name.localeCompare(b.subject.name))[0] ?? null,
    emptyCount: stats.filter((stat) => stat.total === 0).length,
  };
}

function completionDonut(summary: { total: number; done: number; percent: number }) {
  if (summary.total === 0) return "conic-gradient(hsl(var(--muted)) 0deg 360deg)";
  return `conic-gradient(#22c55e 0deg ${summary.percent * 3.6}deg, hsl(var(--muted)) ${summary.percent * 3.6}deg 360deg)`;
}

function taskMatchesFilter(task: TodoNode, filter: TaskFilter) {
  if (filter === "all") return true;
  if (filter === "done") return calculateNodeProgress(task).percent === 100;
  return calculateNodeProgress(task).percent < 100;
}

function treeMatchesFilter(task: TodoNode, filter: TaskFilter): boolean {
  return taskMatchesFilter(task, filter) || task.children.some((child) => treeMatchesFilter(child, filter));
}
