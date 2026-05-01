/**
 * vault-panel.tsx
 * Self-contained vault UI components extracted from ideas.tsx.
 * Exports: VaultGrid, ActiveVaultPanel
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Vault,
  Pencil,
  Palette,
  MoreVertical,
  ArrowLeft,
  X,
} from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Input } from "@/components/ui/input";
import { type IdeaFolder } from "@/lib/idea-folders-api";
import { IdeaTagEditor } from "@/components/idea-tag-editor";

// ─── Shared internal helpers ────────────────────────────────────────────────────

function VaultFolderNameDialog({
  initialName = "",
  title,
  onClose,
  onConfirm,
}: {
  initialName?: string;
  title: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Input
            autoFocus
            placeholder="Vault name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
              if (e.key === "Escape") onClose();
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => name.trim() && onConfirm(name.trim())}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function VaultColorPickerPopover({
  color,
  onChange,
  onClose,
}: {
  color: string;
  onChange: (c: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <Card className="shadow-xl w-auto">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Vault Colour</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <HexColorPicker color={color} onChange={onChange} />
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full border" style={{ background: color }} />
            <span className="text-xs font-mono text-muted-foreground">{color}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              "#ef4444", "#f97316", "#eab308", "#22c55e",
              "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
            ].map((c) => (
              <button
                key={c}
                className="h-5 w-5 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                style={{ background: c }}
                onClick={() => onChange(c)}
              />
            ))}
          </div>
          <Button size="sm" className="w-full" onClick={onClose}>Done</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── VaultGrid ─────────────────────────────────────────────────────────────────

export function VaultGrid({
  vaults,
  onOpenVault,
  onRenameVault,
  onChangeVaultColor,
}: {
  vaults: IdeaFolder[];
  onOpenVault: (id: string) => void;
  onRenameVault: (id: string, name: string) => void;
  onChangeVaultColor: (id: string, color: string) => void;
}) {
  const [colorPickerOpenId, setColorPickerOpenId] = useState<string | null>(null);
  const [tempColor, setTempColor] = useState("#6366f1");
  const [renamingVault, setRenamingVault] = useState<{ id: string; name: string } | null>(null);

  if (vaults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed">
        <p className="text-sm text-muted-foreground">No vaults match your search.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {vaults.map((vault) => (
          <div key={vault.id} className="relative group">
            <button
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-muted/40 w-full"
              style={{ borderColor: `${vault.color}55` }}
              onClick={() => onOpenVault(vault.id)}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `${vault.color}22`, color: vault.color }}
              >
                <Vault className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{vault.name}</p>
                <p className="text-xs text-muted-foreground">{vault.ideaIds.length} items</p>
              </div>
            </button>

            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100">
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-1">
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted rounded-sm"
                    onClick={() => setRenamingVault({ id: vault.id, name: vault.name })}
                  >
                    <Pencil className="h-3 w-3" /> Rename
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted rounded-sm"
                    onClick={() => {
                      setTempColor(vault.color);
                      setColorPickerOpenId(vault.id);
                    }}
                  >
                    <Palette className="h-3 w-3" /> Color
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        ))}
      </div>

      {colorPickerOpenId && (
        <VaultColorPickerPopover
          color={tempColor}
          onChange={(c) => {
            setTempColor(c);
            onChangeVaultColor(colorPickerOpenId, c);
          }}
          onClose={() => setColorPickerOpenId(null)}
        />
      )}

      {renamingVault && (
        <VaultFolderNameDialog
          title="Rename Vault"
          initialName={renamingVault.name}
          onClose={() => setRenamingVault(null)}
          onConfirm={(name) => {
            onRenameVault(renamingVault.id, name);
            setRenamingVault(null);
          }}
        />
      )}
    </>
  );
}

// ─── ActiveVaultPanel ──────────────────────────────────────────────────────────
// Renders the open vault view. Children (idea grid + drop zone + add card) are
// passed in as render props so this component stays decoupled from IdeaCard.

export function ActiveVaultPanel({
  activeVault,
  search,
  children,
  onBack,
}: {
  activeVault: IdeaFolder;
  search: string;
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{activeVault.name}</h1>
            <p className="text-muted-foreground text-sm tracking-widest uppercase mt-0.5">
              Vaulted ideas
            </p>
          </div>
        </div>
        <IdeaTagEditor />
      </div>

      {/* Scrollable idea content */}
      {children}
    </div>
  );
}
