-- Таблица для регистрации пользователей ежедневника
-- Юзернейм уникален глобально — два пользователя не могут взять одинаковый.

CREATE TABLE IF NOT EXISTS checklist_users (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  username     text        UNIQUE NOT NULL,
  display_name text        NOT NULL,
  today_date   text,                          -- 'YYYY-MM-DD' последнего обновления статистики
  today_done   integer     DEFAULT 0,         -- сколько задач выполнено сегодня
  today_total  integer     DEFAULT 0,         -- всего задач на сегодня
  last_seen    timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE checklist_users ENABLE ROW LEVEL SECURITY;

-- Любой может читать (для поиска друзей)
CREATE POLICY "checklist_users_select" ON checklist_users
  FOR SELECT USING (true);

-- Любой может зарегистрироваться
CREATE POLICY "checklist_users_insert" ON checklist_users
  FOR INSERT WITH CHECK (true);

-- Любой может обновить своего пользователя (по username — ограничение чести)
CREATE POLICY "checklist_users_update" ON checklist_users
  FOR UPDATE USING (true) WITH CHECK (true);
