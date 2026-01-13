"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useConvexQuery } from "@/hooks/use-convex-query";
import { BarLoader } from "react-spinners";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Users, User } from "lucide-react";
import { CreateGroupModal } from "./components/create-group-modal";

export default function ContactsPage() {
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data, isLoading } = useConvexQuery(api.contacts.getAllContacts);

  // Check for the createGroup parameter when the component mounts
  useEffect(() => {
    const createGroupParam = searchParams.get("createGroup");

    if (createGroupParam === "true") {
      // Open the modal
      setIsCreateGroupModalOpen(true);

      // Remove the parameter from the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("createGroup");

      // Replace the current URL without the parameter
      router.replace(url.pathname + url.search);
    }
  }, [searchParams, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-12">
        <BarLoader width={"100%"} color="#ffb347" />
      </div>
    );
  }

  const { users, groups } = data || { users: [], groups: [] };

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-6">
        <h1 className="text-5xl gradient-title">Contacts</h1>
        <Button onClick={() => setIsCreateGroupModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Individual Contacts */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center">
            <User className="mr-2 h-5 w-5 text-amber-600" />
            People
          </h2>
          {users.length === 0 ? (
            <Card className="border-dashed border-2 shadow-none bg-muted/20">
              <CardContent className="py-12 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                  <User className="h-6 w-6 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No contacts yet</h3>
                <p className="text-muted-foreground mb-4 max-w-xs">
                  Contacts will appear here once you split an expense with someone.
                </p>
                <Button asChild variant="outline" className="border-amber-200 hover:bg-amber-50 text-amber-700">
                  <Link href="/expenses/new">Add your first expense</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {users.map((user) => (
                <Link key={user.id} href={`/person/${user.id}`}>
                  <Card className="hover:bg-muted/30 transition-all hover:shadow-md cursor-pointer border-l-4 border-l-transparent hover:border-l-amber-400">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-border">
                            <AvatarImage src={user.imageUrl} />
                            <AvatarFallback className="bg-amber-100 text-amber-700 font-medium">
                              {user.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{user.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Groups */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center">
            <Users className="mr-2 h-5 w-5 text-amber-600" />
            Groups
          </h2>
          {groups.length === 0 ? (
            <Card className="border-dashed border-2 shadow-none bg-muted/20">
              <CardContent className="py-12 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No groups created</h3>
                <p className="text-muted-foreground mb-4 max-w-xs">
                  Create a group to easily track shared expenses for trips, housemates, or projects.
                </p>
                <Button
                  onClick={() => setIsCreateGroupModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create a Group
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  <Card className="hover:bg-muted/30 transition-all hover:shadow-md cursor-pointer border-l-4 border-l-transparent hover:border-l-amber-400">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-amber-100 p-2.5 rounded-lg">
                            <Users className="h-6 w-6 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{group.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {group.memberCount} members
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        onSuccess={(groupId) => {
          router.push(`/groups/${groupId}`);
        }}
      />
    </div>
  );
}
