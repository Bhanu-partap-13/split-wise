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

function parseDate(dateStr: string): { date: Date | null; ambiguous: boolean } {
  if (!dateStr) return { date: null, ambiguous: false };
  const s = dateStr.trim();
  
  // ISO: YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { date: new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])), ambiguous: false };
  
  // DD/MM/YYYY or MM/DD/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const p1 = parseInt(dmy[1], 10);
    const p2 = parseInt(dmy[2], 10);
    const year = parseInt(dmy[3], 10);
    
    // If both parts are <= 12, it is ambiguous between DD/MM and MM/DD.
    // By convention, we interpret as DD/MM/YYYY (or prompt/warn).
    const ambiguous = p1 <= 12 && p2 <= 12;
    return { date: new Date(year, p2 - 1, p1), ambiguous };
  }
  
  // Partial e.g. "Mar 14"
  const partial = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2})$/);
  if (partial) {
    const currentYear = new Date().getFullYear();
    const date = new Date(`${partial[1]} ${partial[2]} ${currentYear}`);
    return { date: isNaN(date.getTime()) ? null : date, ambiguous: false };
  }
  
  const parsedDirect = new Date(s);
  return {
    date: isNaN(parsedDirect.getTime()) ? null : parsedDirect,
    ambiguous: false
  };
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
    if (!seen.has(name)) {
      groups[norm].push(name);
      seen.add(name);
    }
  }
  // Only return groups with more than 1 variant (e.g. "Bhanu" vs "bhanu" or "Bhanu Partap" vs "Bhanu   Partap")
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
  const { data } = Papa.parse<RawExpenseRow>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/ /g, "_"),
  });

  const allNames: string[] = [];
  const allCurrencies: string[] = [];
  const seenDescriptionDatePayer = new Map<string, number>();

  const rows: ValidatedRow[] = data.map((raw, idx) => {
    const rowNum = idx + 2; // header is row 1
    const issues: ValidationIssue[] = [];
    let isSkipped = false;

    // 1. Date Validation
    const { date, ambiguous: dateAmbiguous } = parseDate(raw.date || "");
    if (!date || isNaN(date.getTime())) {
      issues.push({ row: rowNum, type: "INVALID_DATE", message: `Cannot parse date "${raw.date || ""}"`, severity: "error", field: "date" });
      isSkipped = true;
    } else if (dateAmbiguous) {
      issues.push({ row: rowNum, type: "AMBIGUOUS_DATE", message: `Date "${raw.date}" is ambiguous (DD/MM or MM/DD?)`, severity: "warning", field: "date" });
    }

    // 2. Amount Validation
    const amount = parseAmount(raw.amount);
    if (amount === null) {
      issues.push({ row: rowNum, type: "MISSING_AMOUNT", message: `Amount is missing or invalid`, severity: "error", field: "amount" });
      isSkipped = true;
    } else if (amount === 0) {
      issues.push({ row: rowNum, type: "ZERO_AMOUNT", message: `Amount is 0`, severity: "error", field: "amount" });
      isSkipped = true;
    } else if (amount < 0) {
      issues.push({ row: rowNum, type: "NEGATIVE_AMOUNT", message: `Negative amount (${amount}) — treated as refund/credit`, severity: "warning", field: "amount" });
    }

    // 3. Payer Validation
    if (!raw.paid_by || raw.paid_by.trim() === "") {
      issues.push({ row: rowNum, type: "MISSING_PAYER", message: `No payer specified`, severity: "error", field: "paid_by" });
      isSkipped = true;
    }

    // 4. Currency Validation
    if (!raw.currency || raw.currency.trim() === "") {
      issues.push({ row: rowNum, type: "MISSING_CURRENCY", message: `Currency not specified`, severity: "error", field: "currency" });
      isSkipped = true;
    }

    // 5. Settlement Heuristic
    const isSettlement =
      /\b(paid back|settlement|settled|repaid|repayment|returned|pay back|upi)\b/i.test(raw.description || "") ||
      /settlement/i.test(raw.notes || "");
    if (isSettlement) {
      issues.push({ row: rowNum, type: "IS_SETTLEMENT", message: `This looks like a settlement/payment transaction`, severity: "warning", field: "description" });
    }

    // 6. Duplicate Detection
    const dupKey = `${normalizeName(raw.description || "")}|${(raw.date || "").trim()}|${normalizeName(raw.paid_by || "")}`;
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

    // 7. Split Type Validation
    const splitType = parseSplitType(raw.split_type || "equal");
    if (!splitType) {
      issues.push({ row: rowNum, type: "INVALID_SPLIT_TYPE", message: `Unknown split type "${raw.split_type}"`, severity: "error", field: "split_type" });
    }

    // 8. Percentage Validation
    if (splitType === "percentage" && raw.split_details) {
      const parts = raw.split_details.split(";").map((p) => p.trim());
      let total = 0;
      for (const part of parts) {
        const match = part.match(/[\d.]+%?$/);
        if (match) {
          total += parseFloat(match[0]);
        }
      }
      if (Math.abs(total - 100) > 1) {
        issues.push({ row: rowNum, type: "PERCENTAGE_MISMATCH", message: `Percentages sum to ${total.toFixed(1)}%, not 100%`, severity: "warning", field: "split_details" });
      }
    }

    // Collect name info
    const payer = raw.paid_by?.trim();
    if (payer) allNames.push(payer);
    if (raw.split_with) {
      raw.split_with.split(";").forEach((n) => {
        if (n.trim()) allNames.push(n.trim());
      });
    }

    // Collect currency info
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
          const m = part.trim().match(/^(.+?)\s+([\d.]+)%?$/);
          if (m) {
            splitDetails[m[1].trim()] = parseFloat(m[2]);
          }
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
