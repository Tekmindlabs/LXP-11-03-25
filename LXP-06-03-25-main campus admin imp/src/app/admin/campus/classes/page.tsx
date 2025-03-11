import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserSession } from "@/server/api/trpc";
import { prisma } from "@/server/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/data-display/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/navigation/tabs";
import { Input } from "@/components/ui/input";
import { Search, Plus, Filter, Calendar, Users, BookOpen } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Class Management | Campus Admin",
  description: "Manage classes at your campus",
};

interface ClassWithDetails {
  id: string;
  code: string;
  name: string;
  status: string;
  program_name: string;
  teacher_name: string | null;
  student_count: number;
}

export default async function CampusClassesPage() {
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

  // Get classes for this campus with program and teacher info using raw query
  const classesWithDetails = await prisma.$queryRaw<ClassWithDetails[]>`
    SELECT 
      c.id, 
      c.code, 
      c.name, 
      c.status,
      p.name as program_name,
      u.name as teacher_name,
      (
        SELECT COUNT(*) 
        FROM "StudentEnrollment" se 
        WHERE se."classId" = c.id AND se.status = 'ACTIVE'
      ) as student_count
    FROM "Class" c
    LEFT JOIN "Program" p ON c."programId" = p.id
    LEFT JOIN "User" u ON c."teacherId" = u.id
    WHERE c."campusId" = ${user.primaryCampusId}
    AND c.status = 'ACTIVE'
    LIMIT 10
  `;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Class Management</h1>
          <p className="text-muted-foreground">Manage classes at {campus.name}</p>
        </div>
        <Button asChild>
          <Link href="/admin/campus/classes/new">
            <Plus className="mr-2 h-4 w-4" /> Create New Class
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative w-full md:w-auto md:min-w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search classes..."
            className="w-full pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
          <Button variant="outline" size="sm">
            <Calendar className="mr-2 h-4 w-4" /> Term
          </Button>
          <Button variant="outline" size="sm">
            <BookOpen className="mr-2 h-4 w-4" /> Program
          </Button>
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="active">Active Classes</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="rounded-md">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium">Class Code</th>
                      <th className="text-left p-4 font-medium">Name</th>
                      <th className="text-left p-4 font-medium">Program</th>
                      <th className="text-left p-4 font-medium">Teacher</th>
                      <th className="text-left p-4 font-medium">
                        <div className="flex items-center">
                          <Users className="mr-2 h-4 w-4" />
                          <span>Students</span>
                        </div>
                      </th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-right p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {classesWithDetails.map((cls) => (
                      <tr key={cls.id} className="hover:bg-muted/50">
                        <td className="p-4">{cls.code}</td>
                        <td className="p-4 font-medium">{cls.name}</td>
                        <td className="p-4">{cls.program_name}</td>
                        <td className="p-4">{cls.teacher_name || "Unassigned"}</td>
                        <td className="p-4">{cls.student_count}</td>
                        <td className="p-4">
                          <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700">
                            Active
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/admin/campus/classes/${cls.id}`}>
                                Manage
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/admin/campus/classes/${cls.id}/schedule`}>
                                Schedule
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {classesWithDetails.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-muted-foreground">
                          No active classes found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="upcoming" className="space-y-4">
          <div className="text-center py-10">
            <p className="text-muted-foreground">No upcoming classes</p>
          </div>
        </TabsContent>
        
        <TabsContent value="archived" className="space-y-4">
          <div className="text-center py-10">
            <p className="text-muted-foreground">No archived classes</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 