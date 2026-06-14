"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Loader2 } from "lucide-react";

interface Props {
  expenseId: Id<"expenses">;
  currentUser: any;
  onClose: () => void;
}

export function ExpenseChatDrawer({ expenseId, currentUser, onClose }: Props) {
  const messages = useQuery(api.messages.getByExpense, { expenseId });
  const sendMessage = useMutation(api.messages.send);
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !currentUser) return;
    await sendMessage({
      expenseId,
      userId: currentUser._id,
      userName: currentUser.name,
      text: text.trim(),
    });
    setText("");
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-dark-navy-surface border border-subtle-blue-gray/50 text-white max-w-md w-full">
        <DialogHeader className="border-b border-subtle-blue-gray/25 pb-3">
          <DialogTitle className="text-lg font-bold font-heading text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-soft-teal" />
            Transaction Comments
          </DialogTitle>
        </DialogHeader>

        <div className="h-72 overflow-y-auto space-y-3 p-3 bg-deep-navy/40 border border-subtle-blue-gray/30 rounded-xl my-4 flex flex-col">
          {messages === undefined ? (
            <div className="flex-1 flex items-center justify-center text-brand-gray text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-soft-teal mr-1.5" />
              Loading comment history...
            </div>
          ) : !messages || messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-brand-gray">
              <MessageSquare className="w-8 h-8 text-subtle-blue-gray mb-2" />
              <p className="text-xs font-semibold text-white mb-0.5">No comments logged yet</p>
              <p className="text-[10px]">Ask questions or discuss splits with the group here.</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.userId === currentUser?._id;
              return (
                <div key={m._id} className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-xl px-3.5 py-2 text-xs relative ${
                    isMe 
                      ? "bg-electric-blue text-white rounded-tr-none" 
                      : "bg-dark-navy-surface border border-subtle-blue-gray/45 text-white rounded-tl-none"
                  }`}>
                    {!isMe && (
                      <div className="text-[10px] font-bold text-soft-teal mb-0.5">
                        {m.userName}
                      </div>
                    )}
                    <p className="leading-relaxed break-words">{m.text}</p>
                    <div className={`text-[9px] text-right mt-1.5 font-medium ${
                      isMe ? "text-white/60" : "text-brand-gray/60"
                    }`}>
                      {new Date(m.createdAt).toLocaleTimeString("en-IN", { 
                        hour: "2-digit", 
                        minute: "2-digit" 
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
            className="bg-deep-navy border-subtle-blue-gray text-white placeholder-brand-gray/40 focus-visible:ring-soft-teal"
            required
          />
          <Button 
            type="submit" 
            className="bg-electric-blue hover:bg-electric-blue/80 text-white shrink-0 px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
