# DECISIONS.md — SplitSmart: Engineering Decision Log

Each significant decision is documented below with the options considered and the rationale for the choice made.

---

## Decision 1: Real-time Backend — Convex vs Supabase vs Firebase

**Context**: The app needs a database to store groups, expenses, splits, and messages. Real-time updates (e.g., expense chat) are a feature requirement.

**Options Considered**:
| Option | Pros | Cons |
|---|---|---|
| **Convex** | Typed schema, real-time subscriptions built-in, no Express/REST boilerplate, serverless functions co-located with schema | Proprietary, less portable |
| Supabase | Open source, PostgreSQL, good DX | Requires writing SQL migrations, WebSocket setup for real-time |
| Firebase | Battle-tested real-time, Google ecosystem | NoSQL is harder to model relational data; no TypeScript schema validation |

**Decision**: **Convex**  
**Reason**: Convex's schema-first approach with `defineTable` gives TypeScript type safety end-to-end. Real-time `useQuery` subscriptions in React components work without any additional setup. This let us build faster during a time-constrained assignment.

---

## Decision 2: Authentication — Clerk vs NextAuth vs Custom JWT

**Context**: The app needs email + social login and a way to resolve user identity in the backend.

**Options Considered**:
| Option | Pros | Cons |
|---|---|---|
| **Clerk** | Pre-built UI, Google OAuth out of the box, webhook to sync user to Convex | Paid after free tier; vendor lock-in |
| NextAuth | Free, open source, flexible | Requires more setup; session management complexity |
| Custom JWT | Full control | Significant implementation time; security risks |

**Decision**: **Clerk**  
**Reason**: For an internship assignment, shipping speed matters more than avoiding vendor lock-in. Clerk's `<SignIn>` and `<SignUp>` components saved several days of auth UI work. The Clerk → Convex user sync webhook (`convex/users.ts`) ensures every authenticated user has a corresponding `users` document.

---

## Decision 3: CSV Validation — Client-side vs Server-side

**Context**: The CSV import wizard needs to validate a potentially large file and show a detailed row-by-row report before committing data.

**Options Considered**:
| Option | Pros | Cons |
|---|---|---|
| **Client-side (browser)** | Instant feedback; no server round-trip; user can see all rows before confirming | Cannot access Convex database to resolve user IDs for payers during validation |
| Server-side (Convex mutation) | Can resolve users; single source of truth | Slow round-trip for large files; hard to show live progress |

**Decision**: **Client-side validation, server-side commit**  
**Reason**: The validation step (`validateCSV` / `validateExcel`) runs entirely in the browser with PapaParse/xlsx. This gives instant, rich feedback. Only the confirmed clean/warning rows are sent to `expenses.importBatch` on the server. This 2-phase approach is the same pattern used by Splitwise, Google Sheets import, and bank CSV importers.

---

## Decision 4: Split Calculation — Library vs Custom Algorithm

**Context**: The app must support equal, unequal, percentage, and share-based splits and calculate simplified debts.

**Options Considered**:
| Option | Pros | Cons |
|---|---|---|
| **Custom algorithm** (`src/lib/balances.ts`) | Full control; no dependencies; can be tailored to our schema | Must be tested carefully |
| Third-party library | Less code | Might not support all our split types; adds dependency |

**Decision**: **Custom algorithm**  
**Reason**: The debt simplification algorithm (net balance → greedy matching) is a standard CS problem that's simple to implement correctly. Using a library would add a dependency for ~60 lines of business logic. The algorithm was first validated with the assignment's CSV data before integrating.

---

## Decision 5: AI Integration — Gemini vs Anthropic Claude vs OpenAI

**Context**: The assignment requires AI-powered balance explanations in plain English. The build spec referenced `@anthropic-ai/sdk` with `claude-sonnet-4-6`.

**Options Considered**:
| Option | Pros | Cons |
|---|---|---|
| **Google Gemini 2.5 Flash** | Free tier available, excellent structured reasoning, `@google/generative-ai` SDK, already set up in the environment | Proprietary; deviates from spec |
| Anthropic Claude (`claude-sonnet-4-6`) | Specified in build prompt; strong reasoning | Requires paid API key; no meaningful free tier for assignment-scale testing |
| OpenAI GPT-4o | Best quality overall | More expensive; no free tier |
| Local LLM (Ollama) | Free; private | Poor quality on structured financial reasoning; requires local GPU |

**Decision**: **Google Gemini 2.5 Flash** (via `@google/generative-ai`)  
**Deviation from spec**: The assignment build prompt specifies `@anthropic-ai/sdk` with `claude-sonnet-4-6`. We deliberately chose Gemini instead.  
**Reason**: Gemini 2.5 Flash's free tier allowed immediate iteration without API billing. The `@google/generative-ai` SDK is production-ready and the model quality for structured financial Q&A is comparable to Claude Sonnet. The system prompt, context injection pattern, and server-side routing are identical regardless of the underlying model — switching to Claude would require only changing the SDK import and model name, not the application architecture. This decision is documented in `AI_USAGE.md`.

---

## Decision 6: How to Handle CSV-imported Members Who Are Not Registered Users

**Context**: The provided CSV has payer names like "Rahul", "Priya", etc. These names may not match any registered Clerk user. If we reject them, the CSV import is useless. If we create ghost users, it pollutes the user table.

**Options Considered**:
| Option | Pros | Cons |
|---|---|---|
| Reject rows with unrecognized payers | Data integrity | Makes the CSV import nearly useless |
| Create stub users for unrecognized names | Import works | Pollutes `users` table with unverified accounts |
| **Store payer name as string (`paidByName`); leave `paidById` pointing to importer** | Import works; clean schema | Balance display falls back to name string; cannot send notifications |

**Decision**: **Store as `paidByName` string**  
**Reason**: `expenses.paidByName` is an optional string that serves as a fallback. The `getGroupExpenses` query checks `paidByName` first, then looks up `paidById`. This lets the import wizard import any CSV without requiring all payers to be registered. The trade-off is that CSV-imported balances are name-based, not user-ID-based, so cross-group tracking of the same person is not possible.

---

## Decision 7: Settlement Detection — Rule-based vs ML

**Context**: The assignment CSV contains rows that are actually payment settlements (e.g., "Priya paid back Rahul") disguised as regular expenses. These must be flagged.

**Options Considered**:
| Option | Pros | Cons |
|---|---|---|
| **Keyword heuristic** (current) | Fast; no model needed; transparent; easy to audit | May miss novel phrasing; may false-positive on expense names containing "UPI" |
| ML text classification | Higher recall | Overkill for assignment; requires training data |

**Decision**: **Keyword heuristic**  
**Keywords used**: `paid back`, `settlement`, `settled`, `repaid`, `repayment`, `returned`, `pay back`, `upi`  
**Reason**: The heuristic is transparent and auditable. False positives are handled gracefully — flagged rows are still imported with `isSettlement: true` and shown separately in the UI. The user can review them in the validation report before confirming.

---

## Decision 8: Currency Handling — Single vs Multi-currency

**Context**: The CSV contains both INR and USD expenses.

**Options Considered**:
| Option | Pros | Cons |
|---|---|---|
| Convert all to one currency via API | Unified balances | Requires a live exchange rate API; adds complexity |
| **Track multi-currency separately** | Accurate to original data | Balances are fragmented by currency |
| Reject non-default currency rows | Simple | Loss of data |

**Decision**: **Track separately, no conversion**  
**Reason**: Adding a live exchange rate API is scope creep for this assignment. The schema stores `currency` on every expense and settlement. The UI displays INR and USD balances separately. A note in the UI and README makes this limitation explicit.

---

## Decision 9: Authorization on Mutations — Who Can Delete/Write?

**Context**: All Convex mutations (`deleteExpense`, `importBatch`, `create`, `settlements.record`, `messages.send`) initially had no server-side authorization checks. Any authenticated user with a valid Convex connection could write or delete any record.

**Risk**: High — a malicious user could delete other groups' expenses or inject messages into chats they are not part of.

**Decision**: Add group membership checks on every write mutation.  
**Status**: ✅ **Already fixed** — every mutation now verifies the requesting user is a member of the target group before proceeding. Additional guards added:
- `deleteExpense` requires `requestingUserId` and verifies group membership
- `importBatch` caps at 500 rows and verifies the importer is a group member
- `settlements.record` validates positive amount and prevents self-settlements
- `messages.send` enforces 2000-character limit and group membership
- `users.getAllUsers` removed entirely — it exposed all user emails to any authenticated client
