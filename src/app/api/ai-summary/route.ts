import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// SECURITY: hard caps to prevent excessive API usage / prompt injection via large payloads
const MAX_BALANCE_ENTRIES = 50;
const MAX_EXPENSE_ENTRIES = 10;
const MAX_PAYLOAD_BYTES = 50_000; // 50KB

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { summary: "Gemini API key is not configured in the server environment variables." },
        { status: 500 }
      );
    }

    // SECURITY: enforce payload size limit before parsing
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { summary: "Request payload too large." },
        { status: 413 }
      );
    }

    const body = await req.json();
    const { simplified, userMap, expenses } = body;

    // SECURITY: validate incoming data is the expected shape
    if (!Array.isArray(simplified) || typeof userMap !== "object") {
      return NextResponse.json(
        { summary: "Invalid request format." },
        { status: 400 }
      );
    }

    const balanceLines = (simplified as any[])
      .slice(0, MAX_BALANCE_ENTRIES)
      .map((b: any) => {
        const fromName = userMap[b.fromUser] || String(b.fromUser).slice(0, 40);
        const toName = userMap[b.toUser] || String(b.toUser).slice(0, 40);
        const amount = typeof b.amount === "number" ? b.amount.toFixed(0) : "?";
        return `${fromName} owes ${toName}: ₹${amount}`;
      }).join("\n");

    const recentExpenses = (expenses as any[] || [])
      .slice(0, MAX_EXPENSE_ENTRIES)
      .map((e: any) => {
        const payerName = e.paidBy?.name || e.paidByName || "unknown";
        const desc = String(e.description || "").slice(0, 100); // cap description length
        const amount = typeof e.amount === "number" ? e.amount : "?";
        return `- ${desc} (₹${amount}, paid by ${payerName})`;
      }).join("\n");

    const promptText = `You are a friendly expense tracking assistant. Summarize these group balances in 3-4 plain English sentences. Be specific about amounts and reasons. Do not use bullet points.

Current balances:
${balanceLines || "Everyone is settled up."}

Recent expenses:
${recentExpenses || "No expenses recorded."}

Write a concise, friendly summary explaining the main debts and roughly why they exist.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(promptText);
    const summary = result.response.text().trim();

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[ai-summary] error:", err);
    return NextResponse.json(
      { summary: "Unable to generate AI balance summary at this time." },
      { status: 500 }
    );
  }
}
