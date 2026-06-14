"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { validateCSV, validateExcel, resolveHeader, ValidationReport } from "@/lib/csvValidator";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import {
  FileSpreadsheet,
  UploadCloud,
  AlertTriangle,
  Coins,
  CheckCircle2,
  ArrowLeft,
  Loader2,
} from "lucide-react";

interface Props {
  groupId: Id<"groups">;
  currentUser: any;
  onImportComplete?: () => void;
}

type Step = "upload" | "validate" | "done";

const ACCEPTED_TYPES = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
};

export function CSVImportWizard({ groupId, currentUser, onImportComplete }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const importBatch = useMutation(api.expenses.importBatch);

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFileName(file.name);

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        const result = await validateExcel(buffer);
        setReport(result);
        setStep("validate");
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const result = validateCSV(text);
        setReport(result);
        setStep("validate");
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
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

        // Exact CSV/Excel data — no remapping
        const paidByName = p.paidBy;
        const splitWith = p.splitWith.length > 0 ? p.splitWith : [p.paidBy];
        const perPerson = p.amount / splitWith.length;

        const splits = splitWith.map((name) => {
          let splitAmount: number;
          if (p.splitType === "equal") {
            splitAmount = Math.round(perPerson * 100) / 100;
          } else if (p.splitType === "percentage") {
            splitAmount = Math.round(((p.splitDetails[name] || 0) / 100) * p.amount * 100) / 100;
          } else if (p.splitType === "share") {
            const totalShares = Object.values(p.splitDetails).reduce((a, b) => a + b, 0) || splitWith.length;
            splitAmount = Math.round(((p.splitDetails[name] || 1) / totalShares) * p.amount * 100) / 100;
          } else {
            // unequal — split_details has per-person amounts
            splitAmount = p.splitDetails[name] ?? Math.round(perPerson * 100) / 100;
          }

          return {
            userName: name,
            amount: splitAmount,
            percentage: p.splitType === "percentage" ? p.splitDetails[name] : undefined,
            shares: p.splitType === "share" ? p.splitDetails[name] : undefined,
          };
        });

        return {
          description: p.description,
          amount: p.amount,
          currency: p.currency,
          paidByName,
          splitType: p.splitType,
          date: p.date.getTime(),
          notes: p.notes || undefined,
          isSettlement: p.isSettlement,
          splits,
        };
      });

      await importBatch({
        groupId,
        importedBy: currentUser._id,
        expenses: expensesToImport as any,
        batchId,
      });
      setStep("done");
      toast({ title: `Successfully imported ${expensesToImport.length} expenses!` });
      setTimeout(() => { onImportComplete?.(); }, 1500);
    } catch (err) {
      toast({ title: "Import failed", description: String(err), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setFileName("");
    setStep("upload");
  };

  // ── Step: Upload ─────────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div className="max-w-2xl mx-auto w-full">
        <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold font-heading">Import Expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                isDragActive
                  ? "border-soft-teal bg-soft-teal/5"
                  : "border-subtle-blue-gray hover:border-soft-teal/50 hover:bg-deep-navy/40"
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-14 h-14 rounded-full bg-soft-teal/10 border border-soft-teal/20 flex items-center justify-center text-soft-teal mx-auto mb-4">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="text-white font-bold text-base font-heading">
                Drag &amp; drop CSV or Excel file here
              </p>
              <p className="text-brand-gray text-xs mt-1">
                Supports <span className="text-soft-teal font-mono">.csv</span>,{" "}
                <span className="text-soft-teal font-mono">.xlsx</span>,{" "}
                <span className="text-soft-teal font-mono">.xls</span> — any column layout
              </p>
              <div className="border-t border-subtle-blue-gray/25 mt-8 pt-6">
                <h4 className="text-xs font-semibold text-brand-gray/60 uppercase tracking-wider mb-3">
                  Recognised Column Names (and common aliases)
                </h4>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                  {[
                    ["date", "expense_date"],
                    ["description", "desc / name"],
                    ["paid_by", "payer / who_paid"],
                    ["amount", "total / cost"],
                    ["currency"],
                    ["split_type", "equal/unequal/percentage/share"],
                    ["split_with", "members / participants"],
                    ["split_details", "breakdown"],
                    ["notes", "remarks / comment"],
                  ].map(([main, alias]) => (
                    <div key={main} className="flex flex-col items-center gap-0.5">
                      <span className="font-mono text-[10px] bg-deep-navy border border-subtle-blue-gray px-2 py-0.5 rounded text-soft-teal">
                        {main}
                      </span>
                      {alias && (
                        <span className="text-[9px] text-brand-gray/50">{alias}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Step: Validate ───────────────────────────────────────────────────────
  if (step === "validate" && report) {
    const warningCount = report.allIssues.filter((i) => i.severity === "warning").length;
    // Use detected original headers for the dynamic table
    const displayHeaders = report.detectedHeaders.length > 0
      ? report.detectedHeaders
      : report.canonicalHeaders;

    return (
      <div className="max-w-5xl mx-auto space-y-6 w-full text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight font-heading flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-soft-teal" />
              Data Report — {fileName}
            </h2>
            <p className="text-brand-gray text-xs mt-1">
              {displayHeaders.length} columns detected · {report.totalRows} rows · Review conflicts before importing
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleReset}
            className="border-subtle-blue-gray hover:bg-subtle-blue-gray/30 text-white flex items-center gap-2 self-start"
          >
            <ArrowLeft className="w-4 h-4" />
            Upload Different File
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Rows", value: report.totalRows, color: "text-white" },
            { label: "Clean", value: report.cleanRows, color: "text-soft-teal" },
            { label: "Warnings", value: warningCount, color: "text-amber-400" },
            { label: "Skipped", value: report.skippedRows, color: "text-red-500" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-sm">
              <CardContent className="pt-6 text-center">
                <div className={`text-3xl font-bold font-heading ${color}`}>{value}</div>
                <div className="text-xs text-brand-gray mt-1">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Name variants */}
        {Object.keys(report.nameVariants).length > 0 && (
          <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-400 flex gap-3 p-4">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <AlertDescription className="text-sm">
              <span className="font-bold text-white block mb-1">Name variants detected:</span>
              <ul className="list-disc pl-5 space-y-1">
                {Object.entries(report.nameVariants).map(([, variants]) => (
                  <li key={variants.join()}>
                    <span className="font-mono bg-deep-navy px-1.5 py-0.5 rounded text-white border border-subtle-blue-gray/50">
                      {variants.join(" / ")}
                    </span>{" "}
                    — normalise in your file if they are the same person.
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Multi-currency */}
        {report.currencies.length > 1 && (
          <Alert className="bg-soft-teal/10 border-soft-teal/20 text-soft-teal flex gap-3 p-4">
            <Coins className="w-5 h-5 shrink-0" />
            <AlertDescription className="text-sm">
              <span className="font-bold text-white block mb-1">Multi-currency detected:</span>
              Currencies found:{" "}
              <span className="font-semibold text-white">{report.currencies.join(", ")}</span>
            </AlertDescription>
          </Alert>
        )}

        {/* Issues */}
        <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-md">
          <CardHeader>
            <CardTitle className="text-base font-bold font-heading">
              Conflicts &amp; Warnings ({report.allIssues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.allIssues.length === 0 ? (
              <div className="flex items-center gap-2 text-soft-teal text-sm py-4">
                <CheckCircle2 className="w-5 h-5" />
                <span>No issues found — all rows are clean.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto divide-y divide-subtle-blue-gray/20">
                {report.allIssues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm py-3 first:pt-0 last:pb-0">
                    <Badge
                      variant={issue.severity === "error" ? "destructive" : "secondary"}
                      className="shrink-0 font-semibold font-mono"
                    >
                      Row {issue.row}
                    </Badge>
                    <div>
                      <span className="font-bold font-heading capitalize text-white">
                        {issue.type.replace(/_/g, " ")}
                      </span>
                      <p className="text-brand-gray text-xs mt-0.5">{issue.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dynamic full-data preview table */}
        <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-md">
          <CardHeader>
            <CardTitle className="text-base font-bold font-heading">
              Full Data Preview ({report.rows.length} rows · {displayHeaders.length} columns)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-dark-navy-surface z-10">
                  <tr className="border-b border-subtle-blue-gray/35 text-brand-gray uppercase tracking-wider">
                    <th className="pb-3 pr-3 font-semibold whitespace-nowrap">Row</th>
                    <th className="pb-3 pr-3 font-semibold whitespace-nowrap">Status</th>
                    {displayHeaders.map((h) => (
                      <th key={h} className="pb-3 pr-3 font-semibold whitespace-nowrap">
                        {h.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle-blue-gray/15">
                  {report.rows.map((row) => {
                    // Map display headers back to canonical keys for data lookup
        // Map: original header → canonical key (row.raw uses canonical keys)
        const headerToCanonical = Object.fromEntries(
          displayHeaders.map((h, i) => [h, report.canonicalHeaders[i] || resolveHeader(h)])
        );

        return (
          <tr
            key={row.rowIndex}
            className={`hover:bg-deep-navy/30 transition-colors ${
              row.isSkipped
                ? "bg-red-500/5 hover:bg-red-500/10"
                : row.issues.length > 0
                  ? "bg-amber-500/5 hover:bg-amber-500/10"
                  : ""
            }`}
          >
            <td className="py-2.5 pr-3 text-brand-gray font-mono">{row.rowIndex}</td>
            <td className="py-2.5 pr-3">
              {row.isSkipped ? (
                <Badge variant="destructive" className="text-[10px]">Skipped</Badge>
              ) : row.issues.length > 0 ? (
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
                  Warning
                </Badge>
              ) : (
                <Badge className="bg-soft-teal/20 text-soft-teal border border-soft-teal/30 text-[10px]">
                  Clean
                </Badge>
              )}
            </td>
            {displayHeaders.map((h) => {
              const key = headerToCanonical[h];
              const val = (row.raw as any)[key] ?? (row.raw as any)[h] ?? "";
              return (
                <td
                  key={h}
                  className="py-2.5 pr-3 text-brand-gray font-mono text-[11px] max-w-[180px] truncate"
                  title={val}
                >
                  {val || <span className="opacity-25">—</span>}
                </td>
              );
            })}
          </tr>
        );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Import button */}
        <div className="flex gap-4">
          <Button
            onClick={handleImport}
            disabled={importing || report.cleanRows + report.warningRows === 0}
            className="bg-electric-blue hover:bg-electric-blue/80 text-white font-bold flex items-center gap-2 px-8 py-5 shadow-lg shadow-electric-blue/20"
          >
            {importing ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Importing...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" />Import {report.cleanRows + report.warningRows} rows (skip {report.skippedRows} errors)</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── Step: Done ───────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="max-w-lg mx-auto w-full">
        <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white text-center py-12 shadow-md">
          <CardContent className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-soft-teal/10 border border-soft-teal/20 flex items-center justify-center text-soft-teal mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold font-heading text-white mb-2">Import Complete!</h2>
            <p className="text-brand-gray text-sm mb-8">
              All expenses imported exactly as provided, including notes and split details.
            </p>
            <Button
              onClick={handleReset}
              variant="outline"
              className="border-subtle-blue-gray text-white hover:bg-subtle-blue-gray/30"
            >
              Import Another File
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
