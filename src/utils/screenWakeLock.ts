/**
 * Screen Wake Lock Utility
 * Keeps the screen awake during Focus Mode sessions on mobile and desktop browsers.
 * Uses the standard Screen Wake Lock API (navigator.wakeLock) with automatic
 * visibility re-acquisition and graceful fallback handling.
 */

class ScreenWakeLockManager {
  private sentinel: any = null;
  private isEnabled: boolean = true;
  private isRequested: boolean = false;
  private listeners: Set<(isActive: boolean) => void> = new Set();
  private visibilityHandler: (() => void) | null = null;
  private videoFallback: HTMLVideoElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('focus_screen_keep_awake');
        if (saved !== null) {
          this.isEnabled = saved !== 'false';
        }
      } catch {
        this.isEnabled = true;
      }
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'wakeLock' in navigator;
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public setIsEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('focus_screen_keep_awake', enabled ? 'true' : 'false');
    } catch {
      // Ignore storage errors in restricted contexts
    }

    if (!enabled) {
      this.release();
    } else if (this.isRequested) {
      this.acquire();
    }
    this.notify();
  }

  public isActive(): boolean {
    return this.sentinel !== null && !this.sentinel.released;
  }

  public subscribe(listener: (isActive: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this.isActive());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const active = this.isActive();
    this.listeners.forEach((cb) => {
      try {
        cb(active);
      } catch (err) {
        console.error('WakeLock listener error:', err);
      }
    });
  }

  public async acquire(): Promise<boolean> {
    this.isRequested = true;
    if (!this.isEnabled) {
      return false;
    }

    // Attach visibility change listener to re-acquire when user returns to tab
    if (typeof document !== 'undefined' && !this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible' && this.isRequested && this.isEnabled) {
          this.acquireNative();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    return this.acquireNative();
  }

  private async acquireNative(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // 1. Try Native Screen Wake Lock API
    if (this.isSupported()) {
      try {
        if (this.sentinel && !this.sentinel.released) {
          this.notify();
          return true;
        }

        const nav = navigator as any;
        const lock = await nav.wakeLock.request('screen');
        this.sentinel = lock;

        lock.addEventListener('release', () => {
          this.sentinel = null;
          this.notify();
        });

        this.notify();
        return true;
      } catch (err) {
        // May fail if low battery or user navigated away
        console.warn('Screen WakeLock API request failed:', err);
      }
    }

    // 2. Fallback: Create and play invisible looping canvas/video if supported
    this.ensureVideoFallback();
    this.notify();
    return false;
  }

  public async release(): Promise<void> {
    this.isRequested = false;

    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (err) {
        console.warn('Screen WakeLock release error:', err);
      }
      this.sentinel = null;
    }

    if (this.videoFallback) {
      try {
        this.videoFallback.pause();
      } catch {
        // Ignore
      }
    }

    this.notify();
  }

  public destroy(): void {
    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.release();
  }

  private ensureVideoFallback(): void {
    // If native wake lock isn't supported, an invisible video can keep iOS/Android awake
    if (typeof document === 'undefined') return;
    if (!this.videoFallback) {
      try {
        const video = document.createElement('video');
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('muted', '');
        video.muted = true;
        video.loop = true;
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        video.style.left = '-9999px';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0.01';
        video.style.pointerEvents = 'none';
        
        // Minimal valid 1-frame webm/mp4 can be set, or tiny silent media
        // Set silent data uri
        video.src = 'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAAhmcmVlAAAACG1kYXQAAAA=';
        document.body.appendChild(video);
        this.videoFallback = video;
      } catch {
        // Ignore
      }
    }

    if (this.videoFallback) {
      this.videoFallback.play().catch(() => {
        // Autoplay policy may block without user gesture; handled gracefully
      });
    }
  }
}

export const screenWakeLock = new ScreenWakeLockManager();
