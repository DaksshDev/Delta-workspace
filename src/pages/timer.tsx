import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Pencil } from "lucide-react";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES } from "@/ecs/entities";
import { PresetModal } from "@/components/PresetModal";
import { toast } from "sonner";

export type TimerPreset = {
  id: string;
  name: string;
  duration: number; // in seconds
};

export const DEFAULT_PRESETS: TimerPreset[] = [
  { id: "pomodoro", name: "Pomodoro", duration: 25 * 60 },
  { id: "shortBreak", name: "Short Break", duration: 5 * 60 },
  { id: "longBreak", name: "Long Break", duration: 15 * 60 },
];

export function Timer() {
  const [presets, setPresets] = useState<TimerPreset[]>(() => {
    const saved = localStorage.getItem("timer_presets");
    return saved ? JSON.parse(saved) : DEFAULT_PRESETS;
  });
  const [activePresetId, setActivePresetId] = useState<string>(presets[0]?.id || "pomodoro");
  const [timeLeft, setTimeLeft] = useState(presets[0]?.duration || 25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [customTimeStr, setCustomTimeStr] = useState("00:00:00");
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  // Derive current active preset
  const activePreset = presets.find(p => p.id === activePresetId) || presets[0] || DEFAULT_PRESETS[0];

  useEffect(() => {
    localStorage.setItem("timer_presets", JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      // save session
      saveSession();
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const saveSession = async () => {
    try {
      const session = await ecsApi.createEntity(ENTITY_TYPES.TIMER_SESSION);
      await ecsApi.setComponent(session.id, 'metadata', {
        duration: activePreset.duration,
        type: activePreset.name,
        date: new Date().toISOString()
      });
    } catch (e) { }
  };

  const toggleTimer = () => {
    if (isEditingTime) {
      const parts = customTimeStr.split(":");
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

      let clamped = false;
      
      if (hrs > 24) {
        hrs = 24;
        mins = 0;
        secs = 0;
        clamped = true;
      } else if (hrs === 24 && (mins > 0 || secs > 0)) {
        mins = 0;
        secs = 0;
        clamped = true;
      }

      if (mins > 59) {
        mins = 59;
        clamped = true;
      }
      if (secs > 59) {
        secs = 59;
        clamped = true;
      }

      if (clamped) {
        toast.error("Your value got clamped to the maximum allowed.", {
          description: "Max time is 24:00:00, with 59 max for min/sec."
        });
      }

      const duration = (hrs * 3600) + (mins * 60) + secs;
      setTimeLeft(duration);
      setIsEditingTime(false);
      if (duration > 0) {
        setIsRunning(true);
      }
    } else {
      setIsRunning(!isRunning);
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsEditingTime(false);
    setTimeLeft(activePreset.duration);
  };

  const switchPreset = (id: string) => {
    const preset = presets.find(p => p.id === id);
    if (preset) {
      setActivePresetId(id);
      setIsRunning(false);
      setIsEditingTime(false);
      setTimeLeft(preset.duration);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    if (h > 0) {
      return `${h.toString().padStart(2, "0")}:${m}:${s}`;
    }
    return `${m}:${s}`;
  };

  const handleCustomTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    const padded = digits.padStart(6, "0").slice(-6);
    const formatted = `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`;
    setCustomTimeStr(formatted);
  };

  const hasStarted = timeLeft !== activePreset.duration;

  return (
    <div className="space-y-6 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Focus Timer</h1>
        <p className="text-muted-foreground">Stay focused and track your sessions.</p>
      </div>

      <Card className="w-full max-w-md bg-card/50 backdrop-blur border-2 border-primary/10">
        <CardContent className="p-8 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-8">
            <div className="flex gap-2 bg-muted p-1 rounded-lg">
              {presets.map(preset => (
                <Button
                  key={preset.id}
                  variant={activePresetId === preset.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => switchPreset(preset.id)}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsPresetModalOpen(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-7xl sm:text-8xl font-bold tracking-tighter tabular-nums mb-12 text-primary flex items-center">
            {isEditingTime ? (
              <input
                type="text"
                value={customTimeStr}
                onChange={handleCustomTimeChange}
                className="w-full max-w-[300px] bg-transparent text-center outline-none border-b-2 border-primary/50 focus:border-primary"
                autoFocus
              />
            ) : (
              formatTime(timeLeft)
            )}
          </div>

          <div className="flex items-center justify-center gap-4 w-full">
            <Button size="lg" className="w-32 h-14 text-lg rounded-full" onClick={toggleTimer}>
              {isRunning ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
              {isRunning ? "Pause" : "Start"}
            </Button>

            <Button
              size="icon"
              variant="outline"
              className="h-14 w-14 rounded-full shrink-0"
              onClick={() => {
                setIsEditingTime(true);
                setIsRunning(false);
                setCustomTimeStr("00:00:00");
              }}
              title="Set Custom Time"
            >
              <Pencil className="h-5 w-5" />
            </Button>

            {hasStarted && !isEditingTime && (
              <Button size="icon" variant="outline" className="h-14 w-14 rounded-full shrink-0" onClick={resetTimer}>
                <RotateCcw className="h-5 w-5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <PresetModal
        open={isPresetModalOpen}
        onOpenChange={setIsPresetModalOpen}
        presets={presets}
        onSave={(newPresets) => {
          setPresets(newPresets);
          // if active preset was removed, switch to first available
          if (!newPresets.find(p => p.id === activePresetId)) {
            setActivePresetId(newPresets[0].id);
            setTimeLeft(newPresets[0].duration);
          } else {
            // Update time if current preset duration changed and timer not running/started
            if (!isRunning && !hasStarted) {
              const updatedPreset = newPresets.find(p => p.id === activePresetId);
              if (updatedPreset) setTimeLeft(updatedPreset.duration);
            }
          }
        }}
        onResetToDefaults={() => {
          setPresets(DEFAULT_PRESETS);
          if (!isRunning && !hasStarted) {
            setTimeLeft(DEFAULT_PRESETS.find(p => p.id === activePresetId)?.duration || DEFAULT_PRESETS[0].duration);
          }
        }}
      />
    </div>
  );
}
