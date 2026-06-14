"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { calculateBalances, simplifyDebts } from "@/lib/balances";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Bug,
  HelpCircle,
  MessageSquare,
  CreditCard,
  MoreHorizontal,
  Send,
  Loader2,
  HelpCircleIcon,
  ChevronRight,
  Headset,
  Trash2,
  Square,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface HelpSupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: any;
  defaultTab?: "ai" | "contact";
}

export function HelpSupportDialog({
  open,
  onOpenChange,
  currentUser,
  defaultTab = "ai",
}: HelpSupportDialogProps) {
  const params = useParams();
  const groupId = params?.groupId as any;

  // Fetch contextual group ledger info if inside a group details page
  const expenses = useQuery(
    api.expenses.getGroupExpenses,
    groupId ? { groupId } : "skip"
  );
  const settlements = useQuery(
    api.settlements.getGroupSettlements,
    groupId ? { groupId } : "skip"
  );
  const members = useQuery(
    api.groups.getGroupMembers,
    groupId ? { groupId } : "skip"
  );

  const [activeTab, setActiveTab] = useState<"ai" | "contact">("ai");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTag, setSelectedTag] = useState<
    "found bug" | "help needed" | "query" | "payment issue" | "others"
  >("found bug");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, aiLoading]);

  // Support tags config
  const supportTags = [
    { id: "found bug", label: "Found Bug", icon: Bug },
    { id: "help needed", label: "Help Needed", icon: HelpCircle },
    { id: "query", label: "Query", icon: MessageSquare },
    { id: "payment issue", label: "Payment Issue", icon: CreditCard },
    { id: "others", label: "Others", icon: MoreHorizontal },
  ] as const;

  const placeholders = {
    "found bug": {
      title: "e.g., CSV parser skipped valid rows",
      desc: "Please describe the bug, how to reproduce it, and what occurred...",
    },
    "help needed": {
      title: "e.g., How to split an expense unequally by share",
      desc: "Tell us what you want to achieve and where you are stuck...",
    },
    "query": {
      title: "e.g., Supported CSV export formats for import",
      desc: "Ask us anything about SplitSmart features, parsing issues, or settings...",
    },
    "payment issue": {
      title: "e.g., Recorded payment is not reflecting in user balance",
      desc: "Specify details of the transaction and what seems wrong...",
    },
    "others": {
      title: "e.g., Feedback / Feature request",
      desc: "How can we help you today?",
    },
  };

  const currentPlaceholder = placeholders[selectedTag];

  // AI chat send message
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || chatInput.trim();
    if (!textToSend) return;

    if (!customText) {
      setChatInput("");
    }

    const userMessage: Message = {
      id: Math.random().toString(),
      role: "user",
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMessage]);
    setAiLoading(true);

    try {
      // Gather contextual ledger details
      let simplified: any[] = [];
      let userMap: Record<string, string> = {};

      if (expenses && settlements && members) {
        userMap = Object.fromEntries(
          members.map((m) => [m.userId, m.user?.name || "Unknown User"])
        );
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

      const assistantMessage: Message = {
        id: Math.random().toString(),
        role: "assistant",
        text: data.response || "I didn't receive a response from the AI model.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect to AI assistant.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Please fill in both title and description.");
      return;
    }

    setIsSubmitting(true);
    // Simulate support ticket submission
    await new Promise((resolve) => setTimeout(resolve, 1200));

    toast.success("Support ticket submitted successfully! Our team will get back to you shortly.");
    setTitle("");
    setDescription("");
    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] p-4 rounded-xl h-[560px] flex flex-col overflow-hidden bg-dark-navy-surface border border-subtle-blue-gray/50 shadow-2xl text-white">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
            <HelpCircleIcon className="h-5 w-5 text-soft-teal shrink-0" />
            Help & Support
          </DialogTitle>
          <div className="flex items-center text-xs text-brand-gray justify-between">
            <p>Submit a ticket to our team or consult the AI assistant.</p>
            <div className="flex items-center rounded bg-subtle-blue-gray/30 p-0.5 border border-subtle-blue-gray/20">
              <Button
                variant="ghost"
                className={cn(
                  "text-[10px] h-6 px-3 rounded-sm text-brand-gray hover:text-white cursor-pointer",
                  activeTab === "ai" && "bg-electric-blue text-white hover:bg-electric-blue"
                )}
                onClick={() => setActiveTab("ai")}
              >
                Talk to AI
              </Button>
              <Button
                variant="ghost"
                className={cn(
                  "text-[10px] h-6 px-3 rounded-sm text-brand-gray hover:text-white cursor-pointer",
                  activeTab === "contact" && "bg-electric-blue text-white hover:bg-electric-blue"
                )}
                onClick={() => setActiveTab("contact")}
              >
                Contact support
              </Button>
            </div>
          </div>
        </DialogHeader>

        {activeTab === "contact" ? (
          <form onSubmit={handleSupportSubmit} className="space-y-4 text-left flex flex-col h-full flex-1">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-zinc-300">Category Tag</Label>
              <div className="flex flex-wrap gap-1.5">
                {supportTags.map((tag) => {
                  const isSelected = selectedTag === tag.id;
                  const Icon = tag.icon;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setSelectedTag(tag.id as any)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 text-[10px] rounded-full border font-medium cursor-pointer transition-all duration-200 select-none",
                        isSelected
                          ? "bg-white text-dark-navy-surface border-white font-bold"
                          : "bg-subtle-blue-gray/30 text-brand-gray border-subtle-blue-gray/20 hover:bg-subtle-blue-gray/50 hover:text-white"
                      )}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="support-title" className="text-xs font-semibold text-zinc-300">Title</Label>
              <Input
                id="support-title"
                type="text"
                required
                placeholder={currentPlaceholder.title}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-deep-navy! border border-subtle-blue-gray/40! text-white placeholder:text-brand-gray/50 h-9 rounded-md text-xs focus-visible:border-soft-teal! focus-visible:ring-0!"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="support-description" className="text-xs font-semibold text-zinc-300">Description</Label>
              <Textarea
                id="support-description"
                required
                rows={4}
                placeholder={currentPlaceholder.desc}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none bg-deep-navy! h-28 border border-subtle-blue-gray/40! text-white placeholder:text-brand-gray/50 rounded-md text-xs focus-visible:border-soft-teal! focus-visible:ring-0! leading-relaxed"
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-subtle-blue-gray/20 rounded-lg border border-subtle-blue-gray/10 mt-auto">
              <Headset className="h-4 w-4 text-soft-teal" />
              <div className="flex flex-col text-left">
                <div className="text-xs text-white">
                  Smart Support Queue Active
                </div>
                <span className="text-[10px] text-brand-gray">
                  Average response time: within 24 hours. We resolve ledger queries directly.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs h-8 border-subtle-blue-gray text-brand-gray hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-electric-blue hover:bg-electric-blue/80 text-white text-xs h-8 px-5 rounded-md flex items-center justify-center gap-1.5 border-none cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    Submitting
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </>
                ) : (
                  "Submit Ticket"
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 justify-between">
            {/* Messages Container */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto pr-1 mb-3 space-y-3 min-h-0 scrollbar-thin scrollbar-thumb-subtle-blue-gray scrollbar-track-transparent text-left"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4 space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-soft-teal/10 border border-soft-teal/20 flex items-center justify-center text-soft-teal">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">SplitSmart AI Assistant</h4>
                    <p className="text-xs text-brand-gray max-w-[280px]">
                      {groupId
                        ? "Ask me anything about this group's expenses, who paid, or how to settle up!"
                        : "Ask me anything about SplitSmart's CSV parser, debt calculations, or platform guides."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 w-full max-w-[380px] pt-1">
                    {groupId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSendMessage("Who has paid the most expenses so far?")}
                          className="flex items-center justify-between px-4 py-2 bg-deep-navy/55 hover:bg-subtle-blue-gray/30 border border-subtle-blue-gray/30 rounded-xl text-xs text-brand-gray hover:text-white transition-all cursor-pointer group"
                        >
                          <span>Who paid the most?</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage("How can we simplify and settle all debts?")}
                          className="flex items-center justify-between px-4 py-2 bg-deep-navy/55 hover:bg-subtle-blue-gray/30 border border-subtle-blue-gray/30 rounded-xl text-xs text-brand-gray hover:text-white transition-all cursor-pointer group"
                        >
                          <span>Settle all debts</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSendMessage("What are the CSV parser guidelines?")}
                          className="flex items-center justify-between px-4 py-2 bg-deep-navy/55 hover:bg-subtle-blue-gray/30 border border-subtle-blue-gray/30 rounded-xl text-xs text-brand-gray hover:text-white transition-all cursor-pointer group"
                        >
                          <span>CSV parser guidelines</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSendMessage("Explain how debt simplification works.")}
                      className="flex items-center justify-between px-4 py-2 bg-deep-navy/55 hover:bg-subtle-blue-gray/30 border border-subtle-blue-gray/30 rounded-xl text-xs text-brand-gray hover:text-white transition-all cursor-pointer group"
                    >
                      <span>Debt simplification algorithm</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex w-full gap-2.5 items-end",
                        isUser ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed break-words",
                          isUser
                            ? "bg-electric-blue text-white rounded-br-none shadow-md"
                            : "bg-deep-navy border border-subtle-blue-gray/30 text-zinc-100 rounded-bl-none"
                        )}
                      >
                        <p className="whitespace-pre-line">{msg.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
              {aiLoading && (
                <div className="flex gap-2 items-center text-xs text-brand-gray">
                  <Loader2 className="w-4 h-4 animate-spin text-soft-teal" />
                  <span>AI Assistant is drafting response...</span>
                </div>
              )}
            </div>

            {/* Chat Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-center gap-1.5 bg-deep-navy border border-subtle-blue-gray/40 rounded-md p-1 focus-within:border-soft-teal"
            >
              {messages.length > 0 && (
                <Button
                  type="button"
                  onClick={() => setMessages([])}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-brand-gray hover:text-white hover:bg-subtle-blue-gray/20 rounded-md shrink-0 flex items-center justify-center cursor-pointer"
                  title="Clear chat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Input
                type="text"
                placeholder="Ask anything..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={aiLoading}
                className="bg-transparent! border-none! text-white placeholder:text-brand-gray/50 h-8 text-xs focus-visible:ring-0! flex-1 outline-none pr-2"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!chatInput.trim() || aiLoading}
                className="h-8 w-8 bg-electric-blue hover:bg-electric-blue/80 text-white rounded-md shrink-0 flex items-center justify-center cursor-pointer disabled:bg-subtle-blue-gray/20 disabled:text-brand-gray/40 border-none"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
