import { useAppStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Menu, Plus, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Switch } from "./ui/switch";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { SidebarContent } from "./sidebar";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { VscLayoutSidebarLeft } from "react-icons/vsc";
import { useAuth } from "@/lib/auth-context";
import { SYNC_STATE_EVENT, SyncSystem } from "@/ecs/sync";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "./ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { AlertCircle, LogOut, User as UserIcon, Settings as SettingsIcon, Cloud, CloudOff, RefreshCw } from "lucide-react";

export function TopBar() {
  const { mode, setMode, sidebarOpen, setSidebarOpen } = useAppStore();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [syncState, setSyncState] = useState<{ queue: number, online: boolean, processing: boolean, verified: boolean }>({
    queue: 0,
    online: true,
    processing: false,
    verified: true,
  });
  const navigate = useNavigate();

  useEffect(() => {
    const updateSync = async () => {
      const status = await SyncSystem.getStatus();
      setSyncState({
        queue: status.queueCount,
        online: status.isOnline,
        processing: status.isProcessing,
        verified: status.lastVerifiedAt !== null && status.verificationMismatches.length === 0 && !status.lastVerificationError,
      });
    };
    updateSync();
    window.addEventListener(SYNC_STATE_EVENT, updateSync);
    const interval = setInterval(updateSync, 3000);
    return () => {
      clearInterval(interval);
      window.removeEventListener(SYNC_STATE_EVENT, updateSync);
    };
  }, []);

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
        <VscLayoutSidebarLeft className="w-6 h-6" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>

      {/* Study / Dev toggle */}
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

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => navigate("/dev/sync")}
              >
                {!syncState.online ? (
                  <CloudOff className="h-4 w-4 text-destructive" />
                ) : syncState.processing || syncState.queue > 0 ? (
                  <RefreshCw className="h-4 w-4 text-amber-500 animate-spin" />
                ) : !syncState.verified ? (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                ) : (
                  <Cloud className="h-4 w-4 text-green-500" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {!syncState.online
                  ? "Offline - Changes saved locally"
                  : syncState.processing
                    ? "Syncing in background..."
                    : syncState.queue > 0
                      ? `${syncState.queue} item${syncState.queue === 1 ? "" : "s"} queued for background sync`
                      : syncState.verified
                        ? "Cloud verified"
                        : "Cloud verification needs attention"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
              <Avatar className="h-8 w-8">
                {user?.photoURL && <img src={user.photoURL} alt={user.displayName || ""} />}
                <AvatarFallback className="text-xs bg-muted text-foreground">
                  {(user?.displayName || "DB").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/dev/settings")}>
              <SettingsIcon className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
