import Papa from "papaparse";

// ── Flexible column alias map ──────────────────────────────────────────────
// Maps any variant → canonical key used internally
const COLUMN_ALIASES: Record<string, string> = {
  // date
  date: "date", transaction_date: "date", expense_date: "date", txn_date: "date",
  "date of expense": "date", "expense date": "date",

  // description
  description: "description", desc: "description", name: "description",
  item: "description", title: "description", particulars: "description",
  "expense name": "description", "item name": "description",

  // paid_by
  paid_by: "paid_by", "paid by": "paid_by", payer: "paid_by",
  paid_by_name: "paid_by", who_paid: "paid_by", "who paid": "paid_by",
  paid_by_person: "paid_by",

  // amount
  amount: "amount", total: "amount", price: "amount", cost: "amount",
  "total amount": "amount", value: "amount", sum: "amount",

  // currency
  currency: "currency", curr: "currency", "currency code": "currency",

  // split_type
  split_type: "split_type", "split type": "split_type", type: "split_type",
  split: "split_type", "split method": "split_type", split_method: "split_type",

  // split_with
  split_with: "split_with", "split with": "split_with", members: "split_with",
  participants: "split_with", people: "split_with", shared_with: "split_with",
  "shared with": "split_with", split_among: "split_with", "split among": "split_with",

  // split_details
  split_details: "split_details", "split details": "split_details", details: "split_details",
  breakdown: "split_details", shares: "split_details", percentages: "split_details",

  // notes
  notes: "notes", note: "notes", remarks: "notes", comment: "notes",
  comments: "notes", "additional notes": "notes", memo: "notes",
};

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
  [key: string]: string; // any extra columns pass through
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
  isSkipped: boolean;
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
  detectedHeaders: string[];   // original CSV headers (for dynamic table display)
  canonicalHeaders: string[];  // mapped canonical names
  totalRows: number;
  cleanRows: number;
  skippedRows: number;
  warningRows: number;
  allIssues: ValidationIssue[];
  uniqueNames: string[];
  nameVariants: Record<string, string[]>;
  currencies: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, "_");
}

export function resolveHeader(raw: string): string {
  const norm = normalizeHeader(raw).replace(/_/g, " ").trim();
  return (
    COLUMN_ALIASES[norm.replace(/ /g, "_")] ||
    COLUMN_ALIASES[norm] ||
    norm.replace(/ /g, "_") // keep original normalized form if no alias
  );
}

function parseDate(dateStr: string): { date: Date | null; ambiguous: boolean } {
  if (!dateStr) return { date: null, ambiguous: false };
  const s = dateStr.trim();

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { date: new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])), ambiguous: false };

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const p1 = parseInt(dmy[1], 10), p2 = parseInt(dmy[2], 10);
    const ambiguous = p1 <= 12 && p2 <= 12;
    return { date: new Date(parseInt(dmy[3], 10), p2 - 1, p1), ambiguous };
  }

  // DD-MM-YYYY
  const dmy2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy2) {
    const p1 = parseInt(dmy2[1], 10), p2 = parseInt(dmy2[2], 10);
    return { date: new Date(parseInt(dmy2[3], 10), p2 - 1, p1), ambiguous: p1 <= 12 && p2 <= 12 };
  }

  const partial = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2})$/);
  if (partial) {
    const d = new Date(`${partial[1]} ${partial[2]} ${new Date().getFullYear()}`);
    return { date: isNaN(d.getTime()) ? null : d, ambiguous: false };
  }

  const direct = new Date(s);
  return { date: isNaN(direct.getTime()) ? null : direct, ambiguous: false };
}

function parseAmount(s: string): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[,\s₹$€£]/g, ""));
  return isNaN(n) ? null : n;
}

function normalizeName(n: string): string {
  return n.trim().toLowerCase().replace(/\s+/g, " ");
}

function detectNameVariants(names: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  const seen = new Set<string>();
  for (const name of names) {
    const norm = normalizeName(name);
    if (!groups[norm]) groups[norm] = [];
    if (!seen.has(name)) { groups[norm].push(name); seen.add(name); }
  }
  return Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length > 1));
}

function parseSplitType(s: string): "equal" | "unequal" | "percentage" | "share" | null {
  const t = (s || "").trim().toLowerCase();
  if (t === "" || t === "equal") return "equal";
  if (t === "unequal") return "unequal";
  if (t === "percentage" || t === "percent" || t === "%") return "percentage";
  if (t === "share" || t === "shares" || t === "ratio") return "share";
  return null;
}

// ── Main validator (works on pre-normalised row objects) ───────────────────
function validateRows(
  data: Record<string, string>[],
  originalHeaders: string[]
): ValidationReport {
  const allNames: string[] = [];
  const allCurrencies: string[] = [];
  const seenKey = new Map<string, number>();

  const rows: ValidatedRow[] = data.map((rawObj, idx) => {
    const rowNum = idx + 2;
    const issues: ValidationIssue[] = [];
    let isSkipped = false;

    // Build typed raw row from flexible columns
    const raw: RawExpenseRow = {
      date: rawObj.date || "",
      description: rawObj.description || "",
      paid_by: rawObj.paid_by || "",
      amount: rawObj.amount || "",
      currency: rawObj.currency || "INR",
      split_type: rawObj.split_type || "equal",
      split_with: rawObj.split_with || "",
      split_details: rawObj.split_details || "",
      notes: rawObj.notes || "",
    };
    // Pass through any extra columns for display
    Object.keys(rawObj).forEach((k) => {
      if (!(k in raw)) raw[k] = rawObj[k];
    });

    // 1. Date
    const { date, ambiguous } = parseDate(raw.date);
    if (!date) {
      issues.push({ row: rowNum, type: "INVALID_DATE", message: `Cannot parse date "${raw.date}"`, severity: "error", field: "date" });
      isSkipped = true;
    } else if (ambiguous) {
      issues.push({ row: rowNum, type: "AMBIGUOUS_DATE", message: `Date "${raw.date}" is ambiguous (DD/MM or MM/DD?)`, severity: "warning", field: "date" });
    }

    // 2. Amount (allow negative = refund/credit)
    const amount = parseAmount(raw.amount);
    if (amount === null) {
      issues.push({ row: rowNum, type: "MISSING_AMOUNT", message: "Amount is missing or invalid", severity: "error", field: "amount" });
      isSkipped = true;
    } else if (amount === 0) {
      issues.push({ row: rowNum, type: "ZERO_AMOUNT", message: "Amount is 0", severity: "error", field: "amount" });
      isSkipped = true;
    } else if (amount < 0) {
      issues.push({ row: rowNum, type: "NEGATIVE_AMOUNT", message: `Negative amount (${amount}) — treated as refund/credit`, severity: "warning", field: "amount" });
    }

    // 3. Payer
    if (!raw.paid_by?.trim()) {
      issues.push({ row: rowNum, type: "MISSING_PAYER", message: "No payer specified", severity: "error", field: "paid_by" });
      isSkipped = true;
    }

    // 4. Currency (default to INR if missing)
    if (!raw.currency?.trim()) {
      raw.currency = "INR";
      issues.push({ row: rowNum, type: "MISSING_CURRENCY", message: "Currency not specified, defaulting to INR", severity: "warning", field: "currency" });
    }

    // 5. Settlement heuristic
    const isSettlement =
      /\b(paid back|settlement|settled|repaid|repayment|returned|pay back|upi)\b/i.test(raw.description) ||
      /settlement/i.test(raw.notes || "");
    if (isSettlement) {
      issues.push({ row: rowNum, type: "IS_SETTLEMENT", message: "Looks like a settlement/payment transaction", severity: "warning", field: "description" });
    }

    // 6. Duplicate detection
    const dupKey = `${normalizeName(raw.description)}|${raw.date?.trim()}|${normalizeName(raw.paid_by)}`;
    if (seenKey.has(dupKey)) {
      issues.push({ row: rowNum, type: "DUPLICATE_EXPENSE", message: `Duplicate of row ${seenKey.get(dupKey)}: same description, date, and payer`, severity: "error", field: "description" });
      isSkipped = true;
    } else {
      seenKey.set(dupKey, rowNum);
    }

    // 7. Split type
    const splitType = parseSplitType(raw.split_type);
    if (!splitType) {
      issues.push({ row: rowNum, type: "INVALID_SPLIT_TYPE", message: `Unknown split type "${raw.split_type}"`, severity: "error", field: "split_type" });
    }

    // 8. Percentage validation
    if (splitType === "percentage" && raw.split_details) {
      const parts = raw.split_details.split(";").map((p) => p.trim());
      let total = 0;
      for (const part of parts) {
        const m = part.match(/[\d.]+%?$/);
        if (m) total += parseFloat(m[0]);
      }
      if (Math.abs(total - 100) > 1) {
        issues.push({ row: rowNum, type: "PERCENTAGE_MISMATCH", message: `Percentages sum to ${total.toFixed(1)}%, not 100%`, severity: "warning", field: "split_details" });
      }
    }

    // Collect names
    const payer = raw.paid_by?.trim();
    if (payer) allNames.push(payer);
    if (raw.split_with) {
      raw.split_with.split(";").forEach((n) => { if (n.trim()) allNames.push(n.trim()); });
    }

    if (raw.currency?.trim()) allCurrencies.push(raw.currency.trim());

    // Build parsed record
    let parsed: ValidatedRow["parsed"] = undefined;
    if (!isSkipped && date && amount !== null && splitType) {
      const splitWith = (raw.split_with || "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);

      const splitDetails: Record<string, number> = {};
      if (raw.split_details) {
        raw.split_details.split(";").forEach((part) => {
          // Match "Name 700" or "Name 30%" or "Name 30"
          const m = part.trim().match(/^(.+?)\s+([\d.]+)%?$/);
          if (m) splitDetails[m[1].trim()] = parseFloat(m[2]);
        });
      }

      parsed = {
        date,
        description: raw.description?.trim() || "",
        paidBy: payer || "",
        amount,
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

  // Canonical headers for display (use detected originals for table)
  const canonicalHeaders = originalHeaders.map((h) => resolveHeader(h));

  return {
    rows,
    detectedHeaders: originalHeaders,
    canonicalHeaders,
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

// ── CSV entry point ────────────────────────────────────────────────────────
export function validateCSV(csvText: string): ValidationReport {
  const originalHeaders: string[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => {
      originalHeaders.push(h.trim()); // capture BEFORE transformation
      return resolveHeader(h);
    },
  });

  return validateRows(parsed.data, originalHeaders);
}

// ── Excel (.xlsx / .xls) entry point ──────────────────────────────────────
export async function validateExcel(buffer: ArrayBuffer): Promise<ValidationReport> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]]; // first sheet

  // Convert to array of objects; raw header row preserved
  const rawData: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
  if (rawData.length < 2) {
    return validateRows([], []);
  }

  const headerRow = (rawData[0] as string[]).map((h) => String(h));
  const originalHeaders = headerRow;
  const canonicalHeaders = headerRow.map((h) => resolveHeader(h));

  const dataRows: Record<string, string>[] = rawData.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    canonicalHeaders.forEach((key, i) => {
      const cell = row[i];
      // Format date columns: Excel stores dates as numeric serial numbers
      if (key === "date" && typeof cell === "number" && cell > 0) {
        // Convert Excel serial date to JS Date using XLSX
        const jsDate = XLSX.SSF.parse_date_code
          ? (() => { const d = (XLSX.SSF as any).parse_date_code(cell); return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : String(cell); })()
          : new Date(Math.round((cell - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
        obj[key] = jsDate;
      } else {
        obj[key] = cell == null ? "" : String(cell);
      }
    });
    return obj;
  }).filter((row) => Object.values(row).some((v) => v.trim() !== ""));

  return validateRows(dataRows, originalHeaders);
}
