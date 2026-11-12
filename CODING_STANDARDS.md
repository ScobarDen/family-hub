# Coding standards

Judgement calls a reviewer applies to a diff. Anything a linter can check lives in `vite.config.ts` instead.

## A replaced rule keeps every branch of the old one

When a diff replaces a domain rule (`isClosed`, `isOverdue`, the Recipients of a Task, what counts as an Occurrence), read the old version on `main` and list the cases it told apart: a single and a recurring Task, a Skipped or Completed Occurrence, a moved date, a Task without a date or without Assignees. Every case keeps its old answer, or the change has a test and a line in the PR saying what now answers differently.
