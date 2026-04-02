-- Add invitation fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS record_id_crm text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invitation_token text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invitation_expire_at timestamptz;

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_profiles_invitation_token ON profiles (invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_record_id_crm ON profiles (record_id_crm) WHERE record_id_crm IS NOT NULL;
