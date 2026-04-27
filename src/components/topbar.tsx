import { useAppStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Menu, Plus, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Switch } from "./ui/switch";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { SidebarContent } from "./sidebar";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function TopBar() {
  const { mode, setMode, sidebarOpen, setSidebarOpen } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const handleCommandPalette = () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };

  const handleModeChange = (checked: boolean) => {
    const next = checked ? "dev" : "study";
    setMode(next);
    navigate(next === "dev" ? "/dev/bugs" : "/");
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 sm:gap-3 border-b bg-background/95 px-3 sm:px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Mobile menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden">
            <Menu className="h-4 w-4" />
            <span className="sr-only">Open Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar collapse */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex h-8 w-8"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <Menu className="h-4 w-4" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>

      {/* Study / Dev toggle (proper shadcn Switch) */}
      <div className="flex items-center space-x-2">
        <span 
          className={`text-sm cursor-pointer select-none transition-colors ${mode === "study" ? "font-medium" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => handleModeChange(false)}
        >
          Study
        </span>
        <Switch
          checked={mode === "dev"}
          onCheckedChange={handleModeChange}
        />
        <span 
          className={`text-sm cursor-pointer select-none transition-colors ${mode === "dev" ? "font-medium" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => handleModeChange(true)}
        >
          Dev
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="relative h-8 w-9 sm:w-40 md:w-56 lg:w-72 justify-center sm:justify-start rounded-md bg-muted/40 px-2 sm:px-3 text-sm font-normal text-muted-foreground shadow-none"
          onClick={handleCommandPalette}
        >
          <Search className="h-4 w-4 sm:mr-2 shrink-0" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>

        <Button variant="default" size="icon" className="h-8 w-8 rounded-full shrink-0">
          <Plus className="h-4 w-4" />
          <span className="sr-only">New</span>
        </Button>

        <Avatar className="h-8 w-8 hidden sm:flex">
          <AvatarFallback className="text-xs bg-muted text-foreground">DB</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
