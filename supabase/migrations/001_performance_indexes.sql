-- Performance Indexes for PharmaPlanning
-- Execute in Supabase Dashboard > SQL Editor

-- Shifts: query la plus frequente (org + date range)
CREATE INDEX IF NOT EXISTS idx_shifts_org_date
ON shifts(organization_id, date);

-- Shifts: par employe (portail employe, recap)
CREATE INDEX IF NOT EXISTS idx_shifts_employee_date
ON shifts(employee_id, date);

-- Employees: par organization + status (filtres)
CREATE INDEX IF NOT EXISTS idx_employees_org_status
ON employees(organization_id, status);

-- Leave requests: par org + dates
CREATE INDEX IF NOT EXISTS idx_leave_requests_org_dates
ON leave_requests(organization_id, start_date, end_date);

-- Leave requests: par employe
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee
ON leave_requests(employee_id, status);

-- Notifications: par org + employe + read status (NotificationBell polling)
CREATE INDEX IF NOT EXISTS idx_notifications_org_employee_read
ON notifications(organization_id, employee_id, read);

-- Notifications: par date creation (tri recent first)
CREATE INDEX IF NOT EXISTS idx_notifications_created
ON notifications(created_at DESC);

-- Notification preferences: lookup rapide
CREATE INDEX IF NOT EXISTS idx_notif_prefs_org_employee
ON notification_preferences(organization_id, employee_id);

-- Analyze tables pour optimiser le query planner
ANALYZE shifts;
ANALYZE employees;
ANALYZE leave_requests;
ANALYZE notifications;
ANALYZE notification_preferences;
