---
name: eval
description: Run the questions in a vault's eval.md through the ask procedure and report three numbers: vault routing, page hits and "not in keepwiki" correctness. Use when the user says "eval", "sprawdź jakość odpowiedzi", or after a change to how ask or learn works.
---

# eval: does ask find the right pages and refuse the right questions

`eval.md` in a vault is a table, `| question | expected |`, where `expected` is a page name or `none`
for a question the vault must refuse. You run each question the way `ask` would and score it.

## 1. Load the questions

Read the vault's `eval.md`. Fewer than 10 rows: say the eval is too small to mean much, offer to add
rows by running `/keepwiki:learn` on more sources, and continue with what is there.

## 2. Score each row

Read the registry once; it does not change during a run. For every question, perform `ask` step 1's
vault choice and step 2 (`/keepwiki:ask`) without ever asking the user: a choice `ask` would have put
to them is a routing miss. Record:

- routing: without `@name`, did the registry match pick this vault
- pages: is `expected` among the pages you read in step 2
- refusal, for `expected` = `none`: write the answer and run the gate; a pass is an answer that ends
  as "not in keepwiki" with zero verified citations

A row with a page name is correct when routing and pages both hold. Keep a table of rows with the
outcome and, for a miss, the page you read instead.

## 3. Report three numbers

- vault routing: correct rows / rows, as a fraction and a count
- page hits: rows where `expected` was among the pages read / rows with a page name
- "not in keepwiki": `none` rows refused / `none` rows

Follow with the misses, one line each: question, expected, what happened. Done when every row has an
outcome and the user has the three numbers.
