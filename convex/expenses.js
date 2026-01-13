import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Create a new expense
export const createExpense = mutation({
  args: {
    description: v.string(),
    amount: v.number(),
    category: v.optional(v.string()),
    date: v.number(), // timestamp
    paidByUserId: v.id("users"),
    splitType: v.string(), // "equal", "percentage", "exact"
    splits: v.array(
      v.object({
        userId: v.id("users"),
        amount: v.number(),
        paid: v.boolean(),
      })
    ),
    groupId: v.optional(v.id("groups")),
  },
  handler: async (ctx, args) => {
    // Use centralized getCurrentUser function
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    console.log("[expenses.js:25] createExpense - User:", user._id, "Args:", JSON.stringify(args));

    // Basic validation
    if (args.amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }
    if (!["equal", "percentage", "exact"].includes(args.splitType)) {
      throw new Error("Invalid split type");
    }

    // All splits must be positive
    if (args.splits.some((s) => s.amount <= 0)) {
      throw new Error("Each split amount must be greater than zero");
    }

    // Load group if provided and assert membership for payer, caller, and splits
    let group = null;
    if (args.groupId) {
      group = await ctx.db.get(args.groupId);
      if (!group) throw new Error("Group not found");

      const memberIds = new Set(group.members.map((m) => m.userId));
      if (!memberIds.has(user._id)) throw new Error("You are not a member of this group");
      if (!memberIds.has(args.paidByUserId))
        throw new Error("Payer must be a member of the group");
      for (const split of args.splits) {
        if (!memberIds.has(split.userId)) {
          throw new Error("All split participants must be group members");
        }
      }
    }

    // Caller must be involved (payer or in splits) to prevent spoofing
    const callerIsPayer = args.paidByUserId === user._id;
    const callerInSplits = args.splits.some((s) => s.userId === user._id);
    if (!callerIsPayer && !callerInSplits) {
      throw new Error("You must be the payer or included in the splits");
    }

    // Verify that splits add up to the total amount (with small tolerance for floating point issues)
    const totalSplitAmount = args.splits.reduce(
      (sum, split) => sum + split.amount,
      0
    );
    const tolerance = 0.01; // Allow for small rounding errors
    console.log("[expenses.js:65] createExpense - Total split amount:", totalSplitAmount, "Total amount:", args.amount, "Difference:", Math.abs(totalSplitAmount - args.amount));
    if (Math.abs(totalSplitAmount - args.amount) > tolerance) {
      throw new Error("Split amounts must add up to the total expense amount");
    }

    // Create the expense
    const expenseId = await ctx.db.insert("expenses", {
      description: args.description,
      amount: args.amount,
      category: args.category || "Other",
      date: args.date,
      paidByUserId: args.paidByUserId,
      splitType: args.splitType,
      splits: args.splits,
      groupId: args.groupId,
      createdBy: user._id,
    });
    console.log("[expenses.js:75] createExpense - Expense created with ID:", expenseId);
    return expenseId;
  },
});

// ----------- Expenses Page -----------

// Get expenses between current user and a specific person
export const getExpensesBetweenUsers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await ctx.runQuery(internal.users.getCurrentUser);
    if (me._id === userId) throw new Error("Cannot query yourself");

    /* ───── 1. One-on-one expenses where either user is the payer ───── */
    // Use the compound index (`paidByUserId`,`groupId`) with groupId = undefined
    const myPaid = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) =>
        q.eq("paidByUserId", me._id).eq("groupId", undefined)
      )
      .collect();

    const theirPaid = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) =>
        q.eq("paidByUserId", userId).eq("groupId", undefined)
      )
      .collect();

    // Merge → candidate set is now just the rows either of us paid for
    const candidateExpenses = [...myPaid, ...theirPaid];

    /* ───── 2. Keep only rows where BOTH are involved (payer or split) ─ */
    const expenses = candidateExpenses.filter((e) => {
      // me is always involved (I’m the payer OR in splits – verified below)
      const meInSplits = e.splits.some((s) => s.userId === me._id);
      const themInSplits = e.splits.some((s) => s.userId === userId);

      const meInvolved = e.paidByUserId === me._id || meInSplits;
      const themInvolved = e.paidByUserId === userId || themInSplits;

      return meInvolved && themInvolved;
    });

    expenses.sort((a, b) => b.date - a.date);

    /* ───── 3. Settlements between the two of us (groupId = undefined) ─ */
    const settlements = await ctx.db
      .query("settlements")
      .filter((q) =>
        q.and(
          q.eq(q.field("groupId"), undefined),
          q.or(
            q.and(
              q.eq(q.field("paidByUserId"), me._id),
              q.eq(q.field("receivedByUserId"), userId)
            ),
            q.and(
              q.eq(q.field("paidByUserId"), userId),
              q.eq(q.field("receivedByUserId"), me._id)
            )
          )
        )
      )
      .collect();

    settlements.sort((a, b) => b.date - a.date);

    /* ───── 4. Compute running balance ──────────────────────────────── */
    let balance = 0;
    console.log("[expenses.js:156] getExpensesBetweenUsers - Starting balance calculation. Expenses count:", expenses.length, "Settlements count:", settlements.length);

    for (const e of expenses) {
      if (e.paidByUserId === me._id) {
        const split = e.splits.find((s) => s.userId === userId && !s.paid);
        if (split) {
          console.log("[expenses.js:160] getExpensesBetweenUsers - I paid, they owe me:", split.amount, "Balance before:", balance);
          balance += split.amount; // they owe me
          console.log("[expenses.js:162] getExpensesBetweenUsers - Balance after:", balance);
        }
      } else {
        const split = e.splits.find((s) => s.userId === me._id && !s.paid);
        if (split) {
          console.log("[expenses.js:165] getExpensesBetweenUsers - They paid, I owe them:", split.amount, "Balance before:", balance);
          balance -= split.amount; // I owe them
          console.log("[expenses.js:167] getExpensesBetweenUsers - Balance after:", balance);
        }
      }
    }

    for (const s of settlements) {
      if (s.paidByUserId === me._id) {
        console.log("[expenses.js:170] getExpensesBetweenUsers - I paid settlement:", s.amount, "Balance before:", balance);
        balance += s.amount; // I paid them back
        console.log("[expenses.js:171] getExpensesBetweenUsers - Balance after:", balance);
      } else {
        console.log("[expenses.js:173] getExpensesBetweenUsers - They paid settlement:", s.amount, "Balance before:", balance);
        balance -= s.amount; // they paid me back
        console.log("[expenses.js:174] getExpensesBetweenUsers - Balance after:", balance);
      }
    }
    console.log("[expenses.js:176] getExpensesBetweenUsers - Final balance:", balance);

    /* ───── 5. Return payload ───────────────────────────────────────── */
    const other = await ctx.db.get(userId);
    if (!other) throw new Error("User not found");

    return {
      expenses,
      settlements,
      otherUser: {
        id: other._id,
        name: other.name,
        email: other.email,
        imageUrl: other.imageUrl,
      },
      balance,
    };
  },
});

// Delete an expense
export const deleteExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, args) => {
    // Get the current user
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    // Get the expense
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) {
      throw new Error("Expense not found");
    }

    // Check if user is authorized to delete this expense
    // Only the creator of the expense or the payer can delete it
    if (expense.createdBy !== user._id && expense.paidByUserId !== user._id) {
      throw new Error("You don't have permission to delete this expense");
    }

    // Delete any settlements that specifically reference this expense
    // Since we can't use array.includes directly in the filter, we'll
    // fetch all settlements and then filter in memory
    const allSettlements = await ctx.db.query("settlements").collect();

    const relatedSettlements = allSettlements.filter(
      (settlement) =>
        settlement.relatedExpenseIds !== undefined &&
        settlement.relatedExpenseIds.includes(args.expenseId)
    );

    for (const settlement of relatedSettlements) {
      // Remove this expense ID from the relatedExpenseIds array
      const updatedRelatedExpenseIds = settlement.relatedExpenseIds.filter(
        (id) => id !== args.expenseId
      );

      if (updatedRelatedExpenseIds.length === 0) {
        // If this was the only related expense, delete the settlement
        await ctx.db.delete(settlement._id);
      } else {
        // Otherwise update the settlement to remove this expense ID
        await ctx.db.patch(settlement._id, {
          relatedExpenseIds: updatedRelatedExpenseIds,
        });
      }
    }

    // Delete the expense
    await ctx.db.delete(args.expenseId);

    return { success: true };
  },
});
