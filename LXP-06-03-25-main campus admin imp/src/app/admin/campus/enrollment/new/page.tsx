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
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "New Enrollment | Campus Admin",
  description: "Create a new student enrollment",
};

const enrollmentFormSchema = z.object({
  studentId: z.string({
    required_error: "Student is required",
  }),
  classId: z.string({
    required_error: "Class is required",
  }),
  startDate: z.date({
    required_error: "Start date is required",
  }),
  endDate: z.date().optional(),
  status: z.enum(["ACTIVE", "PENDING", "COMPLETED", "WITHDRAWN"], {
    required_error: "Status is required",
  }).default("ACTIVE"),
  notes: z.string().optional(),
  paymentStatus: z.enum(["PAID", "PENDING", "PARTIAL", "WAIVED"], {
    required_error: "Payment status is required",
  }).default("PENDING"),
  paymentAmount: z.number().optional(),
  paymentDueDate: z.date().optional(),
  documents: z.array(z.string()).optional(),
});

export default async function CreateEnrollmentPage() {
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

  // Get active students for this campus
  const students = await prisma.$queryRaw<{ id: string, name: string, email: string }[]>`
    SELECT sp.id, u.name, u.email
    FROM "StudentProfile" sp
    JOIN "User" u ON sp."userId" = u.id
    JOIN "CampusUser" cu ON u.id = cu."userId"
    WHERE cu."campusId" = ${user.primaryCampusId}
    AND cu.status = 'ACTIVE'
    ORDER BY u.name
  `;

  // Get active classes for this campus
  const classes = await prisma.$queryRaw<{ id: string, name: string, programName: string }[]>`
    SELECT c.id, c.name, p.name as "programName"
    FROM "Class" c
    JOIN "Program" p ON c."programId" = p.id
    JOIN "CampusProgram" cp ON p.id = cp."programId"
    WHERE cp."campusId" = ${user.primaryCampusId}
    AND c.status = 'ACTIVE'
    ORDER BY c.name
  `;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/campus/enrollment">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">New Enrollment</h1>
        </div>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="single">Single Enrollment</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Enrollment</TabsTrigger>
        </TabsList>
        
        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Student Enrollment</CardTitle>
              <CardDescription>Enroll a student in a class at {campus.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Enrollment Details</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="student">Student *</Label>
                    <Select required>
                      <SelectTrigger id="student">
                        <SelectValue placeholder="Select a student" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name} ({student.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="class">Class *</Label>
                    <Select required>
                      <SelectTrigger id="class">
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name} ({cls.programName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date *</Label>
                      <DatePicker className="w-full" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">End Date (Optional)</Label>
                      <DatePicker className="w-full" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="status">Enrollment Status</Label>
                    <Select defaultValue="ACTIVE">
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                        <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" placeholder="Add any additional notes about this enrollment" className="min-h-[100px]" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Payment Information</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="paymentStatus">Payment Status</Label>
                    <Select defaultValue="PENDING">
                      <SelectTrigger id="paymentStatus">
                        <SelectValue placeholder="Select payment status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PAID">Paid</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="PARTIAL">Partial</SelectItem>
                        <SelectItem value="WAIVED">Waived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="paymentAmount">Payment Amount</Label>
                      <Input id="paymentAmount" type="number" placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentDueDate">Payment Due Date</Label>
                      <DatePicker className="w-full" />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Documents</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="documents">Upload Documents</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                      <div className="space-y-1">
                        <div className="flex items-center justify-center">
                          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <div className="flex text-sm text-gray-600">
                          <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary-dark focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                            <span>Upload a file</span>
                            <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          PDF, PNG, JPG, GIF up to 10MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" asChild>
                <Link href="/admin/campus/enrollment">Cancel</Link>
              </Button>
              <Button type="submit">
                <Save className="mr-2 h-4 w-4" /> Create Enrollment
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Enrollment</CardTitle>
              <CardDescription>Enroll multiple students at once</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Bulk Enrollment Options</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="class-bulk">Class *</Label>
                    <Select required>
                      <SelectTrigger id="class-bulk">
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name} ({cls.programName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate-bulk">Start Date *</Label>
                      <DatePicker className="w-full" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate-bulk">End Date (Optional)</Label>
                      <DatePicker className="w-full" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="status-bulk">Enrollment Status</Label>
                    <Select defaultValue="ACTIVE">
                      <SelectTrigger id="status-bulk">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Student Selection</h3>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Select Students</Label>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">0</span> students selected
                      </div>
                    </div>
                    
                    <div className="border rounded-md max-h-[300px] overflow-y-auto">
                      <div className="p-2 border-b bg-muted">
                        <div className="flex items-center space-x-2">
                          <input type="checkbox" id="select-all" className="rounded border-gray-300" />
                          <label htmlFor="select-all" className="font-medium">Select All</label>
                        </div>
                      </div>
                      <div className="p-2 space-y-2">
                        {students.map((student) => (
                          <div key={student.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md">
                            <input type="checkbox" id={`student-${student.id}`} className="rounded border-gray-300" />
                            <label htmlFor={`student-${student.id}`}>{student.name} ({student.email})</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">CSV Upload</h3>
                  
                  <div className="space-y-2">
                    <Label>Upload Student List</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                      <div className="space-y-1">
                        <div className="flex items-center justify-center">
                          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <div className="flex text-sm text-gray-600">
                          <label htmlFor="csv-upload" className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary-dark focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                            <span>Upload CSV file</span>
                            <input id="csv-upload" name="csv-upload" type="file" className="sr-only" accept=".csv" />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          CSV file with student IDs or emails
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <a href="#" className="text-primary hover:underline">Download template CSV</a>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" asChild>
                <Link href="/admin/campus/enrollment">Cancel</Link>
              </Button>
              <Button type="submit">
                <Save className="mr-2 h-4 w-4" /> Create Bulk Enrollment
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 