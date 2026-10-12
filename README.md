# keepwiki

A second brain for Claude Code and Codex. You feed it sources: notes, articles, videos, PDFs. It
compiles them into a linked markdown wiki, one vault per subject you choose, and answers your
questions only from what the wiki holds. When the answer is not there, it says so.

Status: work in progress, not yet usable. The first release will ship seven skills: `new`, `add`,
`learn`, `ask`, `check`, `explain`, `eval`.

## Method

keepwiki follows the [LLM wiki method described by Andrej Karpathy](https://x.com/karpathy/status/2039805659525644595): sources compile into an
interlinked wiki, not into one summary per source, and every answer cites the pages it came from.

Ideas borrowed from [super-brain](https://github.com/superhero-tech/super-brain) by Wojtek
Strzałkowski and Piotr Kacała: a source updates every page it touches, answers record what the
wiki does not know, a periodic lint for contradictions and orphans, and an honest list of limits.

## Licence

MIT
