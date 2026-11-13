import { IconDownload } from "@tabler/icons-react";
import type { Block } from "../card";

const Sub = ({ children }: { children: string }) => (
	<h4 className="kicker mb-2 font-semibold text-fg">{children}</h4>
);

export function Blocks({
	blocks,
	downloadLabel = "Download",
}: {
	blocks: Block[];
	downloadLabel?: string;
}) {
	return (
		<div className="flex flex-col gap-7">
			{blocks.map((b, i) => (
				<BlockView
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list that is never reordered
					key={i}
					b={b}
					downloadLabel={downloadLabel}
				/>
			))}
		</div>
	);
}

function BlockView({ b, downloadLabel }: { b: Block; downloadLabel: string }) {
	switch (b.type) {
		case "chain":
			return (
				<ol className="flex flex-col">
					{b.steps.map((s, i) => {
						const end = s.tone === "end";
						const quote = s.text.startsWith("“");
						return (
							<li key={s.label} className="flex gap-5">
								<span className="flex w-6 flex-col items-center pt-0.5">
									<span
										className={`size-[11px] rounded-full ${end ? "bg-fg" : "bg-accent"}`}
									/>
									{i < b.steps.length - 1 && (
										<span className="w-px flex-1 bg-line" />
									)}
								</span>
								<span className="flex flex-1 flex-col gap-1.5 pb-4">
									<span
										className={`kicker text-[10px] font-bold ${end ? "text-fg" : "text-accent"}`}
									>
										{s.label}
									</span>
									<span
										className={
											quote
												? "font-display text-lg italic leading-snug text-fg"
												: "text-sm leading-relaxed text-fg"
										}
									>
										{s.text}
									</span>
								</span>
							</li>
						);
					})}
				</ol>
			);
		case "question":
			return (
				<div className="flex flex-col gap-2.5 rounded border border-line bg-white/4 p-4">
					<span className="kicker text-[10px] text-dim">{b.label}</span>
					<p className="font-display text-lg leading-snug text-fg">{b.text}</p>
				</div>
			);
		case "rows":
			return (
				<dl className="flex flex-col">
					{b.rows.map(([l, v]) => (
						<div
							key={l}
							className="grid grid-cols-[120px_1fr] gap-5 border-t border-line py-3"
						>
							<dt className="kicker pt-0.5 text-[10px] text-dim">{l}</dt>
							<dd className="text-sm leading-relaxed text-fg">{v}</dd>
						</div>
					))}
				</dl>
			);
		case "list":
			return (
				<div>
					{b.title && <Sub>{b.title}</Sub>}
					<ul>
						{b.items.map((it, i) => (
							<li
								// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list that is never reordered
								key={i}
								className="flex flex-col gap-1 border-t border-line py-3"
							>
								{it.lead && (
									<span className="text-sm font-semibold text-fg">
										{it.lead}
									</span>
								)}
								<span
									className={`text-sm leading-relaxed ${it.lead ? "text-dim" : "text-fg"}`}
								>
									{it.text}
								</span>
							</li>
						))}
					</ul>
				</div>
			);
		case "quotes":
			return (
				<div>
					{b.title && <Sub>{b.title}</Sub>}
					<div className="flex flex-col gap-3">
						{b.items.map((q, i) => (
							<blockquote
								// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list that is never reordered
								key={i}
								className="border-l-2 border-accent pl-4 font-display text-lg italic leading-snug text-fg"
							>
								{q}
							</blockquote>
						))}
					</div>
				</div>
			);
		case "prose":
			return (
				<p className="font-display text-[17px] leading-relaxed text-fg">
					{b.text}
				</p>
			);
		case "timeline":
			return (
				<div>
					{b.title && <Sub>{b.title}</Sub>}
					<ol className="flex flex-col pl-[5px]">
						{b.items.map((it, i) => (
							<li
								// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list that is never reordered
								key={i}
								className="relative border-l border-line pb-5 pl-5 last:pb-0"
							>
								<span className="absolute top-1 -left-[5px] size-[9px] rounded-full bg-accent" />
								<span className="kicker block text-[10px] font-semibold text-accent">
									{it.lead}
								</span>
								<span className="mt-1 block text-sm leading-relaxed text-fg">
									{it.text}
								</span>
							</li>
						))}
					</ol>
				</div>
			);
		case "cards":
			return (
				<div
					className="grid gap-2.5"
					style={{
						gridTemplateColumns: `repeat(${b.items.length}, minmax(0, 1fr))`,
					}}
				>
					{b.items.map((c) => {
						const tone =
							c.tone === "best"
								? "text-best border-t-best"
								: c.tone === "worst"
									? "text-worst border-t-worst"
									: "text-dim border-t-line";
						return (
							<div
								key={c.label}
								className={`flex flex-col gap-2 rounded border border-line border-t-2 bg-white/4 p-4 ${tone}`}
							>
								<span className="kicker text-[10px] font-semibold">
									{c.label}
								</span>
								<span className="text-sm leading-relaxed text-fg">
									{c.text}
								</span>
							</div>
						);
					})}
				</div>
			);
		case "image":
			return (
				<figure className="flex flex-col items-end gap-2.5">
					<img
						src={b.src}
						alt={b.alt}
						className="w-full rounded border border-line bg-white/4"
					/>
					{b.download && (
						<a
							href={b.src}
							download={b.download}
							className="flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-[13px] text-fg hover:bg-white/7"
						>
							<IconDownload size={14} stroke={1.75} /> {downloadLabel}
						</a>
					)}
				</figure>
			);
		case "radar":
			return (
				<div>
					{b.title && <Sub>{b.title}</Sub>}
					<Radar axes={b.axes} legend={b.legend} />
				</div>
			);
		case "palette":
			return (
				<div className="flex flex-col gap-3">
					{b.items.map((p) => (
						<div key={p.hex} className="flex gap-3.5">
							<span
								className="h-11 w-8 shrink-0 rounded-sm"
								style={{ background: p.hex }}
							/>
							<span className="flex flex-col gap-0.5">
								<span className="flex items-center gap-2 text-sm font-semibold text-fg">
									{p.name}{" "}
									<span className="kicker text-[10px] font-normal text-dim">
										{p.hex}
									</span>
								</span>
								<span className="text-[13px] leading-snug text-dim">
									{p.meaning}
								</span>
							</span>
						</div>
					))}
				</div>
			);
	}
}

/** Six scales on a hexagon: the born temperament, and over it what life made of it. */
function Radar({
	axes,
	legend,
}: Omit<Extract<Block, { type: "radar" }>, "type">) {
	const R = 92;
	const at = (i: number, v: number) => {
		const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
		return [
			160 + Math.cos(a) * R * (v / 100),
			128 + Math.sin(a) * R * (v / 100),
		];
	};
	const shape = (vs: number[]) =>
		vs
			.map((v, i) =>
				at(i, v)
					.map((n) => n.toFixed(1))
					.join(","),
			)
			.join(" ");
	const born = axes.map((x) => x.born);
	const changed = axes.some((x) => x.now !== undefined && x.now !== x.born);
	const now = axes.map((x) => x.now ?? x.born);
	return (
		<figure className="flex flex-col items-center gap-3">
			<svg
				viewBox="-40 0 400 256"
				className="w-full max-w-sm"
				role="img"
				aria-label={axes
					.map(
						(x) =>
							`${x.label} ${x.born}${changed && x.now !== undefined ? ` → ${x.now}` : ""}`,
					)
					.join(", ")}
			>
				<g className="text-line" stroke="currentColor" fill="none">
					{[25, 50, 75, 100].map((v) => (
						<polygon key={v} points={shape(axes.map(() => v))} />
					))}
					{axes.map((x, i) => {
						const [ex, ey] = at(i, 100);
						return <line key={x.label} x1={160} y1={128} x2={ex} y2={ey} />;
					})}
				</g>
				<g className="text-accent" stroke="currentColor" fill="currentColor">
					<polygon points={shape(born)} fillOpacity={0.18} strokeWidth={1.5} />
					{born.map((v, i) => {
						const [cx, cy] = at(i, v);
						// biome-ignore lint/suspicious/noArrayIndexKey: one dot per fixed axis
						return <circle key={i} cx={cx} cy={cy} r={3} />;
					})}
				</g>
				{changed && (
					<g className="text-fg" stroke="currentColor" fill="currentColor">
						<polygon
							points={shape(now)}
							fill="none"
							strokeWidth={1.5}
							strokeDasharray="4 3"
						/>
						{now.map((v, i) => {
							const [cx, cy] = at(i, v);
							// biome-ignore lint/suspicious/noArrayIndexKey: one dot per fixed axis
							return <circle key={i} cx={cx} cy={cy} r={2.5} />;
						})}
					</g>
				)}
				<g className="fill-dim text-[10px]">
					{axes.map((x, i) => {
						const [lx, ly] = at(i, 122);
						return (
							<text
								key={x.label}
								x={lx}
								y={ly + 3}
								textAnchor={
									Math.abs(lx - 160) < 4 ? "middle" : lx > 160 ? "start" : "end"
								}
							>
								{x.label}
							</text>
						);
					})}
				</g>
			</svg>
			<figcaption className="flex gap-5 text-[11px] text-dim">
				<span className="flex items-center gap-1.5">
					<span className="size-2 rounded-full bg-accent" /> {legend.born}
				</span>
				{changed && (
					<span className="flex items-center gap-1.5">
						<span className="w-4 border-t border-dashed border-fg" />{" "}
						{legend.now}
					</span>
				)}
			</figcaption>
		</figure>
	);
}
