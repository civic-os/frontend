CREATE SCHEMA IF NOT EXISTS metadata;
CREATE TABLE metadata.entities (
	table_name name,
	display_name text,
	description text,
	sort_order int
);
CREATE TABLE metadata.properties (
	table_name name,
	column_name name,
	display_name text,
	description text,
	sort_order int,
	column_width int
);
REVOKE ALL ON TABLE metadata.properties FROM PUBLIC;
GRANT SELECT ON TABLE metadata.properties TO PUBLIC;