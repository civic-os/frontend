CREATE TYPE metadata.permission AS ENUM ('create', 'read', 'update', 'delete');

ALTER TYPE metadata.permission OWNER TO postgres;

CREATE TABLE metadata.permissions (
	id serial NOT NULL,
	table_name name NOT NULL,
	permission metadata.permission NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (table_name, permission)
);

ALTER TABLE
	IF EXISTS metadata.permissions OWNER to postgres;

CREATE TABLE metadata.roles (
	id smallserial NOT NULL,
	display_name text NOT NULL,
	description text,
	PRIMARY KEY (id)
);

ALTER TABLE
	IF EXISTS metadata.roles OWNER to postgres;

ALTER TABLE
	IF EXISTS metadata.roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE metadata.permission_roles (
	permission_id integer,
	role_id smallint,
	PRIMARY KEY (permission_id, role_id),
	FOREIGN KEY (permission_id) REFERENCES metadata.permissions (id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE NO ACTION NOT VALID,
	FOREIGN KEY (role_id) REFERENCES metadata.roles (id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE NO ACTION NOT VALID
);

ALTER TABLE
	IF EXISTS metadata.permission_roles OWNER to postgres;

NOTIFY pgrst,
'reload schema';