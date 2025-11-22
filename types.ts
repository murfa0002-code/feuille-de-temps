

export enum TaskCategory {
  CHARGEABLE = 'Temps chargeable',
  NON_CHARGEABLE = 'Temps non chargeable',
}

export interface Task {
  id: string;
  name: string;
  category: TaskCategory;
  hours: number[]; // [Mon, Tue, Wed, Thu, Fri, SatSun] -> 6 elements
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  dayIndex: number; // 0 to 5 (based on DAYS_OF_WEEK constant)
  updated_at?: string;
}

// Kept for legacy component props, but Profile is the new source of truth
export interface Employee {
  id: string;
  name: string;
  username: string;
  password?: string; // No longer stored client-side
  role: 'admin' | 'employee';
}

export interface Profile {
  id: string; // Foreign key to auth.users.id
  name: string;
  username: string;
  role: 'admin' | 'employee';
  updated_at?: string;
}

export interface TimesheetData {
  id: string;
  employee_id: string; // Changed from employeeId to match DB schema
  period_number: string;
  start_date: string;
  end_date: string;
  tasks: Task[];
  todo_list?: TodoItem[]; // New field for weekly objectives
  normal_hours: number[];
  status: 'draft' | 'submitted' | 'approved';
  created_at?: string;
  updated_at?: string;
}

export interface ChargeableTask {
  id: string;
  name: string;
  status: 'approved' | 'pending' | 'rejected';
  proposed_by: string;
  created_at: string;
  profiles?: { name: string }; // For joining proposer name
}

export type AppView = 'timesheet' | 'todo_list' | 'analysis' | 'detailed_analysis' | 'admin_tasks';