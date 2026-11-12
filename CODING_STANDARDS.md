# Coding standards

Judgement calls a reviewer applies to a diff. Anything a linter can check lives in `vite.config.ts` instead.

## A replaced rule keeps every branch of the old one

When a diff replaces a domain rule (`isClosed`, `isOverdue`, the Recipients of a Task, what counts as an Occurrence), read the old version on `main` and list the cases it told apart: a single and a recurring Task, a Skipped or Completed Occurrence, a moved date, a Task without a date or without Assignees. Every case keeps its old answer, or the change has a test and a line in the PR saying what now answers differently.

## Moved code reads its inputs when the old code did

When a diff moves logic between functions, compare each input on `main` and in the diff: `clock.now()`, a Member's zone, a row read from the database. Each one is read at the same moment and as often as before (once per cron tick, once per press), or the PR says what now reads it differently and why. A refactor that reads the clock per row instead of per tick moves a 12-hour boundary without a single test going red.

## A comment says why

A comment carries what the code cannot say: a business rule, a workaround with its link, a gotcha, an ADR. What a line does is said by its names; a comment that restates it, labels a section or narrates the edit goes, and so does one whose code moved away from it.
