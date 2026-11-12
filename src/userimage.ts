import { lookup } from "node:dns/promises";
import { readFile, stat } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";

/**
 * Pictures the user hands us (their own concept, a pose reference) come from a path or URL written into a chat or a
 * card, so they're checked before anything reads, shows or uploads them: only real PNG/JPEG/WebP images, only https
 * to public hosts. Otherwise a crafted card could pull ~/.ssh or a .env into the chat, or make the server fetch an
 * internal address.
 */
export const IMAGE_TYPES = {
	png: "image/png",
	jpeg: "image/jpeg",
	webp: "image/webp",
} as const;
type ImageType = keyof typeof IMAGE_TYPES;
const EXTENSIONS: Record<string, ImageType> = {
	".png": "png",
	".jpg": "jpeg",
	".jpeg": "jpeg",
	".webp": "webp",
};
const MAX_BYTES = 25_000_000;

/** The image type from the file's first bytes, whatever its name says. */
function sniff(b: Buffer): ImageType | undefined {
	if (
		b
			.subarray(0, 8)
			.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
	)
		return "png";
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
	if (
		b.subarray(0, 4).toString("latin1") === "RIFF" &&
		b.subarray(8, 12).toString("latin1") === "WEBP"
	)
		return "webp";
	return undefined;
}

const privateV4 = (ip: string) => {
	const [a, b] = ip.split(".").map(Number);
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 100 && b >= 64 && b <= 127)
	);
};
const privateV6 = (ip: string) => {
	const v = ip.toLowerCase();
	return (
		v === "::" ||
		v === "::1" ||
		v.startsWith("fc") ||
		v.startsWith("fd") ||
		v.startsWith("fe80") ||
		(v.startsWith("::ffff:") && privateV4(v.slice(7)))
	);
};

/** Throws unless the URL is https on a public address (checked after DNS, so a public name can't point inside). */
export async function assertPublicUrl(ref: string): Promise<URL> {
	const url = new URL(ref);
	if (url.protocol !== "https:")
		throw new Error(`Only https image links are accepted: ${ref}`);
	const host = url.hostname.replace(/^\[|\]$/g, "");
	const addresses = isIP(host)
		? [{ address: host }]
		: await lookup(host, { all: true });
	if (
		addresses.some(({ address }) =>
			isIP(address) === 6 ? privateV6(address) : privateV4(address),
		)
	)
		throw new Error(`That image link points at a private address: ${ref}`);
	return url;
}

/** Reads a user-given picture (path or https URL) after checking it really is a PNG, JPEG or WebP image. */
export async function readUserImage(
	ref: string,
): Promise<{ bytes: Buffer; mimeType: string }> {
	let bytes: Buffer;
	if (/^[a-z]+:\/\//i.test(ref)) {
		const res = await fetch(await assertPublicUrl(ref), { redirect: "error" });
		if (!res.ok)
			throw new Error(`Could not download the image (${res.status}): ${ref}`);
		if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES)
			throw new Error(`The image is too large: ${ref}`);
		bytes = Buffer.from(await res.arrayBuffer());
	} else {
		const file = path.resolve(ref);
		if (!EXTENSIONS[path.extname(file).toLowerCase()])
			throw new Error(`Only .png, .jpg and .webp images are accepted: ${ref}`);
		const info = await stat(file).catch(() => {
			throw new Error(`Image not found: ${ref}`);
		});
		if (!info.isFile() || info.size > MAX_BYTES)
			throw new Error(`Not an image file of a usable size: ${ref}`);
		bytes = await readFile(file);
	}
	const type = sniff(bytes);
	if (!type) throw new Error(`Not a PNG, JPEG or WebP image: ${ref}`);
	return { bytes, mimeType: IMAGE_TYPES[type] };
}
