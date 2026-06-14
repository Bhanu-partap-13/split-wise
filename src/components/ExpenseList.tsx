"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useRef } from "react";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { ExpenseChatDrawer } from "./ExpenseChatDrawer";
import { useToast } from "@/components/ui/use-toast";
import { ExpenseTableContent } from "./ExpenseTableContent";
import { ExpenseListContent } from "./ExpenseListContent";
import { cn } from "@/lib/utils";
import { 
  PlusCircle, 
  Loader2,
  Table as TableIcon,
  List as ListIcon
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface Props {
  groupId: Id<"groups">;
  currentUser: any;
}

export function ExpenseList({ groupId, currentUser }: Props) {
  const expenses = useQuery(api.expenses.getGroupExpenses, { groupId });
  const deleteExpense = useMutation(api.expenses.deleteExpense);
  const { toast } = useToast();
  
  const [addOpen, setAddOpen] = useState(false);
  const [chatExpenseId, setChatExpenseId] = useState<Id<"expenses"> | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "list">("table");

  const contentRef = useRef<HTMLDivElement>(null);

  // GSAP: Animate view mode toggle transition
  useGSAP(() => {
    if (contentRef.current) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 15, scale: 0.985 },
        { 
          opacity: 1, 
          y: 0, 
          scale: 1, 
          duration: 0.45, 
          ease: "power2.out" 
        }
      );
    }
  }, [viewMode]);

  const handleDeleteExpense = async (expenseId: Id<"expenses">) => {
    try {
      await deleteExpense({ expenseId }); 
      toast({ title: "Expense record deleted" }); 
    } catch {
      toast({ title: "Failed to delete expense", variant: "destructive" });
    }
  };

  if (expenses === undefined) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="w-8 h-8 text-soft-teal animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-100 tracking-tight">Ledger</h2>
          <p className="text-[12px] text-zinc-600 mt-0.5">All transactions for this group.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle — Linear-style segmented control */}
          <div className="flex items-center bg-white/[0.04] p-0.5 border border-white/[0.06] rounded-lg">
            <button
              onClick={() => setViewMode("table")}
              title="Table View"
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                viewMode === "table"
                  ? "bg-white/[0.1] text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-300"
              )}
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="List View"
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded-md transition-colors cursor-pointer",
                viewMode === "list"
                  ? "bg-white/[0.1] text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-300"
              )}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add Expense — Vercel-style sharp button */}
          <button
            onClick={() => setAddOpen(true)}
            className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add Expense
          </button>
        </div>
      </div>

      {addOpen && (
        <AddExpenseDialog 
          groupId={groupId} 
          currentUser={currentUser} 
          onClose={() => setAddOpen(false)} 
        />
      )}
      
      {chatExpenseId && (
        <ExpenseChatDrawer 
          expenseId={chatExpenseId} 
          currentUser={currentUser} 
          onClose={() => setChatExpenseId(null)} 
        />
      )}

      <div ref={contentRef} className="opacity-0 w-full flex flex-col">
        {viewMode === "table" ? (
          <ExpenseTableContent
            expenses={expenses}
            currentUser={currentUser}
            onDeleteExpense={(id) => handleDeleteExpense(id as Id<"expenses">)}
            onOpenChat={(id) => setChatExpenseId(id as Id<"expenses">)}
          />
        ) : (
          <ExpenseListContent
            expenses={expenses}
            currentUser={currentUser}
            onDeleteExpense={(id) => handleDeleteExpense(id as Id<"expenses">)}
            onOpenChat={(id) => setChatExpenseId(id as Id<"expenses">)}
          />
        )}
      </div>
    </div>
  );
}
