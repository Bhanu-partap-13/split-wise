import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { response: "Gemini API key is not configured." },
        { status: 500 }
      );
    }

    const {
      messages,
      groupId,
      userId,
      groupName,
      members,       // [{ userId, name }]
      expenses,      // full expense objects with splits + paidBy
      settlements,   // settlement records
      simplified,    // simplified debt list
    } = await req.json();

    // ── Security: verify user is a member of the group ──────────────────────
    if (groupId && userId) {
      const isMember = (members || []).some(
        (m: any) => m.userId === userId || m._id === userId
      );
      if (!isMember) {
        return NextResponse.json({
          response:
            "I can only assist with groups you are a member of. You don't appear to be a member of this group.",
        });
      }
    }

    // ── Build member name map ────────────────────────────────────────────────
    const memberNameMap: Record<string, string> = {};
    (members || []).forEach((m: any) => {
      if (m.userId) memberNameMap[m.userId] = m.name || m.user?.name || "Unknown";
    });

    // ── Format outstanding debts ─────────────────────────────────────────────
    const balanceLines = (simplified || [])
      .map((b: any) => {
        const fromName = memberNameMap[b.fromUser] || b.fromUser;
        const toName = memberNameMap[b.toUser] || b.toUser;
        return `- ${fromName} owes ${toName}: ₹${Number(b.amount).toFixed(0)}`;
      })
      .join("\n");

    // ── Format all expenses with real paidBy names ───────────────────────────
    const expenseLines = (expenses || [])
      .slice(0, 50) // cap at 50 for context window
      .map((e: any) => {
        // Resolve paidBy: prefer paidBy.name (from getGroupExpenses join), then paidByName (CSV), then map
        const payerName =
          e.paidBy?.name ||
          e.paidByName ||
          memberNameMap[e.paidById] ||
          "Unknown";

        const splitNames = (e.splits || [])
          .map((s: any) => s.userName || memberNameMap[s.userId] || "Unknown")
          .join(", ");

        const date = e.date
          ? new Date(e.date).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "Unknown date";

        const notes = e.notes ? ` [Note: ${e.notes}]` : "";
        const settlement = e.isSettlement ? " [SETTLEMENT]" : "";

        return `- ${e.description}${settlement}: ₹${e.amount} paid by ${payerName} on ${date} | Split with: ${splitNames || payerName}${notes}`;
      })
      .join("\n");

    // ── Format settlements ────────────────────────────────────────────────────
    const settlementLines = (settlements || [])
      .map((s: any) => {
        const payer = memberNameMap[s.paidById] || s.paidByName || "Unknown";
        const receiver = memberNameMap[s.receiverId] || "Unknown";
        const date = s.date
          ? new Date(s.date).toLocaleDateString("en-IN")
          : "";
        return `- ${payer} paid ${receiver} ₹${s.amount} on ${date}`;
      })
      .join("\n");

    const membersList = Object.values(memberNameMap).join(", ");
    const currentUserName =
      memberNameMap[userId] || "the user";

    // ── System prompt with full context ───────────────────────────────────────
    const systemInstruction = `You are "SplitSmart AI", a smart expense-tracking assistant embedded in the group "${groupName || "this group"}".

You are talking to: ${currentUserName}
Group members: ${membersList || "Unknown"}

=== ALL EXPENSES (${(expenses || []).length} total) ===
${expenseLines || "No expenses recorded yet."}

=== RECORDED SETTLEMENTS ===
${settlementLines || "No settlements recorded yet."}

=== OUTSTANDING BALANCES (after simplification) ===
${balanceLines || "Everyone is settled up! No outstanding debts."}

=== YOUR RULES ===
1. ONLY answer questions about this group ("${groupName || "this group"}"). Never discuss or reveal data from other groups.
2. Use the real names from the context above. Do NOT say "unknown" if a name is available.
3. Answer accurately based only on the data above. Do not guess or fabricate.
4. When listing expenses or debts, be precise with amounts and names.
5. Keep answers friendly, clear, and concise.
6. Use markdown formatting (bold, bullet lists) for clarity.
7. If asked about something outside this group's data, politely decline.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction,
    });

    const history = (messages || []).slice(0, -1).map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content || m.text }],
    }));

    const currentMessage =
      messages[messages.length - 1]?.content ||
      messages[messages.length - 1]?.text ||
      "";

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(currentMessage);
    const responseText = result.response.text().trim();

    return NextResponse.json({ response: responseText });
  } catch (err) {
    console.error("[ai-chat] error:", err);
    return NextResponse.json(
      { response: "I encountered an issue. Please try again." },
      { status: 500 }
    );
  }
}
