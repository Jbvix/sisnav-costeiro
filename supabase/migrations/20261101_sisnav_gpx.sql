-- =============================================================================
-- SISNAV COSTEIRO - Tabela de rotas GPX enviadas (v3.11.0)
-- Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude
-- Data/Hora: 2026-11-01 (UTC-3)
-- -----------------------------------------------------------------------------
-- MOTIVO: o disco do Railway é efêmero (zera a cada deploy). Os GPX enviados
-- pelo app ficavam em gpx/ e sumiam; o índice de rotas, reconstruído depois de
-- um deploy, perdia essas rotas. Agora cada GPX enviado é uma linha aqui.
-- Mesmo padrão das demais tabelas: RLS ligado e SEM políticas -> só o
-- back-end (chave service_role) lê ou grava.
-- Tamanho: um GPX costeiro tem ~8 KB; o servidor recusa acima de 2 MB.
-- =============================================================================
create table if not exists public.sisnav_gpx (
    nome           text primary key,             -- nome saneado, ex.: 'santos_sp x suape_pe.gpx'
    conteudo       text not null,                -- XML do GPX
    tamanho_bytes  integer not null,
    pontos         integer,                      -- nº de waypoints/trackpoints lidos
    enviado_por    text,                         -- tipo do convite ('planning'/'admin')
    enviado_em     timestamptz not null default now()
);

alter table public.sisnav_gpx enable row level security;
revoke all on public.sisnav_gpx from anon, authenticated;
