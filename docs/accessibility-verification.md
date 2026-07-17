# Accessibility verification record

Automated Testing Library interaction checks and Playwright axe scans cover Login, Card management,
Review, Khunhphap, and progress. Before each release, manually record the date, browser/device, tester,
and result for all rows below; link any discovered regression to its fix before approving release.

| Check          | Required evidence                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Keyboard       | Complete Login, create/edit/discard/delete, Review/repeat, Khunhphap, Me, and Logout without a pointer; verify focus order and restoration.     |
| 200% text      | At 320 CSS px and desktop, confirm no clipped controls, lost content, or two-dimensional page scrolling.                                        |
| Forced colors  | In Windows High Contrast, confirm focus, errors, Grades, progress, connectivity, and selection remain distinguishable.                          |
| Screen reader  | With VoiceOver on representative iOS and NVDA or VoiceOver on desktop, confirm headings, names, dialogs, progress, and restrained live updates. |
| Reduced motion | Confirm sheets fade, Review crossfades, and shake, 3D flip, confetti, shimmer, and point travel are absent.                                     |
| Safe areas     | On representative iOS, confirm all four safe areas and the on-screen keyboard leave controls reachable.                                         |

Do not mark this record complete from automated evidence alone.
