import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserSession } from "@/server/api/trpc";
import { prisma } from "@/server/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/forms/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/data-display/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, Filter, Plus, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-display/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

export const metadata: Metadata = {
  title: "Enrollment Management | Campus Admin",
  description: "Manage student enrollments for your campus",
};

type Enrollment = {
  id: string;
  studentName: string;
  studentEmail: string;
  className: string;
  programName: string;
  startDate: Date;
  endDate: Date | null;
  status: string;
  paymentStatus: string;
};

export default async function EnrollmentPage() {
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

  // Get enrollments for this campus
  const enrollments = await prisma.$queryRaw<Enrollment[]>`
    SELECT 
      se.id,
      u.name as "studentName",
      u.email as "studentEmail",
      c.name as "className",
      p.name as "programName",
      se."startDate",
      se."endDate",
      se.status,
      COALESCE(ep."paymentStatus", 'PENDING') as "paymentStatus"
    FROM "StudentEnrollment" se
    JOIN "StudentProfile" sp ON se."studentId" = sp.id
    JOIN "User" u ON sp."userId" = u.id
    JOIN "Class" c ON se."classId" = c.id
    JOIN "Program" p ON c."programId" = p.id
    JOIN "CampusProgram" cp ON p.id = cp."programId"
    LEFT JOIN "EnrollmentPayment" ep ON se.id = ep."enrollmentId"
    WHERE cp."campusId" = ${user.primaryCampusId}
    ORDER BY se."startDate" DESC
    LIMIT 100
  `;

  // Get active classes for this campus
  const classes = await prisma.$queryRaw<{ id: string, name: string }[]>`
    SELECT c.id, c.name
    FROM "Class" c
    JOIN "Program" p ON c."programId" = p.id
    JOIN "CampusProgram" cp ON p.id = cp."programId"
    WHERE cp."campusId" = ${user.primaryCampusId}
    AND c.status = 'ACTIVE'
    ORDER BY c.name
  `;

  // Get programs for this campus
  const programs = await prisma.$queryRaw<{ id: string, name: string }[]>`
    SELECT p.id, p.name
    FROM "Program" p
    JOIN "CampusProgram" cp ON p.id = cp."programId"
    WHERE cp."campusId" = ${user.primaryCampusId}
    ORDER BY p.name
  `;

  // Define columns for the data table
  const columns: ColumnDef<Enrollment>[] = [
    {
      accessorKey: "studentName",
      header: "Student",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.studentName}</div>
          <div className="text-sm text-muted-foreground">{row.original.studentEmail}</div>
        </div>
      ),
    },
    {
      accessorKey: "className",
      header: "Class",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.className}</div>
          <div className="text-sm text-muted-foreground">{row.original.programName}</div>
        </div>
      ),
    },
    {
      accessorKey: "startDate",
      header: "Enrollment Period",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{format(new Date(row.original.startDate), "MMM d, yyyy")}</div>
          {row.original.endDate && (
            <div className="text-sm text-muted-foreground">
              to {format(new Date(row.original.endDate), "MMM d, yyyy")}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        let badgeVariant = "default";
        
        switch (status) {
          case "ACTIVE":
            badgeVariant = "success";
            break;
          case "PENDING":
            badgeVariant = "warning";
            break;
          case "COMPLETED":
            badgeVariant = "default";
            break;
          case "WITHDRAWN":
            badgeVariant = "destructive";
            break;
          default:
            badgeVariant = "default";
        }
        
        return (
          <Badge variant={badgeVariant as any}>{status}</Badge>
        );
      },
    },
    {
      accessorKey: "paymentStatus",
      header: "Payment",
      cell: ({ row }) => {
        const paymentStatus = row.original.paymentStatus;
        let badgeVariant = "default";
        
        switch (paymentStatus) {
          case "PAID":
            badgeVariant = "success";
            break;
          case "PENDING":
            badgeVariant = "warning";
            break;
          case "PARTIAL":
            badgeVariant = "secondary";
            break;
          case "WAIVED":
            badgeVariant = "outline";
            break;
          default:
            badgeVariant = "default";
        }
        
        return (
          <Badge variant={badgeVariant as any}>{paymentStatus}</Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-end space-x-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/admin/campus/enrollment/${row.original.id}`}>
              <Search className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ),
    },
  ];

  // Calculate enrollment statistics
  const activeEnrollments = enrollments.filter(e => e.status === "ACTIVE").length;
  const pendingEnrollments = enrollments.filter(e => e.status === "PENDING").length;
  const completedEnrollments = enrollments.filter(e => e.status === "COMPLETED").length;
  const withdrawnEnrollments = enrollments.filter(e => e.status === "WITHDRAWN").length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Enrollment Management</h1>
        <Button asChild>
          <Link href="/admin/campus/enrollment/new">
            <Plus className="mr-2 h-4 w-4" /> New Enrollment
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeEnrollments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingEnrollments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedEnrollments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Withdrawn Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{withdrawnEnrollments}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search enrollments..."
                className="w-full md:w-[200px] pl-8"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Calendar className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Enrollments</CardTitle>
                <CardDescription>Manage student enrollments for {campus.name}</CardDescription>
              </div>
              
              <div className="flex flex-col md:flex-row gap-2">
                <Select>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="All Programs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TabsContent value="all" className="mt-0">
              <DataTable columns={columns} data={enrollments} />
            </TabsContent>
            <TabsContent value="active" className="mt-0">
              <DataTable columns={columns} data={enrollments.filter(e => e.status === "ACTIVE")} />
            </TabsContent>
            <TabsContent value="pending" className="mt-0">
              <DataTable columns={columns} data={enrollments.filter(e => e.status === "PENDING")} />
            </TabsContent>
            <TabsContent value="completed" className="mt-0">
              <DataTable columns={columns} data={enrollments.filter(e => e.status === "COMPLETED")} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
} 