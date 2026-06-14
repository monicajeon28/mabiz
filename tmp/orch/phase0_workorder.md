# Phase 0 Workorder

## Scope
- Repo-wide audit for bugs, leaks, code smells, silent failures, and performance risks.
- Focus on production code under `src/app/api`, `src/lib`, and long-lived client components.
- Prioritize paths that can lose data, spin unnecessarily, or hide failures.

## P0
- Any fire-and-forget path that can lose user data or report success before persistence.
- Any loop or retry path that can spin without progress or without a hard stop.
- Any silent `catch(() => {})` on backup, webhook, or persistence paths.
- Any numeric-field bug that drops `0` or coerces valid values into null/undefined.
- Unify `processedWebhookEvent` persistence across webhook handlers through shared helpers.
- PayApp request paths must not leave a pending record behind when the external API or DB write fails.
- PayApp webhook DLQ writes must not fail silently.
- PayApp `var2` must always be the landing page slug, while `PayAppPayment.landingPageId` must always stay the DB id.
- Public PayApp requests must pre-create the payment row before calling the external API to avoid webhook/create races.
- PayApp subscription requests must pre-create a subscription row, pass `subscription.id` as `var1`, and mark the row `active` from the paid webhook.
- PayApp public subscription requests must also cancel the external PayApp subscription if the local subscription row update fails after a successful external registration.
- PayApp refunds must treat `partial_refunded` + full refund as remaining-balance refund, not as a second full refund.
- PayApp refunds should pass through a `refund_pending` DB state before calling the external API so the system never reports success while DB still says paid.
- PayApp refunds must choose `paycancel` for same-day / pre-settlement refunds and `paycancelreq` when the payment is past settlement window (D+5) or otherwise settled.
- PayApp refunds must record which PayApp cancel command was used and treat DB-finalization failure after external success as a reconciliation-required failure, not a success.
- PayApp subscription pause/resume/cancel must pass through pending DB states before calling the external API and never leave the row in the old terminal state after external success.
- PayApp subscription list filtering must reject unknown status values instead of querying arbitrary strings.
- Funnel SMS new/edit screens must not auto-fill or silently submit an unverified sender phone; UI should show the verification state before save.
- App layout viewport must live in `export const viewport`, not inside `metadata`, so repeated Next dev warnings do not mask real runtime errors.

## P1
- Long-lived intervals, polling, or global listeners without cleanup or tab-scoped guards.
- Heavy client views with avoidable repeated fetches, duplicate joins, or full-table scans.
- Webhook handlers that do too much work inline instead of using bounded retry or DLQ.
- Convert remaining webhook handler record-write duplication to `recordProcessedWebhookEvent()`.
- Remove remaining `any` usage in PayApp admin/query routes.
- Fix `cruisedot-payment` webhook scope bugs and remove remaining `any` in its write path.
- Persist `affiliateCode` on `cruisedot-payment` Contact rows so CRM reverse lookups stay linked.
- Remove silent DLQ swallowing in `gmcruise/lead-status`.
- Remove silent DLQ swallowing in `gmcruise/payment-failure` and `gmcruise/passport-approved`.
- Keep `processedWebhookEvent.webhookType` values consistent between duplicate checks and no-org fallback writes in `gmcruise` webhooks.
- Inquiry capture must persist `ip`, `userAgent`, `deviceType`, `pageUrl`, `source`, `productName`, `productCode`, and `isGold` into `Contact.surveyData.inquiryTracking`.
- Inquiry capture should update `sourceType`, `productName`, `inquiryProductCode`, and `lastContactedAt` so CRM search and recency views stay aligned with the captured submission.
- Contact lists should show a compact inquiry-tracking summary only for inquiry/gold/landing rows, while full tracking stays in the detail panel to keep list payloads light.
- Reuse a shared tracking-summary helper across list pages so `contacts`, `contacts/all`, `contacts/inquiries`, and `contacts/purchased` stay aligned without duplicating formatting logic.
- DB 공유 대상 선택 must stay role-gated: AGENT only managers + HQ, OWNER all managers + own agents + HQ, GLOBAL_ADMIN everyone.
- DB 공유 modals should support fast name/ID/org search so users do not scroll long recipient lists.

## P2
- Dead code, stale comments, and legacy patterns that are not actively causing failures.
- Non-blocking warnings from build or lint that do not affect runtime correctness.

## Success Criteria
- No user-visible data loss on backup/delete/sign paths.
- No unbounded busy loops or repeated no-progress batches.
- Silent failure paths either converted to awaited failures or explicitly documented as best-effort.
- Type-check and lint stay green after fixes.
