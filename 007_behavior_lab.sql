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
