import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserSession } from "@/server/api/trpc";
import { prisma } from "@/server/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/data-display/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Clock, Edit, FileText, Mail, MapPin, Phone, Trash, User } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const metadata: Metadata = {
  title: "Enrollment Details | Campus Admin",
  description: "View and manage enrollment details",
};

export default async function EnrollmentDetailPage({ params }: { params: { id: string } }) {
  const enrollmentId = params.id;
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

  // Get enrollment details
  const enrollment = await prisma.studentEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      student: {
        include: {
          user: true,
        },
      },
      class: {
        include: {
          program: true,
          schedule: true,
          teacher: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  if (!enrollment) {
    redirect("/admin/campus/enrollment");
  }

  // Check if enrollment belongs to the admin's campus
  const campusProgram = await prisma.campusProgram.findFirst({
    where: {
      campusId: user.primaryCampusId,
      programId: enrollment.class.programId,
    },
  });

  if (!campusProgram) {
    redirect("/admin/campus/enrollment");
  }

  // Get payment details
  const payment = await prisma.enrollmentPayment.findFirst({
    where: { enrollmentId },
  });

  // Get enrollment history
  const history = await prisma.enrollmentHistory.findMany({
    where: { enrollmentId },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: true,
    },
  });

  // Get enrollment documents
  const documents = await prisma.enrollmentDocument.findMany({
    where: { enrollmentId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/campus/enrollment">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Enrollment Details</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/campus/enrollment/${enrollmentId}/edit`}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button variant="destructive">
            <Trash className="mr-2 h-4 w-4" /> Cancel Enrollment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Enrollment Information</CardTitle>
                  <CardDescription>Details about this enrollment</CardDescription>
                </div>
                <Badge 
                  variant={
                    enrollment.status === "ACTIVE" ? "success" : 
                    enrollment.status === "PENDING" ? "warning" : 
                    enrollment.status === "COMPLETED" ? "default" : 
                    "destructive"
                  }
                >
                  {enrollment.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-muted-foreground">Class</h3>
                  <p className="text-lg font-medium">{enrollment.class.name}</p>
                  <p className="text-sm text-muted-foreground">{enrollment.class.program.name}</p>
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-muted-foreground">Enrollment Period</h3>
                  <p className="text-lg font-medium">{format(new Date(enrollment.startDate), "MMMM d, yyyy")}</p>
                  {enrollment.endDate && (
                    <p className="text-sm text-muted-foreground">
                      to {format(new Date(enrollment.endDate), "MMMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Class Schedule</h3>
                <div className="space-y-2">
                  {enrollment.class.schedule?.map((schedule, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 rounded-md bg-muted">
                      <Calendar className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{schedule.day}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(schedule.startTime), "h:mm a")} - {format(new Date(schedule.endTime), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!enrollment.class.schedule || enrollment.class.schedule.length === 0) && (
                    <p className="text-sm text-muted-foreground">No schedule information available</p>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Teacher</h3>
                {enrollment.class.teacher ? (
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarImage src={enrollment.class.teacher.user.image || ""} />
                      <AvatarFallback>{enrollment.class.teacher.user.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{enrollment.class.teacher.user.name}</p>
                      <p className="text-sm text-muted-foreground">{enrollment.class.teacher.user.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No teacher assigned</p>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Notes</h3>
                <p className="text-sm">
                  {enrollment.notes || "No notes available for this enrollment."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="payment" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="payment">Payment</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            
            <TabsContent value="payment">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Payment Information</CardTitle>
                      <CardDescription>Payment details for this enrollment</CardDescription>
                    </div>
                    <Badge 
                      variant={
                        payment?.paymentStatus === "PAID" ? "success" : 
                        payment?.paymentStatus === "PARTIAL" ? "secondary" : 
                        payment?.paymentStatus === "WAIVED" ? "outline" : 
                        "warning"
                      }
                    >
                      {payment?.paymentStatus || "PENDING"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {payment ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">Amount</h3>
                          <p className="text-lg font-medium">${payment.amount.toFixed(2)}</p>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">Due Date</h3>
                          <p className="text-lg font-medium">
                            {payment.dueDate ? format(new Date(payment.dueDate), "MMMM d, yyyy") : "Not specified"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">Payment Method</h3>
                          <p className="text-lg font-medium">{payment.paymentMethod || "Not specified"}</p>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-3">Payment History</h3>
                        {payment.transactions && payment.transactions.length > 0 ? (
                          <div className="space-y-3">
                            {payment.transactions.map((transaction, index) => (
                              <div key={index} className="flex items-start justify-between p-3 rounded-md bg-muted">
                                <div className="flex items-start space-x-3">
                                  <Calendar className="h-5 w-5 text-primary" />
                                  <div>
                                    <p className="font-medium">{format(new Date(transaction.date), "MMMM d, yyyy")}</p>
                                    <p className="text-sm text-muted-foreground">{transaction.method}</p>
                                  </div>
                                </div>
                                <p className="font-medium">${transaction.amount.toFixed(2)}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No payment transactions recorded</p>
                        )}
                      </div>

                      <Separator />

                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-3">Notes</h3>
                        <p className="text-sm">
                          {payment.notes || "No payment notes available."}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground">No payment information available</p>
                      <Button className="mt-4" asChild>
                        <Link href={`/admin/campus/enrollment/${enrollmentId}/payment/new`}>
                          Add Payment Information
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
                {payment && (
                  <CardFooter>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={`/admin/campus/enrollment/${enrollmentId}/payment/edit`}>
                        Update Payment Information
                      </Link>
                    </Button>
                  </CardFooter>
                )}
              </Card>
            </TabsContent>
            
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Enrollment History</CardTitle>
                  <CardDescription>History of changes to this enrollment</CardDescription>
                </CardHeader>
                <CardContent>
                  {history && history.length > 0 ? (
                    <div className="space-y-4">
                      {history.map((entry) => (
                        <div key={entry.id} className="border-l-2 border-primary pl-4 pb-4">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{entry.action}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            by {entry.createdBy.name}
                          </p>
                          {entry.notes && (
                            <p className="text-sm mt-2">{entry.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground">No history records available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="documents">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Documents</CardTitle>
                      <CardDescription>Documents related to this enrollment</CardDescription>
                    </div>
                    <Button asChild>
                      <Link href={`/admin/campus/enrollment/${enrollmentId}/documents/upload`}>
                        Upload Document
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {documents && documents.length > 0 ? (
                    <div className="space-y-3">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 rounded-md border">
                          <div className="flex items-center space-x-3">
                            <FileText className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Uploaded on {format(new Date(doc.createdAt), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={doc.url} target="_blank">View</Link>
                            </Button>
                            <Button variant="ghost" size="sm">Download</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground">No documents available</p>
                      <Button className="mt-4" asChild>
                        <Link href={`/admin/campus/enrollment/${enrollmentId}/documents/upload`}>
                          Upload Document
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Student Information</CardTitle>
              <CardDescription>Details about the enrolled student</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={enrollment.student.user.image || ""} />
                  <AvatarFallback>{enrollment.student.user.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold">{enrollment.student.user.name}</h3>
                  <p className="text-sm text-muted-foreground">{enrollment.student.user.email}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Student ID</p>
                    <p>{enrollment.student.studentId || "Not assigned"}</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p>{enrollment.student.phone || "Not provided"}</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p>{enrollment.student.user.email}</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Address</p>
                    <p>
                      {enrollment.student.address ? (
                        <>
                          {enrollment.student.address}
                          <br />
                          {enrollment.student.city}, {enrollment.student.state} {enrollment.student.postalCode}
                          <br />
                          {enrollment.student.country}
                        </>
                      ) : (
                        "Not provided"
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                    <p>
                      {enrollment.student.dateOfBirth 
                        ? format(new Date(enrollment.student.dateOfBirth), "MMMM d, yyyy")
                        : "Not provided"
                      }
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Emergency Contact</h3>
                {enrollment.student.emergencyContactName ? (
                  <div className="space-y-2">
                    <p className="font-medium">{enrollment.student.emergencyContactName}</p>
                    <p className="text-sm">{enrollment.student.emergencyContactRelationship}</p>
                    <p className="text-sm">{enrollment.student.emergencyContactPhone}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No emergency contact information provided</p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/admin/campus/students/${enrollment.student.id}`}>
                  View Student Profile
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Other Enrollments</CardTitle>
              <CardDescription>Other classes this student is enrolled in</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* This would be populated with actual data in a real implementation */}
                <div className="p-3 rounded-md border">
                  <p className="font-medium">Introduction to Programming</p>
                  <p className="text-sm text-muted-foreground">Computer Science</p>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="outline">Active</Badge>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="#">View</Link>
                    </Button>
                  </div>
                </div>
                <div className="p-3 rounded-md border">
                  <p className="font-medium">Data Structures</p>
                  <p className="text-sm text-muted-foreground">Computer Science</p>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="outline">Completed</Badge>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="#">View</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/admin/campus/students/${enrollment.student.id}/enrollments`}>
                  View All Enrollments
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
} 