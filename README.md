# VibeRaven Supabase launch check

A GitHub Action for apps built with Lovable, Bolt, Cursor or Claude Code on Supabase and Vercel.
It reads the repository on your own runner and flags what the agent left open:

- tables created in migrations without row level security
- policies like `using (true)` that let anyone read, update or delete every row
- a service role or secret key behind `NEXT_PUBLIC_` / `VITE_` or in a `"use client"` file
- `security definer` functions that `anon` can call
- Stripe webhooks without a signature check, env var drift

Advice, not a gate. Analysis runs on your runner. Enabled comments and code-scanning results are published to this repository on GitHub. It never connects to your database.

## Use it

Have two Supabase migration PRs coming up? Try the [read-only migration review pilot](https://github.com/ohad6k/viberaven-action/issues/7).

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
      - uses: ohad6k/viberaven-action@v1.1.2
```

On a pull request from this repository, each check updates the marked report from the same GitHub account or app, or creates a report if none exists. It skips comments on fork pull requests.
On a push to `main` you get a commit comment only when there is a blocker, plus the job summary every time. If your host deploys on that same push (Vercel, Lovable, Bolt), the check runs alongside the deploy, not before it; use pull requests when you want the result before anything ships.

Findings with source locations can appear in GitHub code scanning (SARIF), with fix guidance where available. General findings without a source location are listed in the job summary and preserved in the raw `viberaven.sarif` file on the runner. Code scanning requires repository support and `security-events: write`. If an upload fails, the job continues by default; check the upload step's processing result. Turn it off with `with: { sarif: 'false' }`.

Use one SARIF publishing job with a consistent scan scope per workflow and branch. The Action currently uses the fixed `viberaven` category, so separate scopes can replace each other's alert state.

To fail the job on new blockers: `with: { fail-on-blockers: 'true' }`. To use that failure as a merge gate, require the workflow's status check in your repository rules.

## If a green job has no code-scanning results

An upload log containing `locationFromSarifResult: expected at least one location` can mean a general finding prevented GitHub from processing the report. Use `ohad6k/viberaven-action@v1.1.2`: it keeps general findings visible in the summary and prepares a separate file for located results. It does not invent source locations.

A successful job alone does not confirm an upload. The [SARIF verification run](https://github.com/ohad6k/viberaven-action/actions/runs/41923621531) completed GitHub processing for both zero-result and two-result analyses. This checks delivery; it does not prove the app is secure.

## What it can't see

It reads files. A policy changed by hand in the Supabase dashboard is invisible to it, and it reads views only from migrations (a view runs with its owner's rights unless created `with (security_invoker = true)`). Run this in the SQL editor too:

```sql
select schemaname, tablename from pg_tables
where schemaname = 'public' and rowsecurity = false;
```

A clean result does not prove the app is secure. Same check locally: `npx -y viberaven@1.7.8 check`, or ask your coding agent to "check this with viberaven".

More: https://viberaven.dev
