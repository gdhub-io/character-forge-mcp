import { useCallback, useEffect, useRef, useState } from "react";

const VOLUME = 0.12;
const FADE_OUT_S = 2.5;
const GAP_MS = 6000;
/** Short, so the theme is heard right away (it used to creep in over 1.5 s at an already low volume). */
const FADE_IN_MS = 500;
/** Switching characters: the old theme fades out while the new one fades in. */
const SWITCH_FADE_MS = 1200;
const GESTURES = ["pointerdown", "keydown", "touchstart"] as const;

type Fade = (target: number, ms: number) => void;

/**
 * Plays a character's theme by default: fades out before the end, rests, fades back in from the start.
 * Browsers block sound until the visitor interacts, so a blocked start waits for the first click or key press.
 * Controls that toggle the music carry data-music-toggle, so that first click doesn't start and stop it at once.
 */
export function useThemeMusic(src?: string) {
	const audio = useRef<HTMLAudioElement | null>(null);
	const fade = useRef<Fade>(() => {});
	// The visitor's choice, one for the whole cast: it survives switching characters, and holds even for a character
	// without a theme. `unlocked` turns true once the browser lets the page make sound (after the first interaction).
	const [enabled, setEnabled] = useState(true);
	const wanted = useRef(true);
	const level = useRef(1); // 1 = full, below 1 while the character speaks
	const [unlocked, setUnlocked] = useState(false);
	useEffect(() => {
		const unlock = () => setUnlocked(true);
		for (const g of GESTURES)
			window.addEventListener(g, unlock, { once: true });
		return () => {
			for (const g of GESTURES) window.removeEventListener(g, unlock);
		};
	}, []);

	useEffect(() => {
		if (!src) return;
		const a = new Audio(src);
		a.preload = "auto";
		a.volume = 0;
		audio.current = a;
		let fadeTimer = 0;
		let gapTimer = 0;
		let fadingOut = false;
		let disposed = false; // a stale element (StrictMode, character switch) must never start playing

		const fadeTo: Fade = (target, ms) => {
			window.clearInterval(fadeTimer);
			const step = (target - a.volume) / Math.max(1, ms / 50);
			fadeTimer = window.setInterval(() => {
				const v = a.volume + step;
				const done = step >= 0 ? v >= target : v <= target;
				a.volume = done ? target : Math.min(1, Math.max(0, v));
				if (done) window.clearInterval(fadeTimer);
			}, 50);
		};
		fade.current = fadeTo;

		const start = () =>
			a.play().then(() => {
				if (disposed) return a.pause();
				setUnlocked(true);
				fadeTo(VOLUME * level.current, FADE_IN_MS);
			});
		const onGesture = (e: Event) => {
			if (
				disposed ||
				(e.target instanceof Element && e.target.closest("[data-music-toggle]"))
			)
				return;
			unlisten();
			if (wanted.current) void start().catch(() => {});
		};
		const unlisten = () => {
			for (const g of GESTURES) window.removeEventListener(g, onGesture);
		};
		const listen = () => {
			for (const g of GESTURES) window.addEventListener(g, onGesture);
		};
		if (wanted.current) start().catch(() => !disposed && listen());

		const onTime = () => {
			if (!fadingOut && a.duration && a.duration - a.currentTime < FADE_OUT_S) {
				fadingOut = true;
				fadeTo(0, FADE_OUT_S * 1000);
			}
		};
		const onEnded = () => {
			gapTimer = window.setTimeout(() => {
				if (disposed) return;
				fadingOut = false;
				a.currentTime = 0;
				void a.play().then(() => fadeTo(VOLUME * level.current, FADE_IN_MS));
			}, GAP_MS);
		};
		a.addEventListener("timeupdate", onTime);
		a.addEventListener("ended", onEnded);
		return () => {
			disposed = true;
			unlisten();
			window.clearTimeout(gapTimer);
			a.removeEventListener("timeupdate", onTime);
			a.removeEventListener("ended", onEnded);
			audio.current = null;
			fade.current = () => {}; // a late duck() must not bring the old theme back up
			fadeTo(0, SWITCH_FADE_MS);
			window.setTimeout(() => {
				window.clearInterval(fadeTimer);
				a.pause();
			}, SWITCH_FADE_MS + 100);
		};
	}, [src]);

	const toggle = useCallback(() => {
		const a = audio.current;
		const next = !wanted.current;
		wanted.current = next;
		setEnabled(next);
		setUnlocked(true); // a click on the toggle is itself the interaction browsers wait for
		if (!a) return; // no theme for this character: the choice still applies to the next one
		if (next)
			void a
				.play()
				.then(() => fade.current(VOLUME * level.current, FADE_IN_MS));
		else {
			fade.current(0, 600);
			window.setTimeout(() => !wanted.current && a.pause(), 650);
		}
	}, []);

	/** Ducks the music under the voice (factor < 1) and brings it back (1). */
	const duck = useCallback((factor: number) => {
		level.current = factor;
		if (wanted.current) fade.current(VOLUME * factor, factor < 1 ? 400 : 1200);
	}, []);

	/** on = the visitor's choice; audible = sound may actually play now (chosen and allowed by the browser). */
	return { on: enabled, audible: enabled && unlocked, toggle, duck };
}
