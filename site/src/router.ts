import { useEffect, useState } from "react";

/**
 * The site's pages, at real paths: "/" (the characters) and "/how-it-works". The build writes an HTML file for each
 * (see vite.config.ts), so they load directly on GitHub Pages and search engines see them as pages. Sections of a
 * page ("#install", "#commands") stay anchors.
 */
export type Page = "characters" | "how";
export const PATHS: Record<Page, string> = {
	characters: "/",
	how: "/how-it-works",
};
const LEGACY_GUIDE_HASHES = ["#how-it-works", "#install", "#commands"];

declare global {
	interface Window {
		goatcounter?: { count?: () => void };
	}
}

const pageOf = (pathname: string): Page =>
	pathname.replace(/\/+$/, "") === PATHS.how ? "how" : "characters";

/** Moves to another page without a reload, and counts the view (the first one counts itself on load). */
export function navigate(to: string) {
	window.history.pushState(null, "", to);
	window.dispatchEvent(new PopStateEvent("popstate"));
	window.goatcounter?.count?.();
}

/** For <a href> inside the site: a plain click navigates in place; a new-tab click works as a normal link. */
export function onLinkClick(to: string) {
	return (e: React.MouseEvent) => {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
			return;
		e.preventDefault();
		navigate(to);
	};
}

/** The current page and the section anchor in it; the old hash addresses ("/#how-it-works") move to the new ones. */
export function useLocation(): { page: Page; section?: string } {
	const read = () => {
		const { pathname, hash } = window.location;
		if (pathname === "/" && LEGACY_GUIDE_HASHES.includes(hash)) {
			const section = hash === "#how-it-works" ? "" : hash;
			window.history.replaceState(null, "", `${PATHS.how}${section}`);
			return { page: "how" as Page, section: section.slice(1) || undefined };
		}
		return { page: pageOf(pathname), section: hash.slice(1) || undefined };
	};
	const [loc, setLoc] = useState(read);
	useEffect(() => {
		const on = () => setLoc(read());
		window.addEventListener("popstate", on);
		window.addEventListener("hashchange", on);
		return () => {
			window.removeEventListener("popstate", on);
			window.removeEventListener("hashchange", on);
		};
	}, []);
	return loc;
}
