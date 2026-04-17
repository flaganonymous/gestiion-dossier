-- =============================================
-- Migration 007 : Table apporteurs dédiée + suppression du rôle apporteur
--
-- Les apporteurs d'affaires n'ont plus accès à l'outil.
-- On les stocke dans une table dédiée (sans compte auth).
-- =============================================

-- 1. Table apporteurs
create table if not exists public.apporteurs (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  prenom text not null,
  email text,
  telephone text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists apporteurs_updated_at on public.apporteurs;
create trigger apporteurs_updated_at
  before update on public.apporteurs
  for each row execute function update_updated_at();

-- 2. Migration des profils existants ayant le rôle 'apporteur'
--    vers la nouvelle table (IDs préservés pour ne pas remapper dossiers.apporteur_id)
insert into public.apporteurs (id, nom, prenom, email, actif, created_at)
select id, nom, prenom, email, actif, created_at
from public.profiles
where role = 'apporteur'
on conflict (id) do nothing;

-- 3. Basculement de la FK dossiers.apporteur_id : profiles → apporteurs
do $$
declare fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'dossiers'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'apporteur_id';
  if fk_name is not null then
    execute format('alter table public.dossiers drop constraint %I', fk_name);
  end if;
end$$;

alter table public.dossiers
  add constraint dossiers_apporteur_id_fkey
  foreign key (apporteur_id) references public.apporteurs(id) on delete set null;

-- 4. Neutraliser les profils apporteur : basculer sur 'collaborateur' + actif=false
--    (auth.users conservé, accès désactivé via actif=false).
update public.profiles
set role = 'collaborateur', actif = false
where role = 'apporteur';

-- 5. Supprimer toutes les policies RLS référencant la colonne profiles.role
--    (elles bloquent le changement de type de la colonne)
drop policy if exists "Apporteur voit ses dossiers" on public.dossiers;
drop policy if exists "Apporteur peut créer un dossier" on public.dossiers;
drop policy if exists "Documents visibles selon accès au dossier" on public.documents;
drop policy if exists "Upload possible si accès au dossier" on public.documents;
drop policy if exists "Historique visible selon accès au dossier" on public.historique_statuts;
drop policy if exists "Admin accès smtp_config" on public.smtp_config;
drop policy if exists "Admin accès email_templates" on public.email_templates;

-- 6. Recréer l'enum user_role sans 'apporteur'
alter table public.profiles alter column role drop default;

alter type public.user_role rename to user_role_old;
create type public.user_role as enum ('admin', 'collaborateur', 'client');

alter table public.profiles
  alter column role type public.user_role
  using role::text::public.user_role;

alter table public.profiles alter column role set default 'client';

drop type public.user_role_old;

-- 7. Mettre à jour le trigger handle_new_user (plus de fallback 'apporteur')
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nom, prenom, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'client')
  );
  return new;
end;
$$ language plpgsql security definer;

-- 8. Recréer les policies (sans référence à 'apporteur')
create policy "Documents visibles selon accès au dossier" on public.documents
  for select using (
    exists (
      select 1 from public.dossiers d
      where d.id = dossier_id
      and (
        public.get_my_role() in ('admin', 'collaborateur')
        or (public.get_my_role() = 'client' and d.client_id = auth.uid())
      )
    )
  );

create policy "Upload possible si accès au dossier" on public.documents
  for insert with check (
    exists (
      select 1 from public.dossiers d
      where d.id = dossier_id
      and (
        public.get_my_role() in ('admin', 'collaborateur')
        or (public.get_my_role() = 'client' and d.client_id = auth.uid())
      )
    )
  );

create policy "Historique visible selon accès au dossier" on public.historique_statuts
  for select using (
    exists (
      select 1 from public.dossiers d
      where d.id = dossier_id
      and (
        public.get_my_role() in ('admin', 'collaborateur')
        or (public.get_my_role() = 'client' and d.client_id = auth.uid())
      )
    )
  );

-- 9. Recréer les policies admin pour smtp_config + email_templates
create policy "Admin accès smtp_config" on public.smtp_config
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin accès email_templates" on public.email_templates
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 10. RLS sur apporteurs : seuls admin et collaborateur gèrent la table
alter table public.apporteurs enable row level security;

drop policy if exists "Admin et collaborateur gèrent apporteurs" on public.apporteurs;
create policy "Admin et collaborateur gèrent apporteurs" on public.apporteurs
  for all using (public.get_my_role() in ('admin', 'collaborateur'));
