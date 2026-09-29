-- Registro dei costi e ledger dei crediti (DATA-MODEL). Solo metadati: mai prompt né output.

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid references public.room_participants(id) on delete set null,
  payer_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  on_behalf_of_guest boolean not null default false,
  provider text not null,
  model text not null,
  operation text not null check (operation in ('agent_generate', 'image', 'translate', 'companion_eval', 'summarize_pdf', 'stt_session')),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  units numeric,
  latency_ms integer not null check (latency_ms >= 0),
  success boolean not null,
  error_code text,
  cost_usd_estimated numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index ai_requests_payer_created_idx on public.ai_requests (payer_workspace_id, created_at);
create index ai_requests_room_idx on public.ai_requests (room_id);
create index ai_requests_participant_created_idx on public.ai_requests (participant_id, created_at);
create index ai_requests_guest_cap_idx on public.ai_requests (room_id, participant_id) where on_behalf_of_guest;

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  delta integer not null check (delta <> 0 or reason = 'ai_request'),
  reason text not null check (reason in ('ai_request', 'manual_grant', 'manual_adjust')),
  ai_request_id uuid references public.ai_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

create index credit_ledger_workspace_created_idx on public.credit_ledger (workspace_id, created_at);

alter table public.ai_requests enable row level security;
alter table public.credit_ledger enable row level security;

-- Sola lettura per i membri del workspace pagante. Nessuna policy di scrittura:
-- scrive solo il service role, attraverso le funzioni qui sotto.
create policy "members read ai requests of own workspaces"
  on public.ai_requests for select to authenticated
  using (public.is_workspace_member(payer_workspace_id));

create policy "members read ledger of own workspaces"
  on public.credit_ledger for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- Riserva atomica: un solo update condizionale, così due richieste contemporanee non
-- possono spendere gli stessi crediti.
create function public.ai_reserve_credits(p_workspace uuid, p_credits integer)
returns boolean
language plpgsql
as $$
begin
  if p_credits <= 0 then
    raise exception 'credits to reserve must be positive';
  end if;
  update public.workspaces
    set credits_balance = credits_balance - p_credits
    where id = p_workspace and credits_balance >= p_credits;
  return found;
end;
$$;

create function public.ai_record_request(
  p_room uuid,
  p_participant uuid,
  p_workspace uuid,
  p_provider text,
  p_model text,
  p_operation text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_latency_ms integer,
  p_success boolean,
  p_error_code text,
  p_cost_usd numeric,
  p_reserved integer,
  p_charged integer
)
returns uuid
language plpgsql
as $$
declare
  v_request uuid;
begin
  if p_reserved < 0 or p_charged < 0 then
    raise exception 'reserved and charged credits must not be negative';
  end if;
  insert into public.ai_requests (
    room_id, participant_id, payer_workspace_id, provider, model, operation,
    input_tokens, output_tokens, latency_ms, success, error_code, cost_usd_estimated
  ) values (
    p_room, p_participant, p_workspace, p_provider, p_model, p_operation,
    p_input_tokens, p_output_tokens, p_latency_ms, p_success, p_error_code, p_cost_usd
  ) returning id into v_request;

  insert into public.credit_ledger (workspace_id, delta, reason, ai_request_id)
    values (p_workspace, -p_charged, 'ai_request', v_request);

  -- Conguaglio: la riserva torna, si scala il costo reale. Se il costo supera la
  -- riserva il saldo può toccare zero ma non scendere sotto (vincolo della tabella).
  update public.workspaces
    set credits_balance = greatest(0, credits_balance + p_reserved - p_charged)
    where id = p_workspace;

  return v_request;
end;
$$;

create function public.grant_credits(p_workspace uuid, p_credits integer, p_reason text default 'manual_grant')
returns integer
language plpgsql
as $$
declare
  v_balance integer;
begin
  if p_credits <= 0 then
    raise exception 'credits to grant must be positive';
  end if;
  insert into public.credit_ledger (workspace_id, delta, reason)
    values (p_workspace, p_credits, p_reason);
  update public.workspaces
    set credits_balance = credits_balance + p_credits
    where id = p_workspace
    returning credits_balance into v_balance;
  return v_balance;
end;
$$;

-- Postgres dà EXECUTE a PUBLIC per default: via PostgREST un utente potrebbe
-- regalarsi crediti. Solo il service role può chiamarle.
revoke execute on function public.ai_reserve_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.ai_record_request(uuid, uuid, uuid, text, text, text, integer, integer, integer, boolean, text, numeric, integer, integer) from public, anon, authenticated;
revoke execute on function public.grant_credits(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.ai_reserve_credits(uuid, integer) to service_role;
grant execute on function public.ai_record_request(uuid, uuid, uuid, text, text, text, integer, integer, integer, boolean, text, numeric, integer, integer) to service_role;
grant execute on function public.grant_credits(uuid, integer, text) to service_role;
