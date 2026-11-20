import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** Runs ffmpeg or ffprobe, with one clear error when it isn't installed. */
export async function run(
	tool: "ffmpeg" | "ffprobe",
	args: string[],
): Promise<string> {
	try {
		return (await exec(tool, args, { maxBuffer: 16 * 1024 * 1024 })).stdout;
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === "ENOENT")
			throw new Error(`This step needs ${tool} on PATH (install ffmpeg).`);
		throw e;
	}
}

/** Writes the inputs to temp files, lets `work` turn them into the output file, returns the output and cleans up. */
export async function transformMany(
	inputs: { bytes: Buffer; ext: string }[],
	outExt: string,
	work: (srcs: string[], dst: string) => Promise<void>,
): Promise<Buffer> {
	const dir = await mkdtemp(path.join(os.tmpdir(), "cf-"));
	try {
		const srcs = inputs.map((x, i) => path.join(dir, `in${i}.${x.ext}`));
		const dst = path.join(dir, `out.${outExt}`);
		await Promise.all(inputs.map((x, i) => writeFile(srcs[i], x.bytes)));
		await work(srcs, dst);
		return await readFile(dst);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

/** One input: see transformMany. */
export const transform = (
	input: Buffer,
	inExt: string,
	outExt: string,
	work: (src: string, dst: string) => Promise<void>,
) =>
	transformMany([{ bytes: input, ext: inExt }], outExt, ([src], dst) =>
		work(src, dst),
	);

/** One ffmpeg pass over a buffer: `args` sit between the input and the output file. */
export const ffmpeg = (
	input: Buffer,
	inExt: string,
	outExt: string,
	args: string[],
) =>
	transform(
		input,
		inExt,
		outExt,
		async (src, dst) =>
			void (await run("ffmpeg", [
				"-v",
				"error",
				"-y",
				"-i",
				src,
				...args,
				dst,
			])),
	);

/** Duration in seconds of a media file. */
export const durationOf = async (file: string) =>
	Number(
		(
			await run("ffprobe", [
				"-v",
				"error",
				"-show_entries",
				"format=duration",
				"-of",
				"csv=p=0",
				file,
			])
		).trim(),
	);

/**
 * Decodes a clip's picture to raw RGB at width × height and hands each frame to `on`, in order. With `out`, every
 * frame `on` returns is encoded to that file (H.264, silent), with backpressure, so
 * a whole clip never sits in memory.
 */
export async function eachFrame(
	src: string,
	width: number,
	height: number,
	on: (rgb: Buffer, index: number) => Buffer | undefined,
	out?: { dst: string; fps: number },
): Promise<void> {
	const size = width * height * 3;
	const dec = spawn("ffmpeg", [
		"-v",
		"error",
		"-i",
		src,
		"-vf",
		`scale=${width}:${height}`,
		"-f",
		"rawvideo",
		"-pix_fmt",
		"rgb24",
		"-",
	]);
	const enc = out
		? spawn("ffmpeg", [
				"-v",
				"error",
				"-y",
				"-f",
				"rawvideo",
				"-pix_fmt",
				"rgb24",
				"-s",
				`${width}x${height}`,
				"-r",
				String(out.fps),
				"-i",
				"pipe:0",
				"-an",
				"-c:v",
				"libx264",
				"-crf",
				"18",
				"-pix_fmt",
				"yuv420p",
				"-movflags",
				"+faststart",
				out.dst,
			])
		: undefined;
	const done = (p: ReturnType<typeof spawn>, name: string) =>
		new Promise<void>((resolve, reject) => {
			let err = "";
			p.stderr?.on("data", (d) => {
				err += d;
			});
			p.on("error", (e) =>
				reject(
					(e as NodeJS.ErrnoException).code === "ENOENT"
						? new Error("This step needs ffmpeg on PATH (install ffmpeg).")
						: e,
				),
			);
			p.on("close", (code) =>
				code === 0
					? resolve()
					: reject(new Error(`ffmpeg ${name} failed: ${err.trim()}`)),
			);
		});
	const finished = Promise.all([
		done(dec, "decode"),
		enc ? done(enc, "encode") : undefined,
	]);
	let failed: Error | undefined;
	const fail = (e: Error) => {
		failed ??= e;
		dec.kill();
		enc?.kill();
	};
	// An encoder that dies mid-clip closes its pipe: without a listener that EPIPE would crash the server.
	enc?.stdin.on("error", fail);
	let pending: Buffer = Buffer.alloc(0);
	let index = 0;
	dec.stdout.on("data", (chunk: Buffer) => {
		if (failed) return;
		try {
			pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
			while (pending.length >= size) {
				const frame = pending.subarray(0, size);
				pending = pending.subarray(size);
				const next = on(Buffer.from(frame), index++);
				if (enc && next && !enc.stdin.write(next)) {
					dec.stdout.pause();
					enc.stdin.once("drain", () => dec.stdout.resume());
				}
			}
		} catch (e) {
			fail(e as Error);
		}
	});
	dec.stdout.on("end", () => enc?.stdin.end());
	await finished.catch((e) => {
		throw failed ?? e;
	});
	if (failed) throw failed;
}
