-- Add situation fields to dossiers
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS situation_logement text CHECK (situation_logement IN ('locataire', 'proprietaire', 'heberge'));
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS situation_professionnelle text CHECK (situation_professionnelle IN ('salarie', 'retraite', 'tns'));
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS emprunt_a_deux boolean DEFAULT false;

-- Add category field to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS categorie_document text;
