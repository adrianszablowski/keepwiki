---
name: add
description: Put a source into a keepwiki inbox: pasted text, a link to an article, a PDF, a .md or .txt file. Use when the user shares something to keep, says "add", "dodaj", "zapisz to", or names a vault with @name.
---

# add: a source into an inbox

`add` captures, `learn` understands. You get the source's text into one note with the frontmatter the
CLI writes, in the vault the user named or in the shared inbox when they named none. No page changes
here; that is `/keepwiki:learn`.

## 1. Pick the inbox

`@name` in the request names the vault. Confirm it exists:

```bash
npx -y keepwiki registry list
```

No `@name` means the shared inbox, unless the words make the vault plain ("add this to my SEO notes"):
then use that vault and say so. A name missing from the registry: show the names and ask.

## 2. Get the text, by kind

| The user gives          | `--source` | Where the text comes from                                                                                                                                                                             |
| ----------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| text pasted in the chat | `text`     | stdin, through a heredoc                                                                                                                                                                              |
| a link to a page        | `article`  | the CLI fetches `--url` and takes the page title. A non-zero exit (403, paywall, offline): get the text yourself (WebFetch, or ask the user to paste it) and pass it with `--file -` plus `--title`, keeping `--url` |
| a `.md` or `.txt` path  | `file`     | `--file <path>`                                                                                                                                                                                       |
| a PDF                   | `pdf`      | Claude Code reads the PDF natively, then stdin. In Codex: `pdftotext <file> - \| npx -y keepwiki inbox add …`; with neither, ask the user to paste the text                                           |

A YouTube link is not an input yet: say so and offer to take a pasted transcript as `text`.

`--title` is required for every kind but a fetched article: a short title in the user's words, or the
source's first heading. `--url` goes with everything that has one, because the inbox deduplicates by
URL.

## 3. Run

```bash
npx -y keepwiki inbox add --vault <name> --source <text|article|file|pdf> --title "<title>" [--url <url>] [--file <path>] <<'KEEPWIKI'
<the text, when it comes from stdin>
KEEPWIKI
```

Drop `--vault` for the shared inbox. The JSON answer has `path`, `vault` and `outcome`: `created`, or
`appended` when the URL was already in keepwiki and the text joined that note under a dated heading.
With `appended`, `vault` is the note's owner, which may differ from the `@name` given; say so.

## 4. Report

One line: the note's path, created or appended, and that `/keepwiki:learn` turns it into pages.

Done when `inbox add` exited 0 and the user knows the path and the next command.

## When `npx -y keepwiki` is not available

Write the note yourself and say that you did:

- the shared inbox is `inbox:` in `~/.keepwiki/registry.md`; a vault's inbox is `<vault path>/inbox/`
- filename `<YYYY-MM-DD>-<slug>.md`, slug from the title in `[a-z0-9-]`
- frontmatter, then a blank line, then the text:

  ```
  ---
  source: text
  url: https://example.com/page
  title: Page title
  status: unprocessed
  added: 2026-10-12
  ---
  ```

- before writing, grep every inbox and every vault's `raw/` for `url: <the url>`; a match gets the
  text appended under `## <source> added <date>` and its status set back to `unprocessed`
