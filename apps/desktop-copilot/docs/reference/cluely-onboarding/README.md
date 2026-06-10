# Cluely onboarding — reference screenshots

UX-feel reference only (per UX_SPEC §9 — Cluely is _not_ a code reference; write fresh).
Captured 2026-06-08, walking Cluely's first-run onboarding to inform PG's §4.1 (cold start /
sign-in) and §4.2 (permissions). Filenames are numbered in **flow order**, not the order
they were pasted into chat.

| #   | File                                | What it shows                                                                 | Spec |
| --- | ----------------------------------- | ----------------------------------------------------------------------------- | ---- |
| 01  | `01-signin-continue.png`            | Web sign-in card (Apple / Google / email)                                     | §4.1 |
| 02  | `02-signin-oauth-consent.png`       | Google OAuth consent ("Sign in to Cluely")                                    | §4.1 |
| 03  | `03-signin-loading.png`             | Post-OAuth redirect / loading state                                           | §4.1 |
| 04  | `04-signin-deeplink-open-app.png`   | Deeplink handoff back to desktop ("Open Cluely?") + "Opening…" fallback page  | §4.1 |
| 05  | `05-perm-accessibility.png`         | Permissions screen — Accessibility prompt + System Settings illustration      | §4.2 |
| 06  | `06-perm-accessibility-settings.png`| Accessibility — routed into System Settings ("Open accessibility settings")   | §4.2 |
| 07  | `07-perm-microphone.png`            | Microphone — inline allow/deny prompt                                         | §4.2 |
| 08  | `08-perm-microphone-prompt.png`     | Microphone — the nested OS prompt                                             | §4.2 |
| 09  | `09-perm-screen.png`                | Screen & System Audio Recording prompt + System Settings illustration         | §4.2 |
| 10  | `10-perm-screen-settings.png`       | Screen recording — routed into System Settings ("Open screen settings")       | §4.2 |
| 11  | `11-perm-screen-settings-pane.png`  | System Settings pane open + the "Quit & Reopen" requirement                   | §4.2 |
| 12  | `12-perm-all-set.png`               | All three granted — "All set!" confirmation + Continue                        | §4.2 |

> The double `"Cluely" / "Cluely (New)"` prompts in 06/08/10 are an artifact of two installed
> builds, not a design choice — see the single-prompt-hygiene note in §4.2.
