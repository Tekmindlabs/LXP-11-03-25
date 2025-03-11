import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserSession } from "@/server/api/trpc";
import { prisma } from "@/server/db";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/data-display/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/atoms/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/forms/select";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/forms/form";

export const metadata: Metadata = {
  title: "Create New Class | Campus Admin",
  description: "Create a new class for your campus",
};

const classFormSchema = z.object({
  code: z.string().min(2, {
    message: "Class code must be at least 2 characters.",
  }),
  name: z.string().min(3, {
    message: "Class name must be at least 3 characters.",
  }),
  description: z.string().optional(),
  programId: z.string({
    required_error: "Please select a program.",
  }),
  teacherId: z.string().optional(),
  minCapacity: z.number().min(1).default(1),
  maxCapacity: z.number().min(1).default(30),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

export default async function CreateClassPage() {
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

  // Get programs for this campus
  const programs = await prisma.$queryRaw<{ id: string, name: string }[]>`
    SELECT p.id, p.name
    FROM "Program" p
    JOIN "CampusProgram" cp ON p.id = cp."programId"
    WHERE cp."campusId" = ${user.primaryCampusId}
    AND cp.status = 'ACTIVE'
    ORDER BY p.name
  `;

  // Get teachers for this campus
  const teachers = await prisma.$queryRaw<{ id: string, name: string }[]>`
    SELECT tp.id, u.name
    FROM "TeacherProfile" tp
    JOIN "User" u ON tp."userId" = u.id
    JOIN "CampusUser" cu ON u.id = cu."userId"
    WHERE cu."campusId" = ${user.primaryCampusId}
    AND tp.status = 'ACTIVE'
    ORDER BY u.name
  `;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/campus/classes">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Create New Class</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class Details</CardTitle>
          <CardDescription>Enter the details for the new class at {campus.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Class Code</Label>
                  <Input id="code" placeholder="e.g., CS101" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="name">Class Name</Label>
                  <Input id="name" placeholder="e.g., Introduction to Programming" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="program">Program</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a program" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="teacher">Teacher (Optional)</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign a teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minCapacity">Min Capacity</Label>
                    <Input id="minCapacity" type="number" min="1" defaultValue="1" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxCapacity">Max Capacity</Label>
                    <Input id="maxCapacity" type="number" min="1" defaultValue="30" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date (Optional)</Label>
                    <Input id="startDate" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date (Optional)</Label>
                    <Input id="endDate" type="date" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea id="description" placeholder="Enter a description for this class" className="min-h-[120px]" />
                </div>
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/admin/campus/classes">Cancel</Link>
          </Button>
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" /> Create Class
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 