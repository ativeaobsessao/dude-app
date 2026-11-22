-- DUDE — Migração consolidada para autocontrole e Centro
-- Reexecutável: usa ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS e verificações de constraints.
-- Se a migração 006 já foi aplicada, esta versão reaplica suas etapas de forma idempotente e acrescenta os campos 007.

-- DUDE — Ajustes de consistência do acompanhamento de autocontrole
-- Aplicar no Supabase SQL Editor antes de publicar esta versão.

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS monitor_type TEXT,
  ADD COLUMN IF NOT EXISTS monitor_start TEXT,
  ADD COLUMN IF NOT EXISTS monitor_end TEXT,
  ADD COLUMN IF NOT EXISTS monitor_weekdays TEXT;

ALTER TABLE public.avoidance_checkins
  ADD COLUMN IF NOT EXISTS trigger_tag TEXT,
  ADD COLUMN IF NOT EXISTS trigger_note TEXT,
  ADD COLUMN IF NOT EXISTS window_label TEXT,
  ADD COLUMN IF NOT EXISTS prompts_shown INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS intensity INTEGER,
  ADD COLUMN IF NOT EXISTS time_spent INTEGER;


-- Preserve check-ins and notes when a monitored behavior is removed.
ALTER TABLE public.avoidance_checkins
  ALTER COLUMN habit_id DROP NOT NULL;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.avoidance_checkins'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%(habit_id)%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.avoidance_checkins DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;

  ALTER TABLE public.avoidance_checkins
    ADD CONSTRAINT avoidance_checkins_habit_id_fkey
    FOREIGN KEY (habit_id) REFERENCES public.habits(id) ON DELETE SET NULL;
END $$;

-- Migrations anteriores divergiam dos status que a interface já gravava.
-- Mantemos os aliases antigos permitidos para leitura de registros históricos,
-- mas a aplicação passa a gravar apenas success, relapse e pending.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.avoidance_checkins'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.avoidance_checkins DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.avoidance_checkins'::regclass
      AND conname = 'avoidance_checkins_status_valid_check'
  ) THEN
    ALTER TABLE public.avoidance_checkins
      ADD CONSTRAINT avoidance_checkins_status_valid_check
      CHECK (status IN ('success', 'relapse', 'pending', 'resisti', 'recai', 'depois'));
  END IF;
END $$;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.avoidance_checkins'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%checkin_period%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.avoidance_checkins DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.avoidance_checkins'::regclass
      AND conname = 'avoidance_checkins_period_valid_check'
  ) THEN
    ALTER TABLE public.avoidance_checkins
      ADD CONSTRAINT avoidance_checkins_period_valid_check
      CHECK (checkin_period IN ('morning', 'afternoon', 'evening', 'window', 'all'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.inbox_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inbox_captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own inbox_captures" ON public.inbox_captures;
CREATE POLICY "Users can manage their own inbox_captures"
  ON public.inbox_captures
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_avoidance_checkins_user_habit_date
  ON public.avoidance_checkins (user_id, habit_id, checkin_date);

CREATE INDEX IF NOT EXISTS idx_avoidance_checkins_user_created_at
  ON public.avoidance_checkins (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_avoidance_checkins_habit_created_at
  ON public.avoidance_checkins (habit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_captures_user_created_at
  ON public.inbox_captures (user_id, created_at DESC);


-- DUDE — Campos estruturados para análise de padrões de autocontrole
-- Executar no SQL Editor depois das migrações de base.
-- Esta migração é aditiva e preserva os registros já existentes.

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS monitor_type TEXT,
  ADD COLUMN IF NOT EXISTS monitor_start TEXT,
  ADD COLUMN IF NOT EXISTS monitor_end TEXT,
  ADD COLUMN IF NOT EXISTS monitor_weekdays TEXT;

ALTER TABLE public.avoidance_checkins
  ADD COLUMN IF NOT EXISTS trigger_tag TEXT,
  ADD COLUMN IF NOT EXISTS trigger_note TEXT,
  ADD COLUMN IF NOT EXISTS window_label TEXT,
  ADD COLUMN IF NOT EXISTS prompts_shown INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS intensity INTEGER,
  ADD COLUMN IF NOT EXISTS time_spent INTEGER,
  ADD COLUMN IF NOT EXISTS urge_intensity SMALLINT,
  ADD COLUMN IF NOT EXISTS emotion_tag TEXT,
  ADD COLUMN IF NOT EXISTS environment_tag TEXT,
  ADD COLUMN IF NOT EXISTS preceding_activity TEXT,
  ADD COLUMN IF NOT EXISTS recovery_action TEXT,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_avoidance_checkins_user_habit_created
  ON public.avoidance_checkins (user_id, habit_id, created_at DESC);

COMMENT ON COLUMN public.avoidance_checkins.urge_intensity IS
  'Intensidade subjetiva do impulso informada pelo usuário, de 1 a 10.';
COMMENT ON COLUMN public.avoidance_checkins.emotion_tag IS
  'Estado emocional informado pelo usuário no momento do registro.';
COMMENT ON COLUMN public.avoidance_checkins.environment_tag IS
  'Ambiente ou contexto informado pelo usuário no momento do registro.';
COMMENT ON COLUMN public.avoidance_checkins.preceding_activity IS
  'Atividade que o usuário estava realizando antes do episódio.';
COMMENT ON COLUMN public.avoidance_checkins.recovery_action IS
  'Estratégia que ajudou o usuário a atravessar um impulso.';
COMMENT ON COLUMN public.avoidance_checkins.occurred_at IS
  'Data e hora do acontecimento informadas pelo usuário; created_at permanece como horário de gravação.';
