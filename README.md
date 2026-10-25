# keepwiki

A second brain for Claude Code and Codex. You feed it sources: notes, articles, YouTube videos,
PDFs. It compiles them into a linked markdown wiki, one vault per subject you choose, and answers
your questions only from what the wiki holds. When the answer is not there, it says so.

Status: early release. The seven skills, the citation gate and the session start hook are built, and
the `keepwiki` package is on npm.

## How it works

keepwiki follows the [LLM wiki method described by Andrej Karpathy](https://x.com/karpathy/status/2039805659525644595):
sources compile into an interlinked wiki, not into one summary per source, and every answer cites
the pages it came from.

A vault is one boundary of knowledge you choose: a course, a subject, one client's SEO, the way you
write. Each vault is a plain folder of markdown files you can open in any editor:

| Path         | What it holds                                                         |
| ------------ | --------------------------------------------------------------------- |
| `inbox/`     | sources waiting to be learned                                         |
| `raw/`       | sources already learned, kept verbatim                                |
| `knowledge/` | the wiki pages, linked with `[[page]]`                                |
| `index.md`   | one line per page, the map `ask` reads first                          |
| `eval.md`    | questions with the page that should answer them, for `/keepwiki:eval` |
| `CLAUDE.md`  | the vault's boundary, language and page types                         |

The registry of your vaults is `~/.keepwiki/registry.md`. New vaults go under `~/keepwiki/` unless
you pick another path, and a shared inbox at `~/keepwiki/inbox/` takes sources you have not assigned
to a vault yet.

## What you need

Claude Code or Codex. Nothing else is required: a vault is a folder of markdown files, and the skills
write them.

Node 22 or later turns on the deterministic parts: the citation gate, the inbox commands, the health
check and the session start hook. If you installed Claude Code through npm, you have it. Without Node
the skills do the same work by hand and tell you so.

## Install

One command per tool. Each gives you the same seven skills; Claude Code also gets the session start
hook, because only Claude Code runs plugin hooks.

Claude Code 2.1.275 or later, as a plugin:

```
/plugin install keepwiki --marketplace adrianszablowski/keepwiki
```

Older versions add the marketplace first, `/plugin marketplace add adrianszablowski/keepwiki`, then
install `keepwiki` from it.

Codex, Cursor or another agent without plugins, as plain skill files copied into your agent's skills
folder:

```bash
npx skills add adrianszablowski/keepwiki
```

## The skills

| Skill               | What it does                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `/keepwiki:new`     | Creates a vault, or adopts an existing folder of notes as one.                               |
| `/keepwiki:add`     | Puts a source into an inbox: pasted text, an article link, a YouTube link, a PDF, a file.    |
| `/keepwiki:learn`   | Turns inbox sources into pages, shows you the list of pages first, links them both ways.     |
| `/keepwiki:ask`     | Answers from the pages only, every claim with a verified citation, and says what is missing. |
| `/keepwiki:check`   | Reports broken links, unsourced pages, orphans and contradictions, and changes nothing.      |
| `/keepwiki:explain` | Explains one page in plain words and lists where the page's own account breaks down.         |
| `/keepwiki:eval`    | Runs the questions in `eval.md` and reports how often `ask` found the right vault and page.  |

Name a vault in a question with `@name`, or with `in:name` when your folder has a file of that name.
Answers come in the language you ask in; pages are written in the vault's language, inferred from how
you write.

At the start of a Claude Code session, a hook tells Claude how many sources wait in your inboxes, and
Claude passes it on. It says nothing when there are none.

## Optional tools

Each one matters only for one kind of source or one vault size. The skill detects it and says which
mode it ran in.

| Tool        | What it adds                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------- |
| `yt-dlp`    | the transcript of a YouTube video; without it, `add` asks you to paste the transcript         |
| `pdftotext` | PDF text in Codex; Claude Code reads PDFs itself                                              |
| qmd         | ranked search by meaning inside a vault, which lifts the practical ceiling of about 100 pages |

To add [qmd](https://github.com/tobi/qmd), a local search engine for your own files:

```bash
npm install -g @tobilu/qmd
```

On macOS it also needs Homebrew's SQLite, `brew install sqlite`, and on first use it downloads about
2 GB of models. `ask` creates one qmd collection per vault, named after the vault, the first time it
searches there.

## Limits

[limits.md](limits.md) lists what keepwiki cannot do, from errors that accumulate across pages to
the hook that only Claude Code runs. Read it before you rely on an answer for a decision.

## Credits

Ideas borrowed from [super-brain](https://github.com/superhero-tech/super-brain) by Wojtek
Strzałkowski and Piotr Kacała: a source updates every page it touches, answers record what the
wiki does not know, a periodic check for contradictions and orphans, and an honest list of limits.

## Licence

MIT. The plugin and the npm package are open source. A hosted version, if one is ever built, may be
a separate closed product on the same vault format.
