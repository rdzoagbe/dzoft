# DZOFT — Simplified workspace rollout (Nov 2026)

## Purpose

The admin interface now has four primary destinations:

- **Aujourd’hui / Today**: the existing dashboard and actionable reminders.
- **Dossiers / Cases**: one grouped surface for received requests, clients, quotations and active projects. Search is shared; all original edit buttons and routes are preserved.
- **Messages**: the existing client inbox.
- **Paiements / Payments**: live amounts from `project_tracking` for accepted projects, with an action to open each project and record a verified receipt.

Settings and trash remain accessible through the sidebar on desktop and the **•••** menu on mobile.

The historical routes `#/demandes`, `#/clients`, `#/devis`, `#/projets`, `#/messages`, `#/parametres` and `#/corbeille` are still supported and direct to their proper grouped views.

## Project details: one page

`admin/suivi.html` is still the authoritative business logic. `admin/project-workspace.js` arranges **existing live sections** into a unified page rather than duplicating them or creating a separate database.

The most important actions appear first: delivery progress, next milestone, payment registration and client messages. Document management, private journal, maintenance, invoice administration, technical environment, agreement, file access, reviews and email history are placed in expandable sections.

The project still calls `DzoftTracking.admin(Q, sb, load)` and keeps `DzoftPlacePaymentSteps` event delegation for the original deposit stage. The public client portal does not receive the admin-only journal.

## Recording payments

After checking that money has arrived, open **Paiements → project → Enregistrer un paiement**.

The existing backend `record_project_payment` handles the verified amount, linked or new official invoice, receipt date, payment method, idempotency key, partial amounts, overpayment limits and optional notification. The email is queued in the existing outbox, then delivered by the background worker; queuing does **not** mean delivery. The payment is never inferred from a client claim or a checked milestone.

`project_tracking` supplies the figures shown throughout: agreed total, confirmed received, and balance outstanding. If one project fails to load, the finance totals only sum accessible project results and show a warning rather than silently treating a failed lookup as €0.

Automatic bank reconciliation **is not implemented** and should not be suggested as active.

## Client portal

The main menu is shorter: Accueil, Mes projets, Mes devis, Messages and Documents. Demandes, Environnement and Mon compte remain available under **Plus d’options**. All routes, permissions and the old private-token/account distinction are preserved.

## Test plan before merging to main

1. Run `node --test tests/*.test.cjs`. The GitHub Action checks this on the pull request.
2. Sign in as the owner and pass MFA. Visit all four main destinations; check FR/EN and all historical links.
3. Open a project with actual test data and verify progress and invoice details without changing production financial records.
4. For a **verified test payment**, record a partial receipt, inspect the new confirmed amount and remaining balance, and check the actual email outbox status. Reuse the same idempotency key in an RPC-level test to confirm no duplicate.
5. Publish two categories of progress in one batch. Confirm one digest notification and no journal data in the client portal.
6. Confirm client acceptance, project milestones, notes, invoice PDFs, documents, file upload, maintenance and technical environment remain available.
7. Check desktop and a 390px mobile width, including the bottom navigation and **•••** menu. Check keyboard navigation and focus.
8. Verify PWA offline handling does not cache Supabase responses.

**Deployment:** GitHub Pages serves `main`. Merging the PR publishes these changes. No schema migration or new Supabase deployment is required for this UI-only PR.
