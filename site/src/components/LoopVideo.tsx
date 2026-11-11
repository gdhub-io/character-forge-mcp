import { useEffect, useRef, useState } from "react";

/** Switch to the twin this long before the end, so the handover lands inside the clip's crossfaded last second. */
const LEAD_S = 0.3;
const FADE_MS = 1200;

/**
 * A gapless looping video. `<video loop>` stalls for a moment on every restart while the browser seeks back to the
 * start (picture freezes, sound cuts); two copies take turns instead: just before one ends, the other starts from
 * the beginning and takes over, so the seek never shows. The clip's own sound fades to `volume` (0 = silent).
 */
export function LoopVideo({ src, poster, focus, volume }: { src?: string; poster?: string; focus: string; volume: number }) {
  const a = useRef<HTMLVideoElement>(null);
  const b = useRef<HTMLVideoElement>(null);
  const [front, setFront] = useState(0);
  const active = useRef(0);
  const level = useRef(0); // current sound level, eased toward `volume`
  const target = useRef(volume);
  target.current = volume;

  useEffect(() => {
    const vids = [a.current, b.current];
    if (!src || !vids[0] || !vids[1]) return;
    // A timer, not requestAnimationFrame: rAF stops in hidden panels and background tabs, and the loop would stall.
    let last = performance.now();
    let switching = false;
    const tick = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      const cur = vids[active.current]!;
      const next = vids[1 - active.current]!;
      // Ease the sound; only the playing copy is ever audible.
      const step = (AMBIENT_VOLUME * dt) / FADE_MS;
      level.current = level.current < target.current ? Math.min(target.current, level.current + step) : Math.max(target.current, level.current - step);
      cur.volume = level.current;
      cur.muted = level.current === 0;
      next.muted = true;
      // A stalled copy (autoplay refused, decoder hiccup) is restarted instead of left frozen on one frame.
      if (cur.paused && !switching && !cur.ended) void cur.play().catch(() => {});
      if (!switching && cur.duration && (cur.ended || cur.currentTime >= cur.duration - LEAD_S)) {
        switching = true;
        next.currentTime = 0;
        // Hand over only once the twin is really playing; if it can't start, rewind this copy instead.
        next
          .play()
          .then(() => {
            active.current = 1 - active.current;
            setFront(active.current);
            window.setTimeout(() => {
              cur.pause();
              cur.currentTime = 0;
              switching = false;
            }, LEAD_S * 1000 + 100);
          })
          .catch(() => {
            cur.currentTime = 0;
            void cur.play().catch(() => {});
            switching = false;
          });
      }
    };
    const t = window.setInterval(tick, 100);
    return () => window.clearInterval(t);
  }, [src]);

  const common = { className: "absolute inset-0 size-full object-cover", style: { objectPosition: focus }, src, poster, muted: true, playsInline: true, preload: "auto" } as const;
  return (
    <>
      <video ref={a} {...common} autoPlay style={{ ...common.style, opacity: front === 0 ? 1 : 0 }} />
      {src && <video ref={b} {...common} style={{ ...common.style, opacity: front === 1 ? 1 : 0 }} />}
    </>
  );
}

/** How loud the scene's own sound (sea, wind) sits under the theme; a full fade to it takes FADE_MS. */
export const AMBIENT_VOLUME = 0.35;
