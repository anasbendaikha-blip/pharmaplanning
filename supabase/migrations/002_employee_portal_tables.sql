-- =============================================
-- Migration 002: Employee Portal Tables
-- Tables: availabilities, requests, daily_tasks
-- Execute in Supabase Dashboard > SQL Editor
-- =============================================

-- ─── Table: availabilities ───
CREATE TABLE IF NOT EXISTS availabilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  week_start DATE NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  status TEXT NOT NULL CHECK (status IN ('available','unavailable','uncertain')),
  start_time TIME,
  end_time TIME,
  comment TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, week_start, day_of_week)
);

-- ─── Table: requests ───
CREATE TABLE IF NOT EXISTS requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('leave','shift_swap','sick_leave','other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  start_date DATE NOT NULL,
  end_date DATE,
  target_employee_id UUID REFERENCES employees(id),
  reason TEXT,
  manager_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Table: daily_tasks ───
CREATE TABLE IF NOT EXISTS daily_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  task_name TEXT NOT NULL,
  date DATE NOT NULL,
  assigned_employee_id UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, task_name, date)
);

-- ─── RLS: availabilities ───
ALTER TABLE availabilities ENABLE ROW LEVEL SECURITY;

-- ─── RLS: requests ───
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- ─── RLS: daily_tasks ───
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;

-- ─── Indexes: availabilities ───
CREATE INDEX IF NOT EXISTS idx_availabilities_employee ON availabilities(employee_id, week_start);
CREATE INDEX IF NOT EXISTS idx_availabilities_org_week ON availabilities(organization_id, week_start);

-- ─── Indexes: requests ───
CREATE INDEX IF NOT EXISTS idx_requests_employee ON requests(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_org_status ON requests(organization_id, status, created_at DESC);

-- ─── Indexes: daily_tasks ───
CREATE INDEX IF NOT EXISTS idx_daily_tasks_org_date ON daily_tasks(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_employee ON daily_tasks(assigned_employee_id, date);

-- ─── Analyze ───
ANALYZE availabilities;
ANALYZE requests;
ANALYZE daily_tasks;
