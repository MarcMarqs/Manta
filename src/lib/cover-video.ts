/**
 * Starts a muted cover video.
 *
 * Chrome (and Safari) refuse to start silent, video-only media while the page is hidden —
 * a tab opened in the background, another window in front — and reject the play() promise
 * with AbortError rather than queueing it. Without this the card would stay on its poster
 * for good once the visitor came back to the tab.
 */
export function playWhenVisible(video: HTMLVideoElement): void {
  video.play().catch(() => {
    if (document.visibilityState === 'visible') return;
    document.addEventListener('visibilitychange', () => void video.play().catch(() => {}), { once: true });
  });
}

export function rewind(video: HTMLVideoElement): void {
  video.pause();
  video.currentTime = 0;
}
