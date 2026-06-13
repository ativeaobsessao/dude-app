-- Migration: 005_subscription_trial_vip.sql
-- Description: Sets up the 21-day Free Trial without Card, Admin/VIP Lifetimes, and the Garbage Collector script.
-- Author: SecOps Securitas Team

-- 1. ALTER TABLE PROFILES TO ADD SUBSCRIPTION & TRIAL STRUCTURE
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '21 days'),
ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Retroactive fix: Existing users get 21 days from now so they are not instantly locked out
UPDATE public.profiles
SET trial_ends_at = NOW() + INTERVAL '21 days'
WHERE trial_ends_at IS NULL;


-- 2. UPDATE THE AUTO-PROVISIONING TRIGGER (handle_new_user)
-- Ensures that EVERY new user created in Supabase Auth automatically receives a 21-day trial limit.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    avatar_url, 
    trial_ends_at, 
    is_subscribed, 
    is_admin
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    NOW() + INTERVAL '21 days', -- 21 Dias de Free Trial nativo
    false,
    false
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. THE GARBAGE COLLECTOR (Rotina de Limpeza - Grace Period 30 dias)
-- Rascunho de Query SQL ideal para rodar via pg_cron ou Edge Function semanal para limpar registros órfãos.
-- Regra: Conta inativa/abandonada se passaram 30 dias desde a criação e o trial expirou a pelo menos 9 dias, 
-- e o usuário nunca assinou nem é admin.
/*
-- Para deletar contas de teste antigas:
DELETE FROM auth.users
WHERE id IN (
  SELECT p.id 
  FROM public.profiles p
  WHERE p.is_subscribed = false
    AND p.is_admin = false
    AND NOW() > p.trial_ends_at + INTERVAL '9 days' -- totaliza 30 dias desde o início (21 de trial + 9 de carência)
);
*/


-- 4. EXPLICAÇÃO DE ON DELETE CASCADE (Prevenção de Lixo Órfão)
-- No PostgreSQL/Supabase, a integridade referencial garante que nenhuma tabela contenha chaves estrangeiras sem pai.
-- Como todos os relacionamentos principais da DUDE foram criados mapeando:
-- REFERENCES profiles(id) ON DELETE CASCADE
-- quando o auth.users é destruído, a tabela profiles é deletada via cascata, 
-- e sucessivamente todas as tabelas filhas (habits, scheduled_activities, day_closures, notes, focus_sessions, etc) são evaporadas instantaneamente do banco de dados, sem deixar vestígios.
--
-- Se você precisar validar ou re-aplicar essa cascade em alguma tabela que use chave estrangeira tradicional (sem CASCADE), o molde SQL é:
-- ALTER TABLE nome_da_tabela 
-- DROP CONSTRAINT fk_nome_da_constraint,
-- ADD CONSTRAINT fk_nome_da_constraint FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
