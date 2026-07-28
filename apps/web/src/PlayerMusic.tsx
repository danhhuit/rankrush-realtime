import { Music2, Pause, Play, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { musicTracks } from "./background-music";
import { usePreferences } from "./preferences";
import {
  loadYouTubeIframeApi,
  type YouTubePlayer,
} from "./youtube-iframe-api";

export default function PlayerMusic({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { tr } = usePreferences();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [youtubeReady, setYoutubeReady] = useState(false);
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
  const youtubeHost = useRef<HTMLDivElement>(null);
  const youtubePlayer = useRef<YouTubePlayer | null>(null);
  const wantsToPlay = useRef(false);
  const track = musicTracks[trackIndex] ?? musicTracks[0]!;
  const usesYouTube = track.kind === "youtube";

  useEffect(() => {
    localStorage.setItem("rr_music_track", String(trackIndex));
    localStorage.setItem("rr_music_volume", String(volume));
  }, [trackIndex, volume]);

  useEffect(() => {
    if (youtubePlayer.current || !youtubeHost.current) return;
    let cancelled = false;
    const youtubeTrack = musicTracks.find((item) => item.kind === "youtube");

    void loadYouTubeIframeApi()
      .then((api) => {
        if (
          cancelled ||
          !youtubeHost.current ||
          youtubePlayer.current ||
          !youtubeTrack
        ) {
          return;
        }
        const player = new api.Player(youtubeHost.current, {
          videoId: youtubeTrack.videoId,
          width: "1",
          height: "1",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            loop: 1,
            playlist: youtubeTrack.videoId,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: ({ target }) => {
              if (cancelled) return;
              youtubePlayer.current = target;
              target.setVolume(volume);
              setYoutubeReady(true);
              setMusicError("");
              if (wantsToPlay.current && !disabled && volume > 0) {
                target.playVideo();
              }
            },
            onError: () => {
              if (!cancelled) {
                setYoutubeReady(false);
                setPlaying(false);
                setMusicError(
                  tr(
                    "Không thể tải nhạc Free Fire. Hãy kiểm tra kết nối Internet.",
                    "Could not load Free Fire music. Check your Internet connection.",
                  ),
                );
              }
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          setMusicError(
            tr(
              "Không thể kết nối nguồn nhạc chính thức của Free Fire.",
              "Could not connect to the official Free Fire music source.",
            ),
          );
        }
      });

    return () => {
      cancelled = true;
      youtubePlayer.current?.destroy();
      youtubePlayer.current = null;
    };
  }, []);

  useEffect(() => {
    wantsToPlay.current = playing;
    const player = youtubePlayer.current;
    if (!player) return;
    player.setVolume(volume);
    if (usesYouTube && playing && !disabled && volume > 0) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }, [playing, disabled, usesYouTube, volume, youtubeReady]);

  useEffect(() => {
    if (!playing || disabled || volume === 0 || track.kind !== "synth") return;
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
  }, [playing, disabled, track, volume]);

  const togglePlayback = () => {
    const nextPlaying = !playing;
    wantsToPlay.current = nextPlaying;
    setMusicError("");
    setPlaying(nextPlaying);
    if (usesYouTube && youtubePlayer.current) {
      youtubePlayer.current.setVolume(volume);
      if (nextPlaying && !disabled && volume > 0) {
        youtubePlayer.current.playVideo();
      } else {
        youtubePlayer.current.pauseVideo();
      }
    }
  };

  return (
    <div className="player-music">
      <div ref={youtubeHost} className="youtube-audio-host" aria-hidden="true" />
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
              onChange={(event) => setTrackIndex(Number(event.target.value))}
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
            onClick={togglePlayback}
          >
            {playing ? <Pause /> : <Play />}
            {playing
              ? tr("Tạm dừng nhạc", "Pause music")
              : tr("Phát nhạc", "Play music")}
          </button>
          {track.kind === "youtube" && !musicError && (
            <small className="music-source-note">
              {youtubeReady
                ? tr(
                    `Đang dùng bản chính thức từ ${track.sourceLabel}.`,
                    `Official track from ${track.sourceLabel}.`,
                  )
                : tr(
                    "Đang kết nối nguồn nhạc Free Fire...",
                    "Connecting to the Free Fire music source...",
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

