"use client";

import { UserProfile } from "@clerk/nextjs";
import { Card } from "@/components/ui/card";

export default function SettingsPage() {
    return (
        <div className="container mx-auto py-6 space-y-6">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-gray-900 mb-8">Settings</h1>

            <div className="flex justify-center">
                <div className="w-full max-w-4xl">
                    {/* Clerk's complete profile management component */}
                    <UserProfile
                        appearance={{
                            elements: {
                                rootBox: "w-full shadow-lg rounded-xl overflow-hidden",
                                card: "w-full shadow-none",
                                navbar: "hidden md:flex",
                                navbarButton: "text-gray-600 hover:text-amber-600 hover:bg-amber-50 font-medium",
                                navbarButtonActive: "text-amber-700 bg-amber-50 font-bold",
                                headerTitle: "text-2xl font-bold",
                                headerSubtitle: "text-muted-foreground",
                                profileSectionTitle: "text-lg font-bold text-gray-900 border-b pb-2 mb-4",
                                formButtonPrimary: "bg-amber-500 hover:bg-amber-600 text-white",
                                formFieldInput: "border-gray-200 focus:border-amber-500 focus:ring-amber-500",
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
