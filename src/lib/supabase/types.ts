import type { SituationLogement, SituationProfessionnelle } from '@/lib/documents-checklist'

export type UserRole = 'admin' | 'collaborateur' | 'client'
export type DossierStatut = 'en_cours' | 'refuse' | 'finance'

export interface Profile {
  id: string
  email: string
  nom: string
  prenom: string
  role: UserRole
  actif: boolean
  record_id_crm: string | null
  invitation_token: string | null
  invitation_expire_at: string | null
  created_at: string
  updated_at: string
}

export interface Apporteur {
  id: string
  nom: string
  prenom: string
  email: string | null
  telephone: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

export interface Dossier {
  id: string
  titre: string
  annee: number
  statut: DossierStatut
  client_id: string | null
  apporteur_id: string | null
  notes: string | null
  situation_logement: SituationLogement | null
  situation_professionnelle: SituationProfessionnelle | null
  emprunt_a_deux: boolean
  created_at: string
  updated_at: string
  // relations
  client?: Profile | null
  apporteur?: Apporteur | null
  documents?: Document[]
}

export interface Document {
  id: string
  dossier_id: string
  nom_fichier: string
  type_mime: string | null
  s3_key: string
  taille: number | null
  categorie_document: string | null
  uploade_par: string | null
  created_at: string
  // relation
  uploade_par_profile?: Profile | null
}

export interface HistoriqueStatut {
  id: string
  dossier_id: string
  ancien_statut: DossierStatut | null
  nouveau_statut: DossierStatut
  modifie_par: string | null
  created_at: string
  // relation
  modifie_par_profile?: Profile | null
}

export const STATUT_LABELS: Record<DossierStatut, string> = {
  en_cours: 'En cours',
  refuse: 'Refusé',
  finance: 'Financé',
}

export const STATUT_COLORS: Record<DossierStatut, string> = {
  en_cours: 'bg-blue-100 text-blue-800',
  refuse: 'bg-red-100 text-red-800',
  finance: 'bg-green-100 text-green-800',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  collaborateur: 'Collaborateur',
  client: 'Client',
}
