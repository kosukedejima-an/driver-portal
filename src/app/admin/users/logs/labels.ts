export type EmployeeLog = {
  id: number;
  target_id: string | null;
  target_name: string;
  target_employee_no: string | null;
  action: "create" | "edit" | "role" | "suspend" | "resume" | "delete";
  details: string[] | null;
  actor_name: string | null;
  created_at: string;
};

export const ACTION_LABELS: Record<EmployeeLog["action"], string> = {
  create: "登録",
  edit: "編集",
  role: "権限の変更",
  suspend: "退職（利用停止）",
  resume: "利用再開",
  delete: "完全削除",
};
