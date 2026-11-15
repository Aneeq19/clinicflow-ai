# Release checks

## Automated evidence

- A clean isolated Python environment installed `backend/requirements.txt` successfully.
- `python -m unittest test_receptionist test_owner_admin test_business_settings -q`: **24 tests passed**. Synthetic database/auth doubles verify owner denial, business-scoped access, status conflicts, settings validation/stale edits, supplied-fact fallback, provider failures, privacy and appointment retries.
- `npm ci`, `npm run lint` and `npm run build`: passed on Node 24.
- A simulated DOM check passed public settings rendering, typed chat, settings save/public reload, embedded appointment submission with the same retry UUID after a simulated interruption, and external launcher URL/toggle/duplicate-install behavior. This is not a visual-browser test.
- All SQL migrations parsed successfully. An ephemeral embedded PostgreSQL instance also executed migrations 001/002/003 with synthetic roles and data, repeated migration 003, and verified restricted private tables/function access, allowed settings updates, denied slug updates, persisted owner membership, statistics aggregation and duplicate request-key rejection.

These checks do not run against the owner's real Supabase project or provider account. No credentials or real patient data are used. SQL validation does not confirm that the existing live schema matches this repository.

## User-verified earlier

The builder reported the local homepage, request submission/database row, English/Roman Urdu reception, safety scenarios and owner dashboard working. These reports predate the new settings/embedding release.

## Still required

Use START_HERE.md after running migration 003. Verify the current release with the real local Supabase connection and existing owner. Confirm settings save, public reload, chat, status changes and iframe appointment submission. Verify desktop/mobile appearance and keyboard operation in a real browser.

A real-browser screenshot run was unavailable in the build environment; visual/mobile correctness is not claimed. Run public smoke tests after actual deployment. Check GitHub Actions status after the commit; local checks do not establish that a remote workflow has run.
