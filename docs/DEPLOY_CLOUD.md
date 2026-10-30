# DEPLOY NA NUVEM — SISNAV COSTEIRO v3.6.0-cloud
> Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude | 2026-10-29 21:30 (UTC-3)

## Arquitetura (analogia: rebocador ASD)

```
 Navegador ──► NETLIFY (casco: HTML/JS/CSS)          js/config.js = piloto da barra
     │                                                desvia "api/..." para o Railway
     └──────► RAILWAY (praça de máquinas: Flask + gunicorn)
                   │  KRATOS (xAI) · CHM/SEALAGOM · scrapers · GPX
                   └──► SUPABASE (paiol estanque: Postgres tuglife-core, tabelas sisnav_*)
```

## 1. Supabase (FEITO)
- Projeto **tuglife-core** (`nsbeddfkcdyssrirrhzt`), URL `https://nsbeddfkcdyssrirrhzt.supabase.co`.
- Tabelas `sisnav_invites`, `sisnav_fleet`, `sisnav_kv` com RLS ligado e sem políticas (só a chave `service_role` acessa).
- Os 2 convites de produção já migrados com hash PBKDF2.

## 2. Railway (back-end)
1. railway.com > **New Project** > **Deploy from GitHub repo** > `Jbvix/sisnav-costeiro`.
2. O Railpack detecta Python (`requirements.txt`, `.python-version`); `railway.json` define gunicorn e o healthcheck `/api/health`.
3. **Variables** (copie de `.env.example`):

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | `https://nsbeddfkcdyssrirrhzt.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API Keys > **service_role / secret** (nunca no front!) |
| `SISNAV_ADMIN_KEY` | conteúdo atual de `~/.sisnav_admin_key` no cPanel (ou uma chave nova) |
| `ALLOWED_ORIGINS` | `https://<site>.netlify.app,https://sisnav.tuglife.live` |
| `XAI_API_KEY`, `XAI_MODEL` | os mesmos do `.htaccess` de produção do cPanel |
| `SEALAGOM_API_TOKEN` | idem |

4. **Settings > Networking > Generate Domain** → anote a URL (ex.: `https://sisnav-api-production.up.railway.app`).
5. Teste: `https://<railway>/api/health` deve responder `"storage": "supabase"`.

## 3. Netlify (front-end)
1. app.netlify.com > **Add new project** > **Import from Git** > `Jbvix/sisnav-costeiro` (o `netlify.toml` já define build e publish).
2. **Environment variables**: `SISNAV_API_BASE = https://<url-do-railway>` (sem barra no fim) → **Trigger deploy**.
3. Domínio: *Domain management* > `sisnav.tuglife.live` → no DNS do domínio, CNAME `sisnav` → `<site>.netlify.app`.

## 4. Desligar o cPanel (só depois de validar)
- Manter `~/sisnav_app` por 7 dias como contingência; depois desativar o app Python no cPanel.

## Limites e custos
- Railway: plano Hobby ≈ US$ 5/mês (sem plano gratuito permanente).
- Netlify: plano gratuito cobre o front (≈35 MB de biblioteca).
- Supabase: sem custo extra (projeto existente).
- O disco do Railway é efêmero: GPX enviados ficam no índice (`sisnav_kv`), mas o arquivo .gpx em si some no próximo deploy — **próxima etapa sugerida**: Supabase Storage para GPX.
