import { useState, useRef, useEffect } from "react";
import { useEcsQuery } from "@/ecs/hooks";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES } from "@/ecs/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Youtube, Trash2, BadgeCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { YOUTUBE_API_KEY } from "@/lib/youtubeapi";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNowStrict } from "date-fns";
import { FaYoutube } from "react-icons/fa";
import { SiYoutubeshorts } from "react-icons/si";
import confetti from "canvas-confetti";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseIsoDuration = (duration: string) => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "0:00";
  const h = parseInt(match[1] || "0", 10);
  const m = parseInt(match[2] || "0", 10);
  const s = parseInt(match[3] || "0", 10);
  const mStr = m.toString().padStart(h > 0 ? 2 : 1, "0");
  const sStr = s.toString().padStart(2, "0");
  if (h > 0) return `${h}:${mStr}:${sStr}`;
  return `${mStr}:${sStr}`;
};

const formatViewCount = (views: string | number) => {
  const n = typeof views === "string" ? parseInt(views, 10) : views;
  if (isNaN(n)) return "0";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
};

const isShortUrl = (url: string) =>
  /youtube\.com\/shorts\//i.test(url);

const extractVideoId = (url: string) => {
  const m = url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  );
  return m?.[1] ?? null;
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WatchLater() {
  const { data: videos, refetch } = useEcsQuery(() =>
    ecsApi.getEntitiesByType(ENTITY_TYPES.VIDEO)
  );
  const { data: allMeta = [] } = useEcsQuery(() =>
    ecsApi.getEntitiesWithComponent("metadata")
  );

  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [pendingWatchId, setPendingWatchId] = useState<string | null>(null);

  useEffect(() => {
    const checkPending = () => {
      const pending = localStorage.getItem("pendingWatchId");
      if (pending) {
        setPendingWatchId(pending);
      }
    };
    checkPending();
    window.addEventListener("focus", checkPending);
    return () => window.removeEventListener("focus", checkPending);
  }, []);

  const handleConfirmWatch = async (watched: boolean) => {
    if (!pendingWatchId) return;
    
    if (watched) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      await ecsApi.deleteEntity(pendingWatchId);
      refetch();
    }
    
    localStorage.removeItem("pendingWatchId");
    setPendingWatchId(null);
  };

  // Split into shorts / long-form by reading the stored URL from the metadata component
  const metaByEntityId = new Map(
    allMeta.map((c: any) => [c.entityId, c.data])
  );

  const shorts = (videos ?? []).filter(
    (v) => isShortUrl(metaByEntityId.get(v.id)?.url ?? "")
  );
  const longForm = (videos ?? []).filter(
    (v) => !isShortUrl(metaByEntityId.get(v.id)?.url ?? "")
  );

  const handleAdd = async () => {
    if (!newUrl.trim() || adding) return;
    setAdding(true);
    const url = newUrl.trim();
    let title = url;
    let duration = "";
    let views = "";
    let publishedAt = "";
    let channelName = "";
    let channelPfp = "";
    let isVerified = false;

    try {
      const u = new URL(url);
      title = u.hostname + u.pathname;
      const apiKey = YOUTUBE_API_KEY || import.meta.env.VITE_YOUTUBE_API_KEY;
      if (apiKey && (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be"))) {
        const videoId = extractVideoId(url);
        if (videoId) {
          const res = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.items?.length > 0) {
              const video = data.items[0];
              title = video.snippet.title;
              duration = parseIsoDuration(video.contentDetails.duration);
              views = formatViewCount(video.statistics.viewCount);
              publishedAt = video.snippet.publishedAt;
              channelName = video.snippet.channelTitle;
              const channelId = video.snippet.channelId;
              const channelRes = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
              );
              if (channelRes.ok) {
                const channelData = await channelRes.json();
                if (channelData.items?.length > 0) {
                  const ch = channelData.items[0];
                  channelPfp = ch.snippet.thumbnails?.default?.url || "";
                  isVerified = parseInt(ch.statistics.subscriberCount || "0", 10) > 100_000;
                }
              }
            }
          }
        }
      }
    } catch (_) {}

    const entity = await ecsApi.createEntity(ENTITY_TYPES.VIDEO);
    await ecsApi.setComponent(entity.id, "title", { title });
    await ecsApi.setComponent(entity.id, "metadata", {
      url, duration, views, publishedAt, channelName, channelPfp, isVerified,
    });
    await ecsApi.setComponent(entity.id, "status", { status: "unwatched" });
    setNewUrl("");
    setAdding(false);
    refetch();
  };

  const isEmpty = (videos?.length ?? 0) === 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Watch Later</h1>
        <p className="text-muted-foreground">THE GREATEST WATCH LATER THAT HAS EVER LIVED!</p>
      </div>

      {/* URL input */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Paste YouTube URL (video or short)..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              disabled={adding}
            />
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center p-16 text-center border rounded-lg border-dashed">
          <FaYoutube className="text-5xl mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-medium">Your queue is empty</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Paste a YouTube link above — shorts and long videos are sorted automatically.
          </p>
        </div>
      )}

      {/* ── Shorts Section ─────────────────────────────────────────────── */}
      {shorts.length > 0 && (
        <ShortsSection shorts={shorts} refetch={refetch} />
      )}

      {/* ── Long-form Section ───────────────────────────────────────────── */}
      {longForm.length > 0 && (
        <div className="space-y-4">
          {shorts.length > 0 && (
            <div className="flex items-center gap-2">
              <FaYoutube className="text-[#ff0000] text-xl" />
              <h2 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
                Videos
              </h2>
            </div>
          )}
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {longForm.map((video) => (
              <VideoCard key={video.id} videoId={video.id} refetchList={refetch} />
            ))}
          </div>
        </div>
      )}

      {/* Pending Watch Modal */}
      <Dialog open={!!pendingWatchId} onOpenChange={(open) => {
        if (!open) {
          localStorage.removeItem("pendingWatchId");
          setPendingWatchId(null);
        }
      }}>
        <DialogContent className="sm:max-w-md bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Did you watch this video?</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-4 pointer-events-none">
            {pendingWatchId && (
              shorts.find((s) => s.id === pendingWatchId) ? (
                <ShortCard videoId={pendingWatchId} refetchList={refetch} previewOnly />
              ) : longForm.find((l) => l.id === pendingWatchId) ? (
                <div className="w-full max-w-sm">
                  <VideoCard videoId={pendingWatchId} refetchList={refetch} previewOnly />
                </div>
              ) : null
            )}
          </div>
          <div className="flex gap-3 justify-center mt-2">
            <Button variant="outline" className="w-24" onClick={() => handleConfirmWatch(false)}>No</Button>
            <Button className="w-24" onClick={() => handleConfirmWatch(true)}>Yes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shorts Horizontal Section ────────────────────────────────────────────────

function ShortsSection({
  shorts,
  refetch,
}: {
  shorts: { id: string }[];
  refetch: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? 320 : -320, behavior: "smooth" });
  };

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SiYoutubeshorts className="text-[#ff0000] text-xl" />
          <h2 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
            Shorts
          </h2>
          <span className="text-xs text-muted-foreground/60">({shorts.length})</span>
        </div>
        {/* Scroll controls */}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Horizontal scroll strip */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {shorts.map((video) => (
          <ShortCard key={video.id} videoId={video.id} refetchList={refetch} />
        ))}
      </div>
    </div>
  );
}

// ─── Short Card (9:16 portrait) ───────────────────────────────────────────────

function ShortCard({ videoId, refetchList, previewOnly }: { videoId: string; refetchList: () => void; previewOnly?: boolean }) {
  const { data: titleComp } = useEcsQuery(() => ecsApi.getComponent(videoId, "title"));
  const { data: metaComp } = useEcsQuery(() => ecsApi.getComponent(videoId, "metadata"));
  const { data: statusComp } = useEcsQuery(() =>
    ecsApi.getComponent(videoId, "status")
  );

  const isWatched = statusComp?.data?.status === "watched";
  const metadata = metaComp?.data || {};
  const url = metadata.url || "";
  const channelName = metadata.channelName || "";
  const channelPfp = metadata.channelPfp;
  const views = metadata.views;
  const title = titleComp?.data?.title || url || "Untitled";

  const videoId_yt = extractVideoId(url);
  // Shorts look best with a portrait-cropped thumbnail
  const thumbnail = videoId_yt
    ? `https://i.ytimg.com/vi/${videoId_yt}/hqdefault.jpg`
    : "";

  const handleDelete = async () => {
    await ecsApi.deleteEntity(videoId);
    refetchList();
  };

  return (
    // Fixed width — portrait 9:16 card, horizontally scrollable
    <div
      className={cn(
        "group relative shrink-0 select-none",
        isWatched && "opacity-50",
        !previewOnly && "cursor-pointer"
      )}
      style={{ width: "160px" }}
      onClick={() => {
        if (!previewOnly) {
          localStorage.setItem("pendingWatchId", videoId);
          window.open(url, "_blank");
        }
      }}
    >
      {/* Portrait thumbnail */}
      <div
        className="relative rounded-2xl overflow-hidden bg-muted"
        style={{ aspectRatio: "9/16" }}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <SiYoutubeshorts className="text-3xl text-muted-foreground opacity-40" />
          </div>
        )}

        {/* Shorts badge */}
        <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/70 rounded-full px-1.5 py-0.5">
          <SiYoutubeshorts className="text-[#ff0000] text-xs" />
          <span className="text-[9px] font-bold text-white tracking-wide">SHORT</span>
        </div>

        {/* Hover actions */}
        {!previewOnly && (
          <>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-2xl" />
            <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <Button
                size="icon"
                variant="destructive"
                className="h-7 w-7 rounded-full"
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}

      </div>

      {/* Title + channel below card */}
      <div className="mt-2 px-0.5 space-y-1.5">
        <p className="text-xs font-semibold leading-snug line-clamp-2 text-foreground">
          {title}
        </p>
        <div className="flex items-center gap-2">
          {channelPfp ? (
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={channelPfp} alt={channelName} />
              <AvatarFallback>{channelName?.charAt(0) || "?"}</AvatarFallback>
            </Avatar>
          ) : (
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarFallback>{title?.charAt(0) || "S"}</AvatarFallback>
            </Avatar>
          )}
          <div className="flex flex-col overflow-hidden">
            {channelName && (
              <span className="text-[10px] font-medium text-muted-foreground truncate">{channelName}</span>
            )}
            {views && (
              <span className="text-[9px] text-muted-foreground/80 truncate">{views} views</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Long-form Video Card ─────────────────────────────────────────────────────

function VideoCard({ videoId, refetchList, previewOnly }: { videoId: string; refetchList: () => void; previewOnly?: boolean }) {
  const { data: titleComp } = useEcsQuery(() => ecsApi.getComponent(videoId, "title"));
  const { data: metaComp } = useEcsQuery(() => ecsApi.getComponent(videoId, "metadata"));
  const { data: statusComp } = useEcsQuery(() =>
    ecsApi.getComponent(videoId, "status")
  );

  const isWatched = statusComp?.data?.status === "watched";
  const metadata = metaComp?.data || {};
  const url = metadata.url || "";
  const duration = metadata.duration;
  const views = metadata.views;
  const publishedAt = metadata.publishedAt;
  const channelName = metadata.channelName;
  const channelPfp = metadata.channelPfp;
  const isVerified = metadata.isVerified;

  const videoId_yt = extractVideoId(url);
  const thumbnail = videoId_yt
    ? `https://i.ytimg.com/vi/${videoId_yt}/hqdefault.jpg`
    : "";

  const handleDelete = async () => {
    await ecsApi.deleteEntity(videoId);
    refetchList();
  };

  const relativeTime = publishedAt
    ? formatDistanceToNowStrict(new Date(publishedAt), { addSuffix: true })
    : "";

  return (
    <Card
      className={cn(
        "group overflow-hidden transition-all bg-transparent border-0 shadow-none",
        isWatched && "opacity-60"
      )}
    >
      {/* 16:9 Thumbnail */}
      <div
        className={cn("aspect-video bg-muted relative rounded-xl overflow-hidden", !previewOnly && "cursor-pointer")}
        onClick={() => {
          if (!previewOnly) {
            localStorage.setItem("pendingWatchId", videoId);
            window.open(url, "_blank");
          }
        }}
      >
        {thumbnail ? (
          <img src={thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Youtube className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>
        )}

        {duration && (
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium tracking-wide">
            {duration}
          </div>
        )}

        {!previewOnly && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <Button
              size="icon"
              variant="destructive"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Info row */}
      <div
        className={cn("flex gap-3 mt-3 px-1", !previewOnly && "cursor-pointer")}
        onClick={() => {
          if (!previewOnly) {
            localStorage.setItem("pendingWatchId", videoId);
            window.open(url, "_blank");
          }
        }}
      >
        {channelPfp ? (
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={channelPfp} alt={channelName} />
            <AvatarFallback>{channelName?.charAt(0) || "?"}</AvatarFallback>
          </Avatar>
        ) : (
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback>{titleComp?.data?.title?.charAt(0) || "V"}</AvatarFallback>
          </Avatar>
        )}

        <div className="flex flex-col overflow-hidden">
          <h3 className="text-sm font-semibold leading-tight line-clamp-2 text-foreground mb-1">
            {titleComp?.data?.title || url || "Untitled"}
          </h3>
          {channelName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <span className="truncate">{channelName}</span>
              {isVerified && <BadgeCheck className="h-3 w-3 shrink-0" />}
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            {views && <span>{views} views</span>}
            {views && relativeTime && <span>•</span>}
            {relativeTime && <span>{relativeTime}</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}
