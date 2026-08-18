begin;
set local search_path = extensions, public, pg_catalog;

select plan(12);

select has_table('public', 'device_pairing_tokens', 'pairing token table exists');
select has_table('public', 'device_credentials', 'device credential table exists');
select has_table('public', 'device_provisioning_events', 'provisioning audit table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.device_pairing_tokens'::regclass),
  'pairing tokens have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.device_credentials'::regclass),
  'device credentials have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.device_provisioning_events'::regclass),
  'provisioning events have RLS enabled'
);

select ok(
  not has_table_privilege('authenticated', 'public.device_pairing_tokens', 'select'),
  'authenticated cannot select pairing token hashes'
);
select ok(
  not has_table_privilege('authenticated', 'public.device_credentials', 'select'),
  'authenticated cannot select credential hashes'
);
select ok(
  not has_table_privilege('authenticated', 'public.device_provisioning_events', 'select'),
  'authenticated cannot select internal audit rows directly'
);

select ok(
  exists(select 1 from pg_policies where policyname = 'pairing_tokens_deny_browser'),
  'explicit pairing-token browser deny policy exists'
);
select ok(
  exists(select 1 from pg_indexes where indexname = 'device_credentials_current_idx'),
  'one-current-credential partial unique index exists'
);
select ok(
  exists(select 1 from pg_indexes where indexname = 'pairing_tokens_expiry_idx'),
  'available pairing expiry index exists'
);

select * from finish();
rollback;
