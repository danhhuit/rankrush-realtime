export type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (volume: number) => void;
  destroy: () => void;
};

type YouTubePlayerOptions = {
  videoId: string;
  width: string;
  height: string;
  playerVars: {
    autoplay: 0 | 1;
    controls: 0 | 1;
    disablekb: 0 | 1;
    loop: 0 | 1;
    playlist: string;
    playsinline: 0 | 1;
    origin: string;
  };
  events: {
    onReady: (event: { target: YouTubePlayer }) => void;
    onError: () => void;
  };
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayer;
};

type YouTubeWindow = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

let apiPromise: Promise<YouTubeApi> | null = null;

export function loadYouTubeIframeApi(): Promise<YouTubeApi> {
  const youtubeWindow = window as YouTubeWindow;
  if (youtubeWindow.YT?.Player) {
    return Promise.resolve(youtubeWindow.YT);
  }
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      apiPromise = null;
      reject(new Error("YouTube IFrame API did not load in time."));
    }, 15_000);
    const previousReady = youtubeWindow.onYouTubeIframeAPIReady;

    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      window.clearTimeout(timeout);
      if (youtubeWindow.YT?.Player) {
        resolve(youtubeWindow.YT);
      } else {
        apiPromise = null;
        reject(new Error("YouTube IFrame API is unavailable."));
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      apiPromise = null;
      reject(new Error("Could not load YouTube IFrame API."));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}

