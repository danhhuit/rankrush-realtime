export type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (volume: number) => void;
  destroy: () => void;
};

export const youtubePlayerState = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
} as const;

export type YouTubePlayerState =
  (typeof youtubePlayerState)[keyof typeof youtubePlayerState];

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
    onStateChange: (event: {
      target: YouTubePlayer;
      data: YouTubePlayerState;
    }) => void;
    onError: (event: { target: YouTubePlayer; data: number }) => void;
    onAutoplayBlocked?: (event: { target: YouTubePlayer }) => void;
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
    let settled = false;
    const previousReady = youtubeWindow.onYouTubeIframeAPIReady;
    const restorePreviousReady = () => {
      if (previousReady) {
        youtubeWindow.onYouTubeIframeAPIReady = previousReady;
      } else {
        delete youtubeWindow.onYouTubeIframeAPIReady;
      }
    };
    const finishWithError = (message: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      apiPromise = null;
      restorePreviousReady();
      document
        .querySelector<HTMLScriptElement>(
          'script[src="https://www.youtube.com/iframe_api"]',
        )
        ?.remove();
      reject(new Error(message));
    };
    const timeout = window.setTimeout(() => {
      finishWithError("YouTube IFrame API did not load in time.");
    }, 15_000);

    youtubeWindow.onYouTubeIframeAPIReady = () => {
      if (settled) return;
      window.clearTimeout(timeout);
      if (youtubeWindow.YT?.Player) {
        settled = true;
        restorePreviousReady();
        resolve(youtubeWindow.YT);
      } else {
        finishWithError("YouTube IFrame API is unavailable.");
      }
      previousReady?.();
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      finishWithError("Could not load YouTube IFrame API.");
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}
