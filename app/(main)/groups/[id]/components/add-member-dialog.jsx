"use client";

import { useState } from "react";
import { useConvexMutation, useConvexQuery } from "@/hooks/use-convex-query";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export function AddMemberDialog({ isOpen, onClose, groupId, currentMemberIds }) {
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [commandOpen, setCommandOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const addMembers = useConvexMutation(api.groups.addMemberToGroup);
    const { data: searchResults, isLoading: isSearching } = useConvexQuery(
        api.users.searchUsers,
        { query: searchQuery }
    );

    const addMember = (user) => {
        // Check if user is already selected or already a member of the group
        if (currentMemberIds.includes(user.id)) {
            toast.error("User is already in the group");
            return;
        }

        if (!selectedMembers.some((m) => m.id === user.id)) {
            setSelectedMembers([...selectedMembers, user]);
        }
        setCommandOpen(false);
        setSearchQuery("");
    };

    const removeMember = (userId) => {
        setSelectedMembers(selectedMembers.filter((m) => m.id !== userId));
    };

    const handleSubmit = async () => {
        if (selectedMembers.length === 0) return;

        setIsSubmitting(true);
        try {
            const userIds = selectedMembers.map((m) => m.id);
            await addMembers.mutate({
                groupId,
                userIds,
            });

            toast.success("Members added successfully!");
            setSelectedMembers([]);
            onClose();
        } catch (error) {
            toast.error("Failed to add members: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setSelectedMembers([]);
        setSearchQuery("");
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Members</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Find People</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {/* Selected members */}
                            {selectedMembers.map((member) => (
                                <Badge
                                    key={member.id}
                                    variant="secondary"
                                    className="px-3 py-1"
                                >
                                    <Avatar className="h-5 w-5 mr-2">
                                        <AvatarImage src={member.imageUrl} />
                                        <AvatarFallback>
                                            {member.name?.charAt(0) || "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span>{member.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeMember(member.id)}
                                        className="ml-2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}

                            {/* Add member button with dropdown */}
                            <Popover open={commandOpen} onOpenChange={setCommandOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1 text-xs"
                                    >
                                        <UserPlus className="h-3.5 w-3.5" />
                                        Search
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0" align="start" side="bottom">
                                    <Command>
                                        <CommandInput
                                            placeholder="Search by name or email..."
                                            value={searchQuery}
                                            onValueChange={setSearchQuery}
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                {searchQuery.length < 2 ? (
                                                    <p className="py-3 px-4 text-sm text-center text-muted-foreground">
                                                        Type at least 2 characters to search
                                                    </p>
                                                ) : isSearching ? (
                                                    <p className="py-3 px-4 text-sm text-center text-muted-foreground">
                                                        Searching...
                                                    </p>
                                                ) : (
                                                    <p className="py-3 px-4 text-sm text-center text-muted-foreground">
                                                        No users found
                                                    </p>
                                                )}
                                            </CommandEmpty>
                                            <CommandGroup heading="Suggestions">
                                                {searchResults?.map((user) => {
                                                    const isAlreadyMember = currentMemberIds.includes(user.id);

                                                    return (
                                                        <CommandItem
                                                            key={user.id}
                                                            value={user.name + user.email}
                                                            onSelect={() => addMember(user)}
                                                            disabled={isAlreadyMember}
                                                            className={isAlreadyMember ? "opacity-50" : ""}
                                                        >
                                                            <div className="flex items-center gap-2 w-full">
                                                                <Avatar className="h-6 w-6">
                                                                    <AvatarImage src={user.imageUrl} />
                                                                    <AvatarFallback>
                                                                        {user.name?.charAt(0) || "?"}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div className="flex flex-col flex-1">
                                                                    <span className="text-sm">{user.name}</span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {user.email}
                                                                    </span>
                                                                </div>
                                                                {isAlreadyMember && <span className="text-xs italic text-muted-foreground">Member</span>}
                                                            </div>
                                                        </CommandItem>
                                                    )
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {selectedMembers.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                Search for friends by name or email to add them to this group.
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || selectedMembers.length === 0}
                    >
                        {isSubmitting ? "Adding..." : "Add People"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
