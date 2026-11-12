import { useCallback, useEffect, useRef, useState } from "react";
import type { Acoustics } from "./characters";

/** The voice waits a beat after the click (the music ducks first), fades in a touch, and fades out when stopped. */
const START_DELAY_S = 0.7;
const FADE_IN_S = 0.15;
const FADE_OUT_S = 0.8;

/** A decaying stereo noise burst: a cheap, believable room impulse for a ConvolverNode. */
function roomImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
	const length = Math.max(1, Math.round(ctx.sampleRate * seconds));
	const buf = ctx.createBuffer(2, length, ctx.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const data = buf.getChannelData(ch);
		for (let i = 0; i < length; i++)
			data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
	}
	return buf;
}

/**
 * Plays the character's voice placed in their room: dry + convolver reverb, a softened top end.
 * onSpeaking(true/false) lets the page duck the music around it.
 */
export function useVoice(
	src: string | undefined,
	acoustics: Acoustics,
	onSpeaking: (speaking: boolean) => void,
) {
	const ctxRef = useRef<AudioContext | null>(null);
	const bufRef = useRef<Promise<AudioBuffer> | null>(null);
	const nodeRef = useRef<AudioBufferSourceNode | null>(null);
	const [speaking, setSpeaking] = useState(false);

	const gainRef = useRef<GainNode | null>(null);
	// Held in a ref so stop() keeps one identity: otherwise toggling the music (a new onSpeaking) would cut the voice.
	const onSpeakingRef = useRef(onSpeaking);
	onSpeakingRef.current = onSpeaking;

	/** Fades the current line out and stops it; the page's speaking state follows at once. */
	const stop = useCallback(() => {
		const source = nodeRef.current;
		const gain = gainRef.current;
		const ctx = ctxRef.current;
		nodeRef.current = null;
		gainRef.current = null;
		if (!source || !gain || !ctx) return;
		const t = ctx.currentTime;
		gain.gain.cancelScheduledValues(t);
		gain.gain.setValueAtTime(gain.gain.value, t);
		gain.gain.linearRampToValueAtTime(0, t + FADE_OUT_S);
		source.stop(t + FADE_OUT_S);
		setSpeaking(false);
		onSpeakingRef.current(false);
	}, []);

	useEffect(() => {
		bufRef.current = null;
		return () => stop();
	}, [src, stop]);

	const play = useCallback(async () => {
		if (!src) return;
		ctxRef.current ??= new AudioContext();
		const ctx = ctxRef.current;
		await ctx.resume();
		bufRef.current ??= fetch(src)
			.then((r) => r.arrayBuffer())
			.then((b) => ctx.decodeAudioData(b));
		const buffer = await bufRef.current;

		const source = ctx.createBufferSource();
		source.buffer = buffer;
		const tone = ctx.createBiquadFilter();
		tone.type = "lowpass";
		tone.frequency.value = acoustics.lowpassHz;
		const dry = ctx.createGain();
		dry.gain.value = 1 - acoustics.wet / 2;
		const wet = ctx.createGain();
		wet.gain.value = acoustics.wet;
		const room = ctx.createConvolver();
		room.buffer = roomImpulse(ctx, acoustics.reverbSeconds);
		const master = ctx.createGain();
		source.connect(tone);
		tone.connect(dry).connect(master);
		tone.connect(room).connect(wet).connect(master);
		master.connect(ctx.destination);

		const at = ctx.currentTime + START_DELAY_S;
		master.gain.setValueAtTime(0, at);
		master.gain.linearRampToValueAtTime(1, at + FADE_IN_S);

		source.onended = () => {
			master.disconnect();
			if (nodeRef.current !== source) return; // already stopped by hand, or replaced
			nodeRef.current = null;
			gainRef.current = null;
			setSpeaking(false);
			onSpeakingRef.current(false);
		};
		nodeRef.current = source;
		gainRef.current = master;
		setSpeaking(true);
		onSpeakingRef.current(true); // the music starts ducking now, during the delay
		source.start(at);
	}, [src, acoustics]);

	const toggle = useCallback(() => {
		if (nodeRef.current) stop();
		else void play();
	}, [play, stop]);

	return { speaking, toggle };
}
