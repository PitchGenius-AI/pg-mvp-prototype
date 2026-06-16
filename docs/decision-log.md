# Decision Log

Append-only record of the **product/scope decisions** behind Pitch Genius — the "why" that the code and specs don't capture on their own. Newest at the bottom. One entry per decision: **date · decision · who drove it · source**. Sources are the recorded Russell⇄Cassandra calls (Fathom) or the scope docs.

> Reconstructed June 2026 from Fathom call recordings + the Drive scope docs. Maintained going forward — ideally add entries right after each Russell call.

## TL;DR — the arc

Pitch Genius started as a broad AI sales platform (lead enrichment + DISC/OCEAN + technique matching + outreach + a Chrome extension + chat + enterprise). Through April–May 2026 it narrowed hard to a focused **async "Buyer Readiness" web app**. On **May 18** Russell rejected that as "not the product" and redirected to a **live, in-call desktop co-pilot** modeled on competitor Yurp — re-adding the psychology / technique / script features the async scope had cut, keeping Buyer Readiness as the moat. June refined that into the current two-app shape (web workbench + desktop co-pilot on a real backend).

## Timeline

### 2026-04 — Narrowing pressure (broad platform → focus)

- **Apr 20** — Intelligence-first chain locked: research → DISC/OCEAN → technique match → scripts. Live coaching parked as a *future Phase-2 Chrome extension*; Russell flags it as "what sells it." GTM settles on solopreneurs. *Driver: Russell.* — [call](https://fathom.video/share/6AqmbHZqPKSj_RWAsPPXsARqLLty_YUd)
- **Apr 27** — "Minimum Viable Change" principle adopted; personal coaching cut, chat de-prioritized. *Driver: Russell.* — [call](https://fathom.video/share/BzdP7yWyq13F_x3zjgG2BQRZysFQ6UBK)

### 2026-05 — The pivot to live

- **May 12** — Narrowed to a single solopreneur UX; teams cut. Scope = **async** script-gen + profiling. Spec+prototype de-risk process locked. *Driver: Russell.* — [call](https://fathom.video/share/A8sKH6at1ySfYumYo988iq_mJJhaQPfz)
- **May 17** — Gen-1 scope doc written for that async product: [Buyer Readiness MVP Scope](https://docs.google.com/document/d/19SQHpRMS1OghLeCwZCOGACLo20_veArQy5r9Y0KbdlE/edit) (now **superseded**).
- **🔑 May 18 — THE PIVOT.** Russell rejects the async Buyer Readiness app ("this is good for just the thing, but this is not the product… it has to be a video prompting system") and redirects to a **live in-call co-pilot** modeled on **Yurp**. Re-adds DISC/OCEAN + technique matching + generated scripts; keeps Buyer Readiness as the moat; CRM round-trip stays file-based. **Desktop app over Chrome extension** (a Chrome extension can't capture a Zoom desktop call; Russell: "why cut half your market?"). Teams / dashboard / chat cut. *Drivers: Russell (live vision), Cassandra (desktop).* — [call](https://fathom.video/share/nSM7GsetLeV2b1Bm8Aix8zagsBNdvnMm)
- **May 19–21** — Post-pivot rewrite into the Gen-2 docs: [MVP Scope Overview](https://docs.google.com/document/d/17vktxAiV_wli7mNhfBtB7PERhEVtwec4fDDjIm7UBVA/edit) + [PG MVP UX Spec](https://docs.google.com/document/d/1WJYBzCplQmgZTiV6yuTO5Ui5jCQKh1ug2Okt38exX5g/edit) (the web app's spec).
- **May 26** — Dynamic "Hybrid Discovery Mode" technique engine; CRM export = single human-readable note; calendar integration rejected. — [call](https://fathom.video/share/VxVFmw-UtSvV7GFyLzf6D5_xLSq2L284)
- **May 29** — Functional-prototype deadline set (June 15); co-pilot = small floating desktop widget; data-flow/latency named the #1 risk. — [call](https://fathom.video/share/bbE4vnr-Dbfa8xoDo4iJ-zfx53dz8Kth)

### 2026-06 — Refinement (and two reversals)

- **Jun 3** — Multiple products per user (cap 10) + a central ICP field; latency fix (load static context once per call); decision to hire a dedicated engineer. *Driver: Russell.* — [call](https://fathom.video/share/mZEw88VqK3VjiuVb-SszRbVEjRkXoY79)
- **Jun 5 — "magic moment" narrowing.** Advisor **Chris Shaw** (timofi) argues the value is entirely the live desktop experience; the team agrees to profile the buyer *live* and **defer** pre-call data gathering (incl. product/ICP context, CRM/LinkedIn imports). Copy Cluely's UI; Gumroad distribution. *Driver: Chris → Russell.* — [call](https://fathom.video/share/joYXP3w6snyFQS7yUD9HPmQX6xcXnzNH)
- **🔁 Jun 10 — partial reversal.** Product + ICP context **back in** as required onboarding (Russell: "it's got to know your product, who you're selling it to, and what problem it solves for them"). Call **duration** added as a script-generation input. **Seller** DISC/OCEAN profiling **cut** (buyer profiling kept). *Driver: Russell.* — [call](https://fathom.video/share/45PqVoRyxkSzoFDcGA-a61Cfc5CYQoR2)
- **Jun 15** — Trial developer (Ederson, timofi) scoped for **performance** work (latency, audio echo); "idiot-proof" auto-everything restated as the target; June-22 demo. — [call](https://fathom.video/share/QLyP7HGJ4T3x6tKBeLe63LoYKPjgbAFj)

## Cast

- **Russell Pontone** — CEO; drives nearly every product/scope decision.
- **Cassandra Wilcox** — fractional CTO; builds, and owns technical/architecture decisions.
- **Chris Shaw** (timofi) — advisor/recruiter brought in June; triggered the Jun-5 narrowing.
- **Ederson** (timofi) — trial engineer onboarded ~Jun 15 for performance work.

## Current canonical specs

See **[`CLAUDE.md`](../CLAUDE.md) → Key links** for the live spec set (desktop UX spec in-repo; web UX spec + scope overview in Drive) and which surface each owns. The Gen-1 doc (linked in the timeline above) is **superseded** — history only.

<!-- New decisions: append below, newest last. -->
