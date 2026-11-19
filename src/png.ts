import { deflateSync, inflateSync } from "node:zlib";

/** An 8-bit image in memory: RGB (3 channels) or RGBA (4), rows top to bottom. */
export interface Raster {
	width: number;
	height: number;
	channels: 3 | 4;
	data: Buffer;
}

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function chunk(type: string, data: Buffer): Buffer {
	const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
	let crc = 0xffffffff;
	for (const byte of td) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	td.copy(out, 4);
	out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
	return out;
}

/** PNG from 8-bit RGB or RGBA pixels (no filtering: small enough for sheets and avatars). */
export function encodePng(r: Raster): Buffer {
	const row = r.width * r.channels;
	const raw = Buffer.alloc((row + 1) * r.height);
	for (let y = 0; y < r.height; y++)
		r.data.copy(raw, y * (row + 1) + 1, y * row, (y + 1) * row);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(r.width, 0);
	ihdr.writeUInt32BE(r.height, 4);
	ihdr.set([8, r.channels === 4 ? 6 : 2, 0, 0, 0], 8);
	return Buffer.concat([
		SIGNATURE,
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

const paeth = (a: number, b: number, c: number) => {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/**
 * Decodes an 8-bit, non-interlaced PNG (grey, grey+alpha, RGB, RGBA or palette) to RGB or RGBA. That covers what
 * image models return; anything else is refused with a clear error rather than misread.
 */
export function decodePng(bytes: Buffer): Raster {
	if (!bytes.subarray(0, 8).equals(SIGNATURE))
		throw new Error("Not a PNG image.");
	let pos = 8;
	let ihdr: Buffer | undefined;
	let palette: Buffer | undefined;
	let alpha: Buffer | undefined;
	const idat: Buffer[] = [];
	while (pos + 8 <= bytes.length) {
		const len = bytes.readUInt32BE(pos);
		const type = bytes.toString("ascii", pos + 4, pos + 8);
		const data = bytes.subarray(pos + 8, pos + 8 + len);
		if (type === "IHDR") ihdr = data;
		else if (type === "PLTE") palette = data;
		else if (type === "tRNS") alpha = data;
		else if (type === "IDAT") idat.push(data);
		else if (type === "IEND") break;
		pos += 12 + len;
	}
	if (!ihdr) throw new Error("PNG has no header.");
	const width = ihdr.readUInt32BE(0);
	const height = ihdr.readUInt32BE(4);
	const [depth, colour, , , interlace] = ihdr.subarray(8, 13);
	const inChannels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colour];
	if (depth !== 8 || interlace !== 0 || !inChannels)
		throw new Error(
			`Unsupported PNG (bit depth ${depth}, colour type ${colour}, interlace ${interlace}): only 8-bit, non-interlaced images can be cropped.`,
		);
	if (colour === 3 && !palette) throw new Error("Palette PNG without PLTE.");
	// A picture the user gave can claim any size: cap it before allocating (a sheet is ~1.6 megapixels).
	if (width * height > 40_000_000)
		throw new Error(`PNG too large to crop: ${width}×${height}.`);
	const stride = width * inChannels;
	const raw = inflateSync(Buffer.concat(idat), {
		maxOutputLength: (stride + 1) * height,
	});
	if (raw.length < (stride + 1) * height)
		throw new Error("PNG image data is truncated.");
	// Undo the per-row filters in place, into one unfiltered buffer.
	const px = Buffer.alloc(stride * height);
	for (let y = 0; y < height; y++) {
		const f = raw[y * (stride + 1)];
		const src = y * (stride + 1) + 1;
		const out = y * stride;
		for (let i = 0; i < stride; i++) {
			const a = i >= inChannels ? px[out + i - inChannels] : 0;
			const b = y > 0 ? px[out - stride + i] : 0;
			const c =
				y > 0 && i >= inChannels ? px[out - stride + i - inChannels] : 0;
			const v = raw[src + i];
			px[out + i] =
				f === 1
					? v + a
					: f === 2
						? v + b
						: f === 3
							? v + ((a + b) >> 1)
							: f === 4
								? v + paeth(a, b, c)
								: v;
		}
	}
	const channels: 3 | 4 =
		colour === 4 || colour === 6 || alpha !== undefined ? 4 : 3;
	if (colour === 6 || (colour === 2 && !alpha))
		return { width, height, channels, data: px };
	const data = Buffer.alloc(width * height * channels);
	for (let p = 0; p < width * height; p++) {
		const o = p * channels;
		let r: number;
		let g: number;
		let b: number;
		let a = 255;
		if (colour === 3) {
			const k = px[p];
			[r, g, b] = [palette![k * 3], palette![k * 3 + 1], palette![k * 3 + 2]];
			if (alpha && k < alpha.length) a = alpha[k];
		} else if (colour === 2) {
			[r, g, b] = [px[p * 3], px[p * 3 + 1], px[p * 3 + 2]];
			if (
				alpha?.length === 6 &&
				r === alpha[1] &&
				g === alpha[3] &&
				b === alpha[5]
			)
				a = 0;
		} else {
			r = g = b = px[p * inChannels];
			if (colour === 4) a = px[p * 2 + 1];
			else if (alpha?.length === 2 && r === alpha[1]) a = 0;
		}
		data[o] = r;
		data[o + 1] = g;
		data[o + 2] = b;
		if (channels === 4) data[o + 3] = a;
	}
	return { width, height, channels, data };
}

/** A rectangle of a raster, in pixels. It may reach past the edges: those pixels get the fill colour. */
export function cropRaster(
	r: Raster,
	x: number,
	y: number,
	w: number,
	h: number,
	fill: number[],
): Raster {
	const [x0, y0] = [Math.round(x), Math.round(y)];
	const [cw, ch] = [Math.max(1, Math.round(w)), Math.max(1, Math.round(h))];
	const data = Buffer.alloc(cw * ch * r.channels);
	const pad = Buffer.from(fill.slice(0, r.channels));
	for (let j = 0; j < ch; j++)
		for (let i = 0; i < cw; i++) {
			const [sx, sy] = [x0 + i, y0 + j];
			const to = (j * cw + i) * r.channels;
			if (sx < 0 || sy < 0 || sx >= r.width || sy >= r.height)
				pad.copy(data, to);
			else {
				const from = (sy * r.width + sx) * r.channels;
				r.data.copy(data, to, from, from + r.channels);
			}
		}
	return { width: cw, height: ch, channels: r.channels, data };
}
