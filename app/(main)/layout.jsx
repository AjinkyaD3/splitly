"use client";

import { Authenticated } from "convex/react";
import React from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

const MainLayout = ({ children }) => {
  return (
    <Authenticated>
      <div className="container mx-auto mt-20 mb-20 px-4">
        <div className="flex flex-col lg:flex-row gap-8">
          <DashboardSidebar />
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </Authenticated>
  );
};

export default MainLayout;
