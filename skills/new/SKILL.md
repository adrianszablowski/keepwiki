---
name: new
description: Create a keepwiki vault, or adopt an existing folder of notes as one. Use when the user wants a new place to collect knowledge about a subject, a course, a client or a project, or says "new vault".
---

# new: create a vault

A vault is one boundary of knowledge the user chooses: a course, a subject, one project's SEO, how
they write. You run a short conversation, then hand the answers to the CLI, which writes the files and
the registry row. Speak the user's language throughout; the skill text is English, the vault is theirs.

## 1. Read the registry first

```bash
npx -y keepwiki registry list
```

Keep the output in view: question 2 compares the new vault against every existing description.
`No vaults yet` means this is the first vault, and the CLI will also create the home folder.

## 2. Ask four questions, one message each

Wait for the answer before the next question. Infer the vault's language from how the user writes;
never ask for it.

1. **Purpose.** What will this vault hold? From the answer, propose a name and a one-line description
   and ask the user to confirm or change them. A name is lowercase letters, digits and hyphens
   (`[a-z0-9-]`), because it becomes `@name` in `ask` and the left side of `[[name:page]]`.
2. **Boundary.** What must this vault never mix with? Before asking, say which existing vaults have
   an overlapping description, if any, and offer to use that vault instead. A new vault earns its
   place when the two subjects share few concepts.
3. **Location.** Default: a new folder under the keepwiki home. Alternatives: a path the user names,
   or an existing folder of notes to adopt. Adopting changes none of the user's files; it adds the
   keepwiki files beside them and lists every existing `.md` as unprocessed in `index.md`.
4. **Sources.** Does the user have something to put in right away? If yes, after step 3 hand off
   with one line: `/keepwiki:add` takes the source, `/keepwiki:learn` turns it into pages.

## 3. Create the vault

```bash
npx -y keepwiki vault create --name <name> --description "<one line>" --language <code> --boundary "<answer 2>"
npx -y keepwiki vault adopt  --name <name> --description "<one line>" --language <code> --boundary "<answer 2>" --path <folder>
```

Add `--path <folder>` to `create` for a location outside the home. The command prints JSON: `path`
and `unprocessed` (the adopted notes). A non-zero exit prints the reason: a taken name, a folder that
already is a vault, a `|` in a description. Fix the input and run it again.

## 4. Report

Tell the user, in their language:

- the vault's path and that it is in the registry
- for an adopted folder, how many notes wait as unprocessed
- that `eval.md` holds the format and no questions yet; the first `learn` adds them, because a
  question with an expected page needs pages to exist

Done when the registry row exists, the vault folder holds `CLAUDE.md`, `index.md`, `eval.md`,
`inbox/`, `raw/`, `knowledge/`, and the user knows the path and the next command.

## When `npx -y keepwiki` is not available

Write the same files by hand, in the exact format the CLI uses, and say that you did:

- registry: `~/.keepwiki/registry.md`. Frontmatter
  `home:` and `inbox:`, then a table whose header is `| name | path | description | language |`.
  Paths under the user's home directory start with `~/`.
- vault `CLAUDE.md` frontmatter: `keepwiki_schema: 1`, `name`, `description`, `language`, `boundary`.
- `index.md` with sections `## Pages` and `## Pending updates`; `eval.md` with a
  `| question | expected |` table; empty `inbox/`, `raw/`, `knowledge/`.
