# Wanderlearn Plans

This directory holds design and implementation plans for Wanderlearn, plus the coding/style guide that governs every code-writing task.

## Numbering convention

- Plans are prefixed with a **two-digit zero-padded integer**, starting at `00`.
- Increment by 1 for each new plan: `00-`, `01-`, `02-`, … `99-`.
- The number is sticky: once a plan is assigned a number, it keeps it. Superseded plans are NOT renumbered — instead, the new plan references the old one and the old file gains a `> SUPERSEDED BY plans/NN-...` note at the top.
- When you're about to create a new plan, run `ls plans/` and pick the next unused number.
- Two-digit padding keeps files in lexical order. If we ever pass 99, we rename the whole series to three digits in one go.

## File naming

`NN-kebab-case-slug.md` — short, action-oriented, no dates in the filename. Example: `00-wanderlearn-phase-1-mvp.md`.

## What belongs in a plan

- **Context** — why the change, what it unblocks, what problem it solves.
- **Scope** — what's in and (equally important) what's explicitly out.
- **Approach** — the single recommended path (not a menu of alternatives).
- **Data model / API surface / file changes** — concrete enough to execute.
- **Verification** — how we test end-to-end.
- **Memory to save** — persistent context for future sessions.

Plans are for aligning with Anthony before implementation. Once approved, a plan is the contract; deviations require either a new plan or an explicit amendment note appended to the original.

## Style guide

`STYLE_GUIDE.md` lives in this directory. It is **re-read before every code-writing task** — that is a hard rule, not a suggestion.

## Current index

| # | File | Status |
|---|---|---|
| 00 | [00-wanderlearn-phase-1-mvp.md](00-wanderlearn-phase-1-mvp.md) | Draft — awaiting approval |
