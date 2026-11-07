# Tropical Luxury UI — visual audit and implementation plan

Baseline checkpoint: 1de9de4. Reference: user-supplied LAYA resort dashboard image. Preserve all Functions, security rules, schemas, quotas and transactional operations.

Audit: the current UI has generic empty regions, text-only navigation, equally weighted cards, no visual reporting, long checklist forms, and photo previews without individual removal. Mobile history controls wrap awkwardly. HTML titles contain markup. Native confirmations lack context and consistency.

Plan: shared forest/ivory/gold tokens, locally bundled Thai font, SVG icons and decorative resort art; reusable cards, rings, charts, empty states, dialogs and skeletons. Compact desktop operations overview, actionable attention summary and outlet comparison based on managerData. Mobile navigation and task progress; photo removal before uploads, preserving immutable uploaded drafts. Collapsible checklist categories and progress. No decorative numbers or fake notification counts. Respect reduced motion and print layouts.

Backend changes: none. Asset art is original lightweight SVG, not the reference image pasted over controls. Existing workflow APIs remain authoritative. Offline font/assets cached with app shell.

## Implemented components
- css/premium.css: forest/ivory/gold tokens, Thai typography, desktop/sidebar and mobile navigation, responsive tables/cards, upload tiles, print and reduced-motion rules.
- js/ui.js: SVG icons, live KPI rings and daily bars, outlet readiness, attention shortcuts, empty illustrations, searchable task/staff lists, accessible confirmation/reason dialog.
- js/app.js: shared component integration, staff progress, individual photo removal before upload, checklist categories and live progress, loading feedback.
- assets/resort.svg and assets/fonts: original vector resort scene and locally hosted Noto Sans Thai with license.
- tools/pages.cjs: shared stylesheet and valid page titles. tools/build.cjs and sw.js include/cache new assets.

## Review iterations
Inspected manager desktop, staff mobile, checklist mobile, employee administration and upload captures. Reduced desktop hero/report spacing after the first review. Corrected screenshot timing to wait for upload data rather than capturing skeletons; disabled animation during visual capture. Test fixtures reset emulator checklist data between suites, and logout tests now await the redirect.

## Limits and next steps
Screenshots use synthetic emulator accounts and data; production data has not been accessed. Art is a lightweight vector interpretation, not a photographic replica. Mobile checks use browser viewports; physical Android/iOS camera behavior, assistive-technology audit and real-device print/PDF remain manual acceptance work. Historical reporting and all previous backend limitations in docs/LIMITATIONS.md still apply. CSV export and browser Print/Save PDF remain the existing workflows.

Unzip the delivery, follow README.md to install dependencies and start the emulator, then follow docs/DEPLOYMENT.md to seed local accounts. Review the screenshots and test report before staging. This delivery does not publish the application or change billing.
