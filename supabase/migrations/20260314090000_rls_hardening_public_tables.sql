-- RLS hardening migration for public tables
-- Goal: secure-by-default posture with explicit policies on all public tables.

DO $$
DECLARE
  table_row record;
  owner_column text;
  owner_udt text;
  has_policies boolean;
  owner_predicate text;
  sensitive_tables text[] := ARRAY[
    'account_credentials',
    'account_password_reset_tokens',
    'auth_rate_limits',
    'ip_allowlist_entries',
    'logs',
    'ticket_api_tokens',
    'vault_entries',
    'vault_totp',
    'vault_backup_codes',
    'vault_entry_groups',
    'data_connectors',
    'security_settings'
  ];
BEGIN
  FOR table_row IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;',
      table_row.schema_name,
      table_row.table_name
    );

    SELECT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = table_row.schema_name
        AND p.tablename = table_row.table_name
    ) INTO has_policies;

    IF has_policies THEN
      CONTINUE;
    END IF;

    IF table_row.table_name = ANY (sensitive_tables) THEN
      EXECUTE format(
        'CREATE POLICY deny_all_clients ON %I.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);',
        table_row.schema_name,
        table_row.table_name
      );
      CONTINUE;
    END IF;

    SELECT c.column_name, c.udt_name
    INTO owner_column, owner_udt
    FROM information_schema.columns c
    WHERE c.table_schema = table_row.schema_name
      AND c.table_name = table_row.table_name
      AND c.column_name IN (
        'user_id', 'member_id', 'owner_id', 'created_by', 'account_id', 'owner_user_id',
        'userid', 'memberid', 'ownerid', 'createdby', 'accountid', 'owneruserid'
      )
    ORDER BY CASE c.column_name
      WHEN 'user_id' THEN 1
      WHEN 'userid' THEN 2
      WHEN 'member_id' THEN 3
      WHEN 'memberid' THEN 4
      WHEN 'owner_id' THEN 5
      WHEN 'ownerid' THEN 6
      WHEN 'owner_user_id' THEN 7
      WHEN 'owneruserid' THEN 8
      WHEN 'created_by' THEN 9
      WHEN 'createdby' THEN 10
      WHEN 'account_id' THEN 11
      WHEN 'accountid' THEN 12
      ELSE 99
    END
    LIMIT 1;

    IF owner_column IS NOT NULL THEN
      IF owner_udt = 'uuid' THEN
        owner_predicate := format('((SELECT auth.uid()) = %I)', owner_column);
      ELSE
        owner_predicate := format('((SELECT auth.uid())::text = %I::text)', owner_column);
      END IF;

      EXECUTE format(
        'CREATE POLICY p_select_own ON %I.%I FOR SELECT TO authenticated USING %s;',
        table_row.schema_name,
        table_row.table_name,
        owner_predicate
      );

      EXECUTE format(
        'CREATE POLICY p_insert_own ON %I.%I FOR INSERT TO authenticated WITH CHECK %s;',
        table_row.schema_name,
        table_row.table_name,
        owner_predicate
      );

      EXECUTE format(
        'CREATE POLICY p_update_own ON %I.%I FOR UPDATE TO authenticated USING %s WITH CHECK %s;',
        table_row.schema_name,
        table_row.table_name,
        owner_predicate,
        owner_predicate
      );

      EXECUTE format(
        'CREATE POLICY p_delete_own ON %I.%I FOR DELETE TO authenticated USING %s;',
        table_row.schema_name,
        table_row.table_name,
        owner_predicate
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY deny_all_clients ON %I.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);',
        table_row.schema_name,
        table_row.table_name
      );
    END IF;
  END LOOP;
END $$;
