-- Extension pour les UUIDs
create extension if not exists "uuid-ossp";

-- Enum rôles
create type user_role as enum ('admin', 'collaborateur', 'apporteur', 'client');

-- Enum statuts dossier
create type dossier_statut as enum ('en_cours', 'refuse', 'finance');

-- Table profils (complète auth.users de Supabase)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  nom text not null,
  prenom text not null,
  role user_role not null default 'apporteur',
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table dossiers
create table public.dossiers (
  id uuid primary key default uuid_generate_v4(),
  titre text not null,
  annee integer not null default extract(year from now()),
  statut dossier_statut not null default 'en_cours',
  client_id uuid references public.profiles(id) on delete set null,
  apporteur_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table documents
create table public.documents (
  id uuid primary key default uuid_generate_v4(),
  dossier_id uuid references public.dossiers(id) on delete cascade not null,
  nom_fichier text not null,
  type_mime text,
  s3_key text not null,
  taille bigint,
  uploade_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Table historique statuts
create table public.historique_statuts (
  id uuid primary key default uuid_generate_v4(),
  dossier_id uuid references public.dossiers(id) on delete cascade not null,
  ancien_statut dossier_statut,
  nouveau_statut dossier_statut not null,
  modifie_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Trigger updated_at sur profiles
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function update_updated_at();

create trigger dossiers_updated_at
  before update on public.dossiers
  for each row execute function update_updated_at();

-- Trigger : créer le profil automatiquement à l'inscription
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nom, prenom, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'apporteur')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS (Row Level Security)
alter table public.profiles enable row level security;
alter table public.dossiers enable row level security;
alter table public.documents enable row level security;
alter table public.historique_statuts enable row level security;

-- Policies profiles
create policy "Profil visible par l'utilisateur lui-même" on public.profiles
  for select using (auth.uid() = id);

create policy "Admin voit tous les profils" on public.profiles
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Profils visibles par collaborateurs" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'collaborateur')
    )
  );

-- Policies dossiers
create policy "Admin et collaborateur voient tout" on public.dossiers
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'collaborateur')
    )
  );

create policy "Apporteur voit ses dossiers" on public.dossiers
  for select using (
    apporteur_id = auth.uid()
  );

create policy "Client voit son dossier" on public.dossiers
  for select using (
    client_id = auth.uid()
  );

create policy "Apporteur peut créer un dossier" on public.dossiers
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'collaborateur', 'apporteur')
    )
  );

-- Policies documents
create policy "Documents visibles selon accès au dossier" on public.documents
  for select using (
    exists (
      select 1 from public.dossiers d
      where d.id = dossier_id
      and (
        d.client_id = auth.uid()
        or d.apporteur_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin', 'collaborateur')
        )
      )
    )
  );

create policy "Upload possible si accès au dossier" on public.documents
  for insert with check (
    exists (
      select 1 from public.dossiers d
      where d.id = dossier_id
      and (
        d.client_id = auth.uid()
        or d.apporteur_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin', 'collaborateur')
        )
      )
    )
  );

create policy "Suppression document : admin/collaborateur seulement" on public.documents
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'collaborateur')
    )
  );

-- Policies historique
create policy "Historique visible selon accès au dossier" on public.historique_statuts
  for select using (
    exists (
      select 1 from public.dossiers d
      where d.id = dossier_id
      and (
        d.client_id = auth.uid()
        or d.apporteur_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin', 'collaborateur')
        )
      )
    )
  );

create policy "Insertion historique : admin/collaborateur" on public.historique_statuts
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'collaborateur')
    )
  );
