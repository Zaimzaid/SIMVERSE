"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft, Download, FileVideo, ImagePlus, Pause, Play, RotateCcw, Scissors,
  SlidersHorizontal, Type, Upload, Volume2, VolumeX, X,
} from "lucide-react";
import {
  clampTrim, editedDuration, formatVideoTime, initialVideoSettings,
  OUTPUT_SIZES, renderVideoFrame, type VideoAspect, type VideoEditSettings,
} from "@/lib/video-studio/editor";
import { Button } from "@/components/ui/button";

type LocalVideo = { name: string; url: string; size: number };
type AudioChain = { context: AudioContext; gain: GainNode };

const fieldClass = "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none";
const sliderClass = "mt-2 block w-full accent-teal-500";
const sectionClass = "rounded-2xl border border-border bg-surface p-4 sm:p-5";

function selectRecorderFormat(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const format of ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(format)) return format;
  }
  return null;
}

function seekTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  if (Math.abs(video.currentTime - seconds) < 0.025) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      video.removeEventListener("seeked", done);
      reject(new Error("Video seeking timed out. Try a different video file."));
    }, 12000);
    function done() {
      window.clearTimeout(timeout);
      resolve();
    }
    video.addEventListener("seeked", done, { once: true });
    try { video.currentTime = seconds; }
    catch (error) {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", done);
      reject(error);
    }
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function VideoStudio({ canEdit }: { canEdit: boolean }) {
  const [file, setFile] = useState<LocalVideo | null>(null);
  const [duration, setDuration] = useState(0);
  const [settings, setSettings] = useState<VideoEditSettings>(() => initialVideoSettings());
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [logoName, setLogoName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const logoUrlRef = useRef<string | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<AudioChain | null>(null);
  const cancelExportRef = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    cancelExportRef.current?.();
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    void audioRef.current?.context.close();
  }, []);

  function update(patch: Partial<VideoEditSettings>) {
    setSettings((old) => ({ ...old, ...patch }));
  }

  function openVideo(source: File | undefined) {
    if (!source || exporting || !canEdit) return;
    if (!source.type.startsWith("video/")) {
      setError("Choose a supported video file from your device.");
      return;
    }
    videoRef.current?.pause();
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    void audioRef.current?.context.close();
    audioRef.current = null;
    const url = URL.createObjectURL(source);
    sourceUrlRef.current = url;
    setFile({ name: source.name, size: source.size, url });
    setDuration(0);
    setSettings(initialVideoSettings());
    setPlayhead(0);
    setPlaying(false);
    setProgress(0);
    setError("");
    setNotice("Video loaded locally. Your original file has not been changed.");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    openVideo(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    openVideo(event.dataTransfer.files[0]);
  }

  function addLogo(source: File | undefined) {
    if (!source || !canEdit) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(source.type)) {
      setError("Your logo must be a PNG, JPEG, or WebP image.");
      return;
    }
    const url = URL.createObjectURL(source);
    const image = new Image();
    image.onload = () => {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
      logoUrlRef.current = url;
      logoRef.current = image;
      setLogoName(source.name);
      setError("");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Could not read the selected logo.");
    };
    image.src = url;
  }

  function removeLogo() {
    if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    logoUrlRef.current = null;
    logoRef.current = null;
    setLogoName("");
  }

  function onMetadata() {
    const video = videoRef.current;
    if (!video) return;
    if (!Number.isFinite(video.duration) || video.duration < 0.1) {
      setError("This video does not have a usable duration.");
      return;
    }
    setDuration(video.duration);
    setSettings(initialVideoSettings(video.duration));
    setPlayhead(0);
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = settings.speed;
    if (audioRef.current) {
      video.muted = false;
      video.volume = 1;
      audioRef.current.gain.gain.value = settings.muted ? 0 : settings.volume;
    } else {
      video.muted = settings.muted;
      video.volume = settings.volume;
    }
  }, [settings.speed, settings.muted, settings.volume, file?.url]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    let frame = 0;
    function draw() {
      if (!video || !canvas) return;
      renderVideoFrame(canvas, video, settings, logoRef.current);
      if (!video.paused && !video.ended) frame = requestAnimationFrame(draw);
    }
    function onTime() {
      setPlayhead(video!.currentTime);
      if (!exporting && video!.currentTime >= settings.trimEnd && settings.trimEnd > 0) {
        video!.pause();
      }
    }
    function onPlay() { setPlaying(true); cancelAnimationFrame(frame); draw(); }
    function onPause() { setPlaying(false); cancelAnimationFrame(frame); draw(); }
    function onSeek() { draw(); }
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeek);
    video.addEventListener("loadeddata", onSeek);
    draw();
    return () => {
      cancelAnimationFrame(frame);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeek);
      video.removeEventListener("loadeddata", onSeek);
    };
  }, [file?.url, settings, exporting, logoName]);

  function setStart(value: number) {
    const trimmed = clampTrim(value, settings.trimEnd, duration);
    update({ trimStart: trimmed.start, trimEnd: trimmed.end, textStart: Math.max(trimmed.start, settings.textStart) });
    if (videoRef.current && videoRef.current.currentTime < trimmed.start) videoRef.current.currentTime = trimmed.start;
  }

  function setEnd(value: number) {
    const trimmed = clampTrim(settings.trimStart, value, duration);
    update({ trimStart: trimmed.start, trimEnd: trimmed.end, textEnd: Math.min(trimmed.end, settings.textEnd) });
    if (videoRef.current && videoRef.current.currentTime > trimmed.end) videoRef.current.currentTime = trimmed.end;
  }

  function seek(value: number) {
    const video = videoRef.current;
    if (!video || exporting) return;
    video.currentTime = value;
    setPlayhead(value);
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video || exporting || !duration) return;
    if (!video.paused) { video.pause(); return; }
    if (video.currentTime < settings.trimStart || video.currentTime >= settings.trimEnd - 0.03) {
      await seekTo(video, settings.trimStart);
    }
    try { await video.play(); }
    catch { setError("Your browser could not play this file. Try an MP4 or WebM video."); }
  }

  function resetEdits() {
    if (exporting) return;
    videoRef.current?.pause();
    setSettings(initialVideoSettings(duration));
    if (videoRef.current) videoRef.current.currentTime = 0;
    removeLogo();
    setNotice("Editing adjustments reset. The original video remains unchanged.");
  }

  async function exportVideo() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const format = selectRecorderFormat();
    if (!video || !canvas || !file || !duration || exporting || !canEdit) return;
    if (!format || typeof canvas.captureStream !== "function") {
      setError("WebM video recording is not supported by this browser. Try recent Chrome, Edge, or Firefox.");
      return;
    }

    setError("");
    setNotice("");
    setProgress(0);
    setExporting(true);
    const snapshot = { ...settings };
    const previousTime = video.currentTime;
    let canvasStream: MediaStream | null = null;
    let audioDestination: MediaStreamAudioDestinationNode | null = null;
    let recordedStream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let raf = 0;
    let stopped = false;
    let cancelled = false;
    let tickTime = 0;

    function stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      video!.pause();
      if (recorder && recorder.state !== "inactive") recorder.stop();
    }

    cancelExportRef.current = () => { cancelled = true; stop(); };
    try {
      video.pause();
      await seekTo(video, snapshot.trimStart);
      renderVideoFrame(canvas, video, snapshot, logoRef.current);

      canvasStream = canvas.captureStream(30);
      const audioTracks: MediaStreamTrack[] = [];
      if (typeof AudioContext !== "undefined") {
        if (!audioRef.current) {
          const context = new AudioContext();
          const source = context.createMediaElementSource(video);
          const gain = context.createGain();
          source.connect(gain);
          gain.connect(context.destination);
          audioRef.current = { context, gain };
        }
        const chain = audioRef.current;
        chain.gain.gain.value = snapshot.muted ? 0 : snapshot.volume;
        video.muted = false;
        video.volume = 1;
        await chain.context.resume();
        audioDestination = chain.context.createMediaStreamDestination();
        chain.gain.connect(audioDestination);
        audioTracks.push(...audioDestination.stream.getAudioTracks());
      }

      recordedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
      recorder = new MediaRecorder(recordedStream, {
        mimeType: format, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000,
      });
      const chunks: BlobPart[] = [];
      const completed = new Promise<Blob>((resolve, reject) => {
        if (!recorder) return reject(new Error("Recorder not available."));
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error("The browser could not finish recording."));
        recorder.onstop = () => resolve(new Blob(chunks, { type: format.split(";")[0] }));
      });
      recorder.start(250);
      try { await video.play(); }
      catch (playbackError) { stop(); await completed.catch(() => undefined); throw playbackError; }
      const start = snapshot.trimStart;
      const length = Math.max(0.1, snapshot.trimEnd - start);
      const tick = (now: number) => {
        if (stopped) return;
        renderVideoFrame(canvas, video, snapshot, logoRef.current);
        if (now - tickTime > 180) {
          setProgress(Math.min(100, Math.round((video.currentTime - start) / length * 100)));
          tickTime = now;
        }
        if (video.currentTime >= snapshot.trimEnd - 0.025 || video.ended) { stop(); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      const result = await completed;
      if (!cancelled) {
        if (!result.size) throw new Error("Recording produced an empty file.");
        const safeName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 70) || "video";
        downloadBlob(result, safeName + "-simverse-edited.webm");
        setProgress(100);
        setNotice("Your edited WebM video was downloaded. The original video was not modified.");
      } else {
        setNotice("Export cancelled. No video was downloaded.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Video export failed. Try again.");
    } finally {
      stop();
      cancelExportRef.current = null;
      if (audioDestination && audioRef.current) audioRef.current.gain.disconnect(audioDestination);
      recordedStream?.getTracks().forEach((track) => track.stop());
      canvasStream?.getTracks().forEach((track) => track.stop());
      try { video.currentTime = previousTime; } catch { /* media may have been replaced */ }
      setExporting(false);
    }
  }

  const size = OUTPUT_SIZES[settings.aspect];
  const videoReady = Boolean(file && duration > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/studio" className="inline-flex items-center gap-2 text-sm text-secondary hover:text-foreground">
          <ArrowLeft className="size-4" />Back to Studio
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => uploadRef.current?.click()} disabled={!canEdit || exporting}>
            <Upload className="size-4" />{file ? "Replace video" : "Import video"}
          </Button>
          <Button disabled={!videoReady || exporting || !canEdit} onClick={() => void exportVideo()}>
            <Download className="size-4" />Export WebM
          </Button>
        </div>
      </div>
      <input ref={uploadRef} type="file" accept="video/*" className="sr-only" aria-label="Choose a video to edit"
        onChange={handleFileChange} disabled={!canEdit || exporting} />
      {!canEdit ? (
        <p className="rounded-xl border border-border p-3 text-sm text-secondary">This workspace requires media editing permission.</p>
      ) : null}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <main className="min-w-0 space-y-5">
          <section className={sectionClass}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">Video preview</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">
                  {file ? file.name : "Your creation starts here"}
                </h2>
                {file ? <p className="mt-1 text-xs text-muted">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · {formatVideoTime(duration)} original · {formatVideoTime(editedDuration(settings))} edited
                </p> : null}
              </div>
              <span className="rounded-lg border border-border px-3 py-1 text-xs text-secondary">{size.label}</span>
            </div>
            <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-xl border border-border-strong bg-[#080c17] p-3 sm:min-h-[360px]"
              onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
              {!file ? (
                <button type="button" disabled={!canEdit} onClick={() => uploadRef.current?.click()}
                  className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-secondary hover:border-accent hover:text-foreground">
                  <FileVideo className="size-10 text-accent" />
                  <span className="font-medium">Choose a video or drop one here</span>
                  <span className="text-xs text-muted">The video stays on your device; it is not uploaded to SIMVERSE.</span>
                </button>
              ) : (
                <canvas ref={canvasRef} width={size.width} height={size.height}
                  aria-label="Preview of the edited video with overlays and visual adjustments"
                  role="img" className="block h-auto max-h-[58vh] w-auto max-w-full rounded-lg shadow-xl" />
              )}
            </div>
            <video key={file?.url ?? "empty"} ref={videoRef} src={file?.url}
              playsInline preload="auto" onLoadedMetadata={onMetadata}
              onError={() => setError("This video could not be decoded. Try an MP4 (H.264) or WebM file.")}
              className="pointer-events-none absolute -left-[9999px] h-px w-px opacity-0"
              aria-hidden="true" />
            <div className="mt-4 flex items-center gap-3">
              <Button size="sm" variant="secondary" onClick={() => void togglePlayback()} disabled={!videoReady || exporting}>
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                {playing ? "Pause" : "Play"}
              </Button>
              <input type="range" className="min-w-0 flex-1 accent-teal-500"
                aria-label="Video playhead" min={settings.trimStart} max={Math.max(settings.trimStart + 0.01, settings.trimEnd)}
                step="0.01" value={Math.min(settings.trimEnd, Math.max(settings.trimStart, playhead))}
                onChange={(event) => seek(Number(event.target.value))} disabled={!videoReady || exporting} />
              <span className="min-w-20 text-right font-mono text-xs text-secondary">
                {formatVideoTime(playhead)} / {formatVideoTime(settings.trimEnd)}
              </span>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="flex items-center gap-2 font-semibold"><Scissors className="size-4 text-accent" />Trim your video</h2>
            <p className="mt-1 text-xs text-muted">Choose where the finished video begins and ends. Your original video is safe.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm text-secondary">Start · {formatVideoTime(settings.trimStart)}
                <input type="range" min="0" max={Math.max(0.1, duration - 0.1)} step="0.05"
                  value={settings.trimStart} onChange={(event) => setStart(Number(event.target.value))}
                  disabled={!videoReady || exporting || !canEdit} className={sliderClass} />
              </label>
              <label className="text-sm text-secondary">End · {formatVideoTime(settings.trimEnd)}
                <input type="range" min="0.1" max={Math.max(0.1, duration)} step="0.05"
                  value={settings.trimEnd} onChange={(event) => setEnd(Number(event.target.value))}
                  disabled={!videoReady || exporting || !canEdit} className={sliderClass} />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/50 px-4 py-3 text-xs text-secondary">
              <span>Selected footage: {formatVideoTime(settings.trimEnd - settings.trimStart)}</span>
              <span>Estimated finished length: {formatVideoTime(editedDuration(settings))}</span>
            </div>
          </section>
        </main>

        <aside className="min-w-0 space-y-4">
          <section className={sectionClass}>
            <h2 className="flex items-center gap-2 font-semibold"><SlidersHorizontal className="size-4 text-accent" />Frame & picture</h2>
            <label className="mt-4 block text-xs font-medium text-secondary">Output format
              <select className={fieldClass} disabled={!canEdit || exporting} value={settings.aspect}
                onChange={(event) => update({ aspect: event.target.value as VideoAspect })}>
                {(Object.keys(OUTPUT_SIZES) as VideoAspect[]).map((key) =>
                  <option key={key} value={key}>{OUTPUT_SIZES[key].label}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-xs font-medium text-secondary">Fit to frame
              <select className={fieldClass} disabled={!canEdit || exporting} value={settings.fit}
                onChange={(event) => update({ fit: event.target.value as VideoEditSettings["fit"] })}>
                <option value="contain">Show whole video (with borders if needed)</option>
                <option value="cover">Fill frame (crop edges)</option>
              </select>
            </label>
            {(["brightness", "contrast", "saturation"] as const).map((field) => (
              <label key={field} className="mt-4 block text-xs capitalize text-secondary">
                {field} · {settings[field]}%
                <input type="range" min="0" max="200" step="5" className={sliderClass}
                  disabled={!canEdit || exporting} value={settings[field]}
                  onChange={(event) => update({ [field]: Number(event.target.value) })} />
              </label>
            ))}
          </section>

          <section className={sectionClass}>
            <h2 className="flex items-center gap-2 font-semibold"><Type className="size-4 text-accent" />Text overlay</h2>
            <label className="mt-3 block text-xs font-medium text-secondary">Text on your video
              <textarea className={fieldClass} value={settings.text} rows={2} maxLength={200}
                placeholder="Add a title or message" disabled={!canEdit || exporting}
                onChange={(event) => update({ text: event.target.value })} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs text-secondary">Placement
                <select className={fieldClass} value={settings.textPosition} disabled={!canEdit || exporting}
                  onChange={(event) => update({ textPosition: event.target.value as VideoEditSettings["textPosition"] })}>
                  <option value="top">Top</option><option value="center">Middle</option><option value="bottom">Bottom</option>
                </select>
              </label>
              <label className="text-xs text-secondary">Color
                <input type="color" className="mt-1.5 block h-10 w-full rounded border border-border bg-background"
                  value={settings.textColor} disabled={!canEdit || exporting}
                  onChange={(event) => update({ textColor: event.target.value })} />
              </label>
            </div>
            <label className="mt-3 block text-xs text-secondary">Text size · {settings.textSize}
              <input type="range" min="24" max="100" step="2" className={sliderClass}
                value={settings.textSize} disabled={!canEdit || exporting}
                onChange={(event) => update({ textSize: Number(event.target.value) })} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs text-secondary">Appears at (seconds)
                <input type="number" className={fieldClass} min={settings.trimStart}
                  max={settings.textEnd} step="0.1" disabled={!canEdit || exporting}
                  value={Number(settings.textStart.toFixed(1))}
                  onChange={(event) => update({ textStart: Math.max(settings.trimStart, Math.min(settings.textEnd, Number(event.target.value))) })} />
              </label>
              <label className="text-xs text-secondary">Disappears at (seconds)
                <input type="number" className={fieldClass} min={settings.textStart}
                  max={settings.trimEnd} step="0.1" disabled={!canEdit || exporting}
                  value={Number(settings.textEnd.toFixed(1))}
                  onChange={(event) => update({ textEnd: Math.max(settings.textStart, Math.min(settings.trimEnd, Number(event.target.value))) })} />
              </label>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="flex items-center gap-2 font-semibold"><ImagePlus className="size-4 text-accent" />Logo or watermark</h2>
            <p className="mt-1 text-xs text-muted">Place a small image in the top-right corner.</p>
            <label className="mt-3 block text-xs text-secondary">Choose image
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!canEdit || exporting}
                onChange={(event) => { addLogo(event.target.files?.[0]); event.target.value = ""; }}
                className="mt-2 block w-full text-xs file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-foreground" />
            </label>
            {logoName ? <div className="mt-3 flex items-center justify-between gap-3 text-xs text-secondary">
              <span className="min-w-0 truncate">{logoName}</span>
              <button type="button" onClick={removeLogo} disabled={exporting} aria-label="Remove logo"
                className="rounded border border-border p-1 hover:text-foreground"><X className="size-4" /></button>
            </div> : null}
          </section>

          <section className={sectionClass}>
            <h2 className="flex items-center gap-2 font-semibold">
              {settings.muted ? <VolumeX className="size-4 text-accent" /> : <Volume2 className="size-4 text-accent" />}
              Playback & sound
            </h2>
            <label className="mt-3 block text-xs text-secondary">Speed
              <select value={String(settings.speed)} onChange={(event) => update({ speed: Number(event.target.value) })}
                disabled={!canEdit || exporting} className={fieldClass}>
                <option value="0.5">0.5× · Slow</option><option value="0.75">0.75×</option>
                <option value="1">1× · Normal</option><option value="1.25">1.25×</option>
                <option value="1.5">1.5×</option><option value="2">2× · Fast</option>
              </select>
            </label>
            <label className="mt-3 block text-xs text-secondary">Volume · {Math.round(settings.volume * 100)}%
              <input type="range" min="0" max="1" step="0.05" className={sliderClass}
                value={settings.volume} disabled={!canEdit || exporting}
                onChange={(event) => update({ volume: Number(event.target.value) })} />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm text-secondary">
              <input type="checkbox" checked={settings.muted} disabled={!canEdit || exporting}
                onChange={(event) => update({ muted: event.target.checked })} className="accent-teal-500" />
              Mute original audio
            </label>
          </section>
        </aside>
      </div>

      <section className={sectionClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Finish & download</h2>
            <p className="mt-1 text-sm text-secondary">
              Export a real WebM video with your chosen trim, framing, text, logo and picture adjustments.
              Recording happens in the browser; keep this tab active.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={resetEdits} disabled={!videoReady || exporting || !canEdit}>
              <RotateCcw className="size-4" />Reset edits
            </Button>
            {exporting ? (
              <Button variant="secondary" onClick={() => cancelExportRef.current?.()}>Cancel export</Button>
            ) : (
              <Button disabled={!videoReady || !canEdit} onClick={() => void exportVideo()}>
                <Download className="size-4" />Export edited video
              </Button>
            )}
          </div>
        </div>
        {exporting ? (
          <div className="mt-4 space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-background">
              <div className="h-full bg-accent transition-all" style={{ width: String(progress) + "%" }} />
            </div>
            <p className="text-xs text-secondary">Recording edited footage · {progress}%</p>
          </div>
        ) : null}
        <div aria-live="polite" className="mt-4 space-y-2">
          {error ? <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{error}</p> : null}
          {notice ? <p className="rounded-lg border border-border bg-background/40 p-3 text-sm text-secondary">{notice}</p> : null}
        </div>
        <p className="mt-3 text-xs text-muted">
          Phase 1: one source video, one text overlay and one image overlay. Projects are not yet saved across page refreshes.
          MP4 encoding, multiple tracks, transitions, advanced audio mixing and cloud storage will come in later phases.
        </p>
      </section>
    </div>
  );
}
