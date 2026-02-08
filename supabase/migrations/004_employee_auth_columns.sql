-- ================================================================
-- Migration 004 : Colonnes authentification employés (CORRIGÉE)
-- ================================================================

-- 1. AJOUTER LA COLONNE user_id EN PREMIER
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Ajouter la colonne email si elle n'existe pas
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. Ajouter les colonnes de gestion de compte
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 4. Ajouter account_status avec contrainte
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'pending';

-- 5. Ajouter la contrainte CHECK sur account_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_account_status_check'
  ) THEN
    ALTER TABLE employees
    ADD CONSTRAINT employees_account_status_check
    CHECK (account_status IN ('pending', 'active', 'suspended', 'deactivated'));
  END IF;
END $$;

-- 6. Commentaires pour documentation
COMMENT ON COLUMN employees.user_id IS 'Référence vers auth.users Supabase - null si invitation pas encore acceptée';
COMMENT ON COLUMN employees.invitation_sent_at IS 'Date envoi email invitation';
COMMENT ON COLUMN employees.invitation_accepted_at IS 'Date activation compte par employé';
COMMENT ON COLUMN employees.account_status IS 'pending=en attente activation, active=actif, suspended=temporaire, deactivated=définitif';

-- 7. Index pour performance
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_employees_account_status ON employees(organization_id, account_status);

-- 8. Contrainte unicité email par organisation
DROP INDEX IF EXISTS idx_employees_org_email;
CREATE UNIQUE INDEX idx_employees_org_email
  ON employees(organization_id, LOWER(email));

-- 9. RLS Policy pour liaison user_id lors de l'activation
DROP POLICY IF EXISTS "Employees can update own user_id during activation" ON employees;
CREATE POLICY "Employees can update own user_id during activation"
  ON employees FOR UPDATE
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND user_id IS NULL
  )
  WITH CHECK (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

-- 10. Policy lecture pour employé via user_id
DROP POLICY IF EXISTS "Employees can view own profile via user_id" ON employees;
CREATE POLICY "Employees can view own profile via user_id"
  ON employees FOR SELECT
  USING (user_id = auth.uid());
