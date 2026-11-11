// Scramjet service worker (same origin as the site, so proxied frames stay on your own domain).
// Paths are relative to this file so the site works at a domain root or in a /repo/ subfolder.
importScripts("scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Only proxy traffic belongs to this worker. Opening Scramjet's IndexedDB for ordinary page
// requests would create its database before the page has set up the object stores, and every
// proxied load would then fail with "One of the specified object stores was not found".
const PREFIX = new URL("scramjet/", self.location.href).pathname;
const WASM = new URL("scram/scramjet.wasm.wasm", self.location.href).pathname;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function handleRequest(event) {
	// Until the page controller has written its config, stay out of the way entirely.
	try {
		await scramjet.loadConfig();
		if (scramjet.config && scramjet.route(event)) {
			return scramjet.fetch(event);
		}
	} catch (e) {
		/* not configured yet (or a proxied request failed) → fall through to the network */
	}
	return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;
	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;
	if (!url.pathname.startsWith(PREFIX) && url.pathname !== WASM) return;
	event.respondWith(handleRequest(event));
});
