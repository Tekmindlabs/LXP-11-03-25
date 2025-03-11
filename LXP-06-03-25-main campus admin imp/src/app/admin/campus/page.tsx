import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserSession } from "@/server/api/trpc";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";
import { prisma } from "@/server/db";
import { CampusAdminDashboardContent } from "@/components/dashboard/CampusAdminDashboardContent";

export const metadata: Metadata = {
  title: "Campus Admin Dashboard",
  description: "Your AIVY LXP Campus Admin Dashboard",
};

export default async function CampusAdminDashboardPage() {
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

  // Get real metrics for campus admin
  const teacherCount = await prisma.user.count({
    where: { 
      userType: 'CAMPUS_TEACHER',
      activeCampuses: {
        some: {
          campusId: user.primaryCampusId,
          status: 'ACTIVE'
        }
      }
    }
  });

  const studentCount = await prisma.user.count({
    where: { 
      userType: 'CAMPUS_STUDENT',
      activeCampuses: {
        some: {
          campusId: user.primaryCampusId,
          status: 'ACTIVE'
        }
      }
    }
  });

  const classCount = await prisma.class.count({
    where: {
      courseCampus: {
        campusId: user.primaryCampusId
      },
      status: 'ACTIVE'
    }
  });

  const programCount = await prisma.programCampus.count({
    where: {
      campusId: user.primaryCampusId,
      status: 'ACTIVE'
    }
  });

  // Custom metrics for campus admin
  const metrics = {
    teachers: { value: teacherCount, description: "Active teachers" },
    students: { value: studentCount, description: "Enrolled students" },
    classes: { value: classCount, description: "Active classes" },
    programs: { value: programCount, description: "Active programs" },
  };

  return (
    <RoleDashboard 
      userName={user.name || "Campus Admin"} 
      userType={user.userType}
      metrics={metrics}
    >
      <CampusAdminDashboardContent campusId={user.primaryCampusId} campusName={campus.name} />
    </RoleDashboard>
  );
} 