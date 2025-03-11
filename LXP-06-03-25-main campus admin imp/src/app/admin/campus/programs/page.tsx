import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserSession } from "@/server/api/trpc";
import { prisma } from "@/server/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/data-display/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/navigation/tabs";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Program Management | Campus Admin",
  description: "Manage programs at your campus",
};

interface CampusProgram {
  id: string;
  campusId: string;
  programId: string;
  startDate: Date;
  endDate?: Date | null;
  status: string;
  program: {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    durationMonths: number;
  };
}

export default async function CampusProgramsPage() {
  const session = await getUserSession();

  if (!session?.userId) {
    redirect("/login");
  }

  // Get user details from database
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      userType: true,
      primaryCampusId: true,
    },
  });

  if (!user || user.userType !== 'CAMPUS_ADMIN' || !user.primaryCampusId) {
    redirect("/login");
  }

  // Get campus details
  const campus = await prisma.campus.findUnique({
    where: { id: user.primaryCampusId },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
    },
  });

  if (!campus) {
    redirect("/login");
  }

  // Get programs assigned to this campus
  const campusPrograms = await prisma.$queryRaw<CampusProgram[]>`
    SELECT cp.*, p.*
    FROM "CampusProgram" cp
    JOIN "Program" p ON cp."programId" = p.id
    WHERE cp."campusId" = ${user.primaryCampusId}
    AND cp.status = 'ACTIVE'
    LIMIT 10
  `;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Program Management</h1>
          <p className="text-muted-foreground">Manage programs at {campus.name}</p>
        </div>
        <Button asChild>
          <Link href="/admin/campus/programs/request">Request New Program</Link>
        </Button>
      </div>

      <div className="flex items-center space-x-2 mb-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search programs..."
            className="w-full pl-8"
          />
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="active">Active Programs</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campusPrograms.map((campusProgram: CampusProgram) => (
              <Card key={campusProgram.id}>
                <CardHeader>
                  <CardTitle>{campusProgram.program.name}</CardTitle>
                  <CardDescription>Code: {campusProgram.program.code}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Duration:</span>
                      <span className="text-sm">{campusProgram.program.durationMonths} months</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Classes:</span>
                      <span className="text-sm">8 active</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Students:</span>
                      <span className="text-sm">124 enrolled</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Start Date:</span>
                      <span className="text-sm">{new Date(campusProgram.startDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/campus/programs/${campusProgram.programId}`}>
                        Manage
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {campusPrograms.length === 0 && (
              <div className="col-span-3 text-center py-10">
                <p className="text-muted-foreground">No active programs found</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/admin/campus/programs/request">Request New Program</Link>
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="upcoming" className="space-y-4">
          <div className="text-center py-10">
            <p className="text-muted-foreground">No upcoming programs</p>
          </div>
        </TabsContent>
        
        <TabsContent value="archived" className="space-y-4">
          <div className="text-center py-10">
            <p className="text-muted-foreground">No archived programs</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 