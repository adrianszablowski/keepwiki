---
name: explain
description: Explain one keepwiki page in plain words, the Feynman way, and show exactly where the page's own account breaks down. Use when the user says "explain", "I do not understand this page", or names a page with [[page]].
---

# explain: teach the page back, then find the cracks

The Feynman test: if you cannot explain it simply, the page does not hold it. You explain the page as
to a bright newcomer, in the user's language, from the page and its neighbours only. Every sentence
that has to lean on your own knowledge is a crack in the page, and the cracks are the deliverable as
much as the explanation. Nothing is edited.

## 1. Read the page and one hop around it

Resolve the page: `[[page]]`, a title, or a topic to find in `index.md` of the vault named with
`@name` or `in:name`, or of the one vault that fits. Read it in full, then every page it links and
every page that links to it (grep `knowledge/` for `[[page]]`), one hop. Cross-vault links
`[[vault:page]]` count: open that vault's page too.

## 2. Explain

Short paragraphs, everyday words, one idea each, an example or an analogy where the page gives
material for one. Each claim keeps its anchor, in the `ask` format:
`"verbatim fragment" [source: <vault>/knowledge/<page>.md]`. Terms the page defines are used as the
page defines them; a term it uses without defining is explained in a few words and marked as a crack.

Before showing it, run the gate on the explanation, as `ask` does:

```bash
npx -y keepwiki verify-citations <<'KEEPWIKI'
<the explanation>
KEEPWIKI
```

A citation that fails is reopened and copied verbatim, or its sentence moves to the cracks below as a
claim the page does not make.

## 3. Where the explanation breaks

A list, one line each, of the places the page could not carry its own weight:

- a term used but never defined, in this page or a linked one
- a step you had to supply from outside the vault to make the account hang together
- a claim with no `sources:` behind it, or whose source file is gone
- a concept that has its own page and is not linked from here
- two passages that pull in different directions

Done when every crack names the fragment it is about.

## 4. Close

Say what one `/keepwiki:add` would mend most cracks (the source that would define the terms or fill
the step), and that `/keepwiki:check` reports the whole vault the same way. Change no file; the user
decides what to add.
