import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import {
  LayoutDashboard,
  Lightbulb,
  BookOpen,
  Youtube,
  FileText,
  PenTool,
  CheckSquare,
  ListTodo,
  Timer,
  Bug,
  Download,
  Save,
  Settings,
} from "lucide-react";

const studyLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/todos", label: "Todos", icon: ListTodo },
  { href: "/study", label: "Study Manager", icon: BookOpen },
  { href: "/exams", label: "Exam Directory", icon: FileText },
  { href: "/ideas", label: "Idea Dump", icon: Lightbulb },
  { href: "/watch", label: "Watch Later", icon: Youtube },
  { href: "/names", label: "Name/Logo Ideas", icon: PenTool },
  { href: "/bucket", label: "Bucket List", icon: CheckSquare },
  { href: "/timer", label: "Timer", icon: Timer },
];

const devLinks = [
  { href: "/dev/bugs", label: "Bugs", icon: Bug },
  { href: "/dev/export", label: "Export", icon: Download },
  { href: "/dev/backups", label: "Backups", icon: Save },
  { href: "/dev/settings", label: "Settings", icon: Settings },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation().pathname;
  const { mode } = useAppStore();
  const links = mode === "study" ? studyLinks : devLinks;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <div className="flex items-center gap-2 font-semibold tracking-tight text-sidebar-foreground">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-foreground">
            <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13h-13L12 6.5z" />
          </svg>
          <span className="text-foreground">Delta Board</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {links.map((link) => {
          const active = location === link.href;
          return (
            <Link
              key={link.href}
              to={link.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const { sidebarOpen } = useAppStore();
  if (!sidebarOpen) return null;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar rounded-tr-2xl rounded-br-2xl h-screen overflow-hidden">
      <SidebarContent />
    </aside>
  );
}
