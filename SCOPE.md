# SCOPE.md — SplitSmart: Anomaly Log & Database Schema

## 1. Product Scope

SplitSmart is a Splitwise-inspired expense splitting application built for an internship assignment. The core differentiator is a **Smart CSV Import Engine** that validates real-world messy expense data before importing, detecting 10+ categories of data issues.

### In Scope
- Login/signup with Clerk (email + Google OAuth)
- Create and manage groups (invite/remove members by email)
- Add expenses manually (equal, unequal, percentage, share splits)
- Smart CSV/Excel import with a 3-step pre-import validation wizard
- Real-time expense chat per expense (via Convex live queries)
- Group-wise and individual balance summaries with debt simplification
- Settle debts / record payments between members
- AI-powered plain-English balance explanations via Google Gemini 2.5 Flash

### Out of Scope (Explicitly Excluded)
- Push notifications
- Email invites (users must already be registered to be added)
- Currency conversion (multi-currency balances shown separately)
- Mobile native app
- Recurring expenses
- Expense editing after creation

---

## 2. CSV Anomaly Log

All anomalies are detected by `src/lib/csvValidator.ts`. The engine performs 10 distinct checks on every row of the uploaded CSV or Excel file.

### Anomaly Categories

| # | Anomaly Type | Detection Method | Severity | Action Taken |
|---|---|---|---|---|
| 1 | `INVALID_DATE` | Cannot parse date string using any known format | **error** | Row **skipped** — cannot determine when expense occurred |
| 2 | `AMBIGUOUS_DATE` | Both day and month are ≤ 12 (e.g., `04/05/2024` could be Apr 5 or May 4) | **warning** | Row **imported** with flag — app assumes DD/MM/YYYY |
| 3 | `MISSING_AMOUNT` | `amount` field is empty or non-numeric | **error** | Row **skipped** — no amount means we cannot calculate splits |
| 4 | `ZERO_AMOUNT` | Parsed amount equals exactly 0 | **error** | Row **skipped** — zero-amount entries create noise in balance calculations |
| 5 | `NEGATIVE_AMOUNT` | Parsed amount is less than 0 | **warning** | Row **imported** with flag — treated as a refund/credit, user is alerted |
| 6 | `MISSING_PAYER` | `paid_by` field is empty or whitespace | **error** | Row **skipped** — cannot assign debt without knowing the payer |
| 7 | `MISSING_CURRENCY` | `currency` field is empty | **warning** | Row **imported** — currency defaults to `INR`, user is alerted |
| 8 | `IS_SETTLEMENT` | Description or notes contain keywords: `paid back`, `settlement`, `settled`, `repaid`, `repayment`, `returned`, `pay back`, `upi` | **warning** | Row **imported** with `isSettlement: true` flag, shown separately in the UI |
| 9 | `DUPLICATE_EXPENSE` | Duplicate key = same `description` + `date` + `paid_by` (case-insensitive) | **error** | Row **skipped** — only the first occurrence is kept |
| 10 | `INVALID_SPLIT_TYPE` | `split_type` value is not one of: `equal`, `unequal`, `percentage`, `share` | **error** | Row **skipped** — cannot create splits without a valid split method |
| 11 | `PERCENTAGE_MISMATCH` | When `split_type` is `percentage`, split percentages do not sum to 100% (±1% tolerance) | **warning** | Row **imported** with flag — amounts may be inaccurate |
| 12 | `NAME_VARIANTS` | Same person named differently across rows (e.g. `Riya`, `riya`, `RIYA`) detected via case-insensitive normalization | **warning** (report-level) | Reported in the pre-import summary — user can review before confirming |

### How Each Is Handled in the Import Wizard

1. **Step 1 — Upload**: User drags and drops a `.csv` or `.xlsx` file.
2. **Step 2 — Validate**: `validateCSV()` or `validateExcel()` runs client-side. A full report is displayed, showing every row's status: Clean / Warning / Error. User can review anomalies row-by-row before proceeding.
3. **Step 3 — Import**: Only non-error rows are sent to the backend via the `expenses.importBatch` Convex mutation. Each import is saved as an `importBatches` record for auditability.

---

## 3. Database Schema

Schema defined in `convex/schema.ts`. All data is stored in Convex's real-time document database.

### Tables

```
users
├── clerkId (string, optional) — Clerk authentication ID
├── email (string, optional)
├── name (string, required)
├── avatarUrl (string, optional)
└── createdAt (number, optional) — Unix timestamp
Indexes: by_clerk_id, by_email

groups
├── name (string, required)
├── description (string, optional)
├── createdBy (ref: users, required)
├── createdAt (number, required) — Unix timestamp
└── currency (string, required) — default "INR"

groupMembers  [join table for users ↔ groups]
├── groupId (ref: groups, required)
├── userId (ref: users, required)
├── role ("admin" | "member", required)
├── joinedAt (number, required) — Unix timestamp
└── nickname (string, optional) — for external/imported-only members
Indexes: by_group, by_user, by_group_and_user

expenses
├── groupId (ref: groups, required)
├── description (string, required)
├── amount (number, required)
├── currency (string, required)
├── paidById (ref: users, required)
├── paidByName (string, optional) — fallback for CSV-imported payers not in the system
├── splitType ("equal" | "unequal" | "percentage" | "share", required)
├── date (number, required) — Unix timestamp
├── notes (string, optional)
├── isSettlement (boolean, required)
├── createdBy (ref: users, required)
├── createdAt (number, required)
└── importBatchId (string, optional) — groups CSV import batches
Indexes: by_group, by_paid_by, by_import_batch

expenseSplits  [child of expenses]
├── expenseId (ref: expenses, required)
├── userId (ref: users, optional) — null for external/CSV members
├── userName (string, required) — always stored for display
├── amount (number, required) — actual amount owed
├── percentage (number, optional)
├── shares (number, optional)
└── isPaid (boolean, required)
Indexes: by_expense, by_user

settlements
├── groupId (ref: groups, required)
├── fromUserId (ref: users, required) — person who paid
├── toUserId (ref: users, required) — person who received
├── amount (number, required)
├── currency (string, required)
├── note (string, optional)
├── recordedBy (ref: users, required)
└── createdAt (number, required)
Indexes: by_group, by_from_user, by_to_user

messages  [real-time chat per expense]
├── expenseId (ref: expenses, required)
├── userId (ref: users, required)
├── userName (string, required)
├── text (string, required)
└── createdAt (number, required)
Index: by_expense

importBatches  [CSV import audit log]
├── groupId (ref: groups, required)
├── uploadedBy (ref: users, required)
├── fileName (string, required)
├── totalRows (number, required)
├── importedRows (number, required)
├── skippedRows (number, required)
├── issues (array of { row, type, message, severity })
├── status ("pending" | "reviewed" | "imported", required)
└── createdAt (number, required)
Index: by_group
```

### Key Relationships
- `users` ↔ `groups` via `groupMembers` (many-to-many, with roles)
- `expenses` belong to `groups`, paid by one `user` (`paidById`)
- `expenseSplits` belong to `expenses`, one record per participant
- `settlements` belong to `groups`, reference `fromUser` and `toUser`
- `messages` belong to `expenses` (per-expense real-time chat)
- `importBatches` track the history and anomalies of every CSV import

### Balance Calculation Algorithm (`src/lib/balances.ts`)
1. For each expense: the payer is owed money by every split participant (net credit = amount owed)
2. For each settlement: reduce the corresponding directional debt
3. **Debt simplification**: Net each person's total balance (positive = owed money, negative = owes money), then greedily match the largest creditor against the largest debtor to minimize transaction count
