import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/data-display/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/navigation/tabs';
import { Button } from '@/components/ui/button';
import { CalendarIcon, GraduationCapIcon, UsersIcon, BookOpenIcon, ClipboardListIcon } from 'lucide-react';
import Link from 'next/link';

interface CampusAdminDashboardContentProps {
  campusId: string;
  campusName: string;
}

export function CampusAdminDashboardContent({ campusId, campusName }: CampusAdminDashboardContentProps) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="facilities">Facilities</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Campus Performance</CardTitle>
                <CardDescription>Key performance indicators for {campusName}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Student Attendance</span>
                    <span className="text-sm font-medium">87%</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '87%' }}></div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm font-medium">Class Completion</span>
                    <span className="text-sm font-medium">92%</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '92%' }}></div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm font-medium">Teacher Engagement</span>
                    <span className="text-sm font-medium">78%</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '78%' }}></div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/campus/reports`}>
                    View Detailed Reports
                  </Link>
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Events</CardTitle>
                <CardDescription>Next 7 days at {campusName}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Teacher Training Workshop</p>
                      <p className="text-sm text-muted-foreground">Tomorrow, 10:00 AM - 12:00 PM</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">End of Term Assessment</p>
                      <p className="text-sm text-muted-foreground">Friday, All Day</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Parent-Teacher Meeting</p>
                      <p className="text-sm text-muted-foreground">Saturday, 2:00 PM - 5:00 PM</p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/campus/calendar`}>
                    View Calendar
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Enrollments</CardTitle>
                <GraduationCapIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+28</div>
                <p className="text-xs text-muted-foreground">+14% from last month</p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/campus/students`}>
                    View Students
                  </Link>
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Teacher Assignments</CardTitle>
                <UsersIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">New assignments this week</p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/campus/teachers`}>
                    Manage Teachers
                  </Link>
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
                <BookOpenIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">42</div>
                <p className="text-xs text-muted-foreground">Across 8 programs</p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/campus/classes`}>
                    View Classes
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="programs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Program Management</CardTitle>
              <CardDescription>Manage programs offered at your campus</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Computer Science</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">8 active classes</p>
                      <p className="text-sm text-muted-foreground">124 enrolled students</p>
                    </CardContent>
                    <CardFooter className="pt-2">
                      <Button variant="outline" size="sm" className="w-full">Manage</Button>
                    </CardFooter>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Business Administration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">12 active classes</p>
                      <p className="text-sm text-muted-foreground">156 enrolled students</p>
                    </CardContent>
                    <CardFooter className="pt-2">
                      <Button variant="outline" size="sm" className="w-full">Manage</Button>
                    </CardFooter>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Graphic Design</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">6 active classes</p>
                      <p className="text-sm text-muted-foreground">98 enrolled students</p>
                    </CardContent>
                    <CardFooter className="pt-2">
                      <Button variant="outline" size="sm" className="w-full">Manage</Button>
                    </CardFooter>
                  </Card>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <Link href={`/admin/campus/programs`}>
                  View All Programs
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="classes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Class Management</CardTitle>
              <CardDescription>Manage classes at your campus</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-md border">
                  <div className="grid grid-cols-5 p-4 font-medium">
                    <div>Class Code</div>
                    <div>Name</div>
                    <div>Program</div>
                    <div>Teacher</div>
                    <div>Students</div>
                  </div>
                  <div className="divide-y">
                    <div className="grid grid-cols-5 p-4">
                      <div>CS101</div>
                      <div>Introduction to Programming</div>
                      <div>Computer Science</div>
                      <div>John Smith</div>
                      <div>32</div>
                    </div>
                    <div className="grid grid-cols-5 p-4">
                      <div>BA201</div>
                      <div>Marketing Fundamentals</div>
                      <div>Business Administration</div>
                      <div>Sarah Johnson</div>
                      <div>28</div>
                    </div>
                    <div className="grid grid-cols-5 p-4">
                      <div>GD110</div>
                      <div>Design Principles</div>
                      <div>Graphic Design</div>
                      <div>Michael Chen</div>
                      <div>24</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <Link href={`/admin/campus/classes`}>
                  Manage Classes
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage users at your campus</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Teachers</CardTitle>
                        <UsersIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">32</div>
                      <p className="text-sm text-muted-foreground">Active teachers</p>
                    </CardContent>
                    <CardFooter className="pt-2">
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link href={`/admin/campus/teachers`}>
                          Manage Teachers
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Students</CardTitle>
                        <GraduationCapIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">450</div>
                      <p className="text-sm text-muted-foreground">Enrolled students</p>
                    </CardContent>
                    <CardFooter className="pt-2">
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link href={`/admin/campus/students`}>
                          Manage Students
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Staff</CardTitle>
                        <UsersIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">18</div>
                      <p className="text-sm text-muted-foreground">Administrative staff</p>
                    </CardContent>
                    <CardFooter className="pt-2">
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link href={`/admin/campus/staff`}>
                          Manage Staff
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <Link href={`/admin/campus/users/new`}>
                  Add New User
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="facilities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Facility Management</CardTitle>
              <CardDescription>Manage facilities at your campus</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-md border">
                  <div className="grid grid-cols-4 p-4 font-medium">
                    <div>Name</div>
                    <div>Type</div>
                    <div>Capacity</div>
                    <div>Status</div>
                  </div>
                  <div className="divide-y">
                    <div className="grid grid-cols-4 p-4">
                      <div>Room 101</div>
                      <div>Classroom</div>
                      <div>30</div>
                      <div><span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Available</span></div>
                    </div>
                    <div className="grid grid-cols-4 p-4">
                      <div>Computer Lab A</div>
                      <div>Laboratory</div>
                      <div>24</div>
                      <div><span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">Maintenance</span></div>
                    </div>
                    <div className="grid grid-cols-4 p-4">
                      <div>Auditorium</div>
                      <div>Event Space</div>
                      <div>200</div>
                      <div><span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Booked</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <Link href={`/admin/campus/facilities`}>
                  Manage Facilities
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest actions in your campus</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">New student enrolled in Computer Science program</p>
                <p className="text-xs text-muted-foreground">Today at 10:30 AM</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Teacher John Smith submitted final grades for CS101</p>
                <p className="text-xs text-muted-foreground">Yesterday at 4:15 PM</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">New class BA301 added to Business Administration program</p>
                <p className="text-xs text-muted-foreground">2 days ago at 2:45 PM</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Facility maintenance scheduled for Computer Lab A</p>
                <p className="text-xs text-muted-foreground">3 days ago at 9:00 AM</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/campus/activity`}>
              View All Activity
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 