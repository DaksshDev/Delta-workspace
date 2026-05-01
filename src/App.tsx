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
import { Progress } from "@/pages/progress";
import { StudyManager } from "@/pages/study";
import { BasicMaths } from "@/pages/basic-maths";
import { WatchLater } from "@/pages/watch";
import { Exams } from "@/pages/exams";
import { Reminders } from "@/pages/reminders";
import { BucketList } from "@/pages/bucket";
import { Timer } from "@/pages/timer";
import { Data } from "@/pages/data";
import { Backups } from "@/pages/backups";
import { SyncPage } from "@/pages/sync-page";
import { Settings } from "@/pages/settings";
import { Bugs } from "@/pages/bugs";

import { SeedSystem } from "@/ecs/seed";
import { SyncSystem } from "@/ecs/sync";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const queryClient = new QueryClient();

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const pendingWatchId = localStorage.getItem("pendingWatchId");
    if (pendingWatchId && location.pathname !== "/watch") {
      navigate("/watch");
    }
  }, [location.pathname, navigate]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ideas" element={<Ideas />} />
        <Route path="/study" element={<StudyManager />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/basic-maths" element={<BasicMaths />} />
        <Route path="/watch" element={<WatchLater />} />
        <Route path="/exams" element={<Exams />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="/bucket" element={<BucketList />} />
        <Route path="/todos" element={<Todos />} />
        <Route path="/timer" element={<Timer />} />

        <Route path="/dev/bugs" element={<Bugs />} />
        <Route path="/dev/data" element={<Data />} />
        <Route path="/dev/sync" element={<SyncPage />} />
        <Route path="/dev/backups" element={<Backups />} />
        <Route path="/dev/settings" element={<Settings />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

function AppContent() {
  const { user, loading, login, logout } = useAuth();
  const [seeded, setSeeded] = useState(false);
  const [showWelcomeBackModal, setShowWelcomeBackModal] = useState(false);
  const [isSyncingWorkspace, setIsSyncingWorkspace] = useState(false);
  const [hasCloudWorkspace, setHasCloudWorkspace] = useState(false);

  // Seed database
  useEffect(() => {
    let mounted = true;
    async function initSeed() {
      if (seeded || loading) return;
      try {
        await SeedSystem.seedIfEmpty();
      } catch (error) {
        console.error("App: Fatal initialization error", error);
      } finally {
        if (mounted) setSeeded(true);
      }
    }
    initSeed();
    return () => { mounted = false; };
  }, [loading, seeded]);

  // Sync cloud workspace
  useEffect(() => {
    let mounted = true;
    
    if (!loading && user && seeded) {
      const runSync = async () => {
        if (SyncSystem.isInitialized && SyncSystem.uid === user.uid) return;
        
        setIsSyncingWorkspace(true);
        const startTime = Date.now();
        try {
          const result = await SyncSystem.init(user.uid);
          const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);
          
          if (mounted && result) {
            if (result.action === 'pulled') {
              setHasCloudWorkspace(true);
              setShowWelcomeBackModal(true);
              toast.success(`Successfully pulled ${result.items} items from cloud in ${timeTaken}s`);
            } else if (result.action === 'pushed') {
              toast.success(`Successfully initialized cloud workspace in ${timeTaken}s`);
            }
          }
        } catch (err) {
          if (mounted) {
            toast.error("Failed to sync workspace. Please sign in again.");
            await logout();
          }
        } finally {
          if (mounted) setIsSyncingWorkspace(false);
        }
      };
      runSync();
    }
    
    return () => { mounted = false; };
  }, [user, loading, seeded, logout]);

  if (loading || !seeded || isSyncingWorkspace) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground animate-pulse font-medium">
          {isSyncingWorkspace ? "Getting your workspace from Firebase..." : "Loading workspace..."}
        </p>
      </div>
    );
  }

  return (
    <>
      <AppRoutes />

      {/* Login Modal */}
      {!user && (
        <Dialog open={true}>
          <DialogContent className="sm:max-w-[425px]" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Welcome to Delta Board</DialogTitle>
              <DialogDescription>
                You need to log in to sync your data across devices and access your personal workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 flex justify-center">
              <Button onClick={login} size="lg" className="gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Welcome Back Modal (Workspace Loaded) */}
      <Dialog open={showWelcomeBackModal} onOpenChange={setShowWelcomeBackModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Workspace Restored</DialogTitle>
            <DialogDescription>
              Welcome back{user?.displayName ? `, ${user.displayName}` : ""}! Your data has been successfully synchronized from the cloud.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <p className="text-sm font-medium">All your devices are in sync.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowWelcomeBackModal(false)} className="w-full">
              Continue to Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function App() {
  const normalizedBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  const baseName = normalizedBase ? normalizedBase : undefined;

  return (
    <ThemeProvider defaultTheme="dark">
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <BrowserRouter basename={baseName}>
              <AppContent />
            </BrowserRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
