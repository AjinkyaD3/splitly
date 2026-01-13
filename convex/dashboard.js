import { query } from "./_generated/server";
import { internal } from "./_generated/api";

// Get user balances
export const getUserBalances = query({
  handler: async (ctx) => {
    // Use the existing getCurrentUser function instead of repeating auth logic
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    const debugLog = [`Starting balance calculation for user ${user.name} (${user._id})`];

    /* ───────────── 1‑to‑1 expenses (no groupId) ───────────── */
    const expenses = (await ctx.db.query("expenses").collect()).filter(
      (e) =>
        !e.groupId && // 1‑to‑1 only
        (e.paidByUserId === user._id ||
          e.splits.some((s) => s.userId === user._id))
    );
    debugLog.push(`Found ${expenses.length} 1-to-1 expenses.`);

    // Track per-counterparty net balance
    // Positive (+) means they owe me
    // Negative (-) means I owe them
    const balanceByUser = {};

    for (const e of expenses) {
      const isPayer = e.paidByUserId === user._id;
      const mySplit = e.splits.find((s) => s.userId === user._id);

      if (isPayer) {
        for (const s of e.splits) {
          if (s.userId === user._id || s.paid) continue;
          balanceByUser[s.userId] = (balanceByUser[s.userId] || 0) + s.amount;
          debugLog.push(`Expense ${e.description} (${e.amount}): I paid. ${s.userId} owes me ${s.amount}. New balance: ${balanceByUser[s.userId]}`);
        }
      } else if (mySplit && !mySplit.paid) {
        balanceByUser[e.paidByUserId] =
          (balanceByUser[e.paidByUserId] || 0) - mySplit.amount;
        debugLog.push(`Expense ${e.description} (${e.amount}): They paid. I owe ${mySplit.amount}. New balance: ${balanceByUser[e.paidByUserId]}`);
      }
    }

    /* ───────────── 1‑to‑1 settlements (no groupId) ───────────── */
    const settlements = (await ctx.db.query("settlements").collect()).filter(
      (s) =>
        !s.groupId &&
        (s.paidByUserId === user._id || s.receivedByUserId === user._id)
    );
    debugLog.push(`Found ${settlements.length} 1-to-1 settlements.`);

    for (const s of settlements) {
      if (s.paidByUserId === user._id) {
        balanceByUser[s.receivedByUserId] =
          (balanceByUser[s.receivedByUserId] || 0) + s.amount;
        debugLog.push(`Settlement (${s.amount}): I paid ${s.receivedByUserId}. They owe me (or reduced my debt). New balance: ${balanceByUser[s.receivedByUserId]}`);
      } else {
        balanceByUser[s.paidByUserId] =
          (balanceByUser[s.paidByUserId] || 0) - s.amount;
        debugLog.push(`Settlement (${s.amount}): ${s.paidByUserId} paid me. I owe them (or reduced their debt). New balance: ${balanceByUser[s.paidByUserId]}`);
      }
    }

    /* build totals and lists from net amounts */
    let youOwe = 0;
    let youAreOwed = 0;
    const youOweList = [];
    const youAreOwedByList = [];

    for (const [uid, net] of Object.entries(balanceByUser)) {
      if (Math.abs(net) < 0.01) continue; // Ignore negligible balances

      const counterpart = await ctx.db.get(uid);
      const base = {
        userId: uid,
        name: counterpart?.name ?? "Unknown",
        imageUrl: counterpart?.imageUrl,
        amount: Math.abs(net),
      };

      if (net > 0) {
        youAreOwed += net;
        youAreOwedByList.push(base);
      } else {
        youOwe += -net;
        youOweList.push(base);
      }
    }

    youOweList.sort((a, b) => b.amount - a.amount);
    youAreOwedByList.sort((a, b) => b.amount - a.amount);

    const result = {
      youOwe,
      youAreOwed,
      totalBalance: youAreOwed - youOwe,
      oweDetails: { youOwe: youOweList, youAreOwedBy: youAreOwedByList },
      debugLog, // Return the trace
    };
    return result;
  },
});

// Get total spent in the current year
export const getTotalSpent = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    // Get start of current year timestamp
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime();

    // Get all expenses for the current year
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_date", (q) => q.gte("date", startOfYear))
      .collect();

    // Filter for expenses where user is involved
    const userExpenses = expenses.filter(
      (expense) =>
        expense.paidByUserId === user._id ||
        expense.splits.some((split) => split.userId === user._id)
    );

    // Calculate total spent (personal share only)
    let totalSpent = 0;

    userExpenses.forEach((expense) => {
      const userSplit = expense.splits.find(
        (split) => split.userId === user._id
      );
      if (userSplit) {
        totalSpent += userSplit.amount;
      }
    });

    return totalSpent;
  },
});

// Get monthly spending
export const getMonthlySpending = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    // Get current year
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime();

    // Get all expenses for current year
    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_date", (q) => q.gte("date", startOfYear))
      .collect();

    // Filter for expenses where user is involved
    const userExpenses = allExpenses.filter(
      (expense) =>
        expense.paidByUserId === user._id ||
        expense.splits.some((split) => split.userId === user._id)
    );

    // Group expenses by month
    const monthlyTotals = {};

    // Initialize all months with zero
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(currentYear, i, 1);
      monthlyTotals[monthDate.getTime()] = 0;
    }

    // Sum up expenses by month
    userExpenses.forEach((expense) => {
      const date = new Date(expense.date);
      const monthStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        1
      ).getTime();

      // Get user's share of this expense
      const userSplit = expense.splits.find(
        (split) => split.userId === user._id
      );
      if (userSplit) {
        monthlyTotals[monthStart] =
          (monthlyTotals[monthStart] || 0) + userSplit.amount;
      }
    });

    // Convert to array format
    const result = Object.entries(monthlyTotals).map(([month, total]) => ({
      month: parseInt(month),
      total,
    }));

    // Sort by month (ascending)
    result.sort((a, b) => a.month - b.month);

    return result;
  },
});

// Get groups for the current user
export const getUserGroups = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    // Get all groups
    const allGroups = await ctx.db.query("groups").collect();

    // Filter for groups where the user is a member
    const groups = allGroups.filter((group) =>
      group.members.some((member) => member.userId === user._id)
    );

    // Calculate balances for each group
    const enhancedGroups = await Promise.all(
      groups.map(async (group) => {
        // Get all expenses for this group
        const expenses = await ctx.db
          .query("expenses")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();

        let balance = 0;

        expenses.forEach((expense) => {
          if (expense.paidByUserId === user._id) {
            // User paid for others
            expense.splits.forEach((split) => {
              if (split.userId !== user._id && !split.paid) {
                balance += split.amount;
              }
            });
          } else {
            // User owes someone else
            const userSplit = expense.splits.find(
              (split) => split.userId === user._id
            );
            if (userSplit && !userSplit.paid) {
              balance -= userSplit.amount;
            }
          }
        });

        // Apply settlements
        const settlements = await ctx.db
          .query("settlements")
          .filter((q) =>
            q.and(
              q.eq(q.field("groupId"), group._id),
              q.or(
                q.eq(q.field("paidByUserId"), user._id),
                q.eq(q.field("receivedByUserId"), user._id)
              )
            )
          )
          .collect();

        settlements.forEach((settlement) => {
          if (settlement.paidByUserId === user._id) {
            // User paid someone
            balance += settlement.amount;
          } else {
            // Someone paid the user
            balance -= settlement.amount;
          }
        });

        return {
          ...group,
          id: group._id,
          balance,
        };
      })
    );

    return enhancedGroups;
  },
});

// Get recent activity for the user
export const getRecentActivity = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    // Get recent expenses involved in
    // We can't easily filter by "involved" in a single index scan without a specific index
    // So for now, we'll fetch recent expenses globally or use a compound index if available
    // A better schema would have a separate "activities" table or an "user_expenses" table
    // For this size, we'll index scan by date and filter

    const recentExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_date")
      .order("desc")
      .take(50); // Take 50, then filter

    const activities = recentExpenses.filter(
      (expense) =>
        expense.paidByUserId === user._id ||
        expense.splits.some((split) => split.userId === user._id)
    ).slice(0, 20); // Limit to 20 relevant items

    // Enhance with user details
    const enhancedActivities = await Promise.all(
      activities.map(async (activity) => {
        const payer = await ctx.db.get(activity.paidByUserId);
        let groupName = null;
        if (activity.groupId) {
          const group = await ctx.db.get(activity.groupId);
          groupName = group?.name;
        }

        return {
          ...activity,
          payerName: payer?.name || "Unknown",
          groupName
        }
      })
    );

    return enhancedActivities;
  },
});