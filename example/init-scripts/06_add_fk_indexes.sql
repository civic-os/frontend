-- =====================================================
-- Add Indexes for Foreign Key Columns
-- =====================================================
--
-- PostgreSQL does NOT automatically index foreign key columns
-- (only the referenced PRIMARY KEY columns are indexed).
--
-- For inverse relationships to perform well, we need indexes
-- on all foreign key columns to avoid full table scans.
--
-- Without these indexes, queries like "SELECT * FROM issues WHERE status = 1"
-- will perform a full table scan instead of an index lookup.

-- Issue table indexes
CREATE INDEX IF NOT EXISTS idx_issues_owner ON "Issue"(owner);
CREATE INDEX IF NOT EXISTS idx_issues_work_package ON "Issue"(work_package);
CREATE INDEX IF NOT EXISTS idx_issues_created_user ON "Issue"(created_user);
CREATE INDEX IF NOT EXISTS idx_issues_status ON "Issue"(status);

-- Bid table indexes
CREATE INDEX IF NOT EXISTS idx_bids_work_package ON "Bid"(work_package);
CREATE INDEX IF NOT EXISTS idx_bids_added_by ON "Bid"(added_by);
CREATE INDEX IF NOT EXISTS idx_bids_issue ON "Bid"(issue);

-- WorkPackage table indexes
CREATE INDEX IF NOT EXISTS idx_work_packages_status ON "WorkPackage"(status);

-- Note: civic_os_users is referenced by many tables but typically
-- has fewer rows, so impact is less critical. However, if you have
-- many users, consider adding indexes on user reference columns.

COMMENT ON INDEX idx_issues_owner IS 'Optimize inverse relationship queries for civic_os_users -> Issue';
COMMENT ON INDEX idx_issues_work_package IS 'Optimize inverse relationship queries for WorkPackage -> Issue';
COMMENT ON INDEX idx_issues_created_user IS 'Optimize inverse relationship queries for civic_os_users -> Issue (created)';
COMMENT ON INDEX idx_issues_status IS 'Optimize inverse relationship queries for IssueStatus -> Issue';
COMMENT ON INDEX idx_bids_work_package IS 'Optimize inverse relationship queries for WorkPackage -> Bid';
COMMENT ON INDEX idx_bids_added_by IS 'Optimize inverse relationship queries for civic_os_users -> Bid';
COMMENT ON INDEX idx_bids_issue IS 'Optimize inverse relationship queries for Issue -> Bid';
COMMENT ON INDEX idx_work_packages_status IS 'Optimize inverse relationship queries for WorkPackageStatus -> WorkPackage';
