import { useState } from "react";
import { useEcsQuery } from "@/ecs/hooks";
import { ecsApi } from "@/ecs/api";
import { ENTITY_TYPES } from "@/ecs/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Youtube, Trash2, CheckCircle, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { YOUTUBE_API_KEY } from "@/lib/youtubeapi";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNowStrict } from "date-fns";

const parseIsoDuration = (duration: string) => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "0:00";

  const h = parseInt(match[1] || "0", 10);
  const m = parseInt(match[2] || "0", 10);
  const s = parseInt(match[3] || "0", 10);

  const mStr = m.toString().padStart(h > 0 ? 2 : 1, "0");
  const sStr = s.toString().padStart(2, "0");

  if (h > 0) {
    return `${h}:${mStr}:${sStr}`;
  }
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

export function WatchLater() {
  const { data: videos, refetch } = useEcsQuery(() => ecsApi.getEntitiesByType(ENTITY_TYPES.VIDEO));
  const [newUrl, setNewUrl] = useState("");

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
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
      if (apiKey && (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be'))) {
        const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        if (videoIdMatch && videoIdMatch[1]) {
          const videoId = videoIdMatch[1];
          const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`);
          if (res.ok) {
            const data = await res.json();
            if (data.items && data.items.length > 0) {
              const video = data.items[0];
              title = video.snippet.title;
              duration = parseIsoDuration(video.contentDetails.duration);
              views = formatViewCount(video.statistics.viewCount);
              publishedAt = video.snippet.publishedAt;
              channelName = video.snippet.channelTitle;
              const channelId = video.snippet.channelId;
              
              // Fetch channel info
              const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`);
              if (channelRes.ok) {
                const channelData = await channelRes.json();
                if (channelData.items && channelData.items.length > 0) {
                  const channel = channelData.items[0];
                  channelPfp = channel.snippet.thumbnails?.default?.url || "";
                  const subs = parseInt(channel.statistics.subscriberCount || "0", 10);
                  isVerified = subs > 100000;
                }
              }
            }
          }
        }
      }
    } catch(e) {}

    const video = await ecsApi.createEntity(ENTITY_TYPES.VIDEO);
    await ecsApi.setComponent(video.id, 'title', { title });
    await ecsApi.setComponent(video.id, 'metadata', { url, duration, views, publishedAt, channelName, channelPfp, isVerified });
    await ecsApi.setComponent(video.id, 'status', { status: 'unwatched' });
    setNewUrl("");
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Watch Later</h1>
          <p className="text-muted-foreground">Queue up your learning resources.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Input 
              placeholder="Paste video URL..." 
              value={newUrl} 
              onChange={(e) => setNewUrl(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            />
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {videos?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed">
            <Youtube className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium">Your queue is empty</h3>
            <p className="text-sm text-muted-foreground mt-1">Paste a link to start watching later.</p>
          </div>
        )}
        
        {videos?.map((video) => (
          <VideoCard key={video.id} videoId={video.id} refetchList={refetch} />
        ))}
      </div>
    </div>
  );
}

function VideoCard({ videoId, refetchList }: { videoId: string, refetchList: () => void }) {
  const { data: titleComp } = useEcsQuery(() => ecsApi.getComponent(videoId, 'title'));
  const { data: metaComp } = useEcsQuery(() => ecsApi.getComponent(videoId, 'metadata'));
  const { data: statusComp, refetch: refetchStatus } = useEcsQuery(() => ecsApi.getComponent(videoId, 'status'));

  const isWatched = statusComp?.data?.status === 'watched';
  const metadata = metaComp?.data || {};
  const url = metadata.url || '';
  const duration = metadata.duration;
  const views = metadata.views;
  const publishedAt = metadata.publishedAt;
  const channelName = metadata.channelName;
  const channelPfp = metadata.channelPfp;
  const isVerified = metadata.isVerified;

  let thumbnail = '';
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (videoIdMatch && videoIdMatch[1]) {
      thumbnail = `https://i.ytimg.com/vi/${videoIdMatch[1]}/hqdefault.jpg`;
    }
  }

  const toggleStatus = async () => {
    const newStatus = isWatched ? 'unwatched' : 'watched';
    await ecsApi.setComponent(videoId, 'status', { status: newStatus });
    refetchStatus();
  };

  const handleDelete = async () => {
    await ecsApi.deleteEntity(videoId);
    refetchList();
  };

  const relativeTime = publishedAt ? formatDistanceToNowStrict(new Date(publishedAt), { addSuffix: true }) : '';

  return (
    <Card className={cn("group overflow-hidden transition-all bg-transparent border-0 shadow-none", isWatched && "opacity-60")}>
      <div className="aspect-video bg-muted relative rounded-xl overflow-hidden cursor-pointer" onClick={() => window.open(url, '_blank')}>
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

        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <Button size="icon" variant="secondary" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); toggleStatus(); }}>
             <CheckCircle className={cn("h-4 w-4", isWatched ? "text-primary" : "")} />
           </Button>
           <Button size="icon" variant="destructive" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleDelete(); }}>
             <Trash2 className="h-4 w-4" />
           </Button>
        </div>
      </div>

      <div className="flex gap-3 mt-3 px-1 cursor-pointer" onClick={() => window.open(url, '_blank')}>
        {channelPfp ? (
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={channelPfp} alt={channelName} />
            <AvatarFallback>{channelName?.charAt(0) || '?'}</AvatarFallback>
          </Avatar>
        ) : (
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback>{titleComp?.data?.title?.charAt(0) || 'V'}</AvatarFallback>
          </Avatar>
        )}
        
        <div className="flex flex-col overflow-hidden">
          <h3 className="text-sm font-semibold leading-tight line-clamp-2 text-foreground mb-1">
            {titleComp?.data?.title || url || 'Untitled'}
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
