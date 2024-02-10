ALTER SCHEMA metadata
    RENAME TO civic_os;

NOTIFY pgrst, 'reload schema'