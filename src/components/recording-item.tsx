"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Download, Trash2 } from "lucide-react";

export type Recording = {
  id: string;
  name: string;
  url: string;
  blob: Blob;
  duration: number;
  enhanced: boolean;
  size: number;
  createdAt: number;
};

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function extFor(blob: Blob): string {
  const t = blob.type;
  if (t.includes("webm")) return "webm";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("mp4")) return "m4a";
  return "audio";
}

export function RecordingItem({
  rec,
  active,
  onPlay,
  onDelete,
  onDownload,
}: {
  rec: Recording;
  active: boolean;
  onPlay: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlaying(false);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (active) {
      void audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      audio.pause();
      audio.currentTime = 0;
      setPlaying(false);
    }
  }, [active]);

  return (
    <li className="rounded-2xl border bg-card/80 p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPlay}
          aria-label={playing ? "暂停" : "播放"}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white transition active:scale-95"
        >
          {playing ? (
            <Pause className="size-4 fill-current" />
          ) : (
            <Play className="size-4 fill-current" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{rec.name}</span>
            {rec.enhanced && (
              <span className="shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                增强版
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatTime(rec.duration)} · {formatSize(rec.size)}
          </div>
        </div>
        <button
          type="button"
          onClick={onDownload}
          aria-label="下载"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Download className="size-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="删除"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-rose-50 hover:text-rose-500"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <audio ref={audioRef} src={rec.url} preload="metadata" className="hidden" />
    </li>
  );
}

export { formatTime, formatSize, extFor };
