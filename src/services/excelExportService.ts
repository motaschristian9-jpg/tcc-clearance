import ExcelJS from 'exceljs';
import { StoredRosterStudent, StoredAttendanceRecord } from '../types/database';

export interface GenerateWorkbookParams {
  eventName: string;
  departmentId: string;
  students: StoredRosterStudent[];
  records: StoredAttendanceRecord[];
}

export async function generateAttendanceWorkbook(params: GenerateWorkbookParams): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TCC Event Clearance System';
  workbook.created = new Date();

  const sheetName = `${params.departmentId} Attendance`;
  const sheet = workbook.addWorksheet(sheetName);

  // Define Columns
  sheet.columns = [
    { header: 'School ID', key: 'school_id', width: 16 },
    { header: 'Full Name', key: 'name', width: 26 },
    { header: 'Department', key: 'department', width: 14 },
    { header: 'Section', key: 'section', width: 14 },
    { header: 'Day 1 AM In', key: 'd1_am_in', width: 14 },
    { header: 'Day 1 AM Out', key: 'd1_am_out', width: 14 },
    { header: 'Day 1 PM In', key: 'd1_pm_in', width: 14 },
    { header: 'Day 1 PM Out', key: 'd1_pm_out', width: 14 },
    { header: 'Total Cleared', key: 'total', width: 16 },
  ];

  // Header Row Styling
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF18181B' }, // Dark charcoal #18181b
  };

  // Add Student Rows
  for (const student of params.students) {
    const studentRecords = params.records.filter((r) => r.student_id === student.student_id && r.status === 'valid');

    const hasD1AmIn = studentRecords.some((r) => r.slot_id === 'day1-morning-in');
    const hasD1AmOut = studentRecords.some((r) => r.slot_id === 'day1-morning-out');
    const hasD1PmIn = studentRecords.some((r) => r.slot_id === 'day1-afternoon-in');
    const hasD1PmOut = studentRecords.some((r) => r.slot_id === 'day1-afternoon-out');

    sheet.addRow({
      school_id: student.school_id_no,
      name: student.full_name,
      department: student.department_id,
      section: student.section_id,
      d1_am_in: hasD1AmIn ? 'SIGNED' : 'MISSING',
      d1_am_out: hasD1AmOut ? 'SIGNED' : 'MISSING',
      d1_pm_in: hasD1PmIn ? 'SIGNED' : 'MISSING',
      d1_pm_out: hasD1PmOut ? 'SIGNED' : 'MISSING',
      total: `${studentRecords.length} / 20`,
    });
  }

  return workbook;
}

/**
 * Trigger browser file download of generated Excel workbook
 */
export async function downloadAttendanceWorkbook(params: GenerateWorkbookParams): Promise<void> {
  const workbook = await generateAttendanceWorkbook(params);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TCC_${params.departmentId}_Attendance_${Date.now()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
