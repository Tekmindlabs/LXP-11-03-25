import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserSession } from "@/server/api/trpc";
import { prisma } from "@/server/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/data-display/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/navigation/tabs";
import { Input } from "@/components/ui/input";
import { Search, Plus, Filter, Download, Upload, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const metadata: Metadata = {
  title: "Student Management | Campus Admin",
  description: "Manage students at your campus",
};

interface StudentWithDetails {
  id: string;
  user_id: string;
  name: string;
  email: string;
  status: string;
  enrollment_date: Date | null;
  program_name: string | null;
  class_count: number;
}

export default async function CampusStudentsPage() {
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

  // Get students for this campus with program info using raw query
  const studentsWithDetails = await prisma.$queryRaw<StudentWithDetails[]>`
    SELECT 
      sp.id, 
      u.id as user_id,
      u.name, 
      u.email,
      sp.status,
      sp."enrollmentDate" as enrollment_date,
      p.name as program_name,
      (
        SELECT COUNT(*) 
        FROM "StudentEnrollment" se 
        WHERE se."studentId" = sp.id AND se.status = 'ACTIVE'
      ) as class_count
    FROM "StudentProfile" sp
    JOIN "User" u ON sp."userId" = u.id
    JOIN "CampusUser" cu ON u.id = cu."userId"
    LEFT JOIN "Program" p ON sp."programId" = p.id
    WHERE cu."campusId" = ${user.primaryCampusId}
    AND sp.status = 'ACTIVE'
    ORDER BY u.name
    LIMIT 20
  `;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Management</h1>
          <p className="text-muted-foreground">Manage students at {campus.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/campus/students/import">
              <Upload className="mr-2 h-4 w-4" /> Import
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/campus/students/export">
              <Download className="mr-2 h-4 w-4" /> Export
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/campus/students/new">
              <Plus className="mr-2 h-4 w-4" /> Add Student
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative w-full md:w-auto md:min-w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search students..."
            className="w-full pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="active">Active Students</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="rounded-md">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium">Student</th>
                      <th className="text-left p-4 font-medium">Email</th>
                      <th className="text-left p-4 font-medium">Program</th>
                      <th className="text-left p-4 font-medium">Enrollment Date</th>
                      <th className="text-left p-4 font-medium">Classes</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-right p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {studentsWithDetails.map((student) => (
                      <tr key={student.id} className="hover:bg-muted/50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={`https://avatar.vercel.sh/${student.name}`} alt={student.name} />
                              <AvatarFallback>{student.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{student.name}</p>
                              <p className="text-xs text-muted-foreground">ID: {student.id.substring(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">{student.email}</td>
                        <td className="p-4">{student.program_name || "Not assigned"}</td>
                        <td className="p-4">{student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString() : "N/A"}</td>
                        <td className="p-4">{student.class_count}</td>
                        <td className="p-4">
                          <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700">
                            Active
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/admin/campus/students/${student.id}`}>
                                View
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/admin/campus/students/${student.id}/enroll`}>
                                Enroll
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/admin/campus/students/${student.id}/actions`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {studentsWithDetails.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-muted-foreground">
                          No active students found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="pending" className="space-y-4">
          <div className="text-center py-10">
            <p className="text-muted-foreground">No pending students</p>
          </div>
        </TabsContent>
        
        <TabsContent value="inactive" className="space-y-4">
          <div className="text-center py-10">
            <p className="text-muted-foreground">No inactive students</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 