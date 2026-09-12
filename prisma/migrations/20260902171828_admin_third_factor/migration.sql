-- Admins sign in on /control_panel with three factors: their ID, their NID, and
-- a separate password. Members keep the two-factor ID + NID sign-in on /login,
-- so this column stays null for them.
ALTER TABLE "User" ADD COLUMN "adminPasswordHash" TEXT;
