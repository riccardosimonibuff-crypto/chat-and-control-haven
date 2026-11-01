<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep chat and productivity data scoped to the authenticated user, enforced by RLS and authenticated server functions; historical unowned messages must not be assigned implicitly.
- Dedicated multi-account Google OAuth uses one-time persisted PKCE state and encrypted server-only tokens per user and Google subject; never fall back to workspace Gmail/Calendar credentials.
- Native voice recognition must fail closed unless Italian on-device processing is supported; typed and wakeword commands share one persistence/send path, and recognition pauses during speech playback.
- Shared voice preference lives in the root provider and user profile; keep speech browser APIs inside effects or user actions.
