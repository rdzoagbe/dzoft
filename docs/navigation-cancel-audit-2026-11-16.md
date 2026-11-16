# Navigation and Cancel audit — 16 November 2026

## Verified fixes in this change

- Quote editor: hide project workspace/tools links when no valid project ID is present; global client navigation remains available.
- Quote and project editors: closed mobile sidebar is inert, opening moves keyboard focus into navigation, Tab stays within it, and Escape/overlay restores focus to the menu button. Desktop navigation is restored when crossing the breakpoint.
- Sidebar accessibility labels follow French/English.
- Journal bulk import: Cancel clears the unsaved text, closes the panel and returns focus to its opener. No record is saved or deleted.
- Both editor pages request the updated navigation asset version.

## Existing protections inspected in source

- Quote editor warns before unloading while a remote save is pending/in flight.
- Payment, invoice-link, payment-method correction and progress draft forms have local-only Cancel handlers; they refuse cancellation while the submit button is disabled.
- Project section navigation preserves existing DOM nodes/listeners and supports allowlisted deep links and keyboard tab selection.
- Client message, review and password Cancel controls are covered by existing local regression tests.

## Validation

`node --test tests/*.test.cjs tests/*.test.mjs`: 222 passed, zero failures.
Five new tests execute the navigation and journal cancellation handlers with a minimal DOM harness. These are behaviour tests, not real-browser end-to-end tests.
`git diff --check`: passed.
Live admin was inspected and is signed out. Authenticated desktop/mobile navigation, real save/failure/retry scenarios and client workflows remain unverified in this pass. No production payment, notification or authentication changes were made.

## Remaining work

- Finish authenticated desktop and narrow-screen walkthroughs after owner sign-in, using test records for mutations.
- Check each remaining legacy editor's Cancel, unsaved-change and async-error behaviour; this patch does not close the complete workflow audit (#59).
- Keep financial amount/date corrections (#64), isolated backup restore (#72), and passkey migration (#57) as separately reviewed work. They are not resolved by UI/navigation tests.
