import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { response: "Gemini API key is not configured in the server environment variables." },
        { status: 500 }
      );
    }

    const { messages, simplified, userMap, expenses } = await req.json();

    const balanceLines = (simplified || []).map((b: any) => {
      const fromName = userMap[b.fromUser] || b.fromUser;
      const toName = userMap[b.toUser] || b.toUser;
      return `- ${fromName} owes ${toName}: ₹${b.amount.toFixed(0)}`;
    }).join("\n");

    const recentExpenses = (expenses || []).map((e: any) => {
      const payerName = e.paidBy?.name || e.paidByName || "unknown";
      return `- ${e.description} (₹${e.amount}, paid by ${payerName} on ${new Date(e.date).toLocaleDateString()})`;
    }).join("\n");

    // System prompt defining role and supplying context
    const systemInstruction = `You are "SplitSmart AI Assistant", a helpful, conversational expense-tracking agent.
You help users understand their group expenses, outstanding debts, and how to settle up.

Here is the current group ledger context:

Outstanding Debts:
${balanceLines || "Everyone is settled up! No outstanding debts."}

All Expenses:
${recentExpenses || "No expenses logged yet."}

Instructions:
- Answer user queries politely, accurately, and concisely based on the ledger context.
- You can explain who owes whom, who paid for what, and suggest the best way to settle debts.
- Keep your answers friendly and conversational.
- Do not make up information that is not supported by the ledger context.
- Use markdown formatting for readability (bolding, lists, etc.) when explaining lists of items.`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction,
    });

    // Format chat history for Gemini API
    // Gemini API expects history to be format [{ role: 'user' | 'model', parts: [{ text: '...' }] }]
    const history = (messages || []).slice(0, -1).map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content || m.text }],
    }));

    const currentMessage = messages[messages.length - 1]?.content || messages[messages.length - 1]?.text || "";

    const chat = model.startChat({
      history: history,
    });

    const result = await chat.sendMessage(currentMessage);
    const responseText = result.response.text().trim();

    return NextResponse.json({ response: responseText });
  } catch (err) {
    console.error("[ai-chat] error:", err);
    return NextResponse.json(
      { response: "I encountered an issue processing your request. Please try again later." },
      { status: 500 }
    );
  }
}
