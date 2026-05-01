import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Palette,
  X,
  ChevronLeft,
  Menu,
  ChevronRight,
  ArrowLeft,
  GripVertical,
  Pencil
} from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { cn, getContrastColor } from "@/lib/utils";
import { ecsApi } from "@/ecs/api";

type Flashcard = {
  id: string;
  title: string;
  content: string;
  color: string;
};

export function FlashcardEditor({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredDeck, setHoveredDeck] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    async function load() {
      const comp = await ecsApi.getComponent(fileId, "flashcards");
      if (comp?.data?.cards && comp.data.cards.length > 0) {
        const migrated = comp.data.cards.map((c: any) => ({
          ...c,
          content: c.content || (Array.isArray(c.points) ? c.points.join("\n") : ""),
        }));
        setCards(migrated);
        setIsEditing(false);
      } else {
        const initialCard: Flashcard = {
          id: crypto.randomUUID(),
          title: "New Card",
          content: "",
          color: "#6366f1",
        };
        setCards([initialCard]);
        setIsEditing(true);
      }
      setLoading(false);
    }
    load();
  }, [fileId]);

  const save = async (newCards: Flashcard[]) => {
    await ecsApi.setComponent(fileId, "flashcards", { cards: newCards });
  };

  const addCard = () => {
    const newCard: Flashcard = {
      id: crypto.randomUUID(),
      title: "New Card",
      content: "",
      color: "#6366f1",
    };
    const updated = [...cards, newCard];
    setCards(updated);
    setSelectedIndex(updated.length - 1);
    save(updated);
  };

  const deleteCard = (index: number) => {
    if (cards.length <= 1) return;
    const updated = cards.filter((_, i) => i !== index);
    setCards(updated);
    setSelectedIndex(Math.max(0, selectedIndex - 1));
    save(updated);
    setShowDeleteConfirm(false);
  };

  const updateCard = (index: number, updates: Partial<Flashcard>) => {
    const updated = cards.map((c, i) => (i === index ? { ...c, ...updates } : c));
    setCards(updated);
    save(updated);
  };

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && selectedIndex < cards.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
    if (isRightSwipe && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const currentCard = cards[selectedIndex];

  if (loading) return null;

  const goToNext = () => {
    if (selectedIndex < cards.length - 1) setSelectedIndex(selectedIndex + 1);
  };

  const goToPrev = () => {
    if (selectedIndex > 0) setSelectedIndex(selectedIndex - 1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col-reverse md:flex-row overflow-hidden">
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Card</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this card? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteCard(selectedIndex)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sidebar - Desktop (Left) / Mobile (Bottom) */}
      <aside
        className={cn(
          "bg-muted/30 border-t md:border-t-0 md:border-r flex flex-col transition-all duration-300 z-20",
          isSidebarOpen ? "w-full md:w-64 h-[30vh] md:h-full" : "w-full md:w-0 h-12 md:h-full overflow-hidden",
          !isEditing && "md:w-0 h-12 overflow-hidden border-none"
        )}
      >
        <div className="flex items-center justify-between p-3 border-b shrink-0">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Flashcards ({cards.length})
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addCard}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:flex hidden"
              onClick={() => setIsSidebarOpen(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-1">
          {cards.map((card, i) => (
            <button
              key={card.id}
              onClick={() => {
                setSelectedIndex(i);
                if (!isEditing && window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 group",
                selectedIndex === i
                  ? "bg-background shadow-sm border-primary/20 ring-1 ring-primary/10"
                  : "hover:bg-muted border-transparent"
              )}
            >
              <div
                className="w-2 h-8 rounded-full shrink-0"
                style={{ backgroundColor: card.color }}
              />
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "text-sm font-medium truncate",
                  selectedIndex === i ? "text-foreground" : "text-muted-foreground"
                )}>
                  {card.title || "Untitled"}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {card.content.length > 0 ? card.content.slice(0, 30) + (card.content.length > 30 ? "..." : "") : "No content"}
                </p>
              </div>
              {cards.length > 1 && selectedIndex === i && (
                <Trash2
                  className="h-3.5 w-3.5 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b bg-background z-10">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && isEditing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-sm font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">
                {isEditing ? "Flashcard Editor" : "Flashcard Preview"}
              </h1>
              <p className="text-xs font-medium truncate max-w-[200px] md:max-w-md">
                {isEditing ? `Editing: ${currentCard.title}` : `${cards.length} Cards in Deck`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button size="sm" className="gap-2" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4" />
                Edit Deck
              </Button>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Palette className="h-4 w-4" />
                    <span className="hidden md:inline">Color</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3">
                  <div className="space-y-3">
                    <HexColorPicker
                      color={currentCard.color}
                      onChange={(c) => updateCard(selectedIndex, { color: c })}
                    />
                    <div className="grid grid-cols-6 gap-2">
                      {["#ef4444", "#f97316", "#facc15", "#4ade80", "#60a5fa", "#c084fc"].map(c => (
                        <button
                          key={c}
                          className="h-6 w-6 rounded-full border border-white/20"
                          style={{ backgroundColor: c }}
                          onClick={() => updateCard(selectedIndex, { color: c })}
                        />
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {isEditing && cards.length > 1 && (
              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </header>

        {/* Body Content */}
        <div
          className="flex-1 overflow-auto bg-muted/10 p-4 md:p-8 flex flex-col items-center justify-center"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {isEditing ? (
            <Card
              className="w-full max-w-2xl shadow-xl border-none overflow-hidden transition-colors duration-500"
              style={{ backgroundColor: currentCard.color }}
            >
              <CardContent className="p-0">
                <div
                  className="p-6 md:p-10 space-y-6"
                  style={{ color: getContrastColor(currentCard.color) }}
                >
                  <input
                    value={currentCard.title}
                    onChange={(e) => updateCard(selectedIndex, { title: e.target.value })}
                    className="bg-transparent border-none text-2xl md:text-4xl font-bold w-full focus:outline-none placeholder:text-inherit placeholder:opacity-40"
                    placeholder="Card Title..."
                  />

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">
                      Content
                    </p>
                    <textarea
                      value={currentCard.content}
                      onChange={(e) => updateCard(selectedIndex, { content: e.target.value })}
                      placeholder="Type card content here..."
                      className="w-full bg-transparent border-none resize-none focus:outline-none text-base md:text-lg leading-relaxed placeholder:text-inherit placeholder:opacity-30 py-1 min-h-[200px]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* STACKED DECK PREVIEW */
            <div
              className="relative w-full max-w-[90vw] md:max-w-2xl aspect-[4/3] md:aspect-[3/2] flex items-center justify-center"
              onMouseEnter={() => setHoveredDeck(true)}
              onMouseLeave={() => setHoveredDeck(false)}
            >
              {cards.map((card, i) => {
                const isSelected = selectedIndex === i;
                const offset = i - selectedIndex;
                const absOffset = Math.abs(offset);

                let translateX = 0;
                let translateY = 0;
                let rotate = 0;
                let scale = 1;
                let zIndex = cards.length - absOffset;
                let opacity = 1;

                // Responsive offsets
                const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                const horizontalStep = isMobile ? (hoveredDeck ? 20 : 5) : (hoveredDeck ? 40 : 10);
                const verticalStep = isMobile ? (hoveredDeck ? 5 : 2) : (hoveredDeck ? 10 : 5);

                if (isSelected) {
                  translateX = 0;
                  translateY = hoveredDeck ? -15 : 0;
                  rotate = 0;
                  scale = isMobile ? 1.02 : 1.05;
                  zIndex = 50;
                } else {
                  translateX = offset * horizontalStep;
                  translateY = absOffset * verticalStep;
                  rotate = offset * (hoveredDeck ? 3 : 1);
                  scale = 1 - (absOffset * 0.04);
                  opacity = 1 - (absOffset * 0.25);
                }

                return (
                  <Card
                    key={card.id}
                    onClick={() => setSelectedIndex(i)}
                    className={cn(
                      "absolute w-full h-full shadow-xl md:shadow-2xl border-none cursor-pointer transition-all duration-500 ease-out flex flex-col overflow-hidden",
                      isSelected ? "ring-2 md:ring-4 ring-primary/20" : "hover:brightness-105"
                    )}
                    style={{
                      backgroundColor: card.color,
                      transform: `translate(${translateX}px, ${translateY}px) rotate(${rotate}deg) scale(${scale})`,
                      zIndex,
                      opacity: Math.max(0, opacity),
                    }}
                  >
                    <CardContent className="p-4 md:p-10 flex flex-col h-full" style={{ color: getContrastColor(card.color) }}>
                      <h2 className="text-xl md:text-4xl font-bold mb-2 md:mb-4 truncate">{card.title}</h2>
                      <div className="flex-1 overflow-auto custom-scrollbar pr-1 md:pr-2">
                        <p className="text-sm md:text-xl leading-relaxed whitespace-pre-wrap opacity-90">
                          {card.content}
                        </p>
                      </div>
                      <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-current/10 flex justify-between items-center text-[8px] md:text-[10px] uppercase tracking-widest font-bold opacity-60">
                        <span>Card {i + 1} of {cards.length}</span>
                        {isSelected && <span>Selected</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="mt-8 flex items-center gap-6">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={goToPrev}
              disabled={selectedIndex === 0}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>

            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
              {selectedIndex + 1} / {cards.length}
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={goToNext}
              disabled={selectedIndex === cards.length - 1}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

// Minimal Popover implementation for the color picker since we're in a custom editor
function Popover({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const childrenArray = Array.isArray(children) ? children : [children];
  return (
    <div className="relative inline-block">
      {childrenArray.map((child, i) => {
        if (!child) return null;
        if (child.type === PopoverTrigger) {
          return <div key={i} onClick={() => setOpen(!open)}>{child}</div>;
        }
        if (child.type === PopoverContent && open) {
          return <div key={i}>{child}</div>;
        }
        return null;
      })}
    </div>
  );
}

function PopoverTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  return <>{children}</>;
}

function PopoverContent({ children, className, align }: { children: React.ReactNode; className?: string; align?: string }) {
  return (
    <div className={cn("absolute right-0 top-full mt-2 z-50 bg-background border rounded-lg shadow-xl p-3 animate-in fade-in zoom-in-95 duration-200", className)}>
      {children}
    </div>
  );
}

