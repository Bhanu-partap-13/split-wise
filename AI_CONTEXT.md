# AI_CONTEXT.md — SplitSmart

## Product Understanding
SplitSmart is a Splitwise-inspired expense splitting application built for an internship assignment. The core differentiator is a Smart CSV Import Engine that validates real-world messy expense data (like the provided expenses_export.csv) before importing, detecting 8+ categories of data issues including duplicates, settlements disguised as expenses, missing payers, name inconsistencies, invalid date formats, percentage mismatches, zero-amount rows, and negative amounts.

## Product Scope
- Login/signup with Clerk (email + Google OAuth)
- Create and manage groups (invite/remove members)
- Add expenses manually (equal, unequal, percentage, share splits)
- Smart CSV import with pre-import validation report
- Real-time expense chat per expense
- Group-wise and individual balance summaries
- Settle debts / record payments
- AI-powered plain-English balance explanations via Gemini 2.5 Flash API

## Out of Scope (Explicitly Excluded)
- Push notifications
- Email invites (users must already be registered)
- Currency conversion (multi-currency balances shown separately)
- Mobile app
- Recurring expenses

## Tech Stack
- Next.js 16 (App Router, TypeScript strict)
- Clerk: authentication
- Convex: real-time backend database (PostgreSQL-style relational schema with indexes)
- shadcn/ui + Tailwind CSS: UI components
- Google Gemini 2.5 Flash: AI balance summaries
- papaparse: CSV parsing
- react-dropzone: file upload UX
- Vercel: deployment

## Database Schema (Convex)
Tables: users, groups, groupMembers, expenses, expenseSplits, settlements, messages, importBatches

Key relationships:
- users <-> groups via groupMembers (many-to-many)
- expenses belong to groups, have a paidBy user
- expenseSplits belong to expenses, reference users
- settlements belong to groups, reference fromUser and toUser
- messages belong to expenses (real-time chat)
- importBatches track CSV import history

## API Design
All data access via Convex queries and mutations (no REST API).
Exception: /api/ai-summary (Next.js route handler, calls Gemini API server-side)

## CSV Validation Engine
File: src/lib/csvValidator.ts
Detects:
1. DUPLICATE_EXPENSE — same description + date + payer
2. IS_SETTLEMENT — keywords in description/notes
3. MISSING_PAYER — empty paid_by field
4. MISSING_CURRENCY — empty currency field
5. ZERO_AMOUNT — 0 entries
6. NEGATIVE_AMOUNT — refunds (flagged as warnings, not errors)
7. INVALID_DATE — unparseable date strings
8. AMBIGUOUS_DATE — DD/MM vs MM/DD ambiguity
9. PERCENTAGE_MISMATCH — percentages don't sum to 100%
10. NAME_VARIANTS — case/spacing inconsistencies across paid_by and split_with fields

Severity levels: "error" (row skipped) vs "warning" (row imported with flag)

## Balance Calculation
File: src/lib/balances.ts
Algorithm:
1. For each expense: payer is owed money by each split participant
2. For each settlement: reduce the corresponding debt
3. Debt simplification: net each person's balance, then greedily match creditors to debtors

## Frontend Structure
src/app/
  page.tsx — Landing
  sign-in/, sign-up/ — Clerk auth pages
  dashboard/
    page.tsx — Dashboard with group list
    groups/
      new/page.tsx — Create group
      [groupId]/page.tsx — Group detail with tabs

src/components/
  CSVImportWizard.tsx — 3-step import flow (upload -> validate -> import)
  ExpenseList.tsx — Expense table with delete and chat
  BalanceSummary.tsx — Simplified debts + AI explain button
  MembersList.tsx — Add/remove members by email
  AddExpenseDialog.tsx — Manual expense entry
  ExpenseChatDrawer.tsx — Real-time chat per expense
  RecordSettlementDialog.tsx — Record payment between users
  DashboardNav.tsx — Top navigation
  providers/ConvexClientProvider.tsx — Convex context wrapper

## Deployment
- Convex: `npx convex deploy` (creates production deployment)
- Vercel: connect GitHub repo, add all env vars, auto-deploys on push

## Known Limitations
- No currency conversion: USD and INR balances are tracked separately
- External members (e.g. "Dev's friend Kabir") imported from CSV are stored by name only, not linked to a user account
- Settlement matching in CSV is heuristic (keyword-based), not guaranteed
- Equal split is the default for CSV imports; unequal/percentage/share splits are calculated from split_details column
