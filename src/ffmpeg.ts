import { execFile } from "node:child_process";
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

/** Writes `input` to a temp file, lets `work` turn it into the output file, returns the output and cleans up. */
export async function transform(
	input: Buffer,
	inExt: string,
	outExt: string,
	work: (src: string, dst: string) => Promise<void>,
): Promise<Buffer> {
	const dir = await mkdtemp(path.join(os.tmpdir(), "cf-"));
	try {
		const src = path.join(dir, `in.${inExt}`);
		const dst = path.join(dir, `out.${outExt}`);
		await writeFile(src, input);
		await work(src, dst);
		return await readFile(dst);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

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
