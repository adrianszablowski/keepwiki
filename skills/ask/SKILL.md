---
name: ask
description: Answer a question only from the pages of one or more keepwiki vaults, each claim with a verified citation, and say plainly what keepwiki does not know. Use when the user asks a question about something they keep in keepwiki, names a vault with @name or in:name, or says "ask".
---

# ask: a grounded answer from the vaults

The answer comes from pages you read, nothing else. Every claim carries a verbatim excerpt and its
page; a gate checks each one, and an answer with zero verified citations becomes "not in keepwiki".
The model's own knowledge enters only when the user asks for it, in its own labelled section.

## 1. Inbox, then vaults

```bash
npx -y keepwiki inbox list
npx -y keepwiki registry list
```

A non-empty inbox earns one line: "N unprocessed sources; `/keepwiki:learn` adds them to the pages".

Vault choice: `@name` or `in:name` in the question names the vaults, one or more. Without a name,
match the question against every `description` in the registry. One clear match: use it and say so
in the answer. No clear match, or several: ask which vaults to search before reading anything. One
vault in the registry: use it.

## 2. Candidates, then pages

For each chosen vault, read `index.md` and pick every page whose line could bear on the question.
Then grep `knowledge/` for the question's key terms, in the vault's language and the question's, and
add the hits: the index is a map, grep is the second net. When `qmd` is on PATH, a third net ranks
the pages by meaning:

```bash
qmd query "<the question>" -c <vault> --json -n 10
```

Each hit's `file` names a page under `knowledge/`; add the ones not yet on the list. A vault with no
collection yet (`qmd collection list` lacks its name) gets one before the query, named after the vault,
and its embeddings:

```bash
qmd collection add <vault path>/knowledge --name <vault> && qmd embed
```

Read every candidate page in full. Follow `[[page]]` and `[[vault:page]]` links that look relevant,
one hop.

## 3. Write the answer

In the question's language. Each claim is followed by its citation:

```
"a verbatim fragment of the page, at least 20 characters" [source: <vault>/knowledge/<page>.md]
```

The fragment is copied from the page, markdown and all, long enough to be found once: a sentence,
not a phrase, and one with no quotation marks inside it, because the first closing quote ends the
excerpt. Straight `"…"`, low-high `„…”` and curly `“…”` quotes all count. End with two short
sections:

- `Searched`: the vaults and the pages read, and `qmd` when it ranked them
- `Not in keepwiki`: the parts of the question the pages leave open

When the user asked for the model's own view as well, add `## Outside keepwiki` after those, with no
citations; this section is never there unasked.

## 4. Run the gate before the user sees the answer

Pass the answer through stdin:

```bash
npx -y keepwiki verify-citations <<'KEEPWIKI'
<the answer>
KEEPWIKI
```

Exit 0 means every citation holds. Exit 1 prints `failed` with a `reason` per citation:

- `excerpt not found`, `excerpt too short`: reopen the page, copy a longer verbatim fragment, or drop
  the claim with its citation
- `missing page`, `unknown vault`: fix the path to the file you actually read

Run the gate again after every fix. Zero verified citations after fixing means the vaults do not
answer the question: reply "Not in keepwiki" with what you searched and offer `/keepwiki:add` for the
source that would. Done when the gate exits 0, or the answer is the "not in keepwiki" one.

## 5. Offer to keep a synthesis

When the answer drew on two or more pages, ask once: save it as a new page? On yes, write
`knowledge/<name>.md` in the vault that holds most of the sources, in the vault's language, with
frontmatter `title`, `sources` (the pages used, as `knowledge/<page>.md`), `updated`, and add its
line under `## Pages` in `index.md`.

## When `npx -y keepwiki` is not available

Check each citation yourself: open the page and find the fragment. Say the answer ran in soft mode,
without the gate.
