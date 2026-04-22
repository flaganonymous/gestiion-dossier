-- =============================================
-- Migration 009 : Journal des emails envoyés
--
-- Permet de tracer l'envoi des emails (template, destinataire,
-- succès/erreur) pour alimenter la page de statistiques.
-- =============================================

create table if not exists public.email_logs (
  id uuid primary key default uuid_generate_v4(),
  template_slug text,
  destinataire text not null,
  sujet text,
  dossier_id uuid references public.dossiers(id) on delete set null,
  success boolean not null default true,
  erreur text,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_logs_created_at
  on public.email_logs (created_at desc);

create index if not exists idx_email_logs_template
  on public.email_logs (template_slug);

alter table public.email_logs enable row level security;

drop policy if exists "Admin lit email_logs" on public.email_logs;
create policy "Admin lit email_logs" on public.email_logs
  for select using (public.get_my_role() = 'admin');
