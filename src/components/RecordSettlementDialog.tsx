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
import { ArrowRightLeft, Loader2, Landmark, CheckCircle2 } from "lucide-react";

interface Props {
  groupId: Id<"groups">;
  currentUser: any;
  defaultFrom: string;
  defaultTo: string;
  defaultAmount: number;
  members: any[];
  onClose: () => void;
}

export function RecordSettlementDialog({
  groupId,
  currentUser,
  defaultFrom,
  defaultTo,
  defaultAmount,
  members,
  onClose,
}: Props) {
  const recordSettlement = useMutation(api.settlements.record);
  const createExpense = useMutation(api.expenses.create); // We log settlement as a transaction in the expenses table so it shows up in Ledger
  const [amount, setAmount] = useState(defaultAmount.toFixed(0));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fromMember = members.find((m) => m.userId === defaultFrom);
  const toMember = members.find((m) => m.userId === defaultTo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error("Please enter a valid amount");
      }

      // 1. Record the settlement in settlements table
      await recordSettlement({
        groupId,
        fromUserId: defaultFrom as Id<"users">,
        toUserId: defaultTo as Id<"users">,
        amount: amt,
        currency: "INR",
        note: note.trim() || undefined,
        recordedBy: currentUser._id,
      });

      // 2. Also log in expenses table with isSettlement: true so it renders on the Ledger
      const splits = [
        {
          userId: defaultFrom as Id<"users">,
          userName: fromMember?.user?.name || "Member",
          amount: amt,
        },
      ];

      await createExpense({
        groupId,
        description: `Settlement: ${fromMember?.user?.name || "User"} paid ${toMember?.user?.name || "User"}`,
        amount: amt,
        currency: "INR",
        paidById: defaultTo as Id<"users">, // recipient is marked as payer so it offsets debt
        splitType: "equal",
        date: Date.now(),
        notes: note.trim() || undefined,
        isSettlement: true,
        createdBy: currentUser._id,
        splits,
      });

      toast({ title: "Settlement recorded successfully!" });
      onClose();
    } catch (err) {
      toast({
        title: "Error recording settlement",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-dark-navy-surface border border-subtle-blue-gray/50 text-white max-w-sm w-full">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-heading text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-soft-teal" />
            Record Settlement
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <div className="p-4 bg-deep-navy/40 border border-subtle-blue-gray/30 rounded-xl space-y-1 text-xs leading-relaxed text-brand-gray">
            <div className="flex items-center justify-between text-white text-sm font-semibold mb-2">
              <span>Transfer summary</span>
              <Landmark className="w-4 h-4 text-soft-teal" />
            </div>
            <div>
              Debtor: <span className="text-white font-medium">{fromMember?.user?.name || defaultFrom}</span>
            </div>
            <div>
              Creditor: <span className="text-white font-medium">{toMember?.user?.name || defaultTo}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-brand-gray text-xs font-semibold uppercase tracking-wider">Amount (INR)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              step="1"
              className="bg-deep-navy border-subtle-blue-gray text-white placeholder-brand-gray/45 focus-visible:ring-soft-teal"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note" className="text-brand-gray text-xs font-semibold uppercase tracking-wider">Note (Optional)</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Sent via UPI, Paid in cash"
              className="bg-deep-navy border-subtle-blue-gray text-white placeholder-brand-gray/45 focus-visible:ring-soft-teal"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-subtle-blue-gray text-white hover:bg-subtle-blue-gray/30"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !amount}
              className="bg-soft-teal hover:bg-soft-teal/80 text-deep-navy font-bold flex items-center gap-1.5 shadow-lg shadow-soft-teal/15 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Record Settlement
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
