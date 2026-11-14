import React, { useEffect, useRef, useState } from "react";
import {
  Download,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Loader2,
} from "lucide-react";
import type { GeneratedTake } from "../constants/voicePresets";

interface WaveformPlayerProps {
  take: GeneratedTake | null;
  isGenerating: boolean;
  onGenerateClick: () => void;
}

const SPEED_OPTIONS = [0.9, 1, 1.1] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  take,
  isGenerating,
  onGenerateClick,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [peaks, setPeaks] = useState<number[]>([]);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(take?.durationSeconds ?? 0);

    if (!take?.audioUrl) {
      setPeaks([]);
      return;
    }

    let cancelled = false;
    const decodeWaveform = async () => {
      try {
        const res = await fetch(take.audioUrl);
        const arrayBuffer = await res.arrayBuffer();
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioCtx();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (cancelled) {
          await ctx.close();
          return;
        }
        const channelData = audioBuffer.getChannelData(0);
        const barCount = 96;
        const blockSize = Math.max(1, Math.floor(channelData.length / barCount));
        const computed: number[] = [];
        let maxPeak = 0.01;
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          const start = i * blockSize;
          const end = Math.min(channelData.length, start + blockSize);
          for (let j = start; j < end; j++) {
            const abs = Math.abs(channelData[j]);
            if (abs > sum) sum = abs;
          }
          if (sum > maxPeak) maxPeak = sum;
          computed.push(sum);
        }
        const normalized = computed.map((v) => Math.max(0.08, v / maxPeak));
        setPeaks(normalized);
        setDuration(audioBuffer.duration || take.durationSeconds);
        await ctx.close();
      } catch {
        if (!cancelled) {
          setPeaks(Array.from({ length: 96 }, (_, i) => 0.25 + ((i * 7) % 5) * 0.12));
        }
      }
    };

    decodeWaveform();

    return () => {
      cancelled = true;
    };
  }, [take?.id, take?.audioUrl, take?.durationSeconds]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate, take?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
  }, [isMuted, take?.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    const bars = peaks.length > 0 ? peaks : Array.from({ length: 96 }, () => 0.12);
    const totalBars = bars.length;
    const gap = 3;
    const barWidth = Math.max(2, (rect.width - gap * (totalBars - 1)) / totalBars);
    const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;

    for (let i = 0; i < totalBars; i++) {
      const x = i * (barWidth + gap);
      const amp = bars[i];
      const barHeight = Math.max(4, amp * (rect.height * 0.82));
      const y = (rect.height - barHeight) / 2;
      const barPosition = (i + 0.5) / totalBars;

      if (!take) {
        ctx.fillStyle = "#E2DDD4";
      } else if (barPosition <= progressRatio) {
        ctx.fillStyle = "#8C5828";
      } else {
        ctx.fillStyle = "#D6D0C4";
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      ctx.fill();
    }
  }, [peaks, currentTime, duration, take]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !take) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const skipBy = (delta: number) => {
    const audio = audioRef.current;
    if (!audio || !take) return;
    const next = Math.max(0, Math.min(duration || audio.duration || 0, audio.currentTime + delta));
    audio.currentTime = next;
    setCurrentTime(next);
  };

  const handleCanvasSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas || !take || duration <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = clickX / rect.width;
    const targetTime = ratio * duration;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleDownload = () => {
    if (!take) return;
    const link = document.createElement("a");
    link.href = take.audioUrl;
    const safeSlug = take.personaTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    link.download = `abadi-indah-voice-${safeSlug || "elegan"}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section
      aria-label="Pemutar Audio Suara"
      className="bg-white border border-[#E6E2DA] rounded-xl p-6 sm:p-7"
    >
      {take && (
        <audio
          ref={audioRef}
          src={take.audioUrl}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
              setDuration(audioRef.current.duration);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(duration);
          }}
          preload="auto"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#EFECE6]">
        <div>
          <p className="text-xs font-medium text-[#6B665E]">
            {take
              ? `${take.personaTitle} · Suara ${take.voiceName} · ${take.sampleRate / 1000} kHz WAV · ${formatFileSize(take.byteLength)}`
              : "Audio Suara Saja · Tanpa Musik Latar · Format WAV 24 kHz"}
          </p>
        </div>
        <div className="font-mono text-xs tabular-nums text-[#3D3A35]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Interactive Waveform */}
      <div className="py-5">
        {isGenerating ? (
          <div className="h-24 flex flex-col items-center justify-center gap-2.5 bg-[#FAF9F6] border border-[#EFECE6] rounded-lg">
            <Loader2 className="w-5 h-5 text-[#8C5828] animate-spin" />
            <p className="text-sm font-medium text-[#3D3A35]">
              Menyintesis rekaman suara perempuan elegan...
            </p>
          </div>
        ) : !take ? (
          <div className="h-24 flex flex-col sm:flex-row items-center justify-between gap-4 px-5 bg-[#FAF9F6] border border-[#EFECE6] rounded-lg">
            <p className="text-sm text-[#57534C]">
              Klik tombol di samping untuk menghasilkan audio suara perempuan elegan dari naskah Abadi Indah.
            </p>
            <button
              type="button"
              onClick={onGenerateClick}
              className="px-4 py-2.5 text-sm font-medium text-white bg-[#8C5828] hover:bg-[#73441D] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8C5828]"
            >
              Hasilkan Audio Suara
            </button>
          </div>
        ) : (
          <div className="relative">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasSeek}
              aria-label="Garis gelombang audio yang dapat diklik untuk melompat ke bagian tertentu"
              className="w-full h-24 cursor-pointer block"
            />
          </div>
        )}
      </div>

      {/* Transport & Download Controls */}
      <div className="pt-4 border-t border-[#EFECE6] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!take || isGenerating}
            aria-label={isPlaying ? "Jeda audio" : "Putar audio"}
            className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 text-sm font-medium text-white bg-[#161513] hover:bg-[#2E2C28] disabled:bg-[#D6D0C4] disabled:text-[#787268] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8C5828]"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Jeda</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Putar Suara</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => skipBy(-5)}
            disabled={!take || isGenerating}
            aria-label="Mundur 5 detik"
            title="Mundur 5 detik"
            className="inline-flex items-center justify-center min-w-[42px] min-h-[42px] px-2.5 text-xs font-mono tabular-nums text-[#3D3A35] bg-[#FAF9F6] hover:bg-[#EFECE6] disabled:opacity-40 border border-[#E6E2DA] rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            5s
          </button>

          <button
            type="button"
            onClick={() => skipBy(5)}
            disabled={!take || isGenerating}
            aria-label="Maju 5 detik"
            title="Maju 5 detik"
            className="inline-flex items-center justify-center min-w-[42px] min-h-[42px] px-2.5 text-xs font-mono tabular-nums text-[#3D3A35] bg-[#FAF9F6] hover:bg-[#EFECE6] disabled:opacity-40 border border-[#E6E2DA] rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            5s
            <RotateCw className="w-3.5 h-3.5 ml-1" />
          </button>

          <button
            type="button"
            onClick={() => setIsMuted((prev) => !prev)}
            disabled={!take || isGenerating}
            aria-label={isMuted ? "Aktifkan suara" : "Bisukan suara"}
            className="inline-flex items-center justify-center min-w-[42px] min-h-[42px] text-[#3D3A35] bg-[#FAF9F6] hover:bg-[#EFECE6] disabled:opacity-40 border border-[#E6E2DA] rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Speed Selector */}
          <div
            role="group"
            aria-label="Kecepatan putar"
            className="inline-flex items-center p-1 bg-[#FAF9F6] border border-[#E6E2DA] rounded-lg"
          >
            {SPEED_OPTIONS.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setPlaybackRate(rate)}
                className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  playbackRate === rate
                    ? "bg-white text-[#161513] font-medium border border-[#E6E2DA]"
                    : "text-[#6B665E] hover:text-[#161513]"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleDownload}
            disabled={!take || isGenerating}
            className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 text-sm font-medium text-[#8C5828] bg-[#FAF5EF] hover:bg-[#F3EADF] disabled:opacity-40 border border-[#DFCBB5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8C5828]"
          >
            <Download className="w-4 h-4" />
            <span>Unduh WAV</span>
          </button>
        </div>
      </div>
    </section>
  );
};
