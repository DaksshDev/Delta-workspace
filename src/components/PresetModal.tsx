import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Trash2 } from "lucide-react";

export type TimerPreset = {
  id: string;
  name: string;
  duration: number; // in seconds
};

interface PresetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: TimerPreset[];
  onSave: (presets: TimerPreset[]) => void;
  onResetToDefaults: () => void;
}

export function PresetModal({ open, onOpenChange, presets, onSave, onResetToDefaults }: PresetModalProps) {
  const [localPresets, setLocalPresets] = useState<(TimerPreset & { durationStr: string })[]>([]);

  useEffect(() => {
    if (open) {
      setLocalPresets(presets.map(p => ({
        ...p,
        durationStr: formatDuration(p.duration)
      })));
    }
  }, [open, presets]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const handleChange = (id: string, field: "name" | "durationStr", value: string) => {
    setLocalPresets(prev => prev.map(p => {
      if (p.id === id) {
        if (field === "durationStr") {
          const digits = value.replace(/\D/g, "");
          const padded = digits.padStart(6, "0").slice(-6);
          const formatted = `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`;
          return { ...p, durationStr: formatted };
        }
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const handleRemove = (id: string) => {
    if (localPresets.length > 2) {
      setLocalPresets(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleSave = () => {
    const newPresets = localPresets.map(p => {
      const parts = p.durationStr.split(":");
      let hStr = "0", mStr = "0", sStr = "0";
      if (parts.length === 3) {
        [hStr, mStr, sStr] = parts;
      } else if (parts.length === 2) {
        [mStr, sStr] = parts;
      } else if (parts.length === 1) {
        sStr = parts[0];
      }
      let hrs = parseInt(hStr || "0", 10);
      let mins = parseInt(mStr || "0", 10);
      let secs = parseInt(sStr || "0", 10);

      if (isNaN(hrs)) hrs = 0;
      if (isNaN(mins)) mins = 0;
      if (isNaN(secs)) secs = 0;

      if (hrs > 24) hrs = 24;
      if (hrs === 24 && (mins > 0 || secs > 0)) { mins = 0; secs = 0; }
      if (mins > 59) mins = 59;
      if (secs > 59) secs = 59;

      const duration = (hrs * 3600) + (mins * 60) + secs;
      return { id: p.id, name: p.name, duration };
    });
    onSave(newPresets);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Presets</DialogTitle>
          <DialogDescription>
            Modify your timer presets. You can remove at most one default preset.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {localPresets.map((preset) => (
            <div key={preset.id} className="flex items-center gap-2">
              <div className="flex-1">
                <Label className="sr-only">Name</Label>
                <Input
                  value={preset.name}
                  onChange={(e) => handleChange(preset.id, "name", e.target.value)}
                  placeholder="Preset Name"
                />
              </div>
              <div className="w-20">
                <Label className="sr-only">Time</Label>
                <Input
                  value={preset.durationStr}
                  onChange={(e) => handleChange(preset.id, "durationStr", e.target.value)}
                  placeholder="MM:SS"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(preset.id)}
                disabled={localPresets.length <= 2}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter className="flex sm:justify-between items-center w-full">
          <Button variant="outline" onClick={() => {
            onResetToDefaults();
            onOpenChange(false);
          }}>
            Reset Defaults
          </Button>
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
