import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { summary: "Gemini API key is not configured in the server environment variables." },
        { status: 500 }
      );
    }

    const { simplified, userMap, expenses } = await req.json();

    const balanceLines = (simplified || []).map((b: any) => {
      const fromName = userMap[b.fromUser] || b.fromUser;
      const toName = userMap[b.toUser] || b.toUser;
      return `${fromName} owes ${toName}: ₹${b.amount.toFixed(0)}`;
    }).join("\n");

    const recentExpenses = (expenses || []).slice(0, 10).map((e: any) => {
      const payerName = e.paidBy?.name || e.paidByName || "unknown";
      return `- ${e.description} (₹${e.amount}, paid by ${payerName})`;
    }).join("\n");

    const promptText = `You are a friendly expense tracking assistant. Summarize these group balances in 3-4 plain English sentences. Be specific about amounts and reasons. Do not use bullet points.

Current balances:
${balanceLines || "Everyone is settled up."}

Recent expenses:
${recentExpenses}

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
