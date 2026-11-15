import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google/return")({
  server: { handlers: { GET: ({ request }) => {
    // Public relay only: the authenticated opener verifies ownership and one-time state before exchanging the code.
    const url = new URL(request.url);
    const message = JSON.stringify({ type: "vega-google-oauth", code: url.searchParams.get("code"), state: url.searchParams.get("state"), error: url.searchParams.get("error") }).replace(/</g, "\\u003c");
    return new Response(`<!doctype html><html lang="it"><head><title>Account Google · V.E.G.A</title><meta name="referrer" content="no-referrer"></head><body><p>Completamento autorizzazione Google…</p><script>history.replaceState(null,'',location.pathname);var m=${message};if(window.opener){['https://chat-and-control-haven.lovable.app','https://id-preview--31ea4d2c-1f14-5aa4-973d-692173241919.lovable.app'].forEach(function(o){try{window.opener.postMessage(m,o)}catch(e){}});window.close()}else{var q=new URLSearchParams();if(m.code)q.set('gcode',m.code);if(m.state)q.set('gstate',m.state);if(m.error)q.set('gerror',m.error);location.replace('/produttivita?'+q)}</script></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; frame-ancestors 'none'" } });
  } } },
});