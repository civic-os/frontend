CREATE TABLE public.civic_os_users (
	id uuid NOT NULL,
	display_name text NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT user_information_display_name_key UNIQUE (display_name),
	CONSTRAINT user_id FOREIGN KEY (id) REFERENCES auth.users (id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE NO ACTION
);

ALTER TABLE
	IF EXISTS public.civic_os_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read" ON public.civic_os_users AS PERMISSIVE FOR ALL TO public USING (TRUE);

CREATE TABLE public.civic_os_users_private (
	id uuid NOT NULL,
	display_name text NOT NULL,
	phone character varying(255),
	email character varying(255),
	PRIMARY KEY (id),
	CONSTRAINT user_id FOREIGN KEY (id) REFERENCES public.civic_os_users (id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE NO ACTION
);

ALTER TABLE
	IF EXISTS public.civic_os_users_private OWNER to postgres;

ALTER TABLE
	IF EXISTS public.civic_os_users_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can read own" ON public.civic_os_users_private AS PERMISSIVE FOR ALL TO public USING ((auth.jwt() ->> 'sub') :: uuid = id);

CREATE
OR REPLACE FUNCTION public.create_or_update_contact_from_user() RETURNS trigger LANGUAGE 'plpgsql' COST 100 VOLATILE NOT LEAKPROOF SECURITY DEFINER AS $BODY$ BEGIN IF (
	NEW.confirmed_at IS DISTINCT
	FROM
		OLD.confirmed_at
) THEN
INSERT INTO
	public.civic_os_users (id, display_name)
VALUES
	(
		NEW.id,
		(NEW.raw_user_meta_data ->> 'display_name')
	);

INSERT INTO
	public.civic_os_users_private (id, display_name, email, phone)
VALUES
	(
		NEW.id,
		(NEW.raw_user_meta_data ->> 'full_name'),
		NEW.email,
		(NEW.raw_user_meta_data ->> 'phone')
	);

END IF;

IF (
	NEW.updated_at IS DISTINCT
	FROM
		OLD.updated_at
) THEN
UPDATE
	public.civic_os_users_private
SET
	display_name = (NEW.raw_user_meta_data ->> 'full_name'),
	email = NEW.email,
	phone = (NEW.raw_user_meta_data ->> 'phone')
WHERE
	id = NEW.id;

END IF;

RETURN NEW;

END;

$BODY$;

CREATE TRIGGER on_update_sync_contact_information
AFTER
INSERT
	OR
UPDATE
	ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_or_update_contact_from_user();

NOTIFY pgrst,
'reload schema';