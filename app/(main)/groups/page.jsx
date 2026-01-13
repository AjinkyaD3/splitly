"use client";

import { api } from "@/convex/_generated/api";
import { useConvexQuery } from "@/hooks/use-convex-query";
import { BarLoader } from "react-spinners";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Plus } from "lucide-react";

export default function GroupsPage() {
    const { data: groups, isLoading } = useConvexQuery(api.dashboard.getUserGroups);

    if (isLoading) {
        return (
            <div className="container mx-auto py-12 flex justify-center">
                <BarLoader color="#ffb347" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-gray-900">My Groups</h1>
                <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-sm">
                    <Link href="/contacts?createGroup=true">
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Group
                    </Link>
                </Button>
            </div>

            {groups?.length === 0 ? (
                <Card className="border-dashed border-2 shadow-none bg-muted/20">
                    <CardContent className="py-12 flex flex-col items-center text-center">
                        <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                            <Users className="h-8 w-8 text-amber-600" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No groups yet</h3>
                        <p className="text-muted-foreground mb-6 max-w-sm">
                            Groups make it easy to split bills with roommates, friends, or family.
                        </p>
                        <Button asChild className="bg-amber-500 hover:bg-amber-600">
                            <Link href="/contacts?createGroup=true">Create your first group</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups?.map((group) => (
                        <Link key={group.id} href={`/groups/${group.id}`} className="group">
                            <Card className="h-full hover:shadow-lg transition-all border-l-4 border-l-transparent hover:border-l-amber-500">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="bg-amber-100 p-3 rounded-xl">
                                            <Users className="h-6 w-6 text-amber-600" />
                                        </div>
                                        {group.balance !== 0 && (
                                            <span className={`text-sm font-bold px-2 py-1 rounded-full ${group.balance > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {group.balance > 0 ? `You are owed ₹${group.balance.toFixed(2)}` : `You owe ₹${Math.abs(group.balance).toFixed(2)}`}
                                            </span>
                                        )}
                                    </div>

                                    <h3 className="text-xl font-bold mb-2 group-hover:text-amber-600 transition-colors">{group.name}</h3>
                                    <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                                        {group.description || "No description"}
                                    </p>

                                    <div className="text-sm text-gray-500 font-medium">
                                        {group.members.length} members
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
