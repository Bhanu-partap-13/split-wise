"use client";

import React, { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Receipt,
  MessageSquare,
  ArrowRightLeft,
  FileInput,
  CircleDot,
  CheckCircle2,
  Clock3,
  Loader,
  AlertCircle,
  ChevronsUpDown,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ExpenseTableProps {
  expenses: any[];
  currentUser: any;
  onDeleteExpense: (id: string) => void;
  onOpenChat: (id: string) => void;
}

const PAGE_SIZE = 10;

type SortField = "description" | "date" | "amount" | "splitType";
type SortDir = "asc" | "desc";

// Approximate exchange rates relative to INR
const RATES_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 83.5,
  EUR: 90.2,
  GBP: 105.4,
  AED: 22.7,
  SGD: 61.8,
  CAD: 61.2,
  AUD: 54.3,
  JPY: 0.56,
};

function convertAmount(amount: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = RATES_TO_INR[fromCurrency.toUpperCase()] ?? 1;
  const toRate = RATES_TO_INR[toCurrency.toUpperCase()] ?? 1;
  return (amount * fromRate) / toRate;
}

// Maps split type → status pill style (mirrors Linear status colors)
function SplitTypePill({ type, isSettlement }: { type: string; isSettlement?: boolean }) {
  if (isSettlement) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/15">
        <ArrowRightLeft className="w-2.5 h-2.5" />
        Settlement
      </span>
    );
  }

  const cfg: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
    equal: {
      icon: <CheckCircle2 className="w-2.5 h-2.5" />,
      cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/15",
      label: "Equal",
    },
    percentage: {
      icon: <Loader className="w-2.5 h-2.5" />,
      cls: "bg-violet-500/10 text-violet-400 border-violet-500/15",
      label: "Percentage",
    },
    exact: {
      icon: <CircleDot className="w-2.5 h-2.5" />,
      cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/15",
      label: "Exact",
    },
    share: {
      icon: <Clock3 className="w-2.5 h-2.5" />,
      cls: "bg-amber-500/10 text-amber-400 border-amber-500/15",
      label: "Share",
    },
  };

  const key = type?.toLowerCase() ?? "";
  const found = cfg[key] ?? {
    icon: <AlertCircle className="w-2.5 h-2.5" />,
    cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/15",
    label: type ?? "—",
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border", found.cls)}>
      {found.icon}
      {found.label}
    </span>
  );
}

function ColHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  field?: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = field === sortField;
  return (
    <th
      className={cn(
        "text-left px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider select-none",
        field && "cursor-pointer hover:text-foreground transition-colors",
        className
      )}
      onClick={() => field && onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {field && (
          <ChevronsUpDown
            className={cn("w-3 h-3 transition-opacity", active ? "opacity-100 text-foreground" : "opacity-30")}
          />
        )}
      </span>
    </th>
  );
}

export function ExpenseTableContent({
  expenses,
  currentUser,
  onDeleteExpense,
  onOpenChat,
}: ExpenseTableProps) {
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState<string | null>(null);
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);

  // Collect all unique currencies from the expense list
  const allCurrencies = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => { if (e.currency) set.add(e.currency.toUpperCase()); });
    return ["All", ...Array.from(set)];
  }, [expenses]);

  const formatAmount = (amount: number, fromCurrency: string) => {
    const target = currencyFilter || fromCurrency;
    const converted = currencyFilter ? convertAmount(amount, fromCurrency, currencyFilter) : amount;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: target || "INR",
      maximumFractionDigits: 0,
    }).format(converted);
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });

  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(f); setSortDir("asc"); }
    setPage(0);
  };

  // Filter by currency if selected
  const filtered = useMemo(() =>
    currencyFilter ? expenses.filter((e) => e.currency?.toUpperCase() === currencyFilter) : expenses,
    [expenses, currencyFilter]
  );

  const sorted2 = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === "description") cmp = (a.description ?? "").localeCompare(b.description ?? "");
    else if (sortField === "date") cmp = (a.date ?? 0) - (b.date ?? 0);
    else if (sortField === "amount") cmp = (a.amount ?? 0) - (b.amount ?? 0);
    else if (sortField === "splitType") cmp = (a.splitType ?? "").localeCompare(b.splitType ?? "");
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted2.length / PAGE_SIZE);
  const paged = sorted2.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const allSelected = paged.length > 0 && selectedIds.length === paged.length;
  const toggleAll = () => setSelectedIds(allSelected ? [] : paged.map((e) => e._id));
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <div className="flex flex-col rounded-xl overflow-hidden border border-border bg-card">
      {/* Column header bar — matches Linear exactly */}
      <div className="border-b border-border bg-muted/30">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-10" />
            <col className="w-[32%]" />
            <col className="w-[13%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-10" />
          </colgroup>
          <thead>
            <tr>
              <th className="px-3 py-2.5">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  className="rounded-[4px] border-primary/20 w-3.5 h-3.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </th>
              <ColHeader label="Transaction" field="description" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <ColHeader label="Status" field="splitType" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <ColHeader label="Paid By" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <ColHeader label="Date" field="date" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <ColHeader label="Members" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-center" />
              {/* Currency / Amount header with dropdown filter */}
              <th className="text-right px-3 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider select-none">
                <div className="relative flex justify-end">
                  <button
                    onClick={() => setCurrencyMenuOpen((o) => !o)}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <span>{currencyFilter ? `${currencyFilter} ↔ converted` : "Amount"}</span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                  {currencyMenuOpen && (
                    <div className="absolute top-6 right-0 z-50 bg-popover border border-border rounded-lg shadow-xl p-1 min-w-[140px]">
                      <p className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Filter &amp; Convert to
                      </p>
                      {allCurrencies.map((cur) => (
                        <button
                          key={cur}
                          onClick={() => {
                            setCurrencyFilter(cur === "All" ? null : cur);
                            setCurrencyMenuOpen(false);
                            setPage(0);
                          }}
                          className={cn(
                            "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition-colors cursor-pointer",
                            (cur === "All" ? !currencyFilter : currencyFilter === cur)
                              ? "bg-accent text-foreground font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          {cur === "All" ? (
                            <><RefreshCw className="w-3 h-3" />Show All</>
                          ) : (
                            <><span className="font-mono w-8">{cur}</span>{cur !== "INR" && <span className="text-[10px] text-muted-foreground">→ {RATES_TO_INR[cur] ? `₹${RATES_TO_INR[cur]}` : "rate N/A"}</span>}</>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </th>
              <th />
            </tr>
          </thead>
        </table>
      </div>

      {/* Rows */}
      <div className="overflow-auto">
        {paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 gap-3">
            <Receipt className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm text-foreground font-medium">No expenses logged yet</p>
            <p className="text-xs text-muted-foreground">Add an expense to start tracking splits.</p>
          </div>
        ) : (
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-10" />
              <col className="w-[32%]" />
              <col className="w-[13%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-10" />
            </colgroup>
            <tbody>
              {paged.map((expense) => {
                const isSelected = selectedIds.includes(expense._id);
                const isHovered = hoveredId === expense._id;
                const payerName = expense.paidBy?.name || expense.paidByName || "Unknown";

                return (
                  <tr
                    key={expense._id}
                    className={cn(
                      "group border-b border-border transition-colors duration-100 cursor-pointer",
                      isSelected
                        ? "bg-primary/5"
                        : isHovered
                        ? "bg-muted/40"
                        : "bg-transparent"
                    )}
                    onMouseEnter={() => setHoveredId(expense._id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onOpenChat(expense._id)}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(expense._id)}
                        className="rounded-[4px] border-primary/20 w-3.5 h-3.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </td>

                    {/* Transaction name + badges */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-medium text-foreground truncate leading-tight">
                          {expense.description}
                        </span>
                        {expense.importBatchId && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 shrink-0">
                            <FileInput className="w-2 h-2" />
                            CSV
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status / Split Type */}
                    <td className="px-3 py-3">
                      <SplitTypePill type={expense.splitType} isSettlement={expense.isSettlement} />
                    </td>

                    {/* Paid By */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5 ring-1 ring-border shrink-0">
                          <AvatarImage src={expense.paidBy?.avatarUrl} />
                          <AvatarFallback className="text-[8px] bg-muted text-muted-foreground font-semibold">
                            {payerName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[12px] text-foreground truncate">{payerName}</span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-3">
                      <span className="text-[12px] text-muted-foreground tabular-nums">
                        {formatDate(expense.date)}
                      </span>
                    </td>

                    {/* Members avatar stack */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center -space-x-1.5">
                        {expense.splits?.slice(0, 4).map((split: any, idx: number) => (
                          <Avatar key={idx} className="h-5 w-5 ring-1 ring-background">
                            <AvatarFallback className="text-[7px] bg-muted text-muted-foreground font-semibold uppercase">
                              {split.userName?.[0] ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {expense.splits?.length > 4 && (
                          <div className="h-5 w-5 rounded-full bg-muted border border-background flex items-center justify-center text-[7px] font-bold text-muted-foreground">
                            +{expense.splits.length - 4}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-3 text-right">
                      <span className="text-[13px] font-semibold text-foreground tabular-nums">
                        {formatAmount(expense.amount, expense.currency)}
                      </span>
                      {currencyFilter && expense.currency?.toUpperCase() !== currencyFilter && (
                        <div className="text-[10px] text-muted-foreground/60 tabular-nums">
                          orig {new Intl.NumberFormat("en-IN", { style: "currency", currency: expense.currency || "INR", maximumFractionDigits: 0 }).format(expense.amount)}
                        </div>
                      )}
                    </td>

                    {/* Actions — appears on hover */}
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className={cn("flex justify-center transition-opacity", isHovered || isSelected ? "opacity-100" : "opacity-0")}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" />
                            }
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-40 bg-popover border border-border shadow-2xl rounded-lg p-1 text-sm"
                          >
                            <DropdownMenuItem
                              onClick={() => onOpenChat(expense._id)}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer text-[12px]"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              Open Chat
                            </DropdownMenuItem>
                            {currentUser && expense.paidById === currentUser._id && (
                              <DropdownMenuItem
                                onClick={() => onDeleteExpense(expense._id)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/[0.08] cursor-pointer text-[12px] font-medium"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer: count + pagination */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-card">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {filtered.length === 0
            ? "No records"
            : selectedIds.length > 0
            ? `${selectedIds.length} selected of ${filtered.length}`
            : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, sorted2.length)} of ${sorted2.length}`}
          {currencyFilter && <span className="ml-2 text-primary font-medium">· converted to {currencyFilter}</span>}
        </span>

        <div className="flex items-center gap-1">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={cn(
                "h-6 min-w-[24px] px-1.5 flex items-center justify-center rounded-md text-[11px] font-medium transition-colors",
                page === i
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {i + 1}
            </button>
          ))}

          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
