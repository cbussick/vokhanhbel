# 13 — Apply the settled visual and motion system

**What to build:** The complete app consistently expresses the approved calm, playful visual language and physical feedback while offering a deliberately designed reduced-motion experience.

**Blocked by:** 12 — Audit accessibility and responsive behavior.

**Status:** ready-for-human

- [x] The accepted color, spacing, radius, shadow, type, duration, easing, layer, border, icon, overlay, and focus tokens are used consistently without introducing a second token tier.
- [x] Production self-hosts Baloo 2 and Be Vietnam Pro WOFF2 assets, provides system fallbacks, and retains complete applicable SIL Open Font License provenance and notices.
- [x] Global reset/theme/base layers and unlayered component modules remain project-owned and avoid broad universal reset, CSS-in-JS, third-party components, and unnecessary global/module escapes.
- [x] Main tab content switches immediately and only active-tab color transitions; buttons use the settled press feedback except when disabled or reduced motion is active.
- [x] Sheets enter/exit with the settled restrained translation/fade, have a plain non-blurred backdrop, are not draggable, and reduce to short fades.
- [x] Reveal uses the settled interrupt-safe 3D flip, delays Grade controls until complete, and becomes a 120 ms crossfade under reduced motion.
- [x] Grade advancement uses one shared-axis transition for every Grade, while reduced motion crossfades; no Grade-specific fly-off or next-due flash appears.
- [x] Each Grade launches the correct Points chip without delaying advancement or pulsing the total; reduced motion removes the chip and announces the immediate number change.
- [x] The first completed round alone receives one 800 ms nonblocking confetti burst; summary appearance follows the settled fade and reduced-motion behavior.
- [x] Login success, wrong-password feedback, skeletons, progress, informational/persistent toasts, connectivity banners, Khunhphap thinking, streaming, and Grade-control appearance match the settled timings and exclusions.
- [x] Card list/search/create/edit/delete/reorder changes have no layout animation, navigation/focus/validation remain immediate, and there is no global smooth scrolling or global near-zero-duration override.
- [x] `prefers-reduced-motion` removes spatial/3D movement, shake, bounce, pulse, confetti, Points travel, and shimmer while preserving clear state feedback with fades no longer than 120 ms.
- [ ] Stable visual states match the approved design reference at representative mobile and 768px widths without treating prototype copy, data, or stale interactions as requirements.

## Comments

The visual/motion implementation and Chromium snapshots pass locally. Final acceptance remains
blocked by Ticket 12's human accessibility/device audit and human approval of the stable visual
states.
