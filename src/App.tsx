import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { ThemeProvider } from "@/components/theme-provider";
import { Dashboard } from "@/pages/dashboard";
import { Ideas } from "@/pages/ideas";
import { Todos } from "@/pages/todos";
import { StudyManager } from "@/pages/study";
import { WatchLater } from "@/pages/watch";
import { Exams } from "@/pages/exams";
import { NamesAndWhiteboard } from "@/pages/names";
import { BucketList } from "@/pages/bucket";
import { Timer } from "@/pages/timer";

import { SeedSystem } from "@/ecs/seed";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ideas" element={<Ideas />} />
        <Route path="/study" element={<StudyManager />} />
        <Route path="/watch" element={<WatchLater />} />
        <Route path="/exams" element={<Exams />} />
        <Route path="/names" element={<NamesAndWhiteboard />} />
        <Route path="/bucket" element={<BucketList />} />
        <Route path="/todos" element={<Todos />} />
        <Route path="/timer" element={<Timer />} />

        <Route path="/dev/bugs" element={<div>Bugs (Coming Soon)</div>} />
        <Route path="/dev/export" element={<div>Export (Coming Soon)</div>} />
        <Route path="/dev/backups" element={<div>Backups (Coming Soon)</div>} />
        <Route path="/dev/settings" element={<div>Settings (Coming Soon)</div>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

function App() {
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    SeedSystem.seedIfEmpty().then(() => setSeeded(true));
  }, []);

  if (!seeded) return <div className="min-h-screen flex items-center justify-center">Loading workspace...</div>;

  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
