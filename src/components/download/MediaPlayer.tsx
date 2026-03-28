import { useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";

interface MediaPlayerProps {
  type: "audio" | "video";
  fileUrl: string;
  fileId: string;
  productId: string;
  userId: string;
}

export function MediaPlayer({ type, fileUrl, fileId, productId, userId }: MediaPlayerProps) {
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement>(null);
  const queryClient = useQueryClient();
  const lastSavedRef = useRef(0);

  const { data: savedProgress } = useQuery({
    queryKey: ["media-progress", fileId, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("media_playback_progress")
        .select("progress_seconds, duration_seconds")
        .eq("user_id", userId)
        .eq("file_id", fileId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId && !!fileId,
  });

  // Restore position when metadata is loaded
  useEffect(() => {
    const el = mediaRef.current;
    if (!el || !savedProgress?.progress_seconds) return;

    const handleLoaded = () => {
      if (savedProgress.progress_seconds > 0 && savedProgress.progress_seconds < el.duration) {
        el.currentTime = Number(savedProgress.progress_seconds);
      }
    };

    if (el.readyState >= 1) {
      handleLoaded();
    } else {
      el.addEventListener("loadedmetadata", handleLoaded, { once: true });
      return () => el.removeEventListener("loadedmetadata", handleLoaded);
    }
  }, [savedProgress]);

  const saveProgress = useCallback(async (currentTime: number, duration: number) => {
    // Throttle: only save if changed by >= 3 seconds
    if (Math.abs(currentTime - lastSavedRef.current) < 3) return;
    lastSavedRef.current = currentTime;

    const payload = {
      user_id: userId,
      product_id: productId,
      file_id: fileId,
      progress_seconds: Math.floor(currentTime),
      duration_seconds: Math.floor(duration),
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("media_playback_progress")
      .select("id")
      .eq("user_id", userId)
      .eq("file_id", fileId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("media_playback_progress")
        .update({
          progress_seconds: payload.progress_seconds,
          duration_seconds: payload.duration_seconds,
          updated_at: payload.updated_at,
        } as any)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("media_playback_progress")
        .insert(payload as any);
    }

    queryClient.invalidateQueries({ queryKey: ["media-progress", fileId, userId] });
  }, [userId, productId, fileId, queryClient]);

  const handleTimeUpdate = useCallback(() => {
    const el = mediaRef.current;
    if (!el || el.paused) return;
    saveProgress(el.currentTime, el.duration);
  }, [saveProgress]);

  const handlePause = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    // Force save on pause regardless of throttle
    lastSavedRef.current = 0;
    saveProgress(el.currentTime, el.duration);
  }, [saveProgress]);

  const progressPercent = savedProgress?.duration_seconds
    ? Math.round((Number(savedProgress.progress_seconds) / Number(savedProgress.duration_seconds)) * 100)
    : 0;

  if (type === "audio") {
    return (
      <div className="px-4 pt-4 space-y-2">
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          controls
          preload="metadata"
          className="w-full h-10 rounded-lg"
          style={{ colorScheme: "dark" }}
          onTimeUpdate={handleTimeUpdate}
          onPause={handlePause}
          onEnded={handlePause}
        >
          <source src={fileUrl} />
        </audio>
        {progressPercent > 0 && progressPercent < 100 && (
          <div className="flex items-center gap-2 px-1">
            <Progress value={progressPercent} className="h-1.5 flex-1" />
            <span className="text-[0.6rem] text-muted-foreground whitespace-nowrap">{progressPercent}%</span>
          </div>
        )}
        {progressPercent >= 100 && (
          <p className="text-[0.6rem] text-green-500 px-1">✓ Concluído</p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full bg-black/5 space-y-2">
      <video
        ref={mediaRef as React.RefObject<HTMLVideoElement>}
        controls
        preload="metadata"
        className="w-full max-h-72 object-contain"
        onTimeUpdate={handleTimeUpdate}
        onPause={handlePause}
        onEnded={handlePause}
      >
        <source src={fileUrl} />
      </video>
      {progressPercent > 0 && (
        <div className="flex items-center gap-2 px-4 pb-2">
          <Progress value={progressPercent} className="h-1.5 flex-1" />
          <span className="text-[0.6rem] text-muted-foreground whitespace-nowrap">
            {progressPercent >= 100 ? "✓ Concluído" : `${progressPercent}%`}
          </span>
        </div>
      )}
    </div>
  );
}
