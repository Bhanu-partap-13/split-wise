"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Calendar,
  Clock,
  ArrowRightLeft,
  FileSpreadsheet,
  Receipt,
  MessageSquare,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ExpenseGroupProps {
  title: string;
  expenses: any[];
  accentColor: string;
  defaultExpanded?: boolean;
  currentUser: any;
  onDeleteExpense: (id: string) => void;
  onOpenChat: (id: string) => void;
}

function ExpenseGroup({
  title,
  expenses,
  accentColor,
  defaultExpanded = true,
  currentUser,
  onDeleteExpense,
  onOpenChat,
}: ExpenseGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="flex flex-col">
      {/* Group Header Banner */}
      <div className="flex items-center justify-between mb-3 px-4 py-2 bg-subtle-blue-gray/15 border border-subtle-blue-gray/20 rounded-xl">
        <div
          className="flex items-center gap-3 cursor-pointer w-full select-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 text-brand-gray bg-subtle-blue-gray/30 rounded transition-transform duration-200",
              !isExpanded && "-rotate-90"
            )}
          />
          <div className={cn("w-1 h-4 rounded-full", accentColor)} />
          <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            {title}
            <span className="text-[10px] font-bold bg-subtle-blue-gray/40 text-brand-gray px-2 py-0.5 rounded">
              {expenses.length}
            </span>
          </h2>
        </div>
      </div>

      {/* Group Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden w-full bg-transparent mt-1 mb-4"
          >
            <div className="border border-subtle-blue-gray/25 rounded-xl bg-dark-navy-surface overflow-hidden">
              <Table>
                <TableHeader className="bg-subtle-blue-gray/5 border-b border-subtle-blue-gray/20">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-xs font-bold text-brand-gray px-4 py-3 min-w-[200px]">Transaction</TableHead>
                    <TableHead className="text-xs font-bold text-brand-gray px-4">Paid By</TableHead>
                    <TableHead className="text-xs font-bold text-brand-gray px-4">Split Type</TableHead>
                    <TableHead className="text-xs font-bold text-brand-gray px-4">Date</TableHead>
                    <TableHead className="text-xs font-bold text-brand-gray px-4 text-right">Amount</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-subtle-blue-gray/10">
                  {expenses.length === 0 ? (
                    <TableRow className="hover:bg-transparent border-none">
                      <TableCell colSpan={6} className="py-8 text-center text-xs text-brand-gray italic">
                        No transactions logged in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenses.map((expense) => {
                      const payerName = expense.paidBy?.name || expense.paidByName || "Unknown User";
                      return (
                        <TableRow
                          key={expense._id}
                          className="hover:bg-subtle-blue-gray/10 border-b border-subtle-blue-gray/10 transition-colors cursor-pointer"
                          onClick={() => onOpenChat(expense._id)}
                        >
                          <TableCell className="p-3 pl-4 max-w-[220px]">
                            <div className="flex flex-col gap-1 text-left">
                              <span className="font-bold text-white text-xs truncate">{expense.description}</span>
                              <div className="flex flex-wrap gap-1">
                                {expense.isSettlement && (
                                  <Badge className="text-[8px] h-3.5 py-0 font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    Settlement
                                  </Badge>
                                )}
                                {expense.importBatchId && (
                                  <Badge className="text-[8px] h-3.5 py-0 font-bold bg-soft-teal/10 text-soft-teal border border-soft-teal/20">
                                    Imported
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="p-3">
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-5 w-5 border border-subtle-blue-gray/20">
                                <AvatarImage src={expense.paidBy?.avatarUrl} />
                                <AvatarFallback className="text-[7px] bg-subtle-blue-gray text-white font-bold uppercase">
                                  {payerName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[11px] font-semibold text-brand-white">{payerName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="p-3">
                            <Badge variant="outline" className="text-[9px] h-3.5 py-0 uppercase border-subtle-blue-gray/50 text-brand-gray font-normal">
                              {expense.splitType}
                            </Badge>
                          </TableCell>
                          <TableCell className="p-3 text-brand-gray text-[11px]">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-brand-gray" />
                              <span>{new Date(expense.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                            </div>
                          </TableCell>
                          <TableCell className="p-3 text-right font-extrabold text-white text-xs">
                            {formatAmount(expense.amount, expense.currency)}
                          </TableCell>
                          <TableCell className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-6 w-6 text-brand-gray hover:text-white rounded-md" />}>
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36 bg-dark-navy-surface border border-subtle-blue-gray/45 text-white">
                                <DropdownMenuItem onClick={() => onOpenChat(expense._id)} className="gap-2 cursor-pointer text-xs">
                                  <MessageSquare className="w-3 h-3" /> Chat
                                </DropdownMenuItem>
                                {currentUser && expense.paidById === currentUser._id && (
                                  <DropdownMenuItem
                                    onClick={() => onDeleteExpense(expense._id)}
                                    className="gap-2 text-red-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer text-xs font-semibold"
                                  >
                                    <Trash2 className="w-3 h-3" /> Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ExpenseListContentProps {
  expenses: any[];
  currentUser: any;
  onDeleteExpense: (id: string) => void;
  onOpenChat: (id: string) => void;
}

export function ExpenseListContent({
  expenses,
  currentUser,
  onDeleteExpense,
  onOpenChat,
}: ExpenseListContentProps) {
  // Categorize expenses into Month groupings: This Month, Last Month, and Older
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

  const thisMonthExpenses = expenses.filter((e) => e.date >= currentMonthStart);
  const lastMonthExpenses = expenses.filter((e) => e.date >= lastMonthStart && e.date < currentMonthStart);
  const olderExpenses = expenses.filter((e) => e.date < lastMonthStart);

  const isAllEmpty = expenses.length === 0;

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-3 duration-300">
      {isAllEmpty ? (
        <div className="border border-subtle-blue-gray/25 border-dashed rounded-xl bg-dark-navy-surface py-20 text-center text-brand-gray">
          <Receipt className="w-10 h-10 opacity-30 mx-auto text-soft-teal mb-3" />
          <h3 className="text-base font-bold text-white mb-0.5">No transactions logged</h3>
          <p className="text-xs max-w-xs mx-auto px-4">Add a shared expense manually or upload a sheet to get started.</p>
        </div>
      ) : (
        <>
          <ExpenseGroup
            title="This Month"
            expenses={thisMonthExpenses}
            accentColor="bg-soft-teal"
            defaultExpanded={thisMonthExpenses.length > 0 || lastMonthExpenses.length === 0}
            currentUser={currentUser}
            onDeleteExpense={onDeleteExpense}
            onOpenChat={onOpenChat}
          />
          <ExpenseGroup
            title="Last Month"
            expenses={lastMonthExpenses}
            accentColor="bg-electric-blue"
            defaultExpanded={lastMonthExpenses.length > 0 && thisMonthExpenses.length === 0}
            currentUser={currentUser}
            onDeleteExpense={onDeleteExpense}
            onOpenChat={onOpenChat}
          />
          <ExpenseGroup
            title="Older Transactions"
            expenses={olderExpenses}
            accentColor="bg-slate-400"
            defaultExpanded={olderExpenses.length > 0 && thisMonthExpenses.length === 0 && lastMonthExpenses.length === 0}
            currentUser={currentUser}
            onDeleteExpense={onDeleteExpense}
            onOpenChat={onOpenChat}
          />
        </>
      )}
    </div>
  );
}
