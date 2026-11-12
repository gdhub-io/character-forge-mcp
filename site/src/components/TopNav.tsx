import {
	IconArrowUpRight,
	IconBrandGithub,
	IconMenu2,
	IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { LANGS, type Lang, ui } from "../i18n";
import { onLinkClick, PATHS, type Page } from "../router";

export const REPO = "gdhub-io/character-forge-mcp";
export const GITHUB_URL = `https://github.com/${REPO}`;

const PAGES: Page[] = ["characters", "how"];
const INSTALL = `${PATHS.how}#install`;

export function TopNav({
	page,
	lang = "en",
	onLang,
}: {
	page: Page;
	lang?: Lang;
	onLang?: (l: Lang) => void;
}) {
	const t = ui(lang);
	const [menu, setMenu] = useState(false);
	// Any link moves to another page or section: close the menu then.
	useEffect(() => {
		const close = () => setMenu(false);
		window.addEventListener("popstate", close);
		window.addEventListener("hashchange", close);
		return () => {
			window.removeEventListener("popstate", close);
			window.removeEventListener("hashchange", close);
		};
	}, []);
	return (
		<header className="relative flex items-center justify-between">
			<a
				href={PATHS.characters}
				onClick={onLinkClick(PATHS.characters)}
				className="flex items-center gap-2.5 text-fg sm:gap-3"
			>
				<span
					aria-hidden
					className="grid size-9 place-items-center rounded-[8px] border border-line bg-deep font-display text-[21px] leading-none font-semibold tracking-[-0.03em] sm:size-11 sm:rounded-[10px] sm:text-[26px]"
				>
					Cf
				</span>
				<span className="font-mono text-[11px] font-bold tracking-[0.14em] sm:text-xs">
					CHARACTER FORGE MCP
				</span>
			</a>
			<nav className="hidden items-center gap-9 md:flex">
				{PAGES.map((p) => (
					<a
						key={p}
						href={PATHS[p]}
						onClick={onLinkClick(PATHS[p])}
						aria-current={p === page ? "page" : undefined}
						className="flex flex-col items-center gap-1.5 text-sm"
					>
						<span
							className={
								p === page
									? "font-semibold text-fg"
									: "text-dim transition-colors hover:text-fg"
							}
						>
							{t.nav[p]}
						</span>
						<span
							className={`h-0.5 w-4 ${p === page ? "bg-accent" : "bg-transparent"}`}
						/>
					</a>
				))}
			</nav>
			<div className="flex items-center gap-2 sm:gap-3">
				{onLang && LANGS.length > 1 && (
					<div
						role="group"
						aria-label="Language"
						className="flex rounded-full border border-line p-0.5 text-[12px] font-semibold"
					>
						{LANGS.map((l) => (
							<button
								type="button"
								key={l}
								onClick={() => onLang(l)}
								aria-pressed={l === lang}
								className={`rounded-full px-2.5 py-1.5 uppercase ${l === lang ? "bg-fg text-deep" : "text-dim hover:text-fg"}`}
							>
								{l}
							</button>
						))}
					</div>
				)}
				<a
					href={GITHUB_URL}
					data-goatcounter-click="github"
					className="hidden items-center gap-2 rounded-full border border-line px-3.5 py-2.5 text-[13px] text-fg sm:flex"
				>
					<IconBrandGithub size={16} stroke={1.75} /> {t.github}
				</a>
				<a
					href={INSTALL}
					onClick={onLinkClick(INSTALL)}
					data-goatcounter-click="install"
					className="hidden items-center gap-2 rounded-full bg-accent px-4.5 py-2.5 text-[13px] font-semibold text-accent-ink sm:flex"
				>
					{t.install} <IconArrowUpRight size={14} stroke={2} />
				</a>
				{/* Phones: links and the call to action live in a menu. */}
				<button
					type="button"
					aria-label="Menu"
					aria-expanded={menu}
					onClick={() => setMenu(!menu)}
					className="grid size-9 place-items-center rounded-full border border-line bg-white/5 text-fg md:hidden"
				>
					{menu ? (
						<IconX size={16} stroke={1.75} />
					) : (
						<IconMenu2 size={16} stroke={1.75} />
					)}
				</button>
			</div>
			{menu && (
				<div className="absolute top-12 right-0 z-30 flex w-56 flex-col gap-1 rounded-lg border border-line bg-glass p-2 backdrop-blur-xl md:hidden">
					{PAGES.map((p) => (
						<a
							key={p}
							href={PATHS[p]}
							onClick={onLinkClick(PATHS[p])}
							className={`rounded px-3 py-2.5 text-sm hover:bg-white/7 ${p === page ? "font-semibold text-fg" : "text-dim"}`}
						>
							{t.nav[p]}
						</a>
					))}
					<a
						href={GITHUB_URL}
						data-goatcounter-click="github"
						className="rounded px-3 py-2.5 text-sm text-dim hover:bg-white/7"
					>
						{t.github}
					</a>
					<a
						href={INSTALL}
						onClick={onLinkClick(INSTALL)}
						data-goatcounter-click="install"
						className="mt-1 flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-[13px] font-semibold text-accent-ink"
					>
						{t.install} <IconArrowUpRight size={14} stroke={2} />
					</a>
				</div>
			)}
		</header>
	);
}
