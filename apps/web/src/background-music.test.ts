import { describe, expect, it } from "vitest";
import { musicTracks } from "./background-music";

describe("background music catalog", () => {
  it("uses the local Free Fire Original Lobby file for track 16", () => {
    expect(musicTracks).toHaveLength(16);
    expect(musicTracks[15]).toEqual({
      kind: "file",
      name: "Free Fire Original Lobby",
      src: "/music/free-fire-lobby.mp3",
      sourceLabel: "Tệp MP3 cục bộ",
    });
  });

  it("keeps the first 15 tracks as local Web Audio tracks", () => {
    expect(musicTracks.slice(0, 15).every((track) => track.kind === "synth")).toBe(
      true,
    );
  });
});
