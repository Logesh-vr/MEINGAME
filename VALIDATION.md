# Verification record

Checked on 29 October 2026. These results distinguish simulation tests, visible browser interaction, rendering benchmarks, and deployment.

## Automated checks

- `npm test`: **43/43 pass**, across two test files.
- `npm run build`: TypeScript and Vite production build pass. The engine-containing JavaScript bundle is about 552 kB, about 147 kB gzipped. Vite emits its advisory about a chunk exceeding 500 kB; this is not a compilation error.
- Dependency installation after updating the test runner and adding the bundled fonts reported **zero known vulnerabilities**. The lockfile is retained.
- 35 tests cover economy, cargo delivery, purchases, reserved capacity, queues/refunds, research, shield direction, melee bypass, EMP recovery, air targeting, splash damage, contested capture, capture exclusions, forward deployment/loss, objective gating, friendly possession, manual movement, controlled-unit death, pausing, restarts, terminal results, corrupted saves, unlocks, and AI spending at all three difficulties.
- Eight command-driven integration runs complete all five campaign missions on Easy and reach actual outcomes in Easy, Normal, and Hard skirmishes. The player script uses ordinary recruitment, research, rally, and attack commands. It does not grant money, spawn free reinforcements, edit health, or force victories.
- Last recorded campaign integration victories: chapters 1–5 at 68s, 68s, 71s, 146s, and 83s respectively. This confirms that objectives and combat permit completion; it is not evidence of a human playthrough or broad balance testing.

## Visible browser checks

Tested in the Codex in-app desktop browser, including the final cinematic presentation:

- Prologue captions, live camera scene, skip/replay, title menu, chapter path, locked/unlocked chapters, mission briefing, map selection, difficulty selection, and the fade from setup into battle.
- Recruitment deducts resources and fills the visible production queue. Orders change army behavior. Overview frames both cores and the relay network.
- Friendly selection, taking control of a Vanguard, Q dash/cooldown, releasing control with Escape, and pause were checked through the interface.
- Opening Settings from a paused match and returning preserves the simulation. The timer, resources, selected unit, and cooldown continue from their prior values after resuming.
- Graphics and reduced-motion settings persist after a real reload. They were restored to Medium and normal motion after this check.
- Chapter one was completed through normal browser recruitment and attack commands in **1:33**. Its ending appeared; returning to the campaign and reloading retained completion and unlocked chapter two. An unattended defeat flow was also observed.
- Research is locked in the opening mission and its drawer displays the expected lock state.
- The interface was inspected at 1280×720 and approximately 1126×518 as the app pane resized. The intended controls are desktop keyboard and mouse.

The other four complete campaign runs were simulation checks, not full browser playthroughs. Active combat with 80 units was not profiled end-to-end. Speaker/headphone listening and mobile touch gameplay were not verified.

## Rendering performance

Development harness: `/tests/benchmark.html`, served by Vite. It renders 40 mixed animated units per side and the environment using the same renderer as the game. It does **not** run active combat, targeting, projectiles, or the normal HUD. This page is absent from the production build.

GPU reported by WebGL: **NVIDIA GeForce RTX 3050 A Laptop GPU**, through ANGLE / Direct3D 11.

| Sample | Quality | Viewport | Render scale | Frames / duration | Average | 95th percentile frame |
| --- | --- | --- | --- | --- | --- | --- |
| Initial renderer | Medium | 1280×720 | 1.25 | 680 / 12.00s | 56.7 FPS | 18.1 ms |
| Initial renderer | Low | 1280×720 | 0.80 | 680 / 12.00s | 56.7 FPS | 18.1 ms |
| Final cinematic revision | Medium | 1126×518 | 1.25 | 719 / 11.99s | **60.0 FPS** | **16.9 ms** |

Final sample: 421 reported draw calls, 79,024 triangles, 81 geometries, and one shadow texture. The sample window and viewport matter; these figures are not a guarantee for all devices, browser sizes, or combat situations.

## Delivery

The source, tests, bundled font license notices, and static production output are retained locally. `.openai/hosting.json` identifies the owner-private Sites project. Native Sites deployment status is the authority for successful publication; a local build or expected URL alone does not establish deployment success.

## Remaining product limits

Original stylized procedural graphics and synthesized audio; captioned in-engine story sequences. Single-player only. Local per-browser saves between chapters, no active-match resume, no cloud synchronization. Desktop WebGL 2 required. Gameplay balance has deterministic regression coverage and a representative browser completion, but has not had extended human playtesting.
