create index pairing_tokens_claimed_by_idx
  on public.device_pairing_tokens(claimed_by)
  where claimed_by is not null;
create index device_credentials_issued_by_idx
  on public.device_credentials(issued_by)
  where issued_by is not null;

-- Explicit restrictive policies document and enforce that browser roles cannot
-- access hashes or provisioning audit data even if grants change later.
create policy pairing_tokens_deny_browser
on public.device_pairing_tokens
as restrictive for all to authenticated
using (false) with check (false);

create policy device_credentials_deny_browser
on public.device_credentials
as restrictive for all to authenticated
using (false) with check (false);

create policy provisioning_events_deny_browser
on public.device_provisioning_events
as restrictive for all to authenticated
using (false) with check (false);
