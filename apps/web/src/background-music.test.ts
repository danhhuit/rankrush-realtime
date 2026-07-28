import { describe, expect, it } from "vitest";
import { musicTracks } from "./background-music";

describe("background music catalog", () => {
  it("uses the official Free Fire Original Lobby stream for track 16", () => {
    expect(musicTracks).toHaveLength(16);
    expect(musicTracks[15]).toEqual({
      kind: "youtube",
      name: "Free Fire Original Lobby",
      videoId: "ewqGxOd5gO8",
      sourceLabel: "Garena Free Fire",
    });
  });

  it("keeps the first 15 tracks as local Web Audio tracks", () => {
    expect(musicTracks.slice(0, 15).every((track) => track.kind === "synth")).toBe(
      true,
    );
  });
});

