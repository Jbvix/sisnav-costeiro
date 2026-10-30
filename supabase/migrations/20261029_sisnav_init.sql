-- =============================================================================
-- SISNAV COSTEIRO - Esquema inicial no Supabase (v3.6.0-cloud)
-- Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude
-- Data/Hora: 2026-10-29 21:30 (UTC-3)
-- -----------------------------------------------------------------------------
-- Acesso SOMENTE pelo back-end (Railway) com a chave service_role.
-- RLS ligado e SEM políticas => as chaves anon/publishable não leem nem gravam
-- nada (porta estanque fechada por padrão).
-- =============================================================================
create table if not exists public.sisnav_invites (
    token          text primary key,
    email          text,
    type           text,                         -- 'planning' | 'monitoring'
    status         text not null default 'pending'
                   check (status in ('pending','active','revoked')),
    password_hash  text,                         -- pbkdf2_sha256$iter$sal$hash
    created_at_ms  bigint,                       -- epoch ms (compatível c/ front)
    first_access   double precision,             -- epoch s
    extra          jsonb not null default '{}'::jsonb,
    updated_at     timestamptz not null default now()
);

create table if not exists public.sisnav_fleet (
    vessel_id    text primary key,
    name         text,
    lat          double precision,
    lon          double precision,
    sog          double precision,
    cog          double precision,
    route_id     text,
    destination  text,
    ts           double precision not null default extract(epoch from now())
);
create index if not exists sisnav_fleet_ts_idx on public.sisnav_fleet (ts);

create table if not exists public.sisnav_kv (
    key            text primary key,           -- ex.: 'tides_scraped.csv'
    value_text     text not null,
    updated_at_ms  bigint
);

alter table public.sisnav_invites enable row level security;
alter table public.sisnav_fleet   enable row level security;
alter table public.sisnav_kv      enable row level security;

revoke all on public.sisnav_invites, public.sisnav_fleet, public.sisnav_kv from anon, authenticated;
