export interface BalanceEntry {
  fromUser: string;
  toUser: string;
  amount: number;
  currency: string;
}

export interface UserBalance {
  userId: string;
  userName: string;
  netBalance: number; // positive = owed money, negative = owes money
  owes: { to: string; amount: number; currency: string }[];
  isOwed: { from: string; amount: number; currency: string }[];
}

export function calculateBalances(
  expenses: Array<{
    paidById: string;
    paidByName?: string | null;
    amount: number;
    currency: string;
    isSettlement: boolean;
    splits: Array<{ userId?: string | null; userName: string; amount: number }>;
  }>,
  settlements: Array<{
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
  }>,
  userMap: Record<string, string> // userId -> userName
): Record<string, Record<string, number>> {
  // balances[A][B] = amount A owes B (positive), A is owed by B (negative)
  const balances: Record<string, Record<string, number>> = {};

  const ensure = (a: string, b: string) => {
    if (!balances[a]) balances[a] = {};
    if (!balances[a][b]) balances[a][b] = 0;
  };

  for (const expense of expenses) {
    if (expense.isSettlement) continue;
    const payer = expense.paidById;
    for (const split of expense.splits) {
      if (!split.userId || split.userId === payer) continue;
      ensure(split.userId, payer);
      ensure(payer, split.userId);
      balances[split.userId][payer] += split.amount;
      balances[payer][split.userId] -= split.amount;
    }
  }

  for (const s of settlements) {
    ensure(s.fromUserId, s.toUserId);
    ensure(s.toUserId, s.fromUserId);
    balances[s.fromUserId][s.toUserId] -= s.amount;
    balances[s.toUserId][s.fromUserId] += s.amount;
  }

  return balances;
}

// Simplify debts — reduce N*(N-1) transactions to minimum
export function simplifyDebts(
  balances: Record<string, Record<string, number>>
): BalanceEntry[] {
  const net: Record<string, number> = {};
  for (const [from, tos] of Object.entries(balances)) {
    for (const [to, amount] of Object.entries(tos)) {
      if (amount > 0) {
        net[from] = (net[from] || 0) - amount;
        net[to] = (net[to] || 0) + amount;
      }
    }
  }

  const creditors = Object.entries(net).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const debtors = Object.entries(net).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const result: BalanceEntry[] = [];

  let ci = 0, di = 0;
  const cred = creditors.map(([id, amt]) => ({ id, amt }));
  const debt = debtors.map(([id, amt]) => ({ id, amt: -amt }));

  while (ci < cred.length && di < debt.length) {
    const settle = Math.min(cred[ci].amt, debt[di].amt);
    result.push({ fromUser: debt[di].id, toUser: cred[ci].id, amount: Math.round(settle * 100) / 100, currency: "INR" });
    cred[ci].amt -= settle;
    debt[di].amt -= settle;
    if (cred[ci].amt < 0.01) ci++;
    if (debt[di].amt < 0.01) di++;
  }

  return result;
}
