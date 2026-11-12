import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/** The public address of the site: canonical links, the share image and the sitemap need it absolute. */
const SITE_URL = (process.env.SITE_URL ?? "http://localhost:5173").replace(/\/$/, "");

/** Pages beyond "/": each gets its own HTML in the build, with its own title, description and canonical address. */
const PAGES = [
	{
		path: "/how-it-works",
		title: "How it works — Character Forge MCP",
		description:
			"Install Character Forge in Claude Code, Codex or any MCP app, and see what it makes: a character card, then their concept, place, living picture, voice and music.",
	},
];

/** robots.txt, sitemap.xml and llms.txt, filled with SITE_URL; served in dev and written into the build. */
function seo(): Plugin {
	const files: Record<string, () => string> = {
		"robots.txt": () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
		"sitemap.xml": () =>
			`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", ...PAGES.map((p) => p.path)].map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`).join("\n")}\n</urlset>\n`,
		"llms.txt": () => readFileSync(new URL("./seo/llms.txt", import.meta.url), "utf8").replaceAll("%SITE_URL%", SITE_URL),
	};
	return {
		name: "seo",
		transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", SITE_URL),
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const make = files[(req.url ?? "").slice(1)];
				if (!make) return next();
				res.setHeader("Content-Type", req.url?.endsWith(".xml") ? "application/xml" : "text/plain; charset=utf-8");
				res.end(make());
			});
		},
		configResolved(config) {
			if (config.command === "build" && !process.env.SITE_URL)
				config.logger.warn("SITE_URL is not set: canonical links, the share image and the sitemap point at localhost.");
		},
		generateBundle() {
			for (const [fileName, make] of Object.entries(files)) this.emitFile({ type: "asset", fileName, source: make() });
		},
		// GitHub Pages serves files, so every page needs its own index.html; 404.html loads the app for anything else.
		writeBundle({ dir = "dist" }) {
			const home = readFileSync(path.join(dir, "index.html"), "utf8");
			const homeTitle = home.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
			const homeDescription = home.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
			for (const page of PAGES) {
				const html = home
					.replaceAll(homeTitle, page.title)
					.replaceAll(homeDescription, page.description)
					.replaceAll(`content="${SITE_URL}/"`, `content="${SITE_URL}${page.path}"`)
					.replace(`href="${SITE_URL}/"`, `href="${SITE_URL}${page.path}"`);
				mkdirSync(path.join(dir, page.path), { recursive: true });
				writeFileSync(path.join(dir, page.path, "index.html"), html);
			}
			writeFileSync(path.join(dir, "404.html"), home);
		},
	};
}

export default defineConfig({ plugins: [react(), tailwindcss(), seo()] });
