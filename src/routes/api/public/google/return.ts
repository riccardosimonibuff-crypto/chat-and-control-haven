import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google/return")({
  server: { handlers: { GET: ({ request }) => {
    // Public relay only: the authenticated opener verifies ownership and one-time state before exchanging the code.
    const url = new URL(request.url);
    const message = JSON.stringify({ type: "vega-google-oauth", code: url.searchParams.get("code"), state: url.searchParams.get("state"), error: url.searchParams.get("error") }).replace(/</g, "\\u003c");
    return new Response(`<!doctype html><html lang="it"><head><title>Account Google · V.E.G.A</title><meta name="referrer" content="no-referrer"></head><body><p>Completamento autorizzazione Google…</p><script>history.replaceState(null,'',location.pathname);if(window.opener){window.opener.postMessage(${message},location.origin);window.close()}else{document.querySelector('p').textContent='Torna a V.E.G.A e ripeti il collegamento.'}</script></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; frame-ancestors 'none'" } });
  } } },
});