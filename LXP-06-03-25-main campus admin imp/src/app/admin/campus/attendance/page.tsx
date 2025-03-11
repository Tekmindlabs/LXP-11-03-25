"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceRecorder } from "@/components/attendance/AttendanceRecorder";
import { AttendanceDashboard } from "@/components/attendance/AttendanceDashboard";
import { AttendanceReports } from "@/components/attendance/AttendanceReports";
import { AttendanceAnalytics } from "@/components/attendance/AttendanceAnalytics";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { data: session } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  // Get the user's primary campus ID from the session
  const campusId = session?.user?.primaryCampusId;

  if (!campusId) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed">
          <div className="text-center">
            <h3 className="text-lg font-medium">No Campus Access</h3>
            <p className="text-sm text-muted-foreground">
              You do not have access to any campus. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance Management</h1>
        <p className="text-muted-foreground mt-1">
          Record, track, and analyze student attendance
        </p>
      </div>

      <Tabs
        defaultValue="dashboard"
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="record">Record</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <AttendanceDashboard campusId={campusId} />
        </TabsContent>

        <TabsContent value="record" className="space-y-4">
          <AttendanceRecorder campusId={campusId} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <AttendanceReports campusId={campusId} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AttendanceAnalytics campusId={campusId} />
        </TabsContent>
      </Tabs>
    </div>
  );
} 