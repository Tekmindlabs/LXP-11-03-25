import { AttendanceStatusType } from "@prisma/client";

// Define attendance status options
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

// Basic attendance record structure
export interface AttendanceRecord {
  id: string;
  date: Date | string;
  status: AttendanceStatus;
  remarks?: string;
  studentId: string;
  classId: string;
  student?: {
    id: string;
    name: string;
    email?: string;
  };
  class?: {
    id: string;
    name: string;
  };
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// Attendance statistics
export interface AttendanceStats {
  totalDays: number;
  statusCounts: {
    PRESENT: number;
    ABSENT: number;
    LATE: number;
    EXCUSED: number;
  };
  attendanceRate: number;
}

// Class-specific attendance statistics
export interface ClassAttendanceStats {
  classId: string;
  className?: string;
  stats: AttendanceStats;
  periodStats?: {
    [period: string]: AttendanceStats;
  };
}

// Student-specific attendance statistics
export interface StudentAttendanceStats {
  studentId: string;
  studentName?: string;
  stats: AttendanceStats;
  periodStats?: {
    [period: string]: AttendanceStats;
  };
}

// Filter options for attendance queries
export interface AttendanceFilter {
  classId?: string;
  studentId?: string;
  status?: AttendanceStatus;
  startDate?: Date;
  endDate?: Date;
  period?: string;
  page?: number;
  pageSize?: number;
  take?: number;
}

// Structure for bulk attendance records
export interface BulkAttendanceRecord {
  date: Date | string;
  classId: string;
  records: {
    studentId: string;
    status: AttendanceStatus;
    remarks?: string;
  }[];
}

// Attendance trend data for analytics
export interface AttendanceTrend {
  date: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
}

// Student comparison data for analytics
export interface StudentComparison {
  studentId: string;
  studentName: string;
  presentRate: number;
  absentRate: number;
  lateRate: number;
  excusedRate: number;
}

// Heatmap data structure for attendance visualization
export interface AttendanceHeatmapData {
  day: string;
  period: string;
  value: number;
}

// Chart data for pie charts
export interface PieChartData {
  id: string;
  label: string;
  value: number;
  color: string;
} 