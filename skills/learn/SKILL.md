---
name: learn
description: Turn unprocessed sources from the inboxes into wiki pages, every page a source touches, shown for approval first, linked both ways, indexed, with the original moved to raw. Use when the user says "learn", "process the inbox", or right after add.
---

# learn: inbox into pages

A page is the vault's current understanding of one thing, written from every source that mentioned
it. One source touches many pages; one page cites many sources. Pages are written in the vault's
language (`language:` in its `CLAUDE.md`), whatever language the source is in.

## 1. Count the work

```bash
npx -y keepwiki inbox list
```

Tell the user "N unprocessed sources", counting shared, per-vault and adopted notes. Zero: say so and
point at `/keepwiki:add`.

Then open `index.md` of every vault with work and pay `## Pending updates` first. Each line is
`- [[page]]: what to change (raw/<file>.md)`, a page the user struck from an earlier list. Update the
page from that raw source and delete the line. Done when the section is empty.

## 2. Route each source to a vault

A note in a vault's `inbox/` belongs to that vault. A shared-inbox note is matched against every
`description` in the registry: one clear match, use it and say so; two plausible, ask; none, propose
`/keepwiki:new` and leave the note. Read the vault's `CLAUDE.md` (boundary, page types) and
`index.md` before deciding pages.

## 3. List every page the source touches, then wait

Read the source in full. List every page it changes, one line each:

- `[[page]] (new): what it will hold`
- `[[page]] (update): what changes`

A page for every concept the source treats as its own, and every existing page whose claims the
source confirms, extends or contradicts. Ask the user to confirm or strike lines. Each struck line goes
to `## Pending updates` in `index.md` in the step 1 format. Done when the user has confirmed the list.

## 4. Write the pages

A page is `knowledge/<name>.md`; the name is lowercase with hyphens and is what `[[name]]` resolves
to. Frontmatter:

```
---
title: The page title
sources:
  - raw/<file>.md
updated: 2026-10-12
---
```

The body states what is true, each claim traceable to a file in `sources`. A contradiction with an
existing page keeps both claims and says which source says what; a silent overwrite loses knowledge.
Related pages in the same vault link `[[page]]` both ways: add the link back on the other page. A
page in another vault is `[[vault:page]]`, one way, and the other vault stays untouched.

`index.md`, under `## Pages`, has one line per page: `- [[page]] — what it holds`. Add a line for a
new page, refresh the line of a changed one.

## 5. Page types and eval

When a third page of one kind exists (three lessons, three tool comparisons), write a template under
`## Page types` in the vault's `CLAUDE.md`: the sections such a page has. Later pages of that kind
follow it.

`eval.md`, while it has fewer than 30 rows: add `| <a question the page answers> | <page> |` per new
page, and once per run `| <a question near the vault's subject it cannot answer> | none |`.

## 6. Close the source

```bash
npx -y keepwiki inbox done <path>                 # a vault inbox note
npx -y keepwiki inbox done <path> --vault <name>  # a shared inbox note
```

The note moves to `raw/` with `status: processed`. The JSON `path` is the raw file; if it differs
from what `sources:` says, fix the frontmatter. An adopted note
(`source: adopted` in `inbox list`) stays where it is; `inbox done` only drops it from
`## Unprocessed notes`, and `sources:` lists its own path relative to the vault.

When `qmd` is on PATH, refresh its index and embeddings once the pages are written, so `ask` finds
them:

```bash
qmd update && qmd embed
```

## 7. Report

Per source: the vault, pages written and updated, pending updates left. Done when
`inbox list` is empty, or every remaining note has a reason the user heard (no vault fits, user
declined).

## When `npx -y keepwiki` is not available

Do the file moves yourself and say that you did:

- unprocessed sources are the `.md` files with `status: unprocessed` in the shared inbox (`inbox:` in
  `~/.keepwiki/registry.md`) and in every vault's `inbox/`, plus `## Unprocessed notes` in each `index.md`
- closing a note: move it to the vault's `raw/`, set `status: processed`, add `processed: <date>`
