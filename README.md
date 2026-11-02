# VibeRaven Supabase launch check

A GitHub Action for apps built with Lovable, Bolt, Cursor or Claude Code on Supabase and Vercel.
It reads the repository on your own runner and flags what the agent left open:

- tables created in migrations without row level security
- policies like `using (true)` that let anyone read, update or delete every row
- a service role or secret key behind `NEXT_PUBLIC_` / `VITE_` or in a `"use client"` file
- `security definer` functions that `anon` can call
- Stripe webhooks without a signature check, env var drift

Advice, not a gate. Nothing is uploaded and it never connects to your database.

## Use it

Lovable and Bolt push straight to `main`, so run it on pushes as well as pull requests:

```yaml
# .github/workflows/viberaven.yml
name: VibeRaven
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: write        # commit comments on pushes
  pull-requests: write   # one updated comment per pull request
  security-events: write # findings on the changed lines (code scanning)
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: ohad6k/viberaven-action@v1
```

On a pull request you get one comment with what this change added or fixed, updated on every push.
On a push to `main` you get a commit comment only when there is a blocker, plus the job summary every time. If your host deploys on that same push (Vercel, Lovable, Bolt), the check runs alongside the deploy, not before it; use pull requests when you want the result before anything ships.

Findings also go to GitHub code scanning (SARIF), so each one shows on its file and line in the pull request, with a link to its fix guide and a test of the app after the fix. Code scanning is free on public repositories. Without `security-events: write`, or on a private repository without code scanning, the upload is skipped and the job goes on. Turn it off with `with: { sarif: 'false' }`.

To block merges on new blockers: `with: { fail-on-blockers: 'true' }`.

## What it can't see

It reads files. A policy changed by hand in the Supabase dashboard is invisible to it, and it reads views only from migrations (a view runs with its owner's rights unless created `with (security_invoker = true)`). Run this in the SQL editor too:

```sql
select schemaname, tablename from pg_tables
where schemaname = 'public' and rowsecurity = false;
```

A clean result does not prove the app is secure. Same check locally: `npx -y viberaven@1.7.8 check`, or ask your coding agent to "check this with viberaven".

More: https://viberaven.dev
