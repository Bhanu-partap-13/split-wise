# MASTER BUILD PROMPT — SplitSmart (Splitwise Clone + Smart CSV Importer)
# Do NOT modify anything. Execute step by step in order.

---

## CONTEXT

You are a senior full-stack engineer. Build a production-ready web application called **SplitSmart** — a Splitwise-inspired expense splitting app with a Smart CSV Importer that detects data quality issues before import. This is an internship assignment submission that must impress evaluators among 6,000 competing candidates.

Do not ask clarifying questions. Do not skip steps. Build everything exactly as specified.

---

## TECH STACK (NON-NEGOTIABLE)

- **Framework**: Next.js 16 (App Router, TypeScript strict mode)
- **Auth**: Clerk (email + Google OAuth)
- **Backend/DB**: Convex (real-time, serverless)
- **UI**: shadcn/ui + Tailwind CSS
- **AI Feature**: gemini 2.5 flash ##do this at last
- **CSV Parsing**: papaparse
- **Deployment**: Vercel
- **Icons**: lucide-react
- **Always use pnpm**
---

## STEP 1 — PROJECT INITIALIZATION [COMPLETED]

Run these commands exactly:

```bash
npx create-next-app@latest splitsmart --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd splitsmart
npx shadcn@latest init -d
npx shadcn@latest add button card input label badge table dialog alert tabs avatar separator toast dropdown-menu
npm install convex @clerk/nextjs @clerk/clerk-react papaparse @types/papaparse lucide-react @vercel-ai/sdk
npx convex dev --once
```

Create `.env.local`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
NEXT_PUBLIC_CONVEX_URL=your_convex_deployment_url
ANTHROPIC_API_KEY=your_anthropic_api_key
```

---

## STEP 2 — CONVEX SCHEMA

Create `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]).index("by_email", ["email"]),

  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    currency: v.string(), // default "INR"
  }),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
    nickname: v.optional(v.string()), // for external people like "Dev's friend Kabir"
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_and_user", ["groupId", "userId"]),

  expenses: defineTable({
    groupId: v.id("groups"),
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    paidById: v.id("users"),
    paidByName: v.optional(v.string()), // fallback for imported data
    splitType: v.union(
      v.literal("equal"),
      v.literal("unequal"),
      v.literal("percentage"),
      v.literal("share")
    ),
    date: v.number(), // Unix timestamp
    notes: v.optional(v.string()),
    isSettlement: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    importBatchId: v.optional(v.string()), // to group imported expenses
  })
    .index("by_group", ["groupId"])
    .index("by_paid_by", ["paidById"])
    .index("by_import_batch", ["importBatchId"]),

  expenseSplits: defineTable({
    expenseId: v.id("expenses"),
    userId: v.optional(v.id("users")),
    userName: v.string(), // always store name for display
    amount: v.number(), // actual amount owed
    percentage: v.optional(v.number()),
    shares: v.optional(v.number()),
    isPaid: v.boolean(),
  })
    .index("by_expense", ["expenseId"])
    .index("by_user", ["userId"]),

  settlements: defineTable({
    groupId: v.id("groups"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    amount: v.number(),
    currency: v.string(),
    note: v.optional(v.string()),
    recordedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_from_user", ["fromUserId"])
    .index("by_to_user", ["toUserId"]),

  messages: defineTable({
    expenseId: v.id("expenses"),
    userId: v.id("users"),
    userName: v.string(),
    text: v.string(),
    createdAt: v.number(),
  })
    .index("by_expense", ["expenseId"]),

  importBatches: defineTable({
    groupId: v.id("groups"),
    uploadedBy: v.id("users"),
    fileName: v.string(),
    totalRows: v.number(),
    importedRows: v.number(),
    skippedRows: v.number(),
    issues: v.array(v.object({
      row: v.number(),
      type: v.string(),
      message: v.string(),
      severity: v.union(v.literal("error"), v.literal("warning")),
    })),
    status: v.union(v.literal("pending"), v.literal("reviewed"), v.literal("imported")),
    createdAt: v.number(),
  }).index("by_group", ["groupId"]),
});
```

---

## STEP 3 — CONVEX FUNCTIONS

### `convex/users.ts`
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { name: args.name, avatarUrl: args.avatarUrl });
      return existing._id;
    }
    return await ctx.db.insert("users", { ...args, createdAt: Date.now() });
  },
});

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

export const searchByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});
```

### `convex/groups.ts`
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const groupId = await ctx.db.insert("groups", { ...args, createdAt: Date.now() });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: args.createdBy,
      role: "admin",
      joinedAt: Date.now(),
    });
    return groupId;
  },
});

export const getUserGroups = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const groups = await Promise.all(
      memberships.map((m) => ctx.db.get(m.groupId))
    );
    return groups.filter(Boolean);
  },
});

export const getGroup = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.groupId);
  },
});

export const getGroupMembers = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();
    const users = await Promise.all(members.map((m) => ctx.db.get(m.userId)));
    return members.map((m, i) => ({ ...m, user: users[i] }));
  },
});

export const addMember = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();
    if (existing) return;
    await ctx.db.insert("groupMembers", {
      ...args,
      role: "member",
      joinedAt: Date.now(),
    });
  },
});

export const removeMember = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();
    if (member) await ctx.db.delete(member._id);
  },
});
```

### `convex/expenses.ts`
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    groupId: v.id("groups"),
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    paidById: v.id("users"),
    splitType: v.union(
      v.literal("equal"),
      v.literal("unequal"),
      v.literal("percentage"),
      v.literal("share")
    ),
    date: v.number(),
    notes: v.optional(v.string()),
    isSettlement: v.boolean(),
    createdBy: v.id("users"),
    splits: v.array(v.object({
      userId: v.optional(v.id("users")),
      userName: v.string(),
      amount: v.number(),
      percentage: v.optional(v.number()),
      shares: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const { splits, ...expenseData } = args;
    const expenseId = await ctx.db.insert("expenses", {
      ...expenseData,
      createdAt: Date.now(),
    });
    await Promise.all(
      splits.map((s) =>
        ctx.db.insert("expenseSplits", { ...s, expenseId, isPaid: false })
      )
    );
    return expenseId;
  },
});

export const importBatch = mutation({
  args: {
    groupId: v.id("groups"),
    importedBy: v.id("users"),
    expenses: v.array(v.object({
      description: v.string(),
      amount: v.number(),
      currency: v.string(),
      paidById: v.optional(v.id("users")),
      paidByName: v.optional(v.string()),
      splitType: v.union(
        v.literal("equal"),
        v.literal("unequal"),
        v.literal("percentage"),
        v.literal("share")
      ),
      date: v.number(),
      notes: v.optional(v.string()),
      isSettlement: v.boolean(),
      splits: v.array(v.object({
        userId: v.optional(v.id("users")),
        userName: v.string(),
        amount: v.number(),
        percentage: v.optional(v.number()),
        shares: v.optional(v.number()),
      })),
    })),
    batchId: v.string(),
  },
  handler: async (ctx, args) => {
    for (const expense of args.expenses) {
      const { splits, ...expenseData } = expense;
      const expenseId = await ctx.db.insert("expenses", {
        ...expenseData,
        groupId: args.groupId,
        createdBy: args.importedBy,
        createdAt: Date.now(),
        importBatchId: args.batchId,
        paidById: expenseData.paidById ?? args.importedBy,
      });
      for (const split of splits) {
        await ctx.db.insert("expenseSplits", { ...split, expenseId, isPaid: false });
      }
    }
  },
});

export const getGroupExpenses = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .order("desc")
      .collect();
    const withSplits = await Promise.all(
      expenses.map(async (e) => {
        const splits = await ctx.db
          .query("expenseSplits")
          .withIndex("by_expense", (q) => q.eq("expenseId", e._id))
          .collect();
        const paidBy = await ctx.db.get(e.paidById);
        return { ...e, splits, paidBy };
      })
    );
    return withSplits;
  },
});

export const deleteExpense = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const splits = await ctx.db
      .query("expenseSplits")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.expenseId))
      .collect();
    await Promise.all(splits.map((s) => ctx.db.delete(s._id)));
    await ctx.db.delete(args.expenseId);
  },
});
```

### `convex/settlements.ts`
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    groupId: v.id("groups"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    amount: v.number(),
    currency: v.string(),
    note: v.optional(v.string()),
    recordedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("settlements", { ...args, createdAt: Date.now() });
  },
});

export const getGroupSettlements = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settlements")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();
  },
});
```

### `convex/messages.ts`
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: {
    expenseId: v.id("expenses"),
    userId: v.id("users"),
    userName: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", { ...args, createdAt: Date.now() });
  },
});

export const getByExpense = query({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.expenseId))
      .order("asc")
      .collect();
  },
});
```

---

## STEP 4 — CSV VALIDATION ENGINE

Create `src/lib/csvValidator.ts`:

```typescript
import Papa from "papaparse";

export interface RawExpenseRow {
  date: string;
  description: string;
  paid_by: string;
  amount: string;
  currency: string;
  split_type: string;
  split_with: string;
  split_details: string;
  notes: string;
}

export type IssueSeverity = "error" | "warning";

export interface ValidationIssue {
  row: number;
  type: string;
  message: string;
  severity: IssueSeverity;
  field?: string;
}

export interface ValidatedRow {
  raw: RawExpenseRow;
  rowIndex: number;
  issues: ValidationIssue[];
  isSkipped: boolean; // has critical error
  parsed?: {
    date: Date;
    description: string;
    paidBy: string;
    amount: number;
    currency: string;
    splitType: "equal" | "unequal" | "percentage" | "share";
    splitWith: string[];
    splitDetails: Record<string, number>;
    notes: string;
    isSettlement: boolean;
  };
}

export interface ValidationReport {
  rows: ValidatedRow[];
  totalRows: number;
  cleanRows: number;
  skippedRows: number;
  warningRows: number;
  allIssues: ValidationIssue[];
  uniqueNames: string[];
  nameVariants: Record<string, string[]>; // canonical -> variants
  currencies: string[];
}

const KNOWN_DATE_FORMATS = [
  // ISO: 2026-02-01
  { regex: /^(\d{4})-(\d{2})-(\d{2})$/, parse: (m: RegExpMatchArray) => new Date(`${m[1]}-${m[2]}-${m[3]}`) },
  // DD/MM/YYYY: 01/03/2026
  { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, parse: (m: RegExpMatchArray) => new Date(`${m[3]}-${m[2]}-${m[1]}`) },
  // MM/DD/YYYY — ambiguous, flag it
  { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, parse: (m: RegExpMatchArray) => new Date(`${m[3]}-${m[1]}-${m[2]}`), ambiguous: true },
  // "Mar 14" partial
  { regex: /^([A-Za-z]{3})\s+(\d{1,2})$/, parse: (m: RegExpMatchArray) => new Date(`${m[1]} ${m[2]} 2026`) },
];

function parseDate(dateStr: string): { date: Date | null; ambiguous: boolean } {
  const s = dateStr.trim();
  // ISO
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { date: new Date(`${iso[1]}-${iso[2]}-${iso[3]}`), ambiguous: false };
  // DD/MM/YYYY
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1]), month = parseInt(dmy[2]);
    const ambiguous = day <= 12 && month <= 12;
    return { date: new Date(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`), ambiguous };
  }
  // Partial "Mar 14"
  const partial = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2})$/);
  if (partial) return { date: new Date(`${partial[1]} ${partial[2]} 2026`), ambiguous: false };
  return { date: null, ambiguous: false };
}

function parseAmount(amountStr: string): number | null {
  if (!amountStr) return null;
  const cleaned = amountStr.replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function detectNameVariants(names: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  const seen = new Set<string>();
  for (const name of names) {
    const norm = normalizeName(name);
    if (!groups[norm]) groups[norm] = [];
    if (!seen.has(name)) { groups[norm].push(name); seen.add(name); }
  }
  // Only return groups with more than 1 variant
  return Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length > 1));
}

function parseSplitType(s: string): "equal" | "unequal" | "percentage" | "share" | null {
  const t = s.trim().toLowerCase();
  if (t === "equal") return "equal";
  if (t === "unequal") return "unequal";
  if (t === "percentage") return "percentage";
  if (t === "share") return "share";
  return null;
}

export function validateCSV(csvText: string): ValidationReport {
  const { data, errors } = Papa.parse<RawExpenseRow>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/ /g, "_"),
  });

  const allNames: string[] = [];
  const allCurrencies: string[] = [];
  const seenDescriptionDatePayer = new Map<string, number>();

  const rows: ValidatedRow[] = data.map((raw, idx) => {
    const rowNum = idx + 2; // 1-indexed, accounting for header
    const issues: ValidationIssue[] = [];
    let isSkipped = false;

    // 1. Parse date
    const { date, ambiguous: dateAmbiguous } = parseDate(raw.date || "");
    if (!date || isNaN(date.getTime())) {
      issues.push({ row: rowNum, type: "INVALID_DATE", message: `Cannot parse date "${raw.date}"`, severity: "error", field: "date" });
      isSkipped = true;
    } else if (dateAmbiguous) {
      issues.push({ row: rowNum, type: "AMBIGUOUS_DATE", message: `Date "${raw.date}" is ambiguous (DD/MM or MM/DD?)`, severity: "warning", field: "date" });
    }

    // 2. Parse amount
    const amount = parseAmount(raw.amount);
    if (amount === null) {
      issues.push({ row: rowNum, type: "MISSING_AMOUNT", message: `Amount is missing or invalid`, severity: "error", field: "amount" });
      isSkipped = true;
    } else if (amount === 0) {
      issues.push({ row: rowNum, type: "ZERO_AMOUNT", message: `Amount is ₹0 — likely a duplicate correction`, severity: "error", field: "amount" });
      isSkipped = true;
    } else if (amount < 0) {
      issues.push({ row: rowNum, type: "NEGATIVE_AMOUNT", message: `Negative amount (${amount}) — treat as refund/credit`, severity: "warning", field: "amount" });
    }

    // 3. Missing paid_by
    if (!raw.paid_by || raw.paid_by.trim() === "") {
      issues.push({ row: rowNum, type: "MISSING_PAYER", message: `No payer specified — cannot assign debt`, severity: "error", field: "paid_by" });
      isSkipped = true;
    }

    // 4. Missing currency
    if (!raw.currency || raw.currency.trim() === "") {
      issues.push({ row: rowNum, type: "MISSING_CURRENCY", message: `Currency not specified`, severity: "error", field: "currency" });
      isSkipped = true;
    }

    // 5. Settlement disguised as expense
    const isSettlement =
      /\b(paid back|settlement|settled|repaid|repayment|returned)\b/i.test(raw.description || "") ||
      /this is a settlement/i.test(raw.notes || "");
    if (isSettlement) {
      issues.push({ row: rowNum, type: "IS_SETTLEMENT", message: `This looks like a settlement/payment, not an expense`, severity: "warning", field: "description" });
    }

    // 6. Duplicate detection (same description + date + payer)
    const dupKey = `${normalizeName(raw.description || "")}|${raw.date}|${normalizeName(raw.paid_by || "")}`;
    if (seenDescriptionDatePayer.has(dupKey)) {
      issues.push({
        row: rowNum,
        type: "DUPLICATE_EXPENSE",
        message: `Duplicate of row ${seenDescriptionDatePayer.get(dupKey)}: same description, date, and payer`,
        severity: "error",
        field: "description",
      });
      isSkipped = true;
    } else {
      seenDescriptionDatePayer.set(dupKey, rowNum);
    }

    // 7. Split type validation
    const splitType = parseSplitType(raw.split_type || "equal");
    if (!splitType) {
      issues.push({ row: rowNum, type: "INVALID_SPLIT_TYPE", message: `Unknown split type "${raw.split_type}"`, severity: "error", field: "split_type" });
    }

    // 8. Percentage validation
    if (splitType === "percentage" && raw.split_details) {
      const parts = raw.split_details.split(";").map((p) => p.trim());
      let total = 0;
      for (const part of parts) {
        const match = part.match(/[\d.]+%?$/);
        if (match) total += parseFloat(match[0]);
      }
      if (Math.abs(total - 100) > 1) {
        issues.push({ row: rowNum, type: "PERCENTAGE_MISMATCH", message: `Percentages sum to ${total.toFixed(1)}%, not 100%`, severity: "warning", field: "split_details" });
      }
    }

    // 9. Collect names for variant detection
    const payer = raw.paid_by?.trim();
    if (payer) allNames.push(payer);
    if (raw.split_with) {
      raw.split_with.split(";").forEach((n) => { if (n.trim()) allNames.push(n.trim()); });
    }

    // 10. Collect currencies
    if (raw.currency?.trim()) allCurrencies.push(raw.currency.trim());

    // 11. Build parsed output if no critical errors
    let parsed: ValidatedRow["parsed"] = undefined;
    if (!isSkipped && date && amount !== null && splitType) {
      const splitWith = (raw.split_with || "").split(";").map((s) => s.trim()).filter(Boolean);
      const splitDetails: Record<string, number> = {};
      if (raw.split_details) {
        raw.split_details.split(";").forEach((part) => {
          const m = part.trim().match(/^(.+?)\s+([\d.]+)%?$/);
          if (m) splitDetails[m[1].trim()] = parseFloat(m[2]);
        });
      }
      parsed = {
        date: date!,
        description: raw.description?.trim() || "",
        paidBy: payer || "",
        amount: amount!,
        currency: raw.currency?.trim() || "INR",
        splitType,
        splitWith,
        splitDetails,
        notes: raw.notes?.trim() || "",
        isSettlement,
      };
    }

    return { raw, rowIndex: rowNum, issues, isSkipped, parsed };
  });

  const nameVariants = detectNameVariants(allNames);
  const uniqueNames = [...new Set(allNames.map(normalizeName))];
  const currencies = [...new Set(allCurrencies)];

  const allIssues = rows.flatMap((r) => r.issues);
  const cleanRows = rows.filter((r) => !r.isSkipped && r.issues.length === 0).length;
  const skippedRows = rows.filter((r) => r.isSkipped).length;
  const warningRows = rows.filter((r) => !r.isSkipped && r.issues.some((i) => i.severity === "warning")).length;

  return {
    rows,
    totalRows: rows.length,
    cleanRows,
    skippedRows,
    warningRows,
    allIssues,
    uniqueNames,
    nameVariants,
    currencies,
  };
}
```

---

## STEP 5 — BALANCE CALCULATION ENGINE

Create `src/lib/balances.ts`:

```typescript
export interface BalanceEntry {
  fromUser: string;
  toUser: string;
  amount: number;
  currency: string;
}

export interface UserBalance {
  userId: string;
  userName: string;
  netBalance: number; // positive = owed money, negative = owes money
  owes: { to: string; amount: number; currency: string }[];
  isOwed: { from: string; amount: number; currency: string }[];
}

export function calculateBalances(
  expenses: Array<{
    paidById: string;
    paidByName?: string | null;
    amount: number;
    currency: string;
    isSettlement: boolean;
    splits: Array<{ userId?: string | null; userName: string; amount: number }>;
  }>,
  settlements: Array<{
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
  }>,
  userMap: Record<string, string> // userId -> userName
): Record<string, Record<string, number>> {
  // balances[A][B] = amount A owes B (positive), A is owed by B (negative)
  const balances: Record<string, Record<string, number>> = {};

  const ensure = (a: string, b: string) => {
    if (!balances[a]) balances[a] = {};
    if (!balances[a][b]) balances[a][b] = 0;
  };

  for (const expense of expenses) {
    if (expense.isSettlement) continue;
    const payer = expense.paidById;
    for (const split of expense.splits) {
      if (!split.userId || split.userId === payer) continue;
      ensure(split.userId, payer);
      ensure(payer, split.userId);
      balances[split.userId][payer] += split.amount;
      balances[payer][split.userId] -= split.amount;
    }
  }

  for (const s of settlements) {
    ensure(s.fromUserId, s.toUserId);
    ensure(s.toUserId, s.fromUserId);
    balances[s.fromUserId][s.toUserId] -= s.amount;
    balances[s.toUserId][s.fromUserId] += s.amount;
  }

  return balances;
}

// Simplify debts — reduce N*(N-1) transactions to minimum
export function simplifyDebts(
  balances: Record<string, Record<string, number>>
): BalanceEntry[] {
  const net: Record<string, number> = {};
  for (const [from, tos] of Object.entries(balances)) {
    for (const [to, amount] of Object.entries(tos)) {
      if (amount > 0) {
        net[from] = (net[from] || 0) - amount;
        net[to] = (net[to] || 0) + amount;
      }
    }
  }

  const creditors = Object.entries(net).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const debtors = Object.entries(net).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const result: BalanceEntry[] = [];

  let ci = 0, di = 0;
  const cred = creditors.map(([id, amt]) => ({ id, amt }));
  const debt = debtors.map(([id, amt]) => ({ id, amt: -amt }));

  while (ci < cred.length && di < debt.length) {
    const settle = Math.min(cred[ci].amt, debt[di].amt);
    result.push({ fromUser: debt[di].id, toUser: cred[ci].id, amount: Math.round(settle * 100) / 100, currency: "INR" });
    cred[ci].amt -= settle;
    debt[di].amt -= settle;
    if (cred[ci].amt < 0.01) ci++;
    if (debt[di].amt < 0.01) di++;
  }

  return result;
}
```

---

## STEP 6 — APP LAYOUT & AUTH [AUTH PAGES COMPLETED]

### `src/app/layout.tsx`
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SplitSmart — Smart Expense Splitting",
  description: "Split expenses fairly with intelligent CSV import and real-time balances",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClerkProvider>
          <ConvexClientProvider>
            {children}
            <Toaster />
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
```

### `src/components/ConvexClientProvider.tsx`
```tsx
"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

### `src/app/page.tsx` — Landing page
```tsx
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center px-6">
        <div className="mb-6 text-6xl">💰</div>
        <h1 className="text-5xl font-bold text-gray-900 mb-4">SplitSmart</h1>
        <p className="text-xl text-gray-600 mb-3">
          The smarter way to split expenses.
        </p>
        <p className="text-gray-500 mb-10">
          Import messy CSVs, detect data issues automatically, and keep everyone's balances crystal clear.
        </p>
        <div className="flex gap-4 justify-center">
          <SignUpButton mode="modal">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8">Get started free</Button>
          </SignUpButton>
          <SignInButton mode="modal">
            <Button size="lg" variant="outline" className="px-8">Sign in</Button>
          </SignInButton>
        </div>
        <div className="mt-16 grid grid-cols-3 gap-6 text-sm text-gray-500">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl mb-2">🔍</div>
            <div className="font-medium text-gray-700">Smart CSV Import</div>
            <div>Detects 8+ types of data issues before they corrupt your books</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl mb-2">⚡</div>
            <div className="font-medium text-gray-700">Real-time balances</div>
            <div>Instant updates across all group members</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl mb-2">🤖</div>
            <div className="font-medium text-gray-700">AI summaries</div>
            <div>Plain-English breakdown of what you owe and why</div>
          </div>
        </div>
      </div>
    </main>
  );
}
```

### `src/app/sign-in/[[...sign-in]]/page.tsx`
```tsx
import { SignIn } from "@clerk/nextjs";
export default function Page() {
  return <div className="min-h-screen flex items-center justify-center"><SignIn /></div>;
}
```

### `src/app/sign-up/[[...sign-up]]/page.tsx`
```tsx
import { SignUp } from "@clerk/nextjs";
export default function Page() {
  return <div className="min-h-screen flex items-center justify-center"><SignUp /></div>;
}
```

### `src/middleware.ts`
```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);
export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) auth().protect();
});
export const config = { matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"] };
```

---

## STEP 7 — USER SYNC HOOK

Create `src/hooks/useCurrentUser.ts`:
```typescript
"use client";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";

export function useCurrentUser() {
  const { user, isLoaded } = useUser();
  const upsertUser = useMutation(api.users.upsertUser);
  const convexUser = useQuery(
    api.users.getByClerkId,
    user ? { clerkId: user.id } : "skip"
  );

  useEffect(() => {
    if (user) {
      upsertUser({
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress || "",
        name: user.fullName || user.firstName || "User",
        avatarUrl: user.imageUrl,
      });
    }
  }, [user, upsertUser]);

  return { user, convexUser, isLoaded };
}
```

---

## STEP 8 — DASHBOARD

### `src/app/dashboard/layout.tsx`
```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/");
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
```

### `src/components/DashboardNav.tsx`
```tsx
"use client";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function DashboardNav() {
  const path = usePathname();
  return (
    <nav className="bg-white border-b px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-xl text-emerald-700">💰 SplitSmart</Link>
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className={cn("text-sm font-medium", path === "/dashboard" ? "text-emerald-700" : "text-gray-600 hover:text-gray-900")}>Dashboard</Link>
          <Link href="/dashboard/groups" className={cn("text-sm font-medium", path.startsWith("/dashboard/groups") ? "text-emerald-700" : "text-gray-600 hover:text-gray-900")}>Groups</Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </nav>
  );
}
```

### `src/app/dashboard/page.tsx`
```tsx
"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Dashboard() {
  const { convexUser } = useCurrentUser();
  const groups = useQuery(api.groups.getUserGroups, convexUser ? { userId: convexUser._id } : "skip");

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back{convexUser ? `, ${convexUser.name.split(" ")[0]}` : ""}!</h1>
          <p className="text-gray-500 mt-1">Here's an overview of your shared expenses.</p>
        </div>
        <Link href="/dashboard/groups/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700">+ New Group</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Groups</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{groups?.length || 0}</div></CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-4">Your Groups</h2>
      {!groups || groups.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <div className="text-4xl mb-4">🏘️</div>
            <p className="text-gray-500 mb-4">No groups yet. Create one to start splitting expenses.</p>
            <Link href="/dashboard/groups/new"><Button className="bg-emerald-600 hover:bg-emerald-700">Create your first group</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => g && (
            <Link key={g._id} href={`/dashboard/groups/${g._id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-base">{g.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">{g.description || "No description"}</p>
                  <p className="text-xs text-gray-400 mt-2">Currency: {g.currency}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## STEP 9 — GROUP PAGES

### `src/app/dashboard/groups/new/page.tsx`
```tsx
"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function NewGroup() {
  const { convexUser } = useCurrentUser();
  const createGroup = useMutation(api.groups.create);
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convexUser || !name.trim()) return;
    setLoading(true);
    try {
      const id = await createGroup({ name: name.trim(), description, createdBy: convexUser._id, currency });
      toast({ title: "Group created!" });
      router.push(`/dashboard/groups/${id}`);
    } catch (err) {
      toast({ title: "Error creating group", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create a new group</h1>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Group name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flat 3B Roommates" required />
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <Label htmlFor="currency">Default currency</Label>
              <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="INR">INR — Indian Rupee</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
              </select>
            </div>
            <Button type="submit" disabled={loading || !name.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {loading ? "Creating..." : "Create group"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### `src/app/dashboard/groups/[groupId]/page.tsx`
```tsx
"use client";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpenseList } from "@/components/ExpenseList";
import { BalanceSummary } from "@/components/BalanceSummary";
import { MembersList } from "@/components/MembersList";
import { CSVImportWizard } from "@/components/CSVImportWizard";
import { Id } from "../../../../../convex/_generated/dataModel";

export default function GroupPage({ params }: { params: { groupId: string } }) {
  const groupId = params.groupId as Id<"groups">;
  const group = useQuery(api.groups.getGroup, { groupId });
  const { convexUser } = useCurrentUser();

  if (!group) return <div className="text-center py-16 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
        {group.description && <p className="text-gray-500 mt-1">{group.description}</p>}
      </div>

      <Tabs defaultValue="expenses">
        <TabsList className="mb-6">
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="import">Import CSV</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <ExpenseList groupId={groupId} currentUser={convexUser} />
        </TabsContent>
        <TabsContent value="balances">
          <BalanceSummary groupId={groupId} currentUser={convexUser} />
        </TabsContent>
        <TabsContent value="import">
          <CSVImportWizard groupId={groupId} currentUser={convexUser} />
        </TabsContent>
        <TabsContent value="members">
          <MembersList groupId={groupId} currentUser={convexUser} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## STEP 10 — CSV IMPORT WIZARD COMPONENT

Create `src/components/CSVImportWizard.tsx`:

```tsx
"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { validateCSV, ValidationReport, ValidatedRow } from "@/lib/csvValidator";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";

// Install react-dropzone: npm install react-dropzone
// If not installed, replace dropzone with a plain <input type="file"> handler

interface Props {
  groupId: Id<"groups">;
  currentUser: any;
}

type Step = "upload" | "validate" | "map" | "import" | "done";

export function CSVImportWizard({ groupId, currentUser }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();
  const allUsers = useQuery(api.users.getAllUsers);
  const importBatch = useMutation(api.expenses.importBatch);

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      const result = validateCSV(text);
      setReport(result);
      setStep("validate");
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
  });

  const handleImport = async () => {
    if (!report || !currentUser) return;
    setImporting(true);
    try {
      const cleanRows = report.rows.filter((r) => !r.isSkipped && r.parsed);
      const batchId = `batch_${Date.now()}`;

      const expensesToImport = cleanRows.map((row) => {
        const p = row.parsed!;
        const splitWith = p.splitWith.length > 0 ? p.splitWith : [p.paidBy];
        const perPerson = p.amount / splitWith.length;
        const splits = splitWith.map((name) => ({
          userName: name,
          amount: p.splitType === "equal" ? Math.round(perPerson * 100) / 100 :
            p.splitType === "percentage" ? Math.round((p.splitDetails[name] || 0) / 100 * p.amount * 100) / 100 :
            p.splitType === "share" ? (() => {
              const totalShares = Object.values(p.splitDetails).reduce((a, b) => a + b, 0);
              return Math.round((p.splitDetails[name] || 1) / totalShares * p.amount * 100) / 100;
            })() :
            p.splitDetails[name] || perPerson,
          percentage: p.splitType === "percentage" ? p.splitDetails[name] : undefined,
          shares: p.splitType === "share" ? p.splitDetails[name] : undefined,
        }));

        return {
          description: p.description,
          amount: p.amount,
          currency: p.currency,
          paidByName: p.paidBy,
          splitType: p.splitType,
          date: p.date.getTime(),
          notes: p.notes || undefined,
          isSettlement: p.isSettlement,
          splits,
        };
      });

      await importBatch({ groupId, importedBy: currentUser._id, expenses: expensesToImport as any, batchId });
      setStep("done");
      toast({ title: `✅ Imported ${expensesToImport.length} expenses successfully!` });
    } catch (err) {
      toast({ title: "Import failed", description: String(err), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  if (step === "upload") {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Import expenses from CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${isDragActive ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-emerald-300"}`}
            >
              <input {...getInputProps()} />
              <div className="text-4xl mb-4">📄</div>
              <p className="text-gray-700 font-medium">Drop your CSV file here</p>
              <p className="text-gray-400 text-sm mt-2">or click to browse</p>
              <p className="text-xs text-gray-400 mt-4">Expected columns: date, description, paid_by, amount, currency, split_type, split_with, split_details, notes</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "validate" && report) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Data Quality Report — {fileName}</h2>
          <Button variant="outline" onClick={() => setStep("upload")}>← Upload different file</Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-gray-800">{report.totalRows}</div>
            <div className="text-sm text-gray-500">Total rows</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-emerald-600">{report.cleanRows}</div>
            <div className="text-sm text-gray-500">Clean rows</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-amber-500">{report.warningRows}</div>
            <div className="text-sm text-gray-500">Warnings</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-red-500">{report.skippedRows}</div>
            <div className="text-sm text-gray-500">Skipped (errors)</div>
          </CardContent></Card>
        </div>

        {/* Name variants */}
        {Object.keys(report.nameVariants).length > 0 && (
          <Alert>
            <AlertDescription>
              <strong>⚠️ Name inconsistencies detected:</strong>
              <ul className="mt-2 space-y-1">
                {Object.entries(report.nameVariants).map(([canonical, variants]) => (
                  <li key={canonical} className="text-sm">
                    <span className="font-mono bg-gray-100 px-1 rounded">{variants.join(" / ")}</span>
                    {" "}— treated as the same person
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Currency warnings */}
        {report.currencies.length > 1 && (
          <Alert>
            <AlertDescription>
              <strong>💱 Multiple currencies found:</strong> {report.currencies.join(", ")}. Balances in different currencies are shown separately.
            </AlertDescription>
          </Alert>
        )}

        {/* Issues table */}
        <Card>
          <CardHeader><CardTitle className="text-base">All issues found ({report.allIssues.length})</CardTitle></CardHeader>
          <CardContent>
            {report.allIssues.length === 0 ? (
              <p className="text-emerald-600 font-medium">🎉 No issues found! All rows are clean.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {report.allIssues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm py-2 border-b last:border-0">
                    <Badge variant={issue.severity === "error" ? "destructive" : "secondary"} className="shrink-0 mt-0.5">
                      Row {issue.row}
                    </Badge>
                    <div>
                      <span className="font-medium">{issue.type.replace(/_/g, " ")}</span>
                      <span className="text-gray-500 ml-2">{issue.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Row preview */}
        <Card>
          <CardHeader><CardTitle className="text-base">Row preview</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-4">Row</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Description</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.rowIndex} className={`border-b ${row.isSkipped ? "bg-red-50" : row.issues.length > 0 ? "bg-amber-50" : ""}`}>
                      <td className="py-2 pr-4 text-gray-400">{row.rowIndex}</td>
                      <td className="py-2 pr-4">
                        {row.isSkipped ? <Badge variant="destructive">Skipped</Badge> :
                          row.issues.length > 0 ? <Badge variant="secondary">Warning</Badge> :
                          <Badge className="bg-emerald-100 text-emerald-700">Clean</Badge>}
                      </td>
                      <td className="py-2 pr-4">{row.raw.date}</td>
                      <td className="py-2 pr-4 max-w-xs truncate">{row.raw.description}</td>
                      <td className="py-2 pr-4">{row.raw.amount} {row.raw.currency}</td>
                      <td className="py-2 text-xs text-gray-500">
                        {row.issues.map((i) => i.type).join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            onClick={handleImport}
            disabled={importing || report.cleanRows === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {importing ? "Importing..." : `Import ${report.cleanRows + report.warningRows} rows (skip ${report.skippedRows} errors)`}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <Card className="max-w-lg mx-auto text-center py-16">
        <CardContent>
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-2">Import complete!</h2>
          <p className="text-gray-500 mb-6">Your expenses have been imported and balances updated.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setStep("upload")} variant="outline">Import another file</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
```

Run: `npm install react-dropzone`

---

## STEP 11 — EXPENSE LIST COMPONENT

Create `src/components/ExpenseList.tsx`:

```tsx
"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { ExpenseChatDrawer } from "./ExpenseChatDrawer";
import { useToast } from "@/components/ui/use-toast";

interface Props { groupId: Id<"groups">; currentUser: any; }

export function ExpenseList({ groupId, currentUser }: Props) {
  const expenses = useQuery(api.expenses.getGroupExpenses, { groupId });
  const deleteExpense = useMutation(api.expenses.deleteExpense);
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [chatExpenseId, setChatExpenseId] = useState<Id<"expenses"> | null>(null);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Expenses</h2>
        <Button onClick={() => setAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">+ Add expense</Button>
      </div>

      {addOpen && <AddExpenseDialog groupId={groupId} currentUser={currentUser} onClose={() => setAddOpen(false)} />}
      {chatExpenseId && <ExpenseChatDrawer expenseId={chatExpenseId} currentUser={currentUser} onClose={() => setChatExpenseId(null)} />}

      <div className="space-y-3">
        {!expenses || expenses.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent><p className="text-gray-500">No expenses yet. Add one or import a CSV.</p></CardContent>
          </Card>
        ) : (
          expenses.map((expense) => (
            <Card key={expense._id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                      {expense.description.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{expense.description}</div>
                      <div className="text-sm text-gray-500">
                        Paid by {expense.paidBy?.name || expense.paidByName || "Unknown"} · {new Date(expense.date).toLocaleDateString("en-IN")}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{expense.splitType}</Badge>
                        {expense.isSettlement && <Badge className="text-xs bg-blue-100 text-blue-700">Settlement</Badge>}
                        {expense.importBatchId && <Badge className="text-xs bg-gray-100 text-gray-600">Imported</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">{formatAmount(expense.amount, expense.currency)}</div>
                      <div className="text-xs text-gray-400">{expense.splits.length} people</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setChatExpenseId(expense._id)}>💬</Button>
                    {currentUser && expense.paidById === currentUser._id && (
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                        onClick={async () => { await deleteExpense({ expenseId: expense._id }); toast({ title: "Expense deleted" }); }}>🗑</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
```

---

## STEP 12 — BALANCE SUMMARY WITH AI

Create `src/components/BalanceSummary.tsx`:

```tsx
"use client";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { calculateBalances, simplifyDebts } from "@/lib/balances";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { RecordSettlementDialog } from "./RecordSettlementDialog";

interface Props { groupId: Id<"groups">; currentUser: any; }

export function BalanceSummary({ groupId, currentUser }: Props) {
  const expenses = useQuery(api.expenses.getGroupExpenses, { groupId });
  const settlements = useQuery(api.settlements.getGroupSettlements, { groupId });
  const members = useQuery(api.groups.getGroupMembers, { groupId });
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [settleDialog, setSettleDialog] = useState<{ from: string; to: string; amount: number } | null>(null);

  if (!expenses || !settlements || !members) return <p className="text-gray-500">Loading balances...</p>;

  const userMap = Object.fromEntries(members.map((m) => [m.userId, m.user?.name || "Unknown"]));
  const balances = calculateBalances(expenses as any, settlements as any, userMap);
  const simplified = simplifyDebts(balances);

  const getAISummary = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simplified, userMap, expenses: expenses.slice(0, 20) }),
      });
      const data = await res.json();
      setAiSummary(data.summary);
    } catch {
      setAiSummary("Unable to generate AI summary at this time.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {settleDialog && currentUser && (
        <RecordSettlementDialog
          groupId={groupId}
          currentUser={currentUser}
          defaultFrom={settleDialog.from}
          defaultTo={settleDialog.to}
          defaultAmount={settleDialog.amount}
          members={members}
          onClose={() => setSettleDialog(null)}
        />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Who owes whom</CardTitle>
          <Button variant="outline" size="sm" onClick={getAISummary} disabled={aiLoading}>
            {aiLoading ? "Thinking..." : "🤖 Explain my balances"}
          </Button>
        </CardHeader>
        <CardContent>
          {aiSummary && (
            <div className="mb-6 bg-emerald-50 rounded-lg p-4 text-sm text-emerald-900 border border-emerald-200">
              <div className="font-medium mb-1">🤖 AI Summary</div>
              {aiSummary}
            </div>
          )}
          {simplified.length === 0 ? (
            <p className="text-emerald-600 font-medium text-center py-8">🎉 All settled up!</p>
          ) : (
            <div className="space-y-3">
              {simplified.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="font-medium">{userMap[b.fromUser] || b.fromUser}</div>
                    <div className="text-gray-400 text-sm">→ owes →</div>
                    <div className="font-medium">{userMap[b.toUser] || b.toUser}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-semibold text-red-600">
                      {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(b.amount)}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setSettleDialog({ from: b.fromUser, to: b.toUser, amount: b.amount })}>
                      Record payment
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## STEP 13 — AI SUMMARY API ROUTE

Create `src/app/api/ai-summary/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { simplified, userMap, expenses } = await req.json();

    const balanceLines = simplified.map((b: any) =>
      `${userMap[b.fromUser] || b.fromUser} owes ${userMap[b.toUser] || b.toUser}: ₹${b.amount.toFixed(0)}`
    ).join("\n");

    const recentExpenses = expenses.slice(0, 10).map((e: any) =>
      `- ${e.description} (₹${e.amount}, paid by ${e.paidBy?.name || "unknown"})`
    ).join("\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `You are a friendly expense tracking assistant. Summarize these group balances in 3-4 plain English sentences. Be specific about amounts and reasons. Do not use bullet points.

Current balances:
${balanceLines || "Everyone is settled up."}

Recent expenses:
${recentExpenses}

Write a concise, friendly summary explaining the main debts and roughly why they exist.`
      }],
    });

    const summary = (message.content[0] as any).text;
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ summary: "Unable to generate summary." }, { status: 500 });
  }
}
```

---

## STEP 14 — REMAINING COMPONENTS

### `src/components/AddExpenseDialog.tsx`
```tsx
"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface Props { groupId: Id<"groups">; currentUser: any; onClose: () => void; }

export function AddExpenseDialog({ groupId, currentUser, onClose }: Props) {
  const members = useQuery(api.groups.getGroupMembers, { groupId });
  const createExpense = useMutation(api.expenses.create);
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [splitType, setSplitType] = useState<"equal" | "unequal" | "percentage" | "share">("equal");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !members) return;
    setLoading(true);
    try {
      const amt = parseFloat(amount);
      const perPerson = amt / members.length;
      const splits = members.map((m) => ({
        userId: m.userId,
        userName: m.user?.name || "Unknown",
        amount: Math.round(perPerson * 100) / 100,
      }));
      await createExpense({
        groupId,
        description,
        amount: amt,
        currency,
        paidById: currentUser._id,
        splitType,
        date: Date.now(),
        isSettlement: false,
        createdBy: currentUser._id,
        splits,
      });
      toast({ title: "Expense added!" });
      onClose();
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?" required /></div>
          <div className="flex gap-3">
            <div className="flex-1"><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="0.01" step="0.01" required /></div>
            <div><Label>Currency</Label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-9 border rounded-md px-3 text-sm mt-1">
                <option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div><Label>Split type</Label>
            <select value={splitType} onChange={(e) => setSplitType(e.target.value as any)} className="w-full h-9 border rounded-md px-3 text-sm mt-1">
              <option value="equal">Equal split</option>
              <option value="unequal">Unequal amounts</option>
              <option value="percentage">By percentage</option>
              <option value="share">By share</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">{loading ? "Adding..." : "Add expense"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### `src/components/ExpenseChatDrawer.tsx`
```tsx
"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props { expenseId: Id<"expenses">; currentUser: any; onClose: () => void; }

export function ExpenseChatDrawer({ expenseId, currentUser, onClose }: Props) {
  const messages = useQuery(api.messages.getByExpense, { expenseId });
  const sendMessage = useMutation(api.messages.send);
  const [text, setText] = useState("");

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !currentUser) return;
    await sendMessage({ expenseId, userId: currentUser._id, userName: currentUser.name, text: text.trim() });
    setText("");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>💬 Expense chat</DialogTitle></DialogHeader>
        <div className="h-64 overflow-y-auto space-y-3 border rounded-lg p-3 bg-gray-50">
          {!messages || messages.length === 0 ? (
            <p className="text-gray-400 text-sm text-center pt-8">No messages yet. Start the conversation!</p>
          ) : messages.map((m) => (
            <div key={m._id} className={`flex ${m.userId === currentUser?._id ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs rounded-lg px-3 py-2 text-sm ${m.userId === currentUser?._id ? "bg-emerald-600 text-white" : "bg-white border text-gray-800"}`}>
                {m.userId !== currentUser?._id && <div className="text-xs font-medium text-gray-500 mb-1">{m.userName}</div>}
                {m.text}
                <div className={`text-xs mt-1 ${m.userId === currentUser?._id ? "text-emerald-100" : "text-gray-400"}`}>
                  {new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleSend} className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message..." />
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Send</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### `src/components/MembersList.tsx`
```tsx
"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";

interface Props { groupId: Id<"groups">; currentUser: any; }

export function MembersList({ groupId, currentUser }: Props) {
  const members = useQuery(api.groups.getGroupMembers, { groupId });
  const addMember = useMutation(api.groups.addMember);
  const removeMember = useMutation(api.groups.removeMember);
  const searchUser = useQuery(api.users.searchByEmail, { email: "" });
  const [email, setEmail] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const { toast } = useToast();
  const foundUser = useQuery(api.users.searchByEmail, searchEmail ? { email: searchEmail } : "skip");

  const handleAdd = async () => {
    if (!foundUser) { toast({ title: "User not found", variant: "destructive" }); return; }
    await addMember({ groupId, userId: foundUser._id });
    toast({ title: `${foundUser.name} added to group!` });
    setEmail(""); setSearchEmail("");
  };

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader><CardTitle>Members ({members?.length || 0})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {members?.map((m) => m.user && (
            <div key={m._id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9">
                  <AvatarImage src={m.user.avatarUrl} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm">{m.user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-sm">{m.user.name}</div>
                  <div className="text-xs text-gray-400">{m.user.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 capitalize">{m.role}</span>
                {m.userId !== currentUser?._id && (
                  <Button size="sm" variant="ghost" className="text-red-500 text-xs"
                    onClick={() => removeMember({ groupId, userId: m.userId })}>Remove</Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Add member by email</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com"
              onKeyDown={(e) => e.key === "Enter" && setSearchEmail(email)} />
            <Button onClick={() => setSearchEmail(email)} variant="outline">Search</Button>
          </div>
          {foundUser && (
            <div className="mt-3 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium text-sm">{foundUser.name}</div>
                <div className="text-xs text-gray-400">{foundUser.email}</div>
              </div>
              <Button onClick={handleAdd} size="sm" className="bg-emerald-600 hover:bg-emerald-700">Add to group</Button>
            </div>
          )}
          {searchEmail && !foundUser && <p className="text-sm text-gray-500 mt-2">No user found with that email.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
```

### `src/components/RecordSettlementDialog.tsx`
```tsx
"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  groupId: Id<"groups">; currentUser: any;
  defaultFrom: string; defaultTo: string; defaultAmount: number;
  members: any[]; onClose: () => void;
}

export function RecordSettlementDialog({ groupId, currentUser, defaultFrom, defaultTo, defaultAmount, members, onClose }: Props) {
  const recordSettlement = useMutation(api.settlements.record);
  const [amount, setAmount] = useState(defaultAmount.toFixed(0));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fromUser = members.find((m) => m.userId === defaultFrom);
  const toUser = members.find((m) => m.userId === defaultTo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await recordSettlement({
        groupId,
        fromUserId: defaultFrom as Id<"users">,
        toUserId: defaultTo as Id<"users">,
        amount: parseFloat(amount),
        currency: "INR",
        note: note || undefined,
        recordedBy: currentUser._id,
      });
      toast({ title: "Settlement recorded!" });
      onClose();
    } catch (err) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-600">
            <strong>{fromUser?.user?.name || defaultFrom}</strong> pays <strong>{toUser?.user?.name || defaultTo}</strong>
          </p>
          <div><Label>Amount (INR)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="1" step="1" required /></div>
          <div><Label>Note (optional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. via UPI" /></div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">{loading ? "Recording..." : "Record payment"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## STEP 15 — AI_CONTEXT.md (REQUIRED DELIVERABLE)

Create `AI_CONTEXT.md` in the root:

```markdown
# AI_CONTEXT.md — SplitSmart

## Product understanding
SplitSmart is a Splitwise-inspired expense splitting application built for an internship assignment. The core differentiator is a Smart CSV Import Engine that validates real-world messy expense data (like the provided expenses_export.csv) before importing, detecting 8+ categories of data issues including duplicates, settlements disguised as expenses, missing payers, name inconsistencies, invalid date formats, percentage mismatches, zero-amount rows, and negative amounts.

## Product scope
- Login/signup with Clerk (email + Google OAuth)
- Create and manage groups (invite/remove members)
- Add expenses manually (equal, unequal, percentage, share splits)
- Smart CSV import with pre-import validation report
- Real-time expense chat per expense
- Group-wise and individual balance summaries
- Settle debts / record payments
- AI-powered plain-English balance explanations via Claude API

## Out of scope (explicitly excluded)
- Push notifications
- Email invites (users must already be registered)
- Currency conversion (multi-currency balances shown separately)
- Mobile app
- Recurring expenses

## Tech stack
- Next.js 14 (App Router, TypeScript strict)
- Clerk: authentication
- Convex: real-time backend database (PostgreSQL-style relational schema with indexes)
- shadcn/ui + Tailwind CSS: UI components
- Anthropic claude-sonnet-4-6: AI balance summaries
- papaparse: CSV parsing
- react-dropzone: file upload UX
- Vercel: deployment

## Database schema (Convex)
Tables: users, groups, groupMembers, expenses, expenseSplits, settlements, messages, importBatches

Key relationships:
- users ←→ groups via groupMembers (many-to-many)
- expenses belong to groups, have a paidBy user
- expenseSplits belong to expenses, reference users
- settlements belong to groups, reference fromUser and toUser
- messages belong to expenses (real-time chat)
- importBatches track CSV import history

## API design
All data access via Convex queries and mutations (no REST API).
Exception: /api/ai-summary (Next.js route handler, calls Anthropic API server-side)

## CSV Validation engine
File: src/lib/csvValidator.ts
Detects:
1. DUPLICATE_EXPENSE — same description + date + payer
2. IS_SETTLEMENT — keywords in description/notes
3. MISSING_PAYER — empty paid_by field
4. MISSING_CURRENCY — empty currency field
5. ZERO_AMOUNT — ₹0 entries
6. NEGATIVE_AMOUNT — refunds (flagged as warnings, not errors)
7. INVALID_DATE — unparseable date strings
8. AMBIGUOUS_DATE — DD/MM vs MM/DD ambiguity
9. PERCENTAGE_MISMATCH — percentages don't sum to 100%
10. NAME_VARIANTS — case/spacing inconsistencies across paid_by and split_with fields

Severity levels: "error" (row skipped) vs "warning" (row imported with flag)

## Balance calculation
File: src/lib/balances.ts
Algorithm:
1. For each expense: payer is owed money by each split participant
2. For each settlement: reduce the corresponding debt
3. Debt simplification: net each person's balance, then greedily match creditors to debtors

## Frontend structure
src/app/
  page.tsx — Landing
  sign-in/, sign-up/ — Clerk auth pages
  dashboard/
    page.tsx — Dashboard with group list
    groups/
      new/page.tsx — Create group
      [groupId]/page.tsx — Group detail with tabs

src/components/
  CSVImportWizard.tsx — 3-step import flow (upload → validate → import)
  ExpenseList.tsx — Expense table with delete and chat
  BalanceSummary.tsx — Simplified debts + AI explain button
  MembersList.tsx — Add/remove members by email
  AddExpenseDialog.tsx — Manual expense entry
  ExpenseChatDrawer.tsx — Real-time chat per expense
  RecordSettlementDialog.tsx — Record payment between users
  DashboardNav.tsx — Top navigation
  ConvexClientProvider.tsx — Convex context wrapper

## Deployment
- Convex: `npx convex deploy` (creates production deployment)
- Vercel: connect GitHub repo, add all env vars, auto-deploys on push

## Known limitations
- No currency conversion: USD and INR balances are tracked separately
- External members (e.g. "Dev's friend Kabir") imported from CSV are stored by name only, not linked to a user account
- Settlement matching in CSV is heuristic (keyword-based), not guaranteed
- Equal split is the default for CSV imports; unequal/percentage/share splits are calculated from split_details column

## Key engineering decisions
- Convex chosen for real-time chat without WebSocket boilerplate
- Debt simplification algorithm reduces O(N²) transactions to minimum O(N) settlements
- CSV validation runs entirely client-side before any server calls
- AI summary is server-side to protect ANTHROPIC_API_KEY
```

---

## STEP 16 — BUILD_PLAN.md (REQUIRED DELIVERABLE)

Create `BUILD_PLAN.md` in the root:

```markdown
# BUILD_PLAN.md — SplitSmart

## 1. Product research
- Studied Splitwise app: core workflows are expense entry, split calculation, balance tracking, and settlement
- Identified the provided expenses_export.csv as intentionally containing data quality issues (duplicates, mixed date formats, missing fields, settlements disguised as expenses)
- Key insight: the assignment tests whether the candidate can detect data integrity issues, not just build a CRUD form

## 2. Architecture
- Next.js App Router for full-stack TypeScript
- Convex for real-time backend (no Express/PostgreSQL setup overhead)
- Clerk for auth (no JWT implementation overhead)
- shadcn/ui for production-quality UI in minimal time

## 3. AI collaboration process
- Used Claude as primary development collaborator
- Claude first analyzed the CSV file to enumerate all data quality issues before any code was written
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
```

---

## STEP 17 — FINAL SETUP & DEPLOY

```bash
# 1. Install missing dependency
pnpm install react-dropzone

# 2. Start Convex dev server (in separate terminal)
npx convex dev

# 3. Run Next.js dev server
pnpm dev

# 4. Test locally at http://localhost:3000

# 5. Deploy Convex to production
npx convex deploy

# 6. Push to GitHub
git init
git add .
git commit -m "feat: SplitSmart — Splitwise clone with smart CSV importer"
git remote add origin https://github.com/YOUR_USERNAME/splitsmart.git
git push -u origin main

# 7. Deploy to Vercel
# Go to vercel.com → New Project → Import from GitHub
# Add these environment variables in Vercel dashboard:
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# CLERK_SECRET_KEY
# NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
# NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
# NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
# NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
# NEXT_PUBLIC_CONVEX_URL (from npx convex deploy output)
# ANTHROPIC_API_KEY
```

---

## IMPORTANT NOTES FOR THE AGENT

1. Do not skip any step. Execute in exact order 1 → 17.
2. After creating each file, verify it compiles with no TypeScript errors before moving to the next step.
3. If a shadcn component isn't installed, run `npx shadcn@latest add [component-name]` before using it.
4. The Convex schema must be deployed (`npx convex dev`) before any Convex queries/mutations will work.
5. The `convex/_generated/` folder is auto-generated by Convex — do not create it manually.
6. For the `useDropzone` import to work, `react-dropzone` must be installed (Step 17).
7. If TypeScript complains about Convex Id types, import from `"../../convex/_generated/dataModel"`.
8. All `"use client"` directives must be at the very top of the file, before any imports.
9. The AI summary route at `src/app/api/ai-summary/route.ts` requires `ANTHROPIC_API_KEY` in `.env.local`.
10. Test the CSV import with the provided `expenses_export.csv` — it should detect exactly 8 critical errors and 5 warnings.