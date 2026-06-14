# BUILD_PLAN.md — SplitSmart

## 1. Product Research
- Studied Splitwise app: core workflows are expense entry, split calculation, balance tracking, and settlement
- Identified the provided expenses_export.csv as intentionally containing data quality issues (duplicates, mixed date formats, missing fields, settlements disguised as expenses)
- Key insight: the assignment tests whether the candidate can detect data integrity issues, not just build a CRUD form

## 2. Architecture
- Next.js App Router for full-stack TypeScript
- Convex for real-time backend (no Express/PostgreSQL setup overhead)
- Clerk for auth (no JWT implementation overhead)
- shadcn/ui for production-quality UI in minimal time

## 3. AI Collaboration Process
- Used Gemini as primary development collaborator
- Gemini first analyzed the CSV file to enumerate all data quality issues before any code was written
- Key questions asked before building:
  - What exactly is wrong in the CSV? (8 categories identified)
  - What split calculation methods are needed?
  - How should settlements be distinguished from expenses?
  - What's the minimum schema to support all split types?
- AI_CONTEXT.md updated after each major architectural decision

## 4. Tradeoffs
- Simplified: currency conversion not implemented (multi-currency shown separately)
- Hardcoded: INR as default balance currency for simplification
- Avoided: OAuth invite flow (users must self-register first)
- Would improve: add currency conversion API, offline support, expense editing
