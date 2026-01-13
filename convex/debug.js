import { query } from "./_generated/server";
import { internal } from "./_generated/api";

export const dumpData = query({
    handler: async (ctx) => {
        const log = (msg, line) => console.log(`[File: convex/debug.js, Line: ${line}] ${msg}`);

        // Bypass auth for debugging - get the first user
        const user = await ctx.db.query("users").first();
        if (!user) {
            log("No users found in database", 7);
            return "No users found";
        }

        log(`Simulating User: ${user._id} (${user.name})`, 11);

        const expenses = await ctx.db.query("expenses").collect();
        const settlements = await ctx.db.query("settlements").collect();

        log(`Total Expenses Found: ${expenses.length}`, 16);
        log(`Total Settlements Found: ${settlements.length}`, 17);

        log("--- DUMPING ALL EXPENSES ---", 19);
        expenses.forEach((e, i) => {
            log(`Expense #${i + 1}: ${JSON.stringify(e)}`, 21);
        });

        log("--- DUMPING ALL SETTLEMENTS ---", 24);
        settlements.forEach((s, i) => {
            log(`Settlement #${i + 1}: ${JSON.stringify(s)}`, 26);
        });

        // Re-run the logic
        const myExpenses = expenses.filter(
            (e) =>
                !e.groupId &&
                (e.paidByUserId === user._id ||
                    e.splits.some((s) => s.userId === user._id))
        );

        log(`Filtered 1-to-1 Expenses for User: ${myExpenses.length}`, 36);

        const balanceByUser = {};

        for (const e of myExpenses) {
            const isPayer = e.paidByUserId === user._id;
            const mySplit = e.splits.find((s) => s.userId === user._id);

            if (isPayer) {
                for (const s of e.splits) {
                    if (s.userId === user._id || s.paid) continue;
                    const oldBal = balanceByUser[s.userId] || 0;
                    balanceByUser[s.userId] = oldBal + s.amount;
                    log(`Expense ${e._id}: User PAID. ${s.userId} owes ${s.amount}. Balance: ${oldBal} -> ${balanceByUser[s.userId]}`, 50);
                }
            } else if (mySplit && !mySplit.paid) {
                const oldBal = balanceByUser[e.paidByUserId] || 0;
                balanceByUser[e.paidByUserId] = oldBal - mySplit.amount;
                log(`Expense ${e._id}: User OWES. Owes ${mySplit.amount} to ${e.paidByUserId}. Balance: ${oldBal} -> ${balanceByUser[e.paidByUserId]}`, 55);
            }
        }

        const mySettlements = settlements.filter(
            (s) =>
                !s.groupId &&
                (s.paidByUserId === user._id || s.receivedByUserId === user._id)
        );

        log(`Filtered 1-to-1 Settlements for User: ${mySettlements.length}`, 65);

        for (const s of mySettlements) {
            if (s.paidByUserId === user._id) {
                const oldBal = balanceByUser[s.receivedByUserId] || 0;
                balanceByUser[s.receivedByUserId] = oldBal + s.amount;
                log(`Settlement ${s._id}: User PAID ${s.amount} to ${s.receivedByUserId}. Balance: ${oldBal} -> ${balanceByUser[s.receivedByUserId]}`, 71);
            } else {
                const oldBal = balanceByUser[s.paidByUserId] || 0;
                balanceByUser[s.paidByUserId] = oldBal - s.amount;
                log(`Settlement ${s._id}: User RECEIVED ${s.amount} from ${s.paidByUserId}. Balance: ${oldBal} -> ${balanceByUser[s.paidByUserId]}`, 75);
            }
        }

        log(`Final Calculated Balances: ${JSON.stringify(balanceByUser)}`, 79);

        let youOwe = 0;
        let youAreOwed = 0;
        const youOweList = [];
        const youAreOwedByList = [];

        for (const [uid, net] of Object.entries(balanceByUser)) {
            if (Math.abs(net) < 0.01) continue;

            const counterpart = await ctx.db.get(uid);
            const base = {
                userId: uid,
                name: counterpart?.name ?? "Unknown",
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

        log(`Final YouAreOwed: ${youAreOwed}`, 104);
        log(`Final YouOwe: ${youOwe}`, 105);

        return {
            balanceByUser,
            youAreOwed,
            youAreOwedByList
        };
    },
});
