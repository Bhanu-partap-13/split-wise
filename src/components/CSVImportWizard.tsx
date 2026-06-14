"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { validateCSV, ValidationReport } from "@/lib/csvValidator";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  FileSpreadsheet,
  UploadCloud,
  AlertTriangle,
  Coins,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  User,
  Info,
} from "lucide-react";

interface Props {
  groupId: Id<"groups">;
  currentUser: any;
  onImportComplete?: () => void;
}

type Step = "upload" | "validate" | "done";

export function CSVImportWizard({ groupId, currentUser, onImportComplete }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  // Name mapping: maps CSV names → actual system names
  const [nameMapping, setNameMapping] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const importBatch = useMutation(api.expenses.importBatch);

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const result = validateCSV(text);
        setReport(result);

        // Auto-detect all unique names from CSV
        const csvNames = new Set<string>();
        result.rows.forEach((row) => {
          if (row.parsed) {
            if (row.parsed.paidBy) csvNames.add(row.parsed.paidBy);
            row.parsed.splitWith.forEach((n) => csvNames.add(n));
          }
        });

        // Pre-fill mapping: if current user name matches (case-insensitive), auto-map
        const currentUserName = currentUser?.name || "";
        const initialMapping: Record<string, string> = {};
        csvNames.forEach((csvName) => {
          if (
            csvName.toLowerCase() === currentUserName.toLowerCase()
          ) {
            initialMapping[csvName] = currentUserName;
          }
        });
        setNameMapping(initialMapping);
        setStep("validate");
      };
      reader.readAsText(file);
    },
    [currentUser]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
  });

  // Get all unique CSV names
  const getAllCsvNames = (): string[] => {
    if (!report) return [];
    const names = new Set<string>();
    report.rows.forEach((row) => {
      if (row.parsed) {
        if (row.parsed.paidBy) names.add(row.parsed.paidBy);
        row.parsed.splitWith.forEach((n) => names.add(n));
      }
    });
    return Array.from(names);
  };

  const handleImport = async () => {
    if (!report || !currentUser) return;
    setImporting(true);
    try {
      const cleanRows = report.rows.filter((r) => !r.isSkipped && r.parsed);
      const batchId = `batch_${Date.now()}`;

      const expensesToImport = cleanRows.map((row) => {
        const p = row.parsed!;

        // Apply name mapping: replace CSV names with mapped names
        const resolveName = (csvName: string): string => {
          return nameMapping[csvName] || csvName;
        };

        const resolvedPaidBy = resolveName(p.paidBy);
        const splitWith = p.splitWith.length > 0 ? p.splitWith : [p.paidBy];
        const resolvedSplitWith = splitWith.map(resolveName);
        const perPerson = p.amount / resolvedSplitWith.length;

        const splits = resolvedSplitWith.map((name) => ({
          userName: name,
          amount:
            p.splitType === "equal"
              ? Math.round(perPerson * 100) / 100
              : p.splitType === "percentage"
                ? Math.round(((p.splitDetails[name] || 0) / 100) * p.amount * 100) / 100
                : p.splitType === "share"
                  ? (() => {
                      const totalShares = Object.values(p.splitDetails).reduce(
                        (a, b) => a + b,
                        0
                      );
                      return (
                        Math.round(
                          ((p.splitDetails[name] || 1) / totalShares) * p.amount * 100
                        ) / 100
                      );
                    })()
                  : p.splitDetails[name] || perPerson,
          percentage:
            p.splitType === "percentage" ? p.splitDetails[name] : undefined,
          shares: p.splitType === "share" ? p.splitDetails[name] : undefined,
        }));

        return {
          description: p.description,
          amount: p.amount,
          currency: p.currency,
          paidByName: resolvedPaidBy,
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
      // Auto-redirect to expenses tab after 1.5s
      setTimeout(() => {
        onImportComplete?.();
      }, 1500);
    } catch (err) {
      toast({
        title: "Import failed",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setFileName("");
    setNameMapping({});
    setStep("upload");
  };

  if (step === "upload") {
    return (
      <div className="max-w-2xl mx-auto w-full">
        <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold font-heading">Import Expenses via CSV</CardTitle>
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
                Drag &amp; drop your CSV file here
              </p>
              <p className="text-brand-gray text-xs mt-1">or click to browse local files</p>
              <div className="border-t border-subtle-blue-gray/25 mt-8 pt-6">
                <h4 className="text-xs font-semibold text-brand-gray/60 uppercase tracking-wider mb-3">
                  Expected Column Headers
                </h4>
                <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                  {[
                    "date",
                    "description",
                    "paid_by",
                    "amount",
                    "currency",
                    "split_type",
                    "split_with",
                    "split_details",
                    "notes",
                  ].map((col) => (
                    <span
                      key={col}
                      className="font-mono text-[10px] bg-deep-navy border border-subtle-blue-gray px-2 py-0.5 rounded text-brand-gray"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {currentUser && (
              <div className="flex items-center gap-2 text-xs text-brand-gray bg-soft-teal/5 border border-soft-teal/15 rounded-lg p-3">
                <Info className="w-4 h-4 text-soft-teal shrink-0" />
                <span>
                  After upload, you can map CSV names to your account name{" "}
                  <span className="text-white font-semibold">{currentUser.name}</span> for accurate tracking.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "validate" && report) {
    const warningCount = report.allIssues.filter((i) => i.severity === "warning").length;
    const csvNames = getAllCsvNames();
    const currentUserName = currentUser?.name || "";

    return (
      <div className="max-w-4xl mx-auto space-y-6 w-full text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight font-heading flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-soft-teal" />
              Data Quality Report — {fileName}
            </h2>
            <p className="text-brand-gray text-xs mt-1">
              Verify columns, map names, and fix conflicts before importing.
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

        {/* Summary metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-sm">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold font-heading text-white">{report.totalRows}</div>
              <div className="text-xs text-brand-gray mt-1">Total Rows</div>
            </CardContent>
          </Card>
          <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-sm">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold font-heading text-soft-teal">{report.cleanRows}</div>
              <div className="text-xs text-brand-gray mt-1">Clean Rows</div>
            </CardContent>
          </Card>
          <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-sm">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold font-heading text-amber-400">{warningCount}</div>
              <div className="text-xs text-brand-gray mt-1">Warnings</div>
            </CardContent>
          </Card>
          <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-sm">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold font-heading text-red-500">{report.skippedRows}</div>
              <div className="text-xs text-brand-gray mt-1">Skipped (Errors)</div>
            </CardContent>
          </Card>
        </div>

        {/* ── Name Mapping Section ─────────────────────────────────────────── */}
        {csvNames.length > 0 && currentUser && (
          <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-md">
            <CardHeader className="border-b border-subtle-blue-gray/25 pb-4">
              <CardTitle className="text-base font-bold font-heading flex items-center gap-2">
                <User className="w-4 h-4 text-soft-teal" />
                Name Mapping
              </CardTitle>
              <p className="text-xs text-brand-gray mt-1">
                Map CSV names to registered usernames. Leave blank to keep the original name.
                Your account name is{" "}
                <span className="text-white font-semibold">{currentUserName}</span>.
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {csvNames.map((csvName) => (
                <div key={csvName} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs text-brand-gray mb-1 block truncate">
                      CSV name:{" "}
                      <span className="font-mono text-white bg-subtle-blue-gray/40 px-1.5 py-0.5 rounded">
                        {csvName}
                      </span>
                    </Label>
                    <Input
                      value={nameMapping[csvName] || ""}
                      onChange={(e) =>
                        setNameMapping((prev) => ({
                          ...prev,
                          [csvName]: e.target.value,
                        }))
                      }
                      placeholder={`Map to real name (e.g., ${currentUserName})`}
                      className="bg-deep-navy border-subtle-blue-gray text-white placeholder-brand-gray/40 focus-visible:ring-soft-teal text-xs h-8"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setNameMapping((prev) => ({
                        ...prev,
                        [csvName]: currentUserName,
                      }))
                    }
                    className="text-soft-teal hover:text-soft-teal hover:bg-soft-teal/10 text-xs h-8 shrink-0"
                  >
                    Use my name
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Name variant alerts */}
        {Object.keys(report.nameVariants).length > 0 && (
          <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-400 flex gap-3 p-4">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <AlertDescription className="text-sm">
              <span className="font-bold text-white block mb-1">Name variants detected:</span>
              <ul className="list-disc pl-5 space-y-1">
                {Object.entries(report.nameVariants).map(([canonical, variants]) => (
                  <li key={canonical}>
                    <span className="font-mono bg-deep-navy px-1.5 py-0.5 rounded text-white border border-subtle-blue-gray/50">
                      {variants.join(" / ")}
                    </span>{" "}
                    will be matched automatically to save duplicate accounts.
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Currency warning alert */}
        {report.currencies.length > 1 && (
          <Alert className="bg-soft-teal/10 border-soft-teal/20 text-soft-teal flex gap-3 p-4">
            <Coins className="w-5 h-5 shrink-0" />
            <AlertDescription className="text-sm">
              <span className="font-bold text-white block mb-1">Multi-currency setup detected:</span>
              Expenses will be recorded in their respective currencies (
              <span className="font-semibold text-white">{report.currencies.join(", ")}</span>).
              Outstanding balances will be calculated and settled separately per currency.
            </AlertDescription>
          </Alert>
        )}

        {/* Issues listing table */}
        <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-md">
          <CardHeader>
            <CardTitle className="text-base font-bold font-heading">
              Identified Import Conflicts ({report.allIssues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.allIssues.length === 0 ? (
              <div className="flex items-center gap-2 text-soft-teal text-sm py-4">
                <CheckCircle2 className="w-5 h-5" />
                <span>Excellent! No issues or warnings found in this CSV.</span>
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

        {/* File Preview */}
        <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-md">
          <CardHeader>
            <CardTitle className="text-base font-bold font-heading">CSV Import Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-subtle-blue-gray/35 text-brand-gray pb-2 uppercase tracking-wider">
                    <th className="pb-3 pr-4 font-semibold">Row</th>
                    <th className="pb-3 pr-4 font-semibold">Status</th>
                    <th className="pb-3 pr-4 font-semibold">Date</th>
                    <th className="pb-3 pr-4 font-semibold">Description</th>
                    <th className="pb-3 pr-4 font-semibold">Paid By (CSV)</th>
                    <th className="pb-3 pr-4 font-semibold">Amount</th>
                    <th className="pb-3 font-semibold">Warnings / Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle-blue-gray/15">
                  {report.rows.map((row) => (
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
                      <td className="py-3 pr-4 text-brand-gray font-mono">{row.rowIndex}</td>
                      <td className="py-3 pr-4">
                        {row.isSkipped ? (
                          <Badge variant="destructive">Skipped</Badge>
                        ) : row.issues.length > 0 ? (
                          <Badge
                            variant="secondary"
                            className="bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          >
                            Warning
                          </Badge>
                        ) : (
                          <Badge className="bg-soft-teal/20 text-soft-teal border border-soft-teal/30">
                            Clean
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-brand-gray">{row.raw.date}</td>
                      <td className="py-3 pr-4 max-w-xs truncate font-medium">{row.raw.description}</td>
                      <td className="py-3 pr-4 text-brand-gray font-mono text-[11px]">
                        {row.raw.paid_by}
                        {nameMapping[row.raw.paid_by] && nameMapping[row.raw.paid_by] !== row.raw.paid_by && (
                          <span className="ml-1 text-soft-teal">→ {nameMapping[row.raw.paid_by]}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-white font-semibold">
                        {row.raw.amount} {row.raw.currency}
                      </td>
                      <td className="py-3 text-[11px] text-brand-gray font-mono max-w-xs truncate">
                        {row.issues.map((i) => i.type).join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Trigger Button */}
        <div className="flex gap-4">
          <Button
            onClick={handleImport}
            disabled={importing || report.cleanRows + report.warningRows === 0}
            className="bg-electric-blue hover:bg-electric-blue/80 text-white font-bold flex items-center gap-2 px-8 py-5 shadow-lg shadow-electric-blue/20"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing records...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Import {report.cleanRows + report.warningRows} Rows (Skip {report.skippedRows} Errors)
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

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
              Your expenses have been successfully verified, logged into the group ledger, and shared
              balances recalculated. Redirecting to Expenses...
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={handleReset}
                variant="outline"
                className="border-subtle-blue-gray text-white hover:bg-subtle-blue-gray/30"
              >
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
