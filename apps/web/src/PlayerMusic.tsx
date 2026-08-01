import { Music2, Pause, Play, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { musicTracks } from "./background-music";
import { usePreferences } from "./preferences";

type FileStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "error";

export default function PlayerMusic({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { tr } = usePreferences();
  const [open, setOpen] = useState(false);
  const [synthPlaying, setSynthPlaying] = useState(false);
  const [fileStatus, setFileStatus] = useState<FileStatus>("idle");
  const [musicError, setMusicError] = useState("");
  const [trackIndex, setTrackIndex] = useState(() =>
    Math.min(
      musicTracks.length - 1,
      Math.max(0, Number(localStorage.getItem("rr_music_track") || 0)),
    ),
  );
  const [volume, setVolume] = useState(() =>
    Number(localStorage.getItem("rr_music_volume") || 28),
  );
  const audio = useRef<{ context: AudioContext; timer: number } | null>(null);
  const fileAudio = useRef<HTMLAudioElement>(null);
  const wantsToPlay = useRef(false);
  const track = musicTracks[trackIndex] ?? musicTracks[0]!;
  const usesFile = track.kind === "file";
  const playing = usesFile ? fileStatus === "playing" : synthPlaying;

  const showFileError = () => {
    const mediaErrorCode = fileAudio.current?.error?.code;
    wantsToPlay.current = false;
    setFileStatus("error");
    setMusicError(
      mediaErrorCode === 2
        ? tr(
            "Không tải được tệp nhạc. Hãy tải lại trang rồi thử lại.",
            "The music file could not be loaded. Reload the page and try again.",
          )
        : tr(
            "Không tìm thấy hoặc không hỗ trợ tệp /music/free-fire-lobby.mp3. Hãy kiểm tra đúng tên và định dạng MP3.",
            "The file /music/free-fire-lobby.mp3 was not found or is unsupported. Check its exact name and MP3 format.",
          ),
    );
  };

  useEffect(() => {
    localStorage.setItem("rr_music_track", String(trackIndex));
    localStorage.setItem("rr_music_volume", String(volume));
  }, [trackIndex, volume]);

  useEffect(() => {
    const player = fileAudio.current;
    if (!player) return;
    player.volume = Math.min(1, Math.max(0, volume / 100));
    if (disabled || volume === 0 || !usesFile) {
      wantsToPlay.current = false;
      player.pause();
      if (usesFile && fileStatus !== "error") {
        setFileStatus("paused");
      }
    }
  }, [disabled, fileStatus, usesFile, volume]);

  useEffect(() => {
    const player = fileAudio.current;
    if (!player || !usesFile) return;
    wantsToPlay.current = false;
    setMusicError("");
    setFileStatus("loading");
    player.load();
  }, [trackIndex, usesFile]);

  useEffect(() => {
    if (!synthPlaying || disabled || volume === 0 || track.kind !== "synth") {
      return;
    }
    const synthTrack = track;
    const context = new AudioContext();
    let noteIndex = 0;
    const playNote = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = synthTrack.wave;
      oscillator.frequency.value =
        synthTrack.notes[noteIndex % synthTrack.notes.length]!;
      const now = context.currentTime;
      const peak = Math.max(0.001, (volume / 100) * 0.055);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 1.15);
      noteIndex += 1;
    };
    playNote();
    const timer = window.setInterval(playNote, 60_000 / synthTrack.bpm);
    audio.current = { context, timer };
    return () => {
      window.clearInterval(timer);
      void context.close();
      audio.current = null;
    };
  }, [synthPlaying, disabled, track, volume]);

  const togglePlayback = async () => {
    setMusicError("");
    if (!usesFile) {
      setSynthPlaying((value) => !value);
      return;
    }

    const player = fileAudio.current;
    if (!player) return;

    if (fileStatus === "playing" || wantsToPlay.current) {
      wantsToPlay.current = false;
      player.pause();
      setFileStatus("paused");
      return;
    }

    wantsToPlay.current = true;
    setFileStatus("loading");
    player.volume = Math.min(1, Math.max(0, volume / 100));
    try {
      await player.play();
    } catch (error) {
      wantsToPlay.current = false;
      const blocked =
        error instanceof DOMException && error.name === "NotAllowedError";
      setFileStatus("error");
      setMusicError(
        blocked
          ? tr(
              "Trình duyệt đã chặn phát nhạc. Hãy nhấn Phát nhạc một lần nữa.",
              "The browser blocked playback. Press Play music once more.",
            )
          : tr(
              "Không thể phát tệp nhạc. Hãy kiểm tra file MP3 rồi tải lại trang.",
              "The music file could not be played. Check the MP3 file and reload the page.",
            ),
      );
    }
  };

  const selectTrack = (nextTrackIndex: number) => {
    wantsToPlay.current = false;
    setSynthPlaying(false);
    fileAudio.current?.pause();
    setFileStatus("idle");
    setMusicError("");
    setTrackIndex(nextTrackIndex);
  };

  return (
    <div className="player-music">
      <audio
        ref={fileAudio}
        src={usesFile ? track.src : undefined}
        preload="metadata"
        loop
        onLoadStart={() => {
          if (usesFile) setFileStatus("loading");
        }}
        onCanPlay={() => {
          if (usesFile && !wantsToPlay.current) setFileStatus("ready");
        }}
        onPlaying={() => {
          wantsToPlay.current = true;
          setFileStatus("playing");
          setMusicError("");
        }}
        onWaiting={() => {
          if (wantsToPlay.current) setFileStatus("loading");
        }}
        onPause={() => {
          wantsToPlay.current = false;
          if (usesFile && fileStatus !== "error") setFileStatus("paused");
        }}
        onError={showFileError}
        aria-hidden="true"
      />
      <button
        type="button"
        className={`music-toggle${playing && !disabled ? " active" : ""}`}
        onClick={() => setOpen((value) => !value)}
        title={tr("Nhạc nền", "Background music")}
      >
        <Music2 />
      </button>
      {open && (
        <div className="music-panel">
          <div className="music-panel-head">
            <span>
              <Music2 />
              <b>{tr("Nhạc nền tập trung", "Focus music")}</b>
            </span>
            <button type="button" onClick={() => setOpen(false)}>
              <X />
            </button>
          </div>
          <label>
            {tr("Chọn bài nhạc", "Choose a track")}
            <select
              value={trackIndex}
              onChange={(event) => selectTrack(Number(event.target.value))}
            >
              {musicTracks.map((item, index) => (
                <option value={index} key={item.name}>
                  {index + 1}. {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="music-volume">
            <span>
              <Volume2 /> {tr("Âm lượng", "Volume")} <b>{volume}%</b>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            className="button button-primary button-block"
            disabled={disabled}
            onClick={() => void togglePlayback()}
          >
            {playing ? <Pause /> : <Play />}
            {usesFile && fileStatus === "loading" && wantsToPlay.current
              ? tr("Đang tải nhạc...", "Loading music...")
              : playing
                ? tr("Tạm dừng nhạc", "Pause music")
                : tr("Phát nhạc", "Play music")}
          </button>
          {track.kind === "file" && !musicError && (
            <small className="music-source-note">
              {fileStatus === "playing"
                ? tr(`Đang phát: ${track.name}.`, `Now playing: ${track.name}.`)
                : fileStatus === "loading" && wantsToPlay.current
                  ? tr("Đang tải bài nhạc...", "Buffering the track...")
                  : fileStatus === "paused"
                    ? tr("Nhạc đã tạm dừng.", "Music is paused.")
                    : fileStatus === "ready"
                      ? tr(
                          `Tệp nhạc ${track.sourceLabel} đã sẵn sàng.`,
                          `The ${track.sourceLabel} music is ready.`,
                        )
                      : tr(
                          "Đang đọc tệp nhạc Free Fire...",
                          "Loading the Free Fire music file...",
                        )}
            </small>
          )}
          {musicError && <small className="music-error">{musicError}</small>}
          {disabled && (
            <small>
              {tr(
                "Host đang tắt âm thanh thiết bị.",
                "The host muted player devices.",
              )}
            </small>
          )}
        </div>
      )}
    </div>
  );
}
