-- =====================================================
-- Pot Hole Observation System - Seed Data
-- =====================================================

-- Seed IssueStatus data
INSERT INTO "public"."IssueStatus" ("id", "created_at", "display_name") VALUES
  ('1', '2024-12-14 20:58:32.638955+00', 'New'),
  ('2', '2024-12-14 21:02:44.44308+00', 'Verification'),
  ('3', '2024-12-14 21:04:23.589205+00', 'Re-estimate'),
  ('4', '2024-12-14 21:05:50.549546+00', 'Repair Queue'),
  ('5', '2024-12-14 21:06:05.12863+00', 'Batched for Quote'),
  ('6', '2024-12-14 21:06:15.078694+00', 'Bid Accepted'),
  ('7', '2024-12-14 21:06:24.374326+00', 'Completed'),
  ('8', '2024-12-14 21:06:28.683431+00', 'Duplicate');

-- Seed WorkPackageStatus data
INSERT INTO "public"."WorkPackageStatus" ("id", "created_at", "display_name") VALUES
  ('2', '2024-12-14 21:29:56.694099+00', 'New'),
  ('3', '2024-12-14 21:30:12.753812+00', 'Competitive'),
  ('4', '2024-12-14 21:30:47.936383+00', 'Awarded'),
  ('5', '2024-12-14 21:30:53.014772+00', 'Not Selected');

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
