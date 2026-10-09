"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  Mic,
  Square,
  Sparkles,
  Waves,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  buildGraph,
  DEFAULT_SETTINGS,
  requestMicStream,
  type EnhancementSettings,
  type RecorderHandle,
} from "@/lib/audio-engine";
import { VoiceSlider } from "@/components/voice-slider";
import { RecordingItem, formatTime, type Recording } from "@/components/recording-item";
import { cn } from "cn";

type Status = "idle" | "requesting" | "recording" | "error";

export function Recorder() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<EnhancementSettings>(DEFAULT_SETTINGS);
  const [elapsed, setElapsed] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleRef = useRef<RecorderHandle | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = useRef(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopVisualizer = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const bars = 48;
    const gap = 3;
    const bw = (width - gap * (bars - 1)) / bars;
    for (let i = 0; i < bars; i++) {
      const h = 4;
      const x = i * (bw + gap);
      const y = (height - h) / 2;
      ctx.fillStyle = "rgba(120, 120, 135, 0.25)";
      ctx.fillRect(x, y, bw, h);
    }
  }, []);

  const startVisualizer = useCallback((analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(data);
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const bars = 48;
      const gap = 3;
      const bw = (width - gap * (bars - 1)) / bars;
      const step = Math.max(1, Math.floor(data.length / bars / 2));
      for (let i = 0; i < bars; i++) {
        const v = data[i * step] / 255;
        const h = Math.max(4, v * height * 0.92);
        const x = i * (bw + gap);
        const y = (height - h) / 2;
        const grad = ctx.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, "rgba(99, 102, 241, 0.9)");
        grad.addColorStop(1, "rgba(168, 85, 247, 0.9)");
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, bw, h);
      }
    };
    render();
  }, []);

  const stop = useCallback(() => {
    stopTimer();
    stopVisualizer();
    const handle = handleRef.current;
    if (!handle) return;

    handle.recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: handle.recorder.mimeType || "audio/webm",
      });
      chunksRef.current = [];
      const url = URL.createObjectURL(blob);
      const id = `rec-${Date.now()}`;
      const rec: Recording = {
        id,
        name: `录音 ${new Date().toLocaleString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        url,
        blob,
        duration: elapsed,
        enhanced: settings.enabled,
        size: blob.size,
        createdAt: Date.now(),
      };
      setRecordings((prev) => [rec, ...prev]);
      setActiveId(id);
      handle.cleanup();
      handleRef.current = null;
      setStatus("idle");
      drawIdle();
    };

    try {
      handle.recorder.stop();
    } catch {
      handle.cleanup();
      handleRef.current = null;
      setStatus("idle");
      drawIdle();
    }
  }, [drawIdle, elapsed, settings.enabled, stopTimer, stopVisualizer]);

  const start = useCallback(async () => {
    setError(null);
    setStatus("requesting");
    try {
      const stream = await requestMicStream();
      const handle = buildGraph(stream, settings);
      handleRef.current = handle;
      chunksRef.current = [];

      handle.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      startTimeRef.current = Date.now();
      setElapsed(0);
      handle.recorder.start(100);
      setStatus("recording");
      startVisualizer(handle.analyser);

      stopTimer();
      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - startTimeRef.current) / 1000);
      }, 200);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "无法访问麦克风，请检查权限。";
      setError(msg);
      setStatus("error");
      drawIdle();
    }
  }, [drawIdle, settings, startVisualizer, stopTimer]);

  const toggle = useCallback(() => {
    if (status === "recording") {
      stop();
    } else if (status === "idle" || status === "error") {
      void start();
    }
  }, [status, start, stop]);

  const deleteRecording = useCallback((id: string) => {
    setRecordings((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((r) => r.id !== id);
    });
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  useEffect(() => {
    drawIdle();
    return () => {
      stopTimer();
      stopVisualizer();
      handleRef.current?.cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recording = status === "recording";
  const requesting = status === "requesting";

  return (
    <div className="min-h-dvh w-full bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-8">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30">
            <Mic className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">速记录音</h1>
            <p className="text-xs text-muted-foreground">一点即录 · 人声增强</p>
          </div>
        </header>

        <section className="rounded-3xl border bg-card/80 p-5 shadow-sm backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "inline-flex size-2.5 rounded-full",
                  recording ? "animate-pulse bg-rose-500" : "bg-slate-300",
                )}
              />
              <span className="font-mono text-2xl tabular-nums tracking-tight">
                {formatTime(elapsed)}
              </span>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                recording
                  ? "bg-rose-50 text-rose-600"
                  : "bg-slate-100 text-slate-500",
              )}
            >
              {recording ? "录制中" : requesting ? "准备中" : "待机"}
            </span>
          </div>

          <canvas
            ref={canvasRef}
            width={320}
            height={72}
            className="mb-5 h-[72px] w-full"
          />

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={toggle}
              disabled={requesting}
              aria-label={recording ? "停止录音" : "开始录音"}
              className={cn(
                "relative flex size-28 items-center justify-center rounded-full text-white shadow-xl transition-all active:scale-95 disabled:opacity-60",
                recording
                  ? "bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/40"
                  : "bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-indigo-500/40",
              )}
            >
              {requesting ? (
                <Loader2 className="size-9 animate-spin" />
              ) : recording ? (
                <Square className="size-9 fill-current" />
              ) : (
                <Mic className="size-10" />
              )}
              {recording && (
                <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-rose-400/40" />
              )}
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {recording ? "点击方块停止" : "点击麦克风开始录音"}
          </p>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        <section className="mt-4 rounded-3xl border bg-card/80 p-5 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-indigo-500" />
              <span className="text-sm font-medium">人声增强</span>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) =>
                setSettings((s) => ({ ...s, enabled: Boolean(v) }))
              }
              aria-label="人声增强开关"
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            开启后实时降噪、提升人声亮度并压缩动态范围，让说话声更清晰、音量更平稳。
          </p>
          <div className="mt-4 space-y-3">
            <VoiceSlider
              label="音量增益"
              value={settings.gain}
              min={1}
              max={3}
              step={0.1}
              format={(v) => `${v.toFixed(1)}x`}
              onChange={(v) => setSettings((s) => ({ ...s, gain: v }))}
              disabled={!settings.enabled}
            />
            <VoiceSlider
              label="人声亮度"
              value={settings.presence}
              min={0}
              max={6}
              step={0.5}
              format={(v) => `${v.toFixed(1)} dB`}
              onChange={(v) => setSettings((s) => ({ ...s, presence: v }))}
              disabled={!settings.enabled}
            />
            <VoiceSlider
              label="低切频率"
              value={settings.highpass}
              min={40}
              max={200}
              step={5}
              format={(v) => `${v} Hz`}
              onChange={(v) => setSettings((s) => ({ ...s, highpass: v }))}
              disabled={!settings.enabled}
            />
          </div>
        </section>

        <section className="mt-4 flex-1">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Waves className="size-4 text-muted-foreground" />
            <span>录音列表</span>
            <span className="text-xs text-muted-foreground">
              ({recordings.length})
            </span>
          </div>

          {recordings.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card/40 p-8 text-center text-sm text-muted-foreground">
              还没有录音，点击上方麦克风开始吧。
            </div>
          ) : (
            <ul className="space-y-2.5">
              {recordings.map((rec) => (
                <RecordingItem
                  key={rec.id}
                  rec={rec}
                  active={activeId === rec.id}
                  onPlay={() =>
                    setActiveId((cur) => (cur === rec.id ? null : rec.id))
                  }
                  onDelete={() => deleteRecording(rec.id)}
                  onDownload={() => {
                    const a = document.createElement("a");
                    a.href = rec.url;
                    const ext = rec.blob.type.includes("webm")
                      ? "webm"
                      : rec.blob.type.includes("mp4")
                        ? "m4a"
                        : "audio";
                    a.download = `${rec.name.replace(/[^\w\u4e00-\u9fa5-]+/g, "_")}.${ext}`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          录音与处理均在本地完成，不上传任何服务器。
          <br />
          建议使用 iPhone Safari 或安卓 Chrome 获得最佳效果。
        </footer>
      </div>
    </div>
  );
}
