-- Таблица для регистрации пользователей ежедневника
-- Юзернейм уникален глобально — два пользователя не могут взять одинаковый.

CREATE TABLE IF NOT EXISTS checklist_users (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  username    text        UNIQUE NOT NULL,
  display_name text       NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE checklist_users ENABLE ROW LEVEL SECURITY;

-- Любой может проверить занятость юзернейма
CREATE POLICY "checklist_users_select" ON checklist_users
  FOR SELECT USING (true);

-- Любой может зарегистрировать новый юзернейм (INSERT только если его ещё нет — UNIQUE гарантирует)
CREATE POLICY "checklist_users_insert" ON checklist_users
  FOR INSERT WITH CHECK (true);
