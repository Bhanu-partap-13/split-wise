"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { calculateBalances, simplifyDebts } from "@/lib/balances";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { RecordSettlementDialog } from "./RecordSettlementDialog";
import { Brain, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";

interface Props {
  groupId: Id<"groups">;
  currentUser: any;
}

export function BalanceSummary({ groupId, currentUser }: Props) {
  const expenses = useQuery(api.expenses.getGroupExpenses, { groupId });
  const settlements = useQuery(api.settlements.getGroupSettlements, { groupId });
  const members = useQuery(api.groups.getGroupMembers, { groupId });
  
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [settleDialog, setSettleDialog] = useState<{ from: string; to: string; amount: number } | null>(null);

  if (expenses === undefined || settlements === undefined || members === undefined) {
    return (
      <div className="flex justify-center items-center py-12 text-brand-gray text-sm">
        <Loader2 className="w-6 h-6 animate-spin text-soft-teal mr-2" />
        Calculating shared balances...
      </div>
    );
  }

  const userMap = Object.fromEntries(
    members.map((m) => [m.userId, m.user?.name || "Unknown User"])
  );
  
  const balances = calculateBalances(expenses as any, settlements as any, userMap);
  const simplified = simplifyDebts(balances);

  const getAISummary = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          simplified, 
          userMap, 
          expenses: expenses.slice(0, 15) 
        }),
      });
      const data = await res.json();
      setAiSummary(data.summary);
    } catch {
      setAiSummary("Unable to generate AI balance summary at this time.");
    } finally {
      setAiLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-IN", { 
      style: "currency", 
      currency: "INR", 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  return (
    <div className="space-y-6 w-full text-white">
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

      <Card className="bg-dark-navy-surface border-subtle-blue-gray/50 text-white shadow-md">
        <CardHeader className="flex flex-row items-center justify-between border-b border-subtle-blue-gray/25 pb-4">
          <CardTitle className="text-base font-bold font-heading">Outstanding Balances</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={getAISummary} 
            disabled={aiLoading}
            className="border-soft-teal/40 hover:bg-soft-teal/10 text-soft-teal text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            {aiLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analyzing ledger...
              </>
            ) : (
              <>
                <Brain className="w-3.5 h-3.5" />
                Explain My Balances
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          {aiSummary && (
            <div className="mb-6 bg-soft-teal/5 rounded-xl p-5 text-sm text-soft-teal border border-soft-teal/20 relative overflow-hidden">
              <div className="absolute top-4 right-4 text-soft-teal/15">
                <Sparkles className="w-12 h-12" />
              </div>
              <div className="font-bold mb-2 flex items-center gap-1.5 text-white font-heading">
                <Brain className="w-4 h-4 text-soft-teal" />
                AI Ledger Breakdown
              </div>
              <p className="text-brand-gray text-xs leading-relaxed max-w-2xl">{aiSummary}</p>
            </div>
          )}
          
          {simplified.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-soft-teal/10 border border-soft-teal/20 flex items-center justify-center text-soft-teal mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-heading text-white mb-0.5">All settled up!</h3>
              <p className="text-brand-gray text-xs">No outstanding debts exist inside this group.</p>
            </div>
          ) : (
            <div className="space-y-1 divide-y divide-subtle-blue-gray/15">
              {simplified.map((b, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 text-sm min-w-0">
                    <span className="font-bold text-white font-heading truncate">
                      {userMap[b.fromUser] || b.fromUser}
                    </span>
                    <ArrowRight className="w-4 h-4 text-brand-gray shrink-0" />
                    <span className="font-bold text-white font-heading truncate">
                      {userMap[b.toUser] || b.toUser}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                    <span className="font-extrabold text-red-500 font-heading text-base">
                      {formatAmount(b.amount)}
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setSettleDialog({ from: b.fromUser, to: b.toUser, amount: b.amount })}
                      className="border-subtle-blue-gray hover:bg-subtle-blue-gray/30 text-white font-medium text-xs"
                    >
                      Record Payment
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
