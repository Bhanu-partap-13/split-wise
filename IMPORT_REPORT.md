# Import Report — SplitSmart CSV Validation Engine

This document describes the format and content of the import report produced by SplitSmart when it ingests a CSV or Excel file through the Smart CSV Import Wizard.

---

## How the Report Is Produced

The import report is generated **client-side** by `src/lib/csvValidator.ts` before any data is written to the database.

**Entry points:**
- `validateCSV(csvText: string): ValidationReport` — for `.csv` files
- `validateExcel(buffer: ArrayBuffer): Promise<ValidationReport>` — for `.xlsx` / `.xls` files

Both functions use the same core `validateRows()` engine and return an identical `ValidationReport` object.

---

## Report Structure (`ValidationReport`)

```typescript
interface ValidationReport {
  rows: ValidatedRow[];          // One entry per data row in the CSV
  detectedHeaders: string[];     // Original column headers from the file
  canonicalHeaders: string[];    // Mapped canonical names (e.g. "Payer" → "paid_by")
  totalRows: number;             // Total data rows (excluding header)
  cleanRows: number;             // Rows with zero issues
  skippedRows: number;           // Rows skipped due to one or more errors
  warningRows: number;           // Rows imported but with warnings
  allIssues: ValidationIssue[];  // Flat list of every issue across all rows
  uniqueNames: string[];         // All unique payer/participant names (normalized)
  nameVariants: Record<string, string[]>; // Names that appear with multiple spellings
  currencies: string[];          // All unique currency codes found in the file
}
```

Each row produces a `ValidatedRow`:

```typescript
interface ValidatedRow {
  raw: RawExpenseRow;   // Original cell values as strings
  rowIndex: number;     // 1-indexed row number (row 2 = first data row after header)
  issues: ValidationIssue[];
  isSkipped: boolean;   // true = row will NOT be imported
  parsed?: { ... };     // Only present for rows that will be imported
}
```

Each issue is:

```typescript
interface ValidationIssue {
  row: number;          // Row number (2-indexed)
  type: string;         // Issue code (see table below)
  message: string;      // Human-readable explanation
  severity: "error" | "warning";
  field?: string;       // Which column triggered the issue
}
```

---

## Issue Codes and Their Meaning

| Code | Severity | Triggered By | Action |
|---|---|---|---|
| `INVALID_DATE` | error | Date string cannot be parsed by any known format | Row skipped |
| `AMBIGUOUS_DATE` | warning | Both day and month ≤ 12 (DD/MM or MM/DD unclear) | Imported; assumes DD/MM/YYYY |
| `MISSING_AMOUNT` | error | Amount field empty or non-numeric | Row skipped |
| `ZERO_AMOUNT` | error | Amount parses to exactly 0 | Row skipped |
| `NEGATIVE_AMOUNT` | warning | Amount parses to a negative number | Imported as refund/credit |
| `MISSING_PAYER` | error | `paid_by` field empty or whitespace-only | Row skipped |
| `MISSING_CURRENCY` | warning | `currency` field empty | Imported; defaults to INR |
| `IS_SETTLEMENT` | warning | Description/notes contain settlement keywords | Imported with `isSettlement: true` |
| `DUPLICATE_EXPENSE` | error | Same description + date + payer as an earlier row | Row skipped (first occurrence kept) |
| `INVALID_SPLIT_TYPE` | error | `split_type` is not `equal`, `unequal`, `percentage`, or `share` | Row skipped |
| `PERCENTAGE_MISMATCH` | warning | Percentage split details do not sum to 100% (±1% tolerance) | Imported; amounts may be off |

---

## Sample Import Report (Based on Assignment CSV)

Below is a representative example of the validation output the app would produce when ingesting the `expenses_export.csv` from the assignment. Exact row numbers depend on the actual file content.

```
=== IMPORT REPORT ===
File: expenses_export.csv
Total rows: 42

Summary:
  ✅ Clean rows:    28  (ready to import)
  ⚠️  Warning rows:   8  (imported with flags)
  ❌ Skipped rows:   6  (not imported)

Currencies detected: INR, USD
Unique members: Rahul, Priya, Ankit, Dev, Meera, Kabir

--- ANOMALIES DETECTED ---

Row 5  | ERROR   | DUPLICATE_EXPENSE   | Duplicate of row 3: same description, date, and payer
        | Field: description | Value: "Dinner at Punjab Grill, 2024-03-15, Rahul"

Row 9  | WARNING | IS_SETTLEMENT       | Looks like a settlement/payment transaction
        | Field: description | Value: "Priya paid back Rahul"

Row 12 | ERROR   | MISSING_PAYER       | No payer specified
        | Field: paid_by     | Value: ""

Row 17 | WARNING | AMBIGUOUS_DATE      | Date "04/05/2024" is ambiguous (DD/MM or MM/DD?)
        | Field: date        | Value: "04/05/2024" → interpreted as 4 May 2024

Row 21 | ERROR   | ZERO_AMOUNT         | Amount is 0
        | Field: amount      | Value: "0"

Row 24 | WARNING | NEGATIVE_AMOUNT     | Negative amount (-500) — treated as refund/credit
        | Field: amount      | Value: "-500"

Row 28 | WARNING | MISSING_CURRENCY    | Currency not specified, defaulting to INR
        | Field: currency    | Value: ""

Row 31 | ERROR   | INVALID_DATE        | Cannot parse date "32/13/2024"
        | Field: date        | Value: "32/13/2024"

Row 35 | WARNING | PERCENTAGE_MISMATCH | Percentages sum to 85.0%, not 100%
        | Field: split_details | Value: "Rahul 40%; Priya 45%"

Row 39 | WARNING | IS_SETTLEMENT       | Looks like a settlement/payment transaction
        | Field: description | Value: "UPI transfer to Ankit"

Row 41 | ERROR   | DUPLICATE_EXPENSE   | Duplicate of row 38: same description, date, and payer

--- NAME VARIANT REPORT ---
The following names appear with different capitalizations/spellings.
Please confirm they refer to the same person before importing:

  "rahul" appears as: Rahul, rahul, RAHUL
  "priya" appears as: Priya, priya

--- IMPORT ACTION ---
Proceeding will import 36 rows (28 clean + 8 warnings).
6 rows will be skipped.
```

---

## How the Report Is Shown in the UI

The validation report is displayed in **Step 2** of the import wizard (`src/components/CSVImportWizard.tsx`):

1. **Summary bar** at the top showing counts of clean / warning / skipped rows
2. **Full data table** with every row, color-coded:
   - 🟢 Green = clean, no issues
   - 🟡 Yellow = warning, will be imported with a flag
   - 🔴 Red = error, will be skipped
3. **Issue detail** on hover/expand per row
4. **Name variant panel** showing potential name inconsistencies
5. **Currency list** showing all unique currencies found
6. **Confirm Import** button is only enabled after the user has reviewed the report
