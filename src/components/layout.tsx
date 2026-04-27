import { ReactNode, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { useAppStore } from "@/lib/store";
import { CommandPalette } from "./command-palette";

export function Layout({ children }: { children: ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "/") {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, setSidebarOpen]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground selection:bg-foreground/20">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl w-full">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}