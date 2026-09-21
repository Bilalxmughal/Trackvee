-- Add new internal Trackvee staff roles to the users role enum
ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'ops';
ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'live_ops';
ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'agent';
ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'chat_support';
ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'viewer';
