---
name: check
description: Report the health of a keepwiki vault, broken links, pages without sources, orphans, contradictions between pages, stale entries, without changing anything. Use when the user says "check", "what is wrong with the wiki", or once a month on a vault in daily use.
---

# check: a health report, nothing repaired

`check` reports; the user decides what to fix and `learn` or a hand edit does it. Three severities:
`error` (the wiki points at something that does not exist), `warning` (knowledge is there but
unanchored), `note` (housekeeping). The report has two halves: the structural one the CLI computes,
and the semantic one you read for.

## 1. Structural findings from the CLI

```bash
npx -y keepwiki check --vault <name>
```

The JSON lists `findings`, each with `severity`, `code`, `file`, `message`, errors first. The codes:

| Code                  | Severity        | Meaning                                                                   |
| --------------------- | --------------- | ------------------------------------------------------------------------- |
| `schema-missing`      | `error`         | the vault `CLAUDE.md` has no `keepwiki_schema`                            |
| `frontmatter-missing` | `error`         | a page has no frontmatter block                                           |
| `broken-link`         | `error`         | `[[page]]` names a page that is not in `knowledge/`                       |
| `broken-cross-link`   | `error`         | `[[vault:page]]` names a vault not in the registry, or a page it lacks    |
| `source-missing`      | `error`         | a `sources:` entry points at a file that is gone                          |
| `schema-outdated`     | `warning`       | the vault was written by an older keepwiki; a migration will come         |
| `page-fields-missing` | `warning`       | the frontmatter lacks `title`, `sources` or `updated`                      |
| `unsourced-page`      | `warning`       | the page lists no `sources:`, so nothing backs its claims                 |
| `orphan-page`         | `warning`       | no other page links to it                                                 |
| `unindexed-page`      | `warning`       | missing from `## Pages` in `index.md`, so `ask` will not find it           |
| `index-stale-entry`   | `warning`       | `index.md` lists a page that does not exist                               |
| `pending-updates`     | `warning`/`note`| struck pages waiting for `learn`; `warning` from 5 lines up               |
| `inbox-waiting`       | `note`          | unprocessed sources in this vault's inbox                                 |
| `eval-small`          | `note`          | fewer than 10 rows in `eval.md`                                           |
| `stale-page`          | `note`          | `updated:` is more than 90 days old                                       |

## 2. Semantic findings you read for

Read `index.md`, then every page, following `[[links]]` so linked pairs are read together. Record:

- a **contradiction**: two pages, or two passages of one page, that cannot both be true. `error`.
  Quote both passages with `"excerpt" [source: <vault>/knowledge/<page>.md]`.
- an **unsourced claim**: a specific statement (a number, a date, a rule) on a page whose `sources:`
  do not mention it. Open the raw files to decide. `warning`. A page the CLI already flagged
  `source-missing` or `unsourced-page` gets no such lines; the one finding covers it.
- a **duplicate**: two pages about one thing under two names. `warning`, with the merge you would do.
- a **missing link**: a page names a concept that has its own page and does not link it. `note`.

Done when every page has been read once and every finding carries the file it is about.

## 3. Report

One report, both halves merged, sorted `error`, `warning`, `note`, in the user's language. Each line:
severity, file, what is wrong, and the one action that fixes it (`/keepwiki:learn` for pending
updates and inbox, a hand edit for a link, `/keepwiki:add` for a claim with no source). Close with the
three counts. Change no file.

## When `npx -y keepwiki` is not available

Do the structural half by hand: grep `knowledge/` for `[[` and resolve each link, compare `## Pages`
with the files, open each `sources:` path, count `## Pending updates`. Say the report ran in soft mode.
