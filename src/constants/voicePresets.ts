export const DEFAULT_ABADI_INDAH_SCRIPT = `Abadi Indah adalah sebuah perusahaan yang bergerak dalam bidang pengecoran logam (cast iron) dan pengecoran aluminium (cast aluminium) yang sudah diakui mutu dan kualitasnya. Abadi Indah juga dikenal sebagai Abadi Indah Utama yang beralamatkan di Kurung Baru, Batur, Ceper, Klaten, Jawa tengah. Kami melayani berbagai macam produk furnitur baik interior maupun eksterior yang berbahan dasar logam contohnya seperti: tiang lampu jalan paris, meja/kursi taman antik, gazebo, lampu gantung klasik mail box (kotak surat), ranjang tempat tidur antik, lampu abin, dan lain lain.

Kami selalu mengutamakan mutu produk yang mengedepankan kualitas dari hasil desain serta perpaduan karya seni dan teknologi tepat guna hingga menghasilkan produk dengan ketahanan material yang tangguh dan presisi juga melayani desain kustom yang anda inginkan.`;

export interface VoicePersona {
  id: string;
  displayName: string;
  characterLabel: string;
  voiceName: "Kore" | "Zephyr";
  summary: string;
  styleInstruction: string;
}

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: "nadia-elegan",
    displayName: "Nadia",
    characterLabel: "Elegan & Berwibawa",
    voiceName: "Kore",
    summary: "Artikulasi jernih · Tempo tenang · Profil korporat premium",
    styleInstruction:
      "Warm, poised, and sophisticated Indonesian female narrator with graceful articulation, calm luxury heritage brand cadence, and crisp pronunciation of Indonesian and classic terms like cast iron, cast aluminium, and mail box; pure clean spoken studio voice only without background music or sound effects.",
  },
  {
    id: "laras-anggun",
    displayName: "Laras",
    characterLabel: "Anggun & Hangat",
    voiceName: "Zephyr",
    summary: "Lembut & ramah · Intonasi halus · Narasi galeri seni logam",
    styleInstruction:
      "Soft, graceful, and welcoming Indonesian female voiceover artist with serene pacing, refined warmth, and gentle emphasis on artisanal craftsmanship; pure clean spoken voice only without music.",
  },
  {
    id: "sekar-klasik",
    displayName: "Sekar",
    characterLabel: "Klasik & Dokumenter",
    voiceName: "Kore",
    summary: "Ritme terukur · Resonansi berkarisma · Jeda antar paragraf tegas",
    styleInstruction:
      "Dignified, unhurried Indonesian female documentary narrator with resonant poise, refined editorial clarity, and deliberate breathing pauses between paragraphs; pure spoken voice only.",
  },
];

export interface ScriptSegment {
  id: string;
  indexLabel: string;
  title: string;
  subtitle: string;
  text: string;
}

export const SCRIPT_SEGMENTS: ScriptSegment[] = [
  {
    id: "seg-profil",
    indexLabel: "01. Profil & Alamat Usaha",
    title: "Identitas Perusahaan & Sentra Pengecoran",
    subtitle: "Kurung Baru, Batur, Ceper, Klaten, Jawa Tengah",
    text: "Abadi Indah adalah sebuah perusahaan yang bergerak dalam bidang pengecoran logam (cast iron) dan pengecoran aluminium (cast aluminium) yang sudah diakui mutu dan kualitasnya. Abadi Indah juga dikenal sebagai Abadi Indah Utama yang beralamatkan di Kurung Baru, Batur, Ceper, Klaten, Jawa tengah.",
  },
  {
    id: "seg-produk",
    indexLabel: "02. Ragam Produk Logam",
    title: "Koleksi Furnitur Interior & Eksterior",
    subtitle: "Tiang lampu jalan Paris, kursi taman antik, gazebo, kotak surat",
    text: "Kami melayani berbagai macam produk furnitur baik interior maupun eksterior yang berbahan dasar logam contohnya seperti: tiang lampu jalan paris, meja/kursi taman antik, gazebo, lampu gantung klasik mail box (kotak surat), ranjang tempat tidur antik, lampu abin, dan lain lain.",
  },
  {
    id: "seg-komitmen",
    indexLabel: "03. Mutu & Desain Kustom",
    title: "Perpaduan Seni, Presisi, dan Ketahanan",
    subtitle: "Teknologi tepat guna serta layanan desain sesuai permintaan",
    text: "Kami selalu mengutamakan mutu produk yang mengedepankan kualitas dari hasil desain serta perpaduan karya seni dan teknologi tepat guna hingga menghasilkan produk dengan ketahanan material yang tangguh dan presisi juga melayani desain kustom yang anda inginkan.",
  },
];

export interface GeneratedTake {
  id: string;
  personaId: string;
  personaTitle: string;
  voiceName: "Kore" | "Zephyr";
  styleInstruction: string;
  text: string;
  audioUrl: string;
  durationSeconds: number;
  sampleRate: number;
  byteLength: number;
  createdAtLabel: string;
}
