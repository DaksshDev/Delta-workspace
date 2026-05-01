import { useState } from "react";
import { useEcsQuery } from "@/ecs/hooks";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES } from "@/ecs/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, BellRing, X, Check } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Types ────────────────────────────────────────────────────────────────────

const REMINDER_TYPE = ENTITY_TYPES.TODO; // reuse TODO entity slot — unique by content

// ─── Delete Confirmation ──────────────────────────────────────────────────────

function DeleteConfirm({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <Card className="w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-semibold">Delete reminder?</h2>
          <p className="text-sm text-muted-foreground">
            This reminder will be permanently removed. This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" onClick={onConfirm}>Delete</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Reminder Item ────────────────────────────────────────────────────────────

function ReminderItem({
  reminderId,
  refetchList,
}: {
  reminderId: string;
  refetchList: () => void;
}) {
  const isMobile = useIsMobile();

  const { data: titleComp, refetch: refetchTitle } = useEcsQuery(() =>
    ecsApi.getComponent(reminderId, "title")
  );
  const { data: colorComp, refetch: refetchColor } = useEcsQuery(() =>
    ecsApi.getComponent(reminderId, "color")
  );

  // Filter out non-reminders via a flag component
  const { data: flagComp } = useEcsQuery(() =>
    ecsApi.getComponent(reminderId, "reminder-flag")
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const currentColor = colorComp?.data?.color || "";
  const title = titleComp?.data?.title || "Untitled";

  const handleDelete = async () => {
    await ecsApi.deleteEntity(reminderId);
    refetchList();
  };

  const handleUpdateTitle = async () => {
    if (!editTitle.trim()) return;
    await ecsApi.setComponent(reminderId, "title", { title: editTitle.trim() });
    setIsEditing(false);
    refetchTitle();
  };

  const handleUpdateColor = async (color: string) => {
    await ecsApi.setComponent(reminderId, "color", { color });
    refetchColor();
  };

  if (!flagComp) return null; // not a reminder entity

  return (
    <>
      <Card
        className={cn(
          "group transition-all hover:bg-muted/50 border shadow-sm hover:shadow-md",
          !currentColor && "border-none"
        )}
        style={{
          borderColor: currentColor || undefined,
          backgroundColor: currentColor ? `${currentColor}18` : undefined,
        }}
      >
        <CardContent className="p-3 flex items-center gap-3">
          {/* Bell indicator with accent color */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
            style={{
              backgroundColor: currentColor ? `${currentColor}30` : "hsl(var(--muted))",
              color: currentColor || "hsl(var(--muted-foreground))",
            }}
          >
            <BellRing className="h-4 w-4" />
          </div>

          {/* Title / edit area */}
          {isEditing ? (
            <div className="flex-1 flex items-center gap-2">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdateTitle();
                  if (e.key === "Escape") setIsEditing(false);
                }}
                className="h-8 bg-background"
                autoFocus
              />
              <Button size="sm" onClick={handleUpdateTitle} className="h-8 px-3">
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-8">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <span className="flex-1 text-sm font-medium text-foreground">{title}</span>
          )}

          {/* Actions — always visible on mobile, hover on desktop */}
          <div
            className={cn(
              "flex items-center gap-1 transition-opacity shrink-0",
              !isMobile && "opacity-0 group-hover:opacity-100"
            )}
          >
            {/* Rename */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditTitle(title);
                setIsEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            {/* Color picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <div
                    className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40"
                    style={{ backgroundColor: currentColor || "transparent" }}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Reminder Color</span>
                    {currentColor && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => handleUpdateColor("")}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                  <HexColorPicker
                    color={currentColor || "#ffffff"}
                    onChange={handleUpdateColor}
                  />
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6",
                      "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#a78bfa",
                    ].map((c) => (
                      <button
                        key={c}
                        className="h-5 w-5 rounded-full border border-border transition-transform hover:scale-110"
                        style={{ backgroundColor: c }}
                        onClick={() => handleUpdateColor(c)}
                      />
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {showDeleteConfirm && (
        <DeleteConfirm
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            handleDelete();
          }}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Reminders() {
  const { data: entities, refetch } = useEcsQuery(() =>
    ecsApi.getEntitiesByType(REMINDER_TYPE)
  );
  const { data: allFlags = [], refetch: refetchFlags } = useEcsQuery(() =>
    ecsApi.getEntitiesWithComponent("reminder-flag")
  );

  const [newTitle, setNewTitle] = useState("");

  const reminderIds = new Set(allFlags.map((f: any) => f.entityId));
  const reminders = (entities ?? []).filter((e) => reminderIds.has(e.id));

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const entity = await ecsApi.createEntity(REMINDER_TYPE);
    await ecsApi.setComponent(entity.id, "title", { title: newTitle.trim() });
    await ecsApi.setComponent(entity.id, "reminder-flag", { isReminder: true });
    setNewTitle("");
    refetch();
    refetchFlags();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reminders</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Quick notes and things to keep in mind.
        </p>
      </div>

      {/* Add input */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Add a reminder..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reminder list */}
      <div className="space-y-2">
        {reminders.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed">
            <BellRing className="h-10 w-10 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-base font-medium">No reminders yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add something above to get started.
            </p>
          </div>
        )}
        {reminders.map((r) => (
          <ReminderItem
            key={r.id}
            reminderId={r.id}
            refetchList={() => { refetch(); refetchFlags(); }}
          />
        ))}
      </div>
    </div>
  );
}
