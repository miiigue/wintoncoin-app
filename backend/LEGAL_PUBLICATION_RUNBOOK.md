# Legal Publication Runbook (TyC / Privacy)

This runbook defines the professional process for publishing legal document changes.

## Why this exists

In fintech-grade systems, editing `terms.html` or `privacy.html` is not enough by itself.  
Compliance enforcement is based on the **versioned legal artifact stored in DB** (`legal_documents`) and each user's acceptance evidence (`user_agreements_log`).

## Standard publication workflow

1. Update legal text in:
   - `frontend/terms.html`
   - `frontend/privacy.html`
2. Publish a new version to DB with the legal publisher script.
3. Verify affected users now require re-acceptance.
4. Communicate changes to users (in-app + email as needed).

## Commands

From `backend/`:

```bash
npm run legal:publish:terms -- --version v1.1.0
npm run legal:publish:privacy -- --version v1.1.0
```

Or generic:

```bash
npm run legal:publish -- --type terms_and_conditions --file ../frontend/terms.html --version v1.1.0
npm run legal:publish -- --type privacy_policy --file ../frontend/privacy.html --version v1.1.0
```

Dry run:

```bash
npm run legal:publish -- --type terms_and_conditions --file ../frontend/terms.html --dry-run
```

## Expected effect after publication

- New legal version is marked active for that document type.
- Existing users with older accepted version/hash will receive:
  - `requires_terms_acceptance: true`
  - action-blocking on protected operations until re-acceptance.

## Verification checklist

1. Confirm active docs:
   - query `legal_documents` for active entries per type.
2. Login with old user:
   - backend should return `requires_terms_acceptance: true`.
3. Open dashboard:
   - legal banner appears.
4. Attempt protected action:
   - backend returns `403` with `LEGAL_ACCEPTANCE_REQUIRED`.
5. Accept legal docs:
   - action unblocks and acceptance evidence is saved.

## Notes

- Use semantic versioning style (`v1.1.0`, `v1.2.0`) for audit clarity.
- Never silently overwrite a published legal version in production.
- If legal text changes materially, always publish a new version and require re-acceptance.
- If you accidentally reuse an existing version, the publisher will fail and suggest the next version (example: `v1.1.0` -> `v1.1.1`).
