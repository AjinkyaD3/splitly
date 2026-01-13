"use client";

import { api } from "@/convex/_generated/api";
import { useConvexQuery } from "@/hooks/use-convex-query";
import { BarLoader } from "react-spinners";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Assuming these exist usually
import { ArrowUpRight, ArrowDownLeft, Receipt } from "lucide-react";
import { format } from "date-fns";
import { useUser } from "@clerk/nextjs";

export default function ActivityPage() {
    const { user } = useUser();
    const { data: activities, isLoading } = useConvexQuery(api.dashboard.getRecentActivity);

    if (isLoading) {
        return (
            <div className="container mx-auto py-12 flex justify-center">
                <BarLoader color="#ffb347" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-gray-900">Recent Activity</h1>

            {!activities || activities.length === 0 ? (
                <Card className="border-dashed border-2 shadow-none bg-muted/20">
                    <CardContent className="py-12 flex flex-col items-center text-center">
                        <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                            <Receipt className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-600">No recent activity</h3>
                        <p className="text-muted-foreground">Transactions will appear here when you add expenses.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4 max-w-3xl">
                    {activities.map((activity) => {
                        const isPayer = activity.paidByUserId === (user?.publicMetadata?.convexId || activity.paidByUserId);
                        // Note: convex/auth mapping might differ, checking generic logic:
                        // We can check if activity.payerName is "You" or matches user name, 
                        // but strictly we'd compare IDs. 
                        // In dashboard.js we enhanced with `payerName`.

                        return (
                            <Card key={activity._id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${isPayer ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                        {isPayer ? (
                                            <ArrowUpRight className={`h-5 w-5 ${isPayer ? 'text-emerald-600' : 'text-rose-600'}`} />
                                        ) : (
                                            <ArrowDownLeft className={`h-5 w-5 ${isPayer ? 'text-emerald-600' : 'text-rose-600'}`} />
                                        )}
                                    </div>

                                    <div className="flex-1">
                                        <h4 className="font-semibold text-gray-900">{activity.description}</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {activity.payerName} paid ₹{activity.amount.toFixed(2)}
                                            {activity.groupName && <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">{activity.groupName}</span>}
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-sm font-medium text-gray-500">
                                            {format(new Date(activity.date), "MMM d, yyyy")}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
