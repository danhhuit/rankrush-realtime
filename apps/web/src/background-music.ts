export type SynthMusicTrack = {
  kind: "synth";
  name: string;
  bpm: number;
  wave: OscillatorType;
  notes: readonly number[];
};

export type FileMusicTrack = {
  kind: "file";
  name: string;
  src: string;
  sourceLabel: string;
};

export type MusicTrack = SynthMusicTrack | FileMusicTrack;

export const musicTracks: readonly MusicTrack[] = [
  {
    kind: "synth",
    name: "Mây Trôi",
    bpm: 76,
    wave: "sine",
    notes: [261.63, 329.63, 392, 329.63],
  },
  {
    kind: "synth",
    name: "Biển Sáng",
    bpm: 82,
    wave: "sine",
    notes: [293.66, 369.99, 440, 369.99],
  },
  {
    kind: "synth",
    name: "Gió Nhẹ",
    bpm: 72,
    wave: "triangle",
    notes: [220, 277.18, 329.63, 277.18],
  },
  {
    kind: "synth",
    name: "Bình Minh",
    bpm: 88,
    wave: "triangle",
    notes: [261.63, 392, 329.63, 440],
  },
  {
    kind: "synth",
    name: "Mưa Êm",
    bpm: 68,
    wave: "sine",
    notes: [196, 246.94, 293.66, 246.94],
  },
  {
    kind: "synth",
    name: "Đồi Xanh",
    bpm: 80,
    wave: "sine",
    notes: [246.94, 311.13, 369.99, 311.13],
  },
  {
    kind: "synth",
    name: "Sao Khuya",
    bpm: 70,
    wave: "triangle",
    notes: [174.61, 220, 261.63, 220],
  },
  {
    kind: "synth",
    name: "Dòng Sông",
    bpm: 84,
    wave: "sine",
    notes: [233.08, 293.66, 349.23, 293.66],
  },
  {
    kind: "synth",
    name: "Thư Viện",
    bpm: 64,
    wave: "triangle",
    notes: [207.65, 261.63, 311.13, 261.63],
  },
  {
    kind: "synth",
    name: "Khoảng Trời",
    bpm: 90,
    wave: "sine",
    notes: [329.63, 415.3, 493.88, 415.3],
  },
  {
    kind: "synth",
    name: "Lá Non",
    bpm: 78,
    wave: "triangle",
    notes: [277.18, 349.23, 415.3, 349.23],
  },
  {
    kind: "synth",
    name: "Hoàng Hôn",
    bpm: 74,
    wave: "sine",
    notes: [196, 293.66, 246.94, 329.63],
  },
  {
    kind: "synth",
    name: "Cà Phê Sớm",
    bpm: 86,
    wave: "triangle",
    notes: [261.63, 329.63, 440, 392],
  },
  {
    kind: "synth",
    name: "Tĩnh Lặng",
    bpm: 60,
    wave: "sine",
    notes: [164.81, 207.65, 246.94, 207.65],
  },
  {
    kind: "synth",
    name: "Chuyến Đi",
    bpm: 92,
    wave: "triangle",
    notes: [293.66, 440, 369.99, 493.88],
  },
  {
    kind: "file",
    name: "Free Fire Original Lobby",
    src: "/music/free-fire-lobby.mp3",
    sourceLabel: "Tệp MP3 cục bộ",
  },
];
