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
import { Loader2, Plus } from "lucide-react";

interface Props {
  groupId: Id<"groups">;
  currentUser: any;
  onClose: () => void;
}

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
      if (isNaN(amt) || amt <= 0) {
        throw new Error("Please enter a valid amount");
      }
      
      const perPerson = amt / members.length;
      const splits = members.map((m) => ({
        userId: m.userId,
        userName: m.user?.name || "Unknown User",
        amount: Math.round(perPerson * 100) / 100,
      }));

      await createExpense({
        groupId,
        description: description.trim(),
        amount: amt,
        currency,
        paidById: currentUser._id,
        splitType,
        date: Date.now(),
        isSettlement: false,
        createdBy: currentUser._id,
        splits,
      });

      toast({ title: "Expense logged successfully!" });
      onClose();
    } catch (err) {
      toast({
        title: "Error adding expense",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-dark-navy-surface border border-subtle-blue-gray/50 text-white max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-heading text-white">Log Shared Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <div className="space-y-2">
            <Label htmlFor="desc" className="text-brand-gray text-xs font-semibold uppercase tracking-wider">Description</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Electricity Bill, Dinner at Restaurant"
              className="bg-deep-navy border-subtle-blue-gray text-white placeholder-brand-gray/45 focus-visible:ring-soft-teal"
              required
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="amount" className="text-brand-gray text-xs font-semibold uppercase tracking-wider">Amount</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                className="bg-deep-navy border-subtle-blue-gray text-white placeholder-brand-gray/45 focus-visible:ring-soft-teal"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency" className="text-brand-gray text-xs font-semibold uppercase tracking-wider">Currency</Label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-10 border border-subtle-blue-gray rounded-md bg-deep-navy text-white px-3 text-sm focus:border-soft-teal focus:outline-none w-24"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="splitType" className="text-brand-gray text-xs font-semibold uppercase tracking-wider">Split Strategy</Label>
            <select
              id="splitType"
              value={splitType}
              onChange={(e) => setSplitType(e.target.value as any)}
              className="w-full h-10 border border-subtle-blue-gray rounded-md bg-deep-navy text-white px-3 text-sm focus:border-soft-teal focus:outline-none"
            >
              <option value="equal">Split Equally among all members</option>
              <option value="unequal" disabled>Unequal shares (CSV Import exclusive)</option>
              <option value="percentage" disabled>Percentage-weighted (CSV Import exclusive)</option>
              <option value="share" disabled>Shares-weighted (CSV Import exclusive)</option>
            </select>
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
              className="bg-electric-blue hover:bg-electric-blue/80 text-white font-bold flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Log Expense
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
