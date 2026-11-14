import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  Loader2,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import {
  DEFAULT_ABADI_INDAH_SCRIPT,
  SCRIPT_SEGMENTS,
  VOICE_PERSONAS,
  type GeneratedTake,
  type VoicePersona,
} from "./constants/voicePresets";
import { WaveformPlayer } from "./components/WaveformPlayer";

function formatClock(date: Date): string {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDurationBadge(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function App() {
  const [scriptText, setScriptText] = useState<string>(DEFAULT_ABADI_INDAH_SCRIPT);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(VOICE_PERSONAS[0].id);
  const [customStyle, setCustomStyle] = useState<string>(VOICE_PERSONAS[0].styleInstruction);
  const [showStyleEditor, setShowStyleEditor] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [takes, setTakes] = useState<GeneratedTake[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState<boolean>(false);

  const createdUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = createdUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const selectedPersona: VoicePersona = useMemo(
    () =>
      VOICE_PERSONAS.find((p) => p.id === selectedPersonaId) ?? VOICE_PERSONAS[0],
    [selectedPersonaId]
  );

  const activeTake: GeneratedTake | null = useMemo(
    () => takes.find((t) => t.id === activeTakeId) ?? takes[0] ?? null,
    [takes, activeTakeId]
  );

  const wordCount = useMemo(() => {
    const words = scriptText.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [scriptText]);

  const estimatedSeconds = useMemo(() => {
    return Math.max(1, Math.round((wordCount / 130) * 60));
  }, [wordCount]);

  const handleSelectPersona = (persona: VoicePersona) => {
    setSelectedPersonaId(persona.id);
    setCustomStyle(persona.styleInstruction);
  };

  const synthesizeAudio = useCallback(
    async (textOverride?: string, labelSuffix?: string) => {
      const targetText = (textOverride ?? scriptText).trim();
      if (!targetText) {
        setErrorMessage("Mohon isi naskah teks sebelum membuat rekaman suara.");
        return;
      }

      setIsGenerating(true);
      setErrorMessage(null);

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: targetText,
            voiceName: selectedPersona.voiceName,
            styleInstruction: customStyle,
          }),
        });

        const payload = await res.json();
        if (!res.ok) {
          throw new Error(
            payload?.error || "Gagal memproses suara dari layanan Gemini TTS."
          );
        }

        const binaryString = atob(payload.audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const wavBlob = new Blob([bytes], { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(wavBlob);
        createdUrlsRef.current.push(audioUrl);

        const newTake: GeneratedTake = {
          id: `take-${Date.now()}`,
          personaId: selectedPersona.id,
          personaTitle: labelSuffix
            ? `${selectedPersona.displayName} (${labelSuffix})`
            : `${selectedPersona.displayName} — ${selectedPersona.characterLabel}`,
          voiceName: payload.voiceName || selectedPersona.voiceName,
          styleInstruction: customStyle,
          text: targetText,
          audioUrl,
          durationSeconds: Number(payload.durationSeconds) || 0,
          sampleRate: Number(payload.sampleRate) || 24000,
          byteLength: Number(payload.byteLength) || bytes.length,
          createdAtLabel: formatClock(new Date()),
        };

        setTakes((prev) => [newTake, ...prev]);
        setActiveTakeId(newTake.id);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat membuat audio suara.";
        setErrorMessage(msg);
      } finally {
        setIsGenerating(false);
      }
    },
    [scriptText, selectedPersona, customStyle]
  );

  const handleDownloadTake = (take: GeneratedTake) => {
    const link = document.createElement("a");
    link.href = take.audioUrl;
    const safeSlug = take.personaTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    link.download = `abadi-indah-${safeSlug || "voice"}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#161513] flex flex-col">
      {/* Top Bar Contract: 1 row, 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-20 bg-[#FAF9F6]/95 backdrop-blur-sm border-b border-[#E6E2DA]">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
          <a
            href="#studio"
            className="font-display text-2xl font-semibold tracking-tight text-[#161513] whitespace-nowrap shrink-0"
          >
            Abadi Indah Voice
          </a>

          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#57534C]"
          >
            <a
              href="#studio"
              className="hover:text-[#161513] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Studio Suara
            </a>
            <a
              href="#naskah"
              className="hover:text-[#161513] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Naskah Profil
            </a>
            <a
              href="#riwayat"
              className="hover:text-[#161513] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Riwayat Audio
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => synthesizeAudio()}
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#8C5828] hover:bg-[#73441D] disabled:bg-[#B89F86] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8C5828]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses Suara</span>
                </>
              ) : (
                <span>Hasilkan Audio</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Primary Studio Section */}
        <section
          id="studio"
          className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-10 pb-14"
        >
          <div className="max-w-3xl mb-8">
            <p className="text-xs font-medium text-[#6B665E] mb-3">
              Sulih Suara Perempuan Elegan · Bahasa Indonesia · Audio Suara Saja
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-[#161513] leading-[1.1] text-balance">
              Narasi Suara Elegan untuk Profil Abadi Indah Utama
            </h1>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-6 px-4 py-3 bg-[#FDF3F2] border border-[#E7C2BE] text-[#9A2E24] rounded-lg text-sm flex items-center justify-between gap-4"
            >
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-xs font-medium underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {/* 2-Column Studio Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Cols: Focal Audio Player + Voice Persona + Script Editor */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <WaveformPlayer
                take={activeTake}
                isGenerating={isGenerating}
                onGenerateClick={() => synthesizeAudio()}
              />

              {/* Voice Persona Selector */}
              <div className="bg-white border border-[#E6E2DA] rounded-xl p-6 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-[#161513]">
                      Karakter Suara Perempuan
                    </h2>
                    <p className="text-xs text-[#6B665E] mt-0.5">
                      Pilih intonasi yang paling sesuai untuk presentasi profil usaha
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStyleEditor((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#57534C] hover:text-[#161513] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{showStyleEditor ? "Sembunyikan Arahan" : "Sesuaikan Arahan"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {VOICE_PERSONAS.map((persona) => {
                    const isSelected = persona.id === selectedPersona.id;
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => handleSelectPersona(persona)}
                        className={`text-left p-4 rounded-lg border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8C5828] ${
                          isSelected
                            ? "bg-[#FAF5EF] border-[#8C5828]"
                            : "bg-[#FAF9F6] border-[#E6E2DA] hover:border-[#C9C1B4]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-semibold text-[#161513]">
                            {persona.displayName}
                          </span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-[#8C5828] shrink-0" />
                          )}
                        </div>
                        <p className="text-xs font-medium text-[#8C5828] mb-1.5">
                          {persona.characterLabel}
                        </p>
                        <p className="text-xs text-[#6B665E] leading-relaxed">
                          {persona.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {showStyleEditor && (
                  <div className="mt-4 pt-4 border-t border-[#EFECE6]">
                    <label
                      htmlFor="voice-style-input"
                      className="block text-xs font-medium text-[#3D3A35] mb-1.5"
                    >
                      Arahan Gaya Suara (Voice Design)
                    </label>
                    <textarea
                      id="voice-style-input"
                      rows={2}
                      value={customStyle}
                      onChange={(e) => setCustomStyle(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs text-[#161513] bg-[#FAF9F6] border border-[#E6E2DA] rounded-lg focus:outline-none focus:border-[#8C5828]"
                    />
                  </div>
                )}
              </div>

              {/* Script Editor */}
              <div className="bg-white border border-[#E6E2DA] rounded-xl p-6 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-base font-semibold text-[#161513]">
                      Naskah Narasi
                    </h2>
                    <p className="text-xs text-[#6B665E] mt-0.5 font-mono tabular-nums">
                      {wordCount} kata · Estimasi {formatDurationBadge(estimatedSeconds)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {scriptText !== DEFAULT_ABADI_INDAH_SCRIPT && (
                      <button
                        type="button"
                        onClick={() => setScriptText(DEFAULT_ABADI_INDAH_SCRIPT)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#57534C] hover:text-[#161513] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Kembalikan Teks Asli</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => synthesizeAudio()}
                      disabled={isGenerating || scriptText.trim().length === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#8C5828] hover:bg-[#73441D] disabled:bg-[#B89F86] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Memproses...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Buat Audio Penuh</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <label htmlFor="narration-script" className="sr-only">
                  Teks naskah yang akan diubah menjadi suara
                </label>
                <textarea
                  id="narration-script"
                  rows={9}
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  className="w-full p-4 text-[15px] leading-[1.7] text-[#161513] bg-[#FAF9F6] border border-[#E6E2DA] rounded-lg focus:outline-none focus:border-[#8C5828] resize-y"
                />
              </div>
            </div>

            {/* Right 5 Cols: Abadi Indah Visual Context + Session Take History */}
            <aside className="lg:col-span-5 flex flex-col gap-6">
              {/* Brand Craft Showcase */}
              <div className="bg-white border border-[#E6E2DA] rounded-xl overflow-hidden">
                <div className="aspect-[4/3] bg-[#EAE6DE] relative overflow-hidden">
                  {!imageFailed ? (
                    <img
                      src="/src/assets/images/abadi_indah_metalcraft_1794650906574.jpg"
                      alt="Tiang lampu jalan klasik Paris dan kursi taman antik karya pengecoran logam Abadi Indah"
                      referrerPolicy="no-referrer"
                      onError={() => setImageFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#EFECE6] to-[#DFD9CE]">
                      <p className="font-display text-2xl font-semibold text-[#161513]">
                        Abadi Indah Utama
                      </p>
                      <p className="text-xs text-[#57534C] mt-1">
                        Cast Iron &amp; Cast Aluminium · Ceper, Klaten
                      </p>
                    </div>
                  )}
                </div>
                <div className="p-5 sm:p-6">
                  <p className="text-xs font-medium text-[#8C5828] mb-1">
                    Profil Perusahaan Narasi
                  </p>
                  <h2 className="font-display text-2xl font-semibold text-[#161513]">
                    Abadi Indah Utama
                  </h2>
                  <p className="text-sm text-[#57534C] leading-relaxed mt-1.5">
                    Kurung Baru, Batur, Ceper, Klaten, Jawa Tengah — Pengecoran logam cast iron &amp; cast aluminium untuk furnitur interior, eksterior, dan desain kustom.
                  </p>
                </div>
              </div>

              {/* Session Audio History */}
              <div
                id="riwayat"
                className="bg-white border border-[#E6E2DA] rounded-xl p-6"
              >
                <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#EFECE6]">
                  <div>
                    <h2 className="text-base font-semibold text-[#161513]">
                      Riwayat Audio Sesi
                    </h2>
                    <p className="text-xs text-[#6B665E] mt-0.5">
                      Bandingkan dan unduh hasil rekaman suara
                    </p>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-[#57534C]">
                    {takes.length} rekaman
                  </span>
                </div>

                {takes.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-[#57534C] max-w-xs mx-auto leading-relaxed">
                      Belum ada rekaman suara pada sesi ini. Tekan tombol Hasilkan Audio untuk membuat versi pertama.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-[#EFECE6] mt-1">
                    {takes.map((take) => {
                      const isActive = activeTake?.id === take.id;
                      return (
                        <li
                          key={take.id}
                          className={`py-3.5 flex items-center justify-between gap-3 ${
                            isActive ? "opacity-100" : "opacity-85 hover:opacity-100"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setActiveTakeId(take.id)}
                                className="text-sm font-medium text-[#161513] hover:text-[#8C5828] truncate text-left cursor-pointer"
                              >
                                {take.personaTitle}
                              </button>
                            </div>
                            <p className="text-xs text-[#6B665E] font-mono tabular-nums mt-0.5">
                              {formatDurationBadge(take.durationSeconds)} · {take.createdAtLabel} · {isActive ? "Sedang dipilih" : "Siap diputar"}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setActiveTakeId(take.id)}
                              aria-label={`Pilih dan muat ${take.personaTitle}`}
                              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors cursor-pointer ${
                                isActive
                                  ? "bg-[#8C5828] text-white border-[#8C5828]"
                                  : "bg-[#FAF9F6] text-[#3D3A35] border-[#E6E2DA] hover:bg-[#EFECE6]"
                              }`}
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadTake(take)}
                              aria-label={`Unduh WAV ${take.personaTitle}`}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#FAF9F6] text-[#3D3A35] border border-[#E6E2DA] hover:bg-[#EFECE6] transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        </section>

        {/* Below-the-Fold Script Breakdown for Quick Segment Synthesis */}
        <section
          id="naskah"
          className="border-t border-[#E6E2DA] bg-white py-14"
        >
          <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
            <div className="max-w-2xl mb-10">
              <p className="text-xs font-medium text-[#8C5828] mb-2">
                Struktur Naskah Profil
              </p>
              <h2 className="font-display text-3xl font-semibold text-[#161513] text-balance">
                Uji Pelafalan Per Bagian Naskah
              </h2>
              <p className="text-sm text-[#57534C] mt-2 leading-relaxed">
                Anda dapat menguji suara perempuan elegan pada satu bagian kalimat tertentu terlebih dahulu sebelum membuat rekaman penuh.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {SCRIPT_SEGMENTS.map((segment) => (
                <article
                  key={segment.id}
                  className="p-6 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl flex flex-col justify-between gap-5"
                >
                  <div>
                    <p className="text-xs font-medium text-[#6B665E] mb-2">
                      {segment.indexLabel}
                    </p>
                    <h3 className="font-display text-2xl font-semibold text-[#161513] mb-1.5">
                      {segment.title}
                    </h3>
                    <p className="text-xs text-[#8C5828] mb-4">
                      {segment.subtitle}
                    </p>
                    <p className="text-sm text-[#3D3A35] leading-relaxed">
                      “{segment.text}”
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#E6E2DA] flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        synthesizeAudio(
                          segment.text,
                          segment.indexLabel.split(".")[0].trim()
                        )
                      }
                      disabled={isGenerating}
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#161513] bg-white hover:bg-[#EFECE6] disabled:opacity-40 border border-[#E6E2DA] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[#8C5828]" />
                      <span>Hasilkan Bagian Ini</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setScriptText(segment.text)}
                      className="text-xs font-medium text-[#57534C] hover:text-[#161513] underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Muat ke Editor
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E6E2DA] bg-[#FAF9F6] py-6">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 flex flex-wrap items-center justify-between gap-4 text-xs text-[#6B665E]">
          <span>Abadi Indah Utama · Kurung Baru, Batur, Ceper, Klaten, Jawa Tengah</span>
          <span>Audio Suara Saja · Format WAV 24 kHz</span>
        </div>
      </footer>
    </div>
  );
}
