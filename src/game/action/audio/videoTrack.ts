/** HTML media used by story/video.ts. The bubbling registration keeps the story
 * player independent of the mixer; engine/modules.ts attaches it to GameAudio. */
export const VIDEO_AUDIO_EVENT = 'goei:video-audio';
export class VideoTrack {
  private element: HTMLAudioElement;
  private disposed = false;
  private held = false;
  private gamePaused = false;
  private pending = false;
  private resync = false;
  private needsGesture = false;
  private cleanup = new Set<() => void>();
  private visibility = () => this.sync();
  constructor(root: HTMLElement, url: string, private blockedButton: (show: boolean) => void) {
    this.element = new Audio(url);
    document.addEventListener('visibilitychange', this.visibility);
    root.dispatchEvent(new CustomEvent(VIDEO_AUDIO_EVENT, { bubbles: true, detail: this }));
    this.sync();
  }
  get blocked() { return this.gamePaused || document.hidden; }
  setPolicy(volume: number, paused: boolean) {
    this.element.volume = Math.max(0, Math.min(1, volume));
    const changed = this.gamePaused !== paused;
    this.gamePaused = paused;
    if (changed) this.sync();
  }
  onDispose(fn: () => void) { this.cleanup.add(fn); }
  pause() { this.held = true; this.sync(); }
  resume(at: number) {
    this.element.currentTime = at;
    this.held = false;
    this.sync();
  }
  enable(at?: number) {
    if (at !== undefined) this.element.currentTime = at;
    this.needsGesture = false;
    this.sync();
  }
  private sync() {
    const a = this.element;
    if (this.disposed || this.held || this.blocked) { this.resync = false; a.pause(); return; }
    if (this.pending) { this.resync = true; return; }
    if (!a.paused || this.needsGesture) return;
    this.pending = true;
    void a.play().then(() => {
      if (this.disposed || this.held || this.blocked) a.pause();
      else this.blockedButton(false);
    }).catch((e: unknown) => {
      if (this.disposed || this.held || this.blocked) return;
      this.needsGesture = e instanceof DOMException && e.name === 'NotAllowedError';
      this.blockedButton(this.needsGesture);
    }).finally(() => {
      this.pending = false;
      const retry = this.resync;
      this.resync = false;
      if (retry) this.sync();
    });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.visibility);
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    for (const fn of this.cleanup) fn();
    this.cleanup.clear();
  }
}
