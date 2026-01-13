import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/* ============================================================================
 *  MUTATION: createSettlement
 * -------------------------------------------------------------------------- */

export const createSettlement = mutation({
  args: {
    amount: v.number(), // must be > 0
    note: v.optional(v.string()),
    paidByUserId: v.id("users"),
    receivedByUserId: v.id("users"),
    groupId: v.optional(v.id("groups")), // null when settling one‑to‑one
    relatedExpenseIds: v.optional(v.array(v.id("expenses"))),
  },
  handler: async (ctx, args) => {
    // Use centralized getCurrentUser function
    const caller = await ctx.runQuery(internal.users.getCurrentUser);
    console.log("[settlements.js:20] createSettlement - Caller:", caller._id, "Args:", JSON.stringify(args));

    /* ── basic validation ────────────────────────────────────────────────── */
    if (args.amount <= 0) throw new Error("Amount must be positive");
    if (args.paidByUserId === args.receivedByUserId) {
      throw new Error("Payer and receiver cannot be the same user");
    }
    if (
      caller._id !== args.paidByUserId &&
      caller._id !== args.receivedByUserId
    ) {
      throw new Error("You must be either the payer or the receiver");
    }

    // Prevent over-settling: compute current net between the two parties (1-to-1 only)
    const isGroup = !!args.groupId;
    if (!isGroup) {
      // Query expenses paid by the payer (no group)
      const expensesPaidByPayer = await ctx.db
        .query("expenses")
        .withIndex("by_user_and_group", (q) =>
          q.eq("paidByUserId", args.paidByUserId).eq("groupId", undefined)
        )
        .collect();

      // Query expenses paid by the receiver (no group)
      const expensesPaidByReceiver = await ctx.db
        .query("expenses")
        .withIndex("by_user_and_group", (q) =>
          q.eq("paidByUserId", args.receivedByUserId).eq("groupId", undefined)
        )
        .collect();

      const expenses = [...expensesPaidByPayer, ...expensesPaidByReceiver];

      // Sum net owed from expenses
      let net = 0; // positive => payer is owed by receiver
      console.log("[settlements.js:53] createSettlement - Calculating net from expenses. Expenses count:", expenses.length);
      for (const exp of expenses) {
        // We already know these are 1-to-1 expenses paid by either Payer or Receiver
        // We just need to check if the *other* person is involved in the split.

        if (exp.paidByUserId === args.paidByUserId) {
          const split = exp.splits.find(
            (s) => s.userId === args.receivedByUserId && !s.paid
          );
          if (split) {
            console.log("[settlements.js:64] createSettlement - Payer paid, receiver owes:", split.amount, "Net before:", net);
            net += split.amount;
            console.log("[settlements.js:67] createSettlement - Net after:", net);
          }
        } else if (exp.paidByUserId === args.receivedByUserId) {
          const split = exp.splits.find(
            (s) => s.userId === args.paidByUserId && !s.paid
          );
          if (split) {
            console.log("[settlements.js:72] createSettlement - Receiver paid, payer owes:", split.amount, "Net before:", net);
            net -= split.amount;
            console.log("[settlements.js:73] createSettlement - Net after:", net);
          }
        }
      }
      console.log("[settlements.js:75] createSettlement - Net from expenses:", net);

      // Apply prior settlements between the two (1-to-1 only)
      // Query 1: Settlments paid by Payer (no group)
      const settlementsPaidByPayer = await ctx.db
        .query("settlements")
        .withIndex("by_user_and_group", (q) =>
          q.eq("paidByUserId", args.paidByUserId).eq("groupId", undefined)
        )
        .filter((q) => q.eq(q.field("receivedByUserId"), args.receivedByUserId))
        .collect();

      // Query 2: Settlements paid by Receiver (no group)
      const settlementsPaidByReceiver = await ctx.db
        .query("settlements")
        .withIndex("by_user_and_group", (q) =>
          q.eq("paidByUserId", args.receivedByUserId).eq("groupId", undefined)
        )
        .filter((q) => q.eq(q.field("receivedByUserId"), args.paidByUserId))
        .collect();

      const priorSettlements = [...settlementsPaidByPayer, ...settlementsPaidByReceiver];

      console.log("[settlements.js:96] createSettlement - Prior settlements count:", priorSettlements.length);
      for (const st of priorSettlements) {
        if (st.paidByUserId === args.paidByUserId) {
          console.log("[settlements.js:98] createSettlement - Prior settlement: payer paid", st.amount, "Net before:", net);
          net -= st.amount;
          console.log("[settlements.js:99] createSettlement - Net after:", net);
        } else {
          console.log("[settlements.js:101] createSettlement - Prior settlement: receiver paid", st.amount, "Net before:", net);
          net += st.amount;
          console.log("[settlements.js:102] createSettlement - Net after:", net);
        }
      }

      // net > 0 => receiver owes payer; net < 0 => payer owes receiver
      const availableToSettle = Math.abs(net);
      console.log("[settlements.js:106] createSettlement - Final net:", net, "Available to settle:", availableToSettle, "Requested amount:", args.amount);
      if (availableToSettle <= 0) {
        throw new Error("No outstanding balance to settle");
      }
      if (args.amount > availableToSettle + 0.01) {
        throw new Error("Settlement amount exceeds outstanding balance");
      }
    }

    /* ── group check (if provided) ───────────────────────────────────────── */
    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (!group) throw new Error("Group not found");

      const isMember = (uid) => group.members.some((m) => m.userId === uid);
      if (!isMember(args.paidByUserId) || !isMember(args.receivedByUserId)) {
        throw new Error("Both parties must be members of the group");
      }
    }

    /* ── insert ──────────────────────────────────────────────────────────── */
    return await ctx.db.insert("settlements", {
      amount: args.amount,
      note: args.note,
      date: Date.now(), // server‑side timestamp
      paidByUserId: args.paidByUserId,
      receivedByUserId: args.receivedByUserId,
      groupId: args.groupId,
      relatedExpenseIds: args.relatedExpenseIds,
      createdBy: caller._id,
    });
  },
});

/* ============================================================================
 *  QUERY: getSettlementData
 *  Returns the balances relevant for a page routed as:
 *      /settlements/[entityType]/[entityId]
 *  where entityType ∈ {"user","group"}
 * -------------------------------------------------------------------------- */

export const getSettlementData = query({
  args: {
    entityType: v.string(), // "user"  | "group"
    entityId: v.string(), // Convex _id (string form) of the user or group
  },
  handler: async (ctx, args) => {
    // Use centralized getCurrentUser function
    const me = await ctx.runQuery(internal.users.getCurrentUser);

    if (args.entityType === "user") {
      /* ─────────────────────────────────────────────── user page */
      const other = await ctx.db.get(args.entityId);
      if (!other) throw new Error("User not found");

      // ---------- gather expenses where either of us paid or appears in splits
      const myExpenses = await ctx.db
        .query("expenses")
        .withIndex("by_user_and_group", (q) =>
          q.eq("paidByUserId", me._id).eq("groupId", undefined)
        )
        .collect();

      const otherUserExpenses = await ctx.db
        .query("expenses")
        .withIndex("by_user_and_group", (q) =>
          q.eq("paidByUserId", other._id).eq("groupId", undefined)
        )
        .collect();

      const expenses = [...myExpenses, ...otherUserExpenses];

      let netBalance = 0; // + means they owe me, - means I owe them

      for (const exp of expenses) {
        const involvesMe =
          exp.paidByUserId === me._id ||
          exp.splits.some((s) => s.userId === me._id);
        const involvesThem =
          exp.paidByUserId === other._id ||
          exp.splits.some((s) => s.userId === other._id);
        if (!involvesMe || !involvesThem) continue;

        // case 1: I paid
        if (exp.paidByUserId === me._id) {
          const split = exp.splits.find(
            (s) => s.userId === other._id && !s.paid
          );
          if (split) netBalance += split.amount;
        }

        // case 2: They paid
        if (exp.paidByUserId === other._id) {
          const split = exp.splits.find((s) => s.userId === me._id && !s.paid);
          if (split) netBalance -= split.amount;
        }
      }

      const mySettlements = await ctx.db
        .query("settlements")
        .withIndex("by_user_and_group", (q) =>
          q.eq("paidByUserId", me._id).eq("groupId", undefined)
        )
        .collect();

      const otherUserSettlements = await ctx.db
        .query("settlements")
        .withIndex("by_user_and_group", (q) =>
          q.eq("paidByUserId", other._id).eq("groupId", undefined)
        )
        .collect();

      const settlements = [...mySettlements, ...otherUserSettlements];

      for (const st of settlements) {
        if (st.paidByUserId === me._id) {
          // I paid them ⇒ they owe me less (or I owe them more)
          // Effectively, I gave money, so the balance shifts in my favor (or reduces my debt)
          // Wait, if I pay them, it means I am settling a debt.
          // If balance is -10 (I owe 10), and I pay 10, balance becomes 0.
          // So if I pay, netBalance increases (becomes less negative).
          netBalance += st.amount;
        } else {
          // They paid me ⇒ I owe them less (or they owe me less)
          // If balance is +10 (they owe 10), and they pay 10, balance becomes 0.
          // So if they pay, netBalance decreases.
          netBalance -= st.amount;
        }
      }

      return {
        type: "user",
        counterpart: {
          userId: other._id,
          name: other.name,
          email: other.email,
          imageUrl: other.imageUrl,
        },
        youAreOwed: Math.max(0, netBalance),
        youOwe: Math.max(0, -netBalance),
        netBalance,
      };
    } else if (args.entityType === "group") {
      /* ──────────────────────────────────────────────────────── group page */
      const group = await ctx.db.get(args.entityId);
      if (!group) throw new Error("Group not found");

      const isMember = group.members.some((m) => m.userId === me._id);
      if (!isMember) throw new Error("You are not a member of this group");

      // ---------- expenses for this group
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();

      // ---------- initialise per‑member tallies
      // netBalance: + means they owe me, - means I owe them
      const balances = {};
      group.members.forEach((m) => {
        if (m.userId !== me._id) balances[m.userId] = 0;
      });

      // ---------- apply expenses
      for (const exp of expenses) {
        if (exp.paidByUserId === me._id) {
          // I paid; others may owe me
          exp.splits.forEach((split) => {
            if (split.userId !== me._id && !split.paid) {
              if (balances[split.userId] !== undefined) {
                balances[split.userId] += split.amount;
              }
            }
          });
        } else if (balances[exp.paidByUserId] !== undefined) {
          // Someone else in the group paid; I may owe them
          const split = exp.splits.find((s) => s.userId === me._id && !s.paid);
          if (split) {
            balances[exp.paidByUserId] -= split.amount;
          }
        }
      }

      // ---------- apply settlements within the group
      const settlements = await ctx.db
        .query("settlements")
        .filter((q) => q.eq(q.field("groupId"), group._id))
        .collect();

      for (const st of settlements) {
        // we only care if ONE side is me
        if (st.paidByUserId === me._id && balances[st.receivedByUserId] !== undefined) {
          // I paid them -> balance increases (less negative or more positive)
          balances[st.receivedByUserId] += st.amount;
        }
        if (st.receivedByUserId === me._id && balances[st.paidByUserId] !== undefined) {
          // They paid me -> balance decreases (less positive or more negative)
          balances[st.paidByUserId] -= st.amount;
        }
      }

      // ---------- shape result list
      const members = await Promise.all(
        Object.keys(balances).map((id) => ctx.db.get(id))
      );

      const list = Object.keys(balances).map((uid) => {
        const m = members.find((u) => u && u._id === uid);
        const net = balances[uid];
        return {
          userId: uid,
          name: m?.name || "Unknown",
          imageUrl: m?.imageUrl,
          youAreOwed: Math.max(0, net),
          youOwe: Math.max(0, -net),
          netBalance: net,
        };
      });

      return {
        type: "group",
        group: {
          id: group._id,
          name: group.name,
          description: group.description,
        },
        balances: list,
      };
    }

    /* ── unsupported entityType ──────────────────────────────────────────── */
    throw new Error("Invalid entityType; expected 'user' or 'group'");
  },
});