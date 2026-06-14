"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { calculateBalances, simplifyDebts } from "@/lib/balances";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  ChevronRight,
  Trash2,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface AIChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: any;
}

export function AIChatSheet({ open, onOpenChange, currentUser }: AIChatSheetProps) {
  const params = useParams();
  const groupId = params?.groupId as any;

  const expenses = useQuery(api.expenses.getGroupExpenses, groupId ? { groupId } : "skip");
  const settlements = useQuery(api.settlements.getGroupSettlements, groupId ? { groupId } : "skip");
  const members = useQuery(api.groups.getGroupMembers, groupId ? { groupId } : "skip");

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, aiLoading]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || chatInput.trim();
    if (!textToSend) return;
    if (!customText) setChatInput("");

    const userMessage: Message = { id: Math.random().toString(), role: "user", text: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setAiLoading(true);

    try {
      let simplified: any[] = [];
      let userMap: Record<string, string> = {};

      if (expenses && settlements && members) {
        userMap = Object.fromEntries(members.map((m) => [m.userId, m.user?.name || "Unknown User"]));
        const balances = calculateBalances(expenses as any, settlements as any, userMap);
        simplified = simplifyDebts(balances);
      }

      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          simplified,
          userMap,
          expenses: expenses ? expenses.slice(0, 15) : [],
        }),
      });

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { id: Math.random().toString(), role: "assistant", text: data.response || "No response from AI." },
      ]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect to AI assistant.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[340px] sm:w-[380px] flex flex-col p-0 bg-sidebar border-r border-border"
        style={{ marginLeft: "var(--sidebar-width, 16rem)" }}
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-muted border border-border flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <SheetTitle className="text-[13px] font-semibold text-foreground leading-none">
              AI Assistant
            </SheetTitle>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              title="Clear chat"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </SheetHeader>

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-8">
              <div className="w-10 h-10 rounded-xl border border-border bg-muted flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h4 className="text-[13px] font-semibold text-foreground">SplitSmart AI</h4>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-[240px] leading-relaxed">
                  {groupId
                    ? "Ask about this group's expenses, who paid, or how to settle up."
                    : "Ask anything about expenses, CSV parsing, or debt calculations."}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 w-full">
                {groupId ? (
                  <>
                    <button
                      onClick={() => handleSendMessage("Who has paid the most expenses so far?")}
                      className="flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-accent border border-border rounded-lg text-[11px] text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                    >
                      <span>Who paid the most?</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleSendMessage("How can we simplify and settle all debts?")}
                      className="flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-accent border border-border rounded-lg text-[11px] text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                    >
                      <span>Settle all debts</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleSendMessage("What are the CSV parser guidelines?")}
                    className="flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-accent border border-border rounded-lg text-[11px] text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                  >
                    <span>CSV parser guidelines</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => handleSendMessage("Explain how debt simplification works.")}
                  className="flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-accent border border-border rounded-lg text-[11px] text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  <span>How does debt simplification work?</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={cn("flex w-full gap-2", isUser ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed break-words",
                      isUser
                        ? "bg-foreground text-background rounded-br-none"
                        : "bg-muted border border-border text-foreground rounded-bl-none"
                    )}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>
                </div>
              );
            })
          )}
          {aiLoading && (
            <div className="flex gap-2 items-center text-[11px] text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 p-3 border-t border-border">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg p-1 focus-within:border-foreground/30 transition-colors"
          >
            <Input
              type="text"
              placeholder="Ask anything..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={aiLoading}
              className="bg-transparent! border-none! text-foreground placeholder:text-muted-foreground/50 h-7 text-[12px] focus-visible:ring-0! flex-1 outline-none"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || aiLoading}
              className="h-7 w-7 bg-foreground hover:bg-foreground/90 text-background rounded-md flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Send className="h-3 w-3" />
            </button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
