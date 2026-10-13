# Limits

What keepwiki cannot do, or does only part way. Read this before you trust it with a decision.

1. Errors accumulate. A mistake on one page flows into every page written from it later. Run
   `/keepwiki:check` once a month, and open the file in `raw/` before you act on something important.
2. A citation does not prove a claim is true. It proves only that the quoted fragment exists in the
   cited file. The source itself can be wrong.
3. `/keepwiki:learn` costs tokens in proportion to the pages a source touches. The list you approve
   before anything is written gives you control over which pages change, not over what the approved
   changes cost.
4. One model has one blind spot. For an important decision, put the same question to a second
   model.
5. A cross-vault link, `[[vault:page]]`, is not clickable in any markdown editor. Only the keepwiki
   skills understand it.
6. Without qmd, a vault works well up to about 100 pages.
7. Images, screenshots and photos of notes are not sources in this release.
8. Codex has no session start hook. There, the model hears about unprocessed sources only when you
   run `/keepwiki:ask` or `/keepwiki:learn`.
9. The citation gate runs in code and needs Node. Without Node, the skill checks citations by hand
   and tells you it ran in soft mode.
10. `/keepwiki:ask` searches only the vaults it chose or you named. Knowledge in another vault is
    not consulted.
11. In a folder that holds a file or subfolder with the same name as a vault, `@name` attaches that
    path to your message. Write `in:name` there instead.
12. The session start hook runs in every project where the plugin is enabled and calls `npx`. Without
    Node on the PATH, the reminder is silently absent.
13. There is no undo for a page. `learn` rewrites it and keepwiki keeps no earlier version. `raw/`
    holds every source verbatim, so a page can be written again. For history, run `git init` in the
    vault folder yourself.
