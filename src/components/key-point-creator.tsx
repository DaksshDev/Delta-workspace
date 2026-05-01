import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, X, Trash2, MoreVertical, Pencil, Palette } from "lucide-react";
import { ecsApi } from "@/ecs/api";
import { useEcsQuery } from "@/ecs/hooks";
import { Input } from "@/components/ui/input";
import { getContrastColor } from "@/lib/utils";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type KeyPoint = { id: string; text: string; color: string; };
type Group = { id: string; name: string; color: string; keypoints: KeyPoint[]; };

export function KeyPointCreator({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const { data: kpComp } = useEcsQuery(() => ecsApi.getComponent(fileId, "keypoints-data"));

  const [groups, setGroups] = useState<Group[]>([]);
  const [ungrouped, setUngrouped] = useState<KeyPoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Load initial data
  useEffect(() => {
    if (kpComp) {
      setGroups(kpComp.data?.groups || []);
      setUngrouped(kpComp.data?.ungrouped || []);
      setLoaded(true);
    } else if (kpComp === undefined) {
      // If component doesn't exist yet, it's empty
      setLoaded(true);
    }
  }, [kpComp]);

  // Auto-save
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const save = (newGroups: Group[], newUngrouped: KeyPoint[]) => {
    setGroups(newGroups);
    setUngrouped(newUngrouped);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      ecsApi.setComponent(fileId, "keypoints-data", { groups: newGroups, ungrouped: newUngrouped });
    }, 500);
  };

  const isEmpty = groups.length === 0 && ungrouped.length === 0;
  const selectedCount = selectedIds.size;

  // Actions
  const addGroup = () => {
    const newGroup: Group = { id: Math.random().toString(36).slice(2), name: "New Group", color: "#3b82f6", keypoints: [] };
    save([...groups, newGroup], ungrouped);
  };

  const addKeyPoint = (groupId?: string) => {
    const newKp: KeyPoint = { id: Math.random().toString(36).slice(2), text: "New Keypoint", color: "#f3f4f6" };
    if (groupId) {
      save(groups.map(g => g.id === groupId ? { ...g, keypoints: [...g.keypoints, newKp] } : g), ungrouped);
    } else {
      save(groups, [...ungrouped, newKp]);
    }
  };

  const updateKeyPoint = (id: string, updates: Partial<KeyPoint>) => {
    save(
      groups.map(g => ({ ...g, keypoints: g.keypoints.map(k => k.id === id ? { ...k, ...updates } : k) })),
      ungrouped.map(k => k.id === id ? { ...k, ...updates } : k)
    );
  };

  const deleteKeyPoint = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    save(
      groups.map(g => ({ ...g, keypoints: g.keypoints.filter(k => k.id !== id) })),
      ungrouped.filter(k => k.id !== id)
    );
  };

  const toggleKeyPointSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const deleteSelectedKeyPoints = () => {
    if (selectedIds.size === 0) return;
    save(
      groups.map(g => ({ ...g, keypoints: g.keypoints.filter(k => !selectedIds.has(k.id)) })),
      ungrouped.filter(k => !selectedIds.has(k.id))
    );
    clearSelection();
    setBulkDeleteConfirmOpen(false);
  };

  const updateGroup = (id: string, updates: Partial<Group>) => {
    save(groups.map(g => g.id === id ? { ...g, ...updates } : g), ungrouped);
  };

  const deleteGroup = (id: string, keepItems: boolean) => {
    const groupToDel = groups.find(g => g.id === id);
    if (!groupToDel) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const kp of groupToDel.keypoints) next.delete(kp.id);
      return next;
    });
    save(groups.filter(g => g.id !== id), keepItems ? [...ungrouped, ...groupToDel.keypoints] : ungrouped);
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, kpId: string) => {
    e.dataTransfer.setData("kpId", kpId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, targetGroupId: string | null, targetKpId?: string) => {
    e.preventDefault();
    const kpId = e.dataTransfer.getData("kpId");
    if (!kpId || kpId === targetKpId) return;

    // Find the kp
    let kp: KeyPoint | undefined;
    for (const g of groups) {
      kp = g.keypoints.find((k: KeyPoint) => k.id === kpId);
      if (kp) break;
    }
    if (!kp) kp = ungrouped.find(k => k.id === kpId);
    if (!kp) return;

    // Remove from old location
    const newGroups = groups.map(g => ({ ...g, keypoints: g.keypoints.filter(k => k.id !== kpId) }));
    const newUngrouped = ungrouped.filter(k => k.id !== kpId);

    // Add to new location
    if (targetGroupId) {
      const gIndex = newGroups.findIndex(g => g.id === targetGroupId);
      if (gIndex > -1) {
        if (targetKpId) {
          const kIndex = newGroups[gIndex].keypoints.findIndex(k => k.id === targetKpId);
          newGroups[gIndex].keypoints.splice(kIndex, 0, kp);
        } else {
          newGroups[gIndex].keypoints.push(kp);
        }
      }
    } else {
      if (targetKpId) {
        const kIndex = newUngrouped.findIndex(k => k.id === targetKpId);
        newUngrouped.splice(kIndex, 0, kp);
      } else {
        newUngrouped.push(kp);
      }
    }
    save(newGroups, newUngrouped);
  };

  if (!loaded) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto flex flex-col">
      <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {isEmpty && <h1 className="text-xl font-semibold">Key Point Creator</h1>}
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 ? (
            <>
              <span className="text-sm font-medium text-foreground">
                {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
              </span>
              <Button onClick={clearSelection} variant="ghost" size="sm">
                Clear
              </Button>
              <Button onClick={() => setBulkDeleteConfirmOpen(true)} variant="destructive" size="sm" className="gap-2">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </>
          ) : (
            <>
              <Button onClick={addGroup} variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Add Group
              </Button>
              <Button onClick={() => addKeyPoint()} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Add Keypoint
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="p-6 flex-1 space-y-8 max-w-7xl mx-auto w-full">
        {groups.map(group => (
          <div 
            key={group.id} 
            className="space-y-4 p-4 rounded-xl border transition-colors"
            style={{ backgroundColor: `${group.color}22` }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, group.id)}
          >
            <GroupHeader
              group={group}
              onUpdate={(u: Partial<Group>) => updateGroup(group.id, u)}
              onDelete={(keepItems) => deleteGroup(group.id, keepItems)}
              onAddKeyPoint={() => addKeyPoint(group.id)}
            />

            <div className="min-h-[60px] rounded-lg border-2 border-dashed border-transparent p-2 transition-colors hover:border-muted-foreground/20">
              <KeyPointGrid
                keypoints={group.keypoints}
                renderKeyPoint={(kp) => (
                  <KeyPointPill
                    key={kp.id}
                    kp={kp}
                    isSelected={selectedIds.has(kp.id)}
                    onToggleSelected={() => toggleKeyPointSelection(kp.id)}
                    onUpdate={(u) => updateKeyPoint(kp.id, u)}
                    onDelete={() => deleteKeyPoint(kp.id)}
                    onDragStart={(e) => handleDragStart(e, kp.id)}
                    onDrop={(e) => { e.stopPropagation(); handleDrop(e, group.id, kp.id); }}
                  />
                )}
              />
              {group.keypoints.length === 0 && (
                <div className="text-sm text-muted-foreground/50 italic py-2 px-2 flex-1 pointer-events-none">
                  Drag keypoints here or add new...
                </div>
              )}
            </div>
          </div>
        ))}

        <div
          className="space-y-4 p-4 rounded-xl"
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, null)}
        >

          <div className="min-h-[60px] p-2">
            <KeyPointGrid
              keypoints={ungrouped}
              renderKeyPoint={(kp) => (
                <KeyPointPill
                  key={kp.id}
                  kp={kp}
                  isSelected={selectedIds.has(kp.id)}
                  onToggleSelected={() => toggleKeyPointSelection(kp.id)}
                  onUpdate={(u) => updateKeyPoint(kp.id, u)}
                  onDelete={() => deleteKeyPoint(kp.id)}
                  onDragStart={(e) => handleDragStart(e, kp.id)}
                  onDrop={(e) => { e.stopPropagation(); handleDrop(e, null, kp.id); }}
                />
              )}
            />
            {ungrouped.length === 0 && groups.length === 0 && (
              <div className="text-sm text-muted-foreground/50 italic py-2 px-2">
                Click "Add Keypoint" to get started...
              </div>
            )}
          </div>
        </div>
      </div>

      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setBulkDeleteConfirmOpen(false)}>
          <div className="bg-card text-card-foreground border shadow-xl rounded-xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-foreground">
              Delete {selectedCount} selected {selectedCount === 1 ? "keypoint" : "keypoints"}?
            </h2>
            <p className="text-sm text-muted-foreground">
              This will permanently delete the selected keypoints. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBulkDeleteConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={deleteSelectedKeyPoints}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function estimateKeyPointRowSpan(kp: KeyPoint) {
  const lines = kp.text.split(/\r?\n/);
  const visualLines = lines.reduce((total, line) => total + Math.max(Math.ceil(line.length / 28), 1), 0);
  return Math.max(Math.ceil((visualLines * 24 + 28) / 64), 1);
}

function KeyPointGrid({
  keypoints,
  renderKeyPoint,
}: {
  keypoints: KeyPoint[];
  renderKeyPoint: (kp: KeyPoint) => React.ReactNode;
}) {
  if (keypoints.length === 0) return null;

  return (
    <div className="grid grid-flow-row-dense auto-rows-[64px] grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
      {keypoints.map((kp) => (
        <div key={kp.id} className="min-w-0" style={{ gridRowEnd: `span ${estimateKeyPointRowSpan(kp)}` }}>
          {renderKeyPoint(kp)}
        </div>
      ))}
    </div>
  );
}

function KeyPointPill({
  kp,
  isSelected,
  onToggleSelected,
  onUpdate,
  onDelete,
  onDragStart,
  onDrop
}: {
  kp: KeyPoint,
  isSelected: boolean,
  onToggleSelected: () => void,
  onUpdate: (u: Partial<KeyPoint>) => void,
  onDelete: () => void,
  onDragStart: (e: React.DragEvent) => void,
  onDrop: (e: React.DragEvent) => void
}) {
  const [editing, setEditing] = useState(kp.text === "New Keypoint");
  const [text, setText] = useState(kp.text);
  const [menuOpen, setMenuOpen] = useState(false);
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef(false);
  const isDark = getContrastColor(kp.color) === 'white';

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const startHoldTimer = () => {
    if (editing) return;
    clearHoldTimer();
    longPressTriggeredRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      onToggleSelected();
    }, 450);
  };

  useEffect(() => {
    if (!editing || !textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [editing, text]);

  useEffect(() => clearHoldTimer, []);

  return (
    <div
      draggable={!editing}
      onDragStart={onDragStart}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
      onPointerDown={() => startHoldTimer()}
      onPointerUp={clearHoldTimer}
      onPointerLeave={clearHoldTimer}
      onPointerCancel={clearHoldTimer}
      onClick={(e) => {
        e.stopPropagation();
        if (editing) return;
        if (longPressTriggeredRef.current) {
          longPressTriggeredRef.current = false;
          return;
        }
        onToggleSelected();
      }}
      className={`group relative flex h-full w-full items-start gap-2 rounded-xl border px-3.5 py-2.5 pr-10 shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing ${
        isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
      style={{
        backgroundColor: kp.color,
        color: getContrastColor(kp.color),
        borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.1)'
      }}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={() => { setEditing(false); onUpdate({ text }); }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { setEditing(false); onUpdate({ text }); } }}
          onClick={e => e.stopPropagation()}
          rows={1}
          className="block min-h-[1.5rem] w-full resize-none overflow-hidden bg-transparent p-0 pr-1 text-sm font-medium leading-relaxed outline-none border-none focus:outline-none focus:ring-0"
          style={{ color: 'inherit' }}
        />
      ) : (
        <span className="block min-w-0 flex-1 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed">
          {kp.text}
        </span>
      )}

      {/* Triple Dot Menu */}
      <div className={`absolute right-2 top-2 flex items-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-black/5 text-inherit outline-none hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 z-[60]" align="center" onClick={e => e.stopPropagation()}>
            {/* Action buttons */}
            <div className="flex flex-col gap-1">
              <button 
                className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors rounded-md text-left w-full"
                onClick={() => { setMenuOpen(false); setEditing(true); }}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                Rename
              </button>
              <button 
                className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors rounded-md text-left w-full"
                onClick={() => { setMenuOpen(false); setColorModalOpen(true); }}
              >
                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                Set color
              </button>
              <button 
                className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-destructive/10 text-destructive transition-colors rounded-md text-left w-full"
                onClick={() => { setMenuOpen(false); setDeleteConfirmOpen(true); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {colorModalOpen && (
        <ColorPickerModal
          color={kp.color}
          onChange={c => onUpdate({ color: c })}
          onClose={() => setColorModalOpen(false)}
        />
      )}

      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setDeleteConfirmOpen(false); }}>
          <div className="bg-card text-card-foreground border shadow-xl rounded-xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-foreground">Delete Keypoint?</h2>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this keypoint? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { onDelete(); setDeleteConfirmOpen(false); }}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupHeader({ group, onUpdate, onDelete, onAddKeyPoint }: { group: Group, onUpdate: (u: Partial<Group>) => void, onDelete: (keepItems: boolean) => void, onAddKeyPoint: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => { setEditing(false); onUpdate({ name }); }}
            onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onUpdate({ name }); } }}
            className="font-semibold text-lg border-transparent focus-visible:ring-0 px-1 py-0 h-auto bg-transparent max-w-sm"
          />
        ) : (
          <span 
            className="font-semibold text-lg px-1 cursor-text truncate flex-1"
            onClick={() => setEditing(true)}
          >
            {group.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => onAddKeyPoint()} className="text-muted-foreground hover:text-foreground shrink-0 h-8 w-8">
          <Plus className="h-4 w-4" />
        </Button>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 z-[60]" align="end">
            <div className="flex flex-col gap-1">
              <button 
                className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors rounded-md text-left w-full"
                onClick={() => { setMenuOpen(false); setEditing(true); }}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                Rename
              </button>
              <button 
                className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors rounded-md text-left w-full"
                onClick={() => { setMenuOpen(false); setColorModalOpen(true); }}
              >
                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                Set color
              </button>
              <button 
                className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-destructive/10 text-destructive transition-colors rounded-md text-left w-full"
                onClick={() => { setMenuOpen(false); setDeleteConfirmOpen(true); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {colorModalOpen && (
        <ColorPickerModal
          color={group.color}
          onChange={c => onUpdate({ color: c })}
          onClose={() => setColorModalOpen(false)}
        />
      )}

      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setDeleteConfirmOpen(false)}>
          <div className="bg-card border shadow-xl rounded-xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Delete Group?</h2>
            <p className="text-sm text-muted-foreground">What would you like to do with the keypoints inside this group?</p>
            <div className="flex flex-col gap-2 mt-2">
              <Button variant="destructive" onClick={() => { onDelete(false); setDeleteConfirmOpen(false); }}>Delete group & items</Button>
              <Button variant="secondary" onClick={() => { onDelete(true); setDeleteConfirmOpen(false); }}>Delete group only</Button>
              <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ColorPickerModal({
  color,
  onChange,
  onClose,
}: {
  color: string;
  onChange: (c: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border shadow-xl rounded-xl p-4 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Set Color</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <HexColorPicker color={color} onChange={onChange} />
        <div className="flex gap-2 flex-wrap max-w-[200px]">
          {['#f3f4f6', '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff', '#fed7aa', '#fecaca', '#0f172a'].map(c => (
            <button key={c} onClick={() => onChange(c)} className="w-6 h-6 rounded-full border shadow-sm hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}
