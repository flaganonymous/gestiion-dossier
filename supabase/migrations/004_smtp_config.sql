-- Table de configuration SMTP
CREATE TABLE IF NOT EXISTS smtp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  provider text NOT NULL DEFAULT 'custom' CHECK (provider IN ('brevo', 'mautic', 'ses', 'custom')),
  host text NOT NULL,
  port integer NOT NULL DEFAULT 587,
  username text NOT NULL,
  password_encrypted text NOT NULL,
  from_email text NOT NULL,
  from_name text NOT NULL DEFAULT 'Crédit Unique',
  use_tls boolean DEFAULT true,
  actif boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Only one active config at a time (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_smtp_config_actif ON smtp_config (actif) WHERE actif = true;

-- RLS
ALTER TABLE smtp_config ENABLE ROW LEVEL SECURITY;

-- Only admins can access (use simple policy since this table is admin-only)
CREATE POLICY "Admin accès smtp_config" ON smtp_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Email templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  nom text NOT NULL,
  sujet text NOT NULL,
  corps_html text NOT NULL,
  corps_texte text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin accès email_templates" ON email_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Insert default templates
INSERT INTO email_templates (slug, nom, sujet, corps_html, corps_texte, variables) VALUES
(
  'invitation_client',
  'Invitation client',
  'Bienvenue sur Crédit Unique — Créez votre accès',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#0E1520;padding:20px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0;font-size:24px"><span style="font-weight:300">CRÉDIT</span> <span style="color:#EE7D07;font-weight:700">UN1QUE</span></h1></div><div style="background:#fff;padding:30px;border:1px solid #EBEBEB;border-top:none;border-radius:0 0 12px 12px"><p>Bonjour <strong>{{prenom}}</strong>,</p><p>Vous avez été invité(e) à accéder à votre espace de gestion de dossier sur <strong>Crédit Unique</strong>.</p><p>Pour créer votre mot de passe et accéder à vos documents, cliquez sur le bouton ci-dessous :</p><p style="text-align:center;margin:30px 0"><a href="{{lien_invitation}}" style="background:#EE7D07;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Créer mon accès</a></p><p style="color:#585e6a;font-size:13px">Ce lien est valable 72 heures. Si vous n''avez pas demandé cet accès, ignorez cet email.</p><hr style="border:none;border-top:1px solid #EBEBEB;margin:20px 0"><p style="color:#585e6a;font-size:12px">Crédit Unique — Gestion des dossiers de rachat de crédit</p></div></div>',
  E'Bonjour {{prenom}},\n\nVous avez été invité(e) à accéder à votre espace Crédit Unique.\n\nCréez votre mot de passe ici : {{lien_invitation}}\n\nCe lien est valable 72 heures.\n\nCrédit Unique',
  '["prenom", "nom", "email", "lien_invitation"]'::jsonb
),
(
  'statut_change',
  'Changement de statut',
  'Votre dossier "{{titre_dossier}}" a changé de statut',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#0E1520;padding:20px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0;font-size:24px"><span style="font-weight:300">CRÉDIT</span> <span style="color:#EE7D07;font-weight:700">UN1QUE</span></h1></div><div style="background:#fff;padding:30px;border:1px solid #EBEBEB;border-top:none;border-radius:0 0 12px 12px"><p>Bonjour <strong>{{prenom}}</strong>,</p><p>Le statut de votre dossier <strong>{{titre_dossier}}</strong> a été mis à jour :</p><p style="text-align:center;margin:20px 0"><span style="background:#FEF2F2;padding:6px 16px;border-radius:20px;font-size:14px">{{ancien_statut}}</span> → <span style="background:#DCFCE7;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:bold">{{nouveau_statut}}</span></p><p style="text-align:center;margin:30px 0"><a href="{{lien_dossier}}" style="background:#EE7D07;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Voir mon dossier</a></p><hr style="border:none;border-top:1px solid #EBEBEB;margin:20px 0"><p style="color:#585e6a;font-size:12px">Crédit Unique — Gestion des dossiers</p></div></div>',
  E'Bonjour {{prenom}},\n\nLe statut de votre dossier "{{titre_dossier}}" est passé de {{ancien_statut}} à {{nouveau_statut}}.\n\nVoir le dossier : {{lien_dossier}}\n\nCrédit Unique',
  '["prenom", "nom", "titre_dossier", "ancien_statut", "nouveau_statut", "lien_dossier"]'::jsonb
),
(
  'document_ajoute',
  'Nouveau document',
  'Un document a été ajouté à votre dossier "{{titre_dossier}}"',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#0E1520;padding:20px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0;font-size:24px"><span style="font-weight:300">CRÉDIT</span> <span style="color:#EE7D07;font-weight:700">UN1QUE</span></h1></div><div style="background:#fff;padding:30px;border:1px solid #EBEBEB;border-top:none;border-radius:0 0 12px 12px"><p>Bonjour <strong>{{prenom}}</strong>,</p><p>Un nouveau document a été ajouté à votre dossier <strong>{{titre_dossier}}</strong> :</p><p style="background:#F5F5F5;padding:12px 16px;border-radius:8px;font-weight:bold">📄 {{nom_fichier}}</p><p style="text-align:center;margin:30px 0"><a href="{{lien_dossier}}" style="background:#EE7D07;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Voir mon dossier</a></p><hr style="border:none;border-top:1px solid #EBEBEB;margin:20px 0"><p style="color:#585e6a;font-size:12px">Crédit Unique — Gestion des dossiers</p></div></div>',
  E'Bonjour {{prenom}},\n\nUn nouveau document "{{nom_fichier}}" a été ajouté à votre dossier "{{titre_dossier}}".\n\nVoir le dossier : {{lien_dossier}}\n\nCrédit Unique',
  '["prenom", "nom", "titre_dossier", "nom_fichier", "lien_dossier"]'::jsonb
),
(
  'rappel_documents',
  'Rappel documents manquants',
  'Documents manquants pour votre dossier "{{titre_dossier}}"',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#0E1520;padding:20px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0;font-size:24px"><span style="font-weight:300">CRÉDIT</span> <span style="color:#EE7D07;font-weight:700">UN1QUE</span></h1></div><div style="background:#fff;padding:30px;border:1px solid #EBEBEB;border-top:none;border-radius:0 0 12px 12px"><p>Bonjour <strong>{{prenom}}</strong>,</p><p>Votre dossier <strong>{{titre_dossier}}</strong> est en attente de documents. Voici les pièces manquantes :</p>{{liste_documents}}<p style="text-align:center;margin:30px 0"><a href="{{lien_dossier}}" style="background:#EE7D07;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Compléter mon dossier</a></p><hr style="border:none;border-top:1px solid #EBEBEB;margin:20px 0"><p style="color:#585e6a;font-size:12px">Crédit Unique — Gestion des dossiers</p></div></div>',
  E'Bonjour {{prenom}},\n\nVotre dossier "{{titre_dossier}}" est en attente de documents.\n\nDocuments manquants :\n{{liste_documents}}\n\nCompléter le dossier : {{lien_dossier}}\n\nCrédit Unique',
  '["prenom", "nom", "titre_dossier", "liste_documents", "lien_dossier"]'::jsonb
),
(
  'bienvenue',
  'Bienvenue',
  'Bienvenue sur Crédit Unique',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#0E1520;padding:20px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0;font-size:24px"><span style="font-weight:300">CRÉDIT</span> <span style="color:#EE7D07;font-weight:700">UN1QUE</span></h1></div><div style="background:#fff;padding:30px;border:1px solid #EBEBEB;border-top:none;border-radius:0 0 12px 12px"><p>Bonjour <strong>{{prenom}}</strong>,</p><p>Votre compte a bien été activé sur <strong>Crédit Unique</strong>.</p><p>Vous pouvez dès maintenant accéder à votre espace pour consulter vos dossiers et transmettre vos documents.</p><p style="text-align:center;margin:30px 0"><a href="{{lien_connexion}}" style="background:#EE7D07;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Accéder à mon espace</a></p><hr style="border:none;border-top:1px solid #EBEBEB;margin:20px 0"><p style="color:#585e6a;font-size:12px">Crédit Unique — Gestion des dossiers</p></div></div>',
  E'Bonjour {{prenom}},\n\nVotre compte Crédit Unique a été activé.\n\nAccéder à votre espace : {{lien_connexion}}\n\nCrédit Unique',
  '["prenom", "nom", "lien_connexion"]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
