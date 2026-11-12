import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/** The public address of the site: canonical links, the share image and the sitemap need it absolute. */
const SITE_URL = (process.env.SITE_URL ?? "http://localhost:5173").replace(/\/$/, "");

/** robots.txt, sitemap.xml and llms.txt, filled with SITE_URL; served in dev and written into the build. */
function seo(): Plugin {
	const files: Record<string, () => string> = {
		"robots.txt": () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
		"sitemap.xml": () =>
			`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}/</loc></url>\n</urlset>\n`,
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
	};
}

export default defineConfig({ plugins: [react(), tailwindcss(), seo()] });
