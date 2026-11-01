import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const scopes = ["openid", "email", "https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/gmail.readonly"];

export const listGoogleAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("google_accounts").select("id,email,reconnect_required").eq("user_id", context.userId).order("created_at");
    if (error) throw new Error(error.message);
    const request = getRequest();
    const url = new URL(request.url);
    const proxyHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const origin = proxyHost ? `https://${proxyHost}` : url.origin;
    return { accounts: data ?? [], configured: Boolean(process.env["GOOGLE_MULTI_CLIENT_ID"] && process.env["GOOGLE_MULTI_CLIENT_SECRET"]), callbackUrl: `${origin}/api/public/google/return` };
  });

export const startGoogleOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
    const clientId = process.env["GOOGLE_MULTI_CLIENT_ID"];
    const secret = process.env["GOOGLE_TOKEN_ENCRYPTION_SECRET"];
    if (!clientId || !secret || !process.env["GOOGLE_MULTI_CLIENT_SECRET"]) throw new Error("Configurazione OAuth Google incompleta.");
    const request = getRequest();
    const url = new URL(request.url);
    const proxyHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const redirectUri = `${proxyHost ? `https://${proxyHost}` : url.origin}/api/public/google/return`;
    const state = crypto.randomUUID();
    const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join("");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const { encryptToken } = await import("./token-crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("google_oauth_states").insert({ state, user_id: context.userId, verifier_ciphertext: await encryptToken(verifier, secret), redirect_uri: redirectUri });
    if (error) throw new Error(error.message);
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: scopes.join(" "), state, code_challenge: challenge, code_challenge_method: "S256", access_type: "offline", prompt: "consent select_account" });
    return { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  });

export const completeGoogleOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ code: z.string().min(1).max(4096), state: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const clientId = process.env["GOOGLE_MULTI_CLIENT_ID"];
    const clientSecret = process.env["GOOGLE_MULTI_CLIENT_SECRET"];
    const secret = process.env["GOOGLE_TOKEN_ENCRYPTION_SECRET"];
    if (!clientId || !clientSecret || !secret) throw new Error("Configurazione OAuth incompleta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: state, error } = await supabaseAdmin.from("google_oauth_states").delete().eq("state", data.state).eq("user_id", context.userId).gt("expires_at", new Date().toISOString()).select().maybeSingle();
    if (error || !state) throw new Error("Autorizzazione scaduta o non valida. Riprova.");
    const { encryptToken, decryptToken } = await import("./token-crypto.server");
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: data.code, grant_type: "authorization_code", redirect_uri: state.redirect_uri, code_verifier: await decryptToken(state.verifier_ciphertext, secret) }) });
    const token = await response.json();
    if (!response.ok || !token.access_token) throw new Error(`Google ${response.status}: autorizzazione non completata.`);
    const infoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!infoResponse.ok) throw new Error(`Google ${infoResponse.status}: verifica account fallita.`);
    const info = await infoResponse.json();
    if (!info.sub || !info.email || !info.email_verified) throw new Error("Account Google non verificato.");
    const granted = String(token.scope ?? "").split(" ");
    if (scopes.filter(s => s.startsWith("https://www.googleapis.com/auth/")).some(s => !granted.includes(s))) throw new Error("Consenti sia Gmail sia Calendar per collegare l’account.");
    const { data: existing, error: existingError } = await supabaseAdmin.from("google_accounts").select("refresh_token_ciphertext").eq("user_id", context.userId).eq("google_subject", info.sub).maybeSingle();
    if (existingError) throw new Error(existingError.message);
    const refresh = token.refresh_token ? await encryptToken(token.refresh_token, secret) : existing?.refresh_token_ciphertext;
    if (!refresh) throw new Error("Google non ha concesso l’accesso continuativo. Riprova il consenso.");
    const { error: saveError } = await supabaseAdmin.from("google_accounts").upsert({ user_id: context.userId, google_subject: info.sub, email: info.email, access_token_ciphertext: await encryptToken(token.access_token, secret), refresh_token_ciphertext: refresh, expires_at: new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000).toISOString(), scopes: token.scope ?? "", reconnect_required: false }, { onConflict: "user_id,google_subject" });
    if (saveError) throw new Error(saveError.message);
    return { email: String(info.email) };
  });

export const removeGoogleAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator(input => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("google_accounts").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });