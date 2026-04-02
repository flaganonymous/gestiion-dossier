-- =============================================
-- FIX: Récursion infinie dans les policies RLS
-- Le problème : les policies sur "profiles" font SELECT FROM profiles → boucle
-- La solution : utiliser une fonction SECURITY DEFINER qui bypass RLS
-- =============================================

-- Fonction helper qui retourne le rôle de l'utilisateur connecté (bypass RLS)
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- =============================================
-- Supprimer les policies problématiques sur profiles
-- =============================================
drop policy if exists "Admin voit tous les profils" on public.profiles;
drop policy if exists "Profils visibles par collaborateurs" on public.profiles;
drop policy if exists "Profil visible par l'utilisateur lui-même" on public.profiles;

-- Recréer les policies sans récursion
create policy "Profil visible par l'utilisateur lui-même" on public.profiles
  for select using (auth.uid() = id);

create policy "Admin et collaborateur voient tous les profils" on public.profiles
  for select using (public.get_my_role() in ('admin', 'collaborateur'));

create policy "Admin gère tous les profils" on public.profiles
  for all using (public.get_my_role() = 'admin');

-- =============================================
-- Supprimer et recréer les policies sur dossiers
-- =============================================
drop policy if exists "Admin et collaborateur voient tout" on public.dossiers;
drop policy if exists "Apporteur voit ses dossiers" on public.dossiers;
drop policy if exists "Client voit son dossier" on public.dossiers;
drop policy if exists "Apporteur peut créer un dossier" on public.dossiers;

create policy "Admin et collaborateur voient tout" on public.dossiers
  for all using (public.get_my_role() in ('admin', 'collaborateur'));

create policy "Apporteur voit ses dossiers" on public.dossiers
  for select using (
    public.get_my_role() = 'apporteur' and apporteur_id = auth.uid()
  );

create policy "Client voit son dossier" on public.dossiers
  for select using (
    public.get_my_role() = 'client' and client_id = auth.uid()
  );

create policy "Apporteur peut créer un dossier" on public.dossiers
  for insert with check (
    public.get_my_role() = 'apporteur' and apporteur_id = auth.uid()
  );

-- =============================================
-- Supprimer et recréer les policies sur documents
-- =============================================
drop policy if exists "Documents visibles selon accès au dossier" on public.documents;
drop policy if exists "Upload possible si accès au dossier" on public.documents;
drop policy if exists "Suppression document : admin/collaborateur seulement" on public.documents;

create policy "Documents visibles selon accès au dossier" on public.documents
  for select using (
    exists (
      select 1 from public.dossiers d
      where d.id = dossier_id
      and (
        public.get_my_role() in ('admin', 'collaborateur')
        or (public.get_my_role() = 'apporteur' and d.apporteur_id = auth.uid())
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
        or (public.get_my_role() = 'apporteur' and d.apporteur_id = auth.uid())
        or (public.get_my_role() = 'client' and d.client_id = auth.uid())
      )
    )
  );

create policy "Suppression document : admin/collaborateur seulement" on public.documents
  for delete using (public.get_my_role() in ('admin', 'collaborateur'));

-- =============================================
-- Supprimer et recréer les policies sur historique_statuts
-- =============================================
drop policy if exists "Historique visible selon accès au dossier" on public.historique_statuts;

create policy "Historique visible selon accès au dossier" on public.historique_statuts
  for select using (
    exists (
      select 1 from public.dossiers d
      where d.id = dossier_id
      and (
        public.get_my_role() in ('admin', 'collaborateur')
        or (public.get_my_role() = 'apporteur' and d.apporteur_id = auth.uid())
        or (public.get_my_role() = 'client' and d.client_id = auth.uid())
      )
    )
  );
