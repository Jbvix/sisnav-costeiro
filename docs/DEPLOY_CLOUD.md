# DEPLOY NA NUVEM — SISNAV COSTEIRO v3.8.1
> Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude | Criado 2026-10-29 21:30 · Atualizado 2026-10-30 17:06 (UTC-3)
>
> **Histórico deste guia**
> - v3.8.1 (2026-10-30): removido `SEALAGOM_API_TOKEN`; Railway configurado pelo painel (o `railway.json` não é lido em serviços novos); `/api/health` mostra a versão; nova seção 4 (favorito "Enviar ao SISNAV").
> - v3.6.0-cloud (2026-10-29): versão inicial (Netlify + Railway + Supabase).

## Arquitetura (analogia: rebocador ASD)

```
 Navegador ──► NETLIFY (casco: HTML/JS/CSS)          js/config.js = piloto da barra
     │                                                desvia "api/..." para o Railway
     └──────► RAILWAY (praça de máquinas: Flask + gunicorn)
                   │  KRATOS (xAI) · CHM/DHN · scrapers · GPX
                   └──► SUPABASE (paiol estanque: Postgres tuglife-core, tabelas sisnav_*)
```

## 1. Supabase (FEITO)
- Projeto **tuglife-core** (`nsbeddfkcdyssrirrhzt`), URL `https://nsbeddfkcdyssrirrhzt.supabase.co`.
- Tabelas `sisnav_invites`, `sisnav_fleet`, `sisnav_kv` com RLS ligado e sem políticas (só a chave `service_role` acessa).
- Os 2 convites de produção já migrados com hash PBKDF2.

## 2. Railway (back-end)
1. railway.com > **New Project** > **Deploy from GitHub repo** > `Jbvix/sisnav-costeiro`.
2. O Railpack detecta Python (`requirements.txt`, `.python-version`).
   **Atenção (v3.8.1):** em serviços novos o Railway **não lê** o `railway.json`. Configure pelo painel:
   1. Clique no serviço **sisnav-costeiro** > aba **Settings**.
   2. Seção **Deploy** > **Custom Start Command** > cole o mesmo comando `web:` do `Procfile` (gunicorn).
   3. Ainda em **Deploy** > **Healthcheck Path** > `/api/health`.
   4. As alterações salvam sozinhas; clique em **Deploy** (barra roxa no topo) para aplicar.
3. **Variables** (copie de `.env.example`):

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | `https://nsbeddfkcdyssrirrhzt.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API Keys > **service_role / secret** (nunca no front!) |
| `SISNAV_ADMIN_KEY` | conteúdo atual de `~/.sisnav_admin_key` no cPanel (ou uma chave nova) |
| `ALLOWED_ORIGINS` | `https://<site>.netlify.app,https://sisnav.tuglife.live` |
| `XAI_API_KEY`, `XAI_MODEL` | os mesmos do `.htaccess` de produção do cPanel |
| `DHN_AVRADIO_CACHE_S`, `DHN_AVRADIO_URL` | opcionais (cache e contingência dos Avisos-Rádio DHN) |

> `SEALAGOM_API_TOKEN` não é mais usado (Sealagom desligado na v3.7.0). Se ainda existir no Railway, pode apagar: **Variables** > ⋮ ao lado da variável > **Remove**.

4. **Settings > Networking > Generate Domain** → anote a URL (ex.: `https://sisnav-api-production.up.railway.app`).
5. Teste: `https://<railway>/api/health` deve responder `"status": "ok"`, `"storage": "supabase"` e a **versão atual** (ex.: `"version": "3.8.1"`). A versão vem de `version.py`: se o número não mudou após um deploy, o Railway ainda está rodando a versão anterior.

## 3. Netlify (front-end)
1. app.netlify.com > **Add new project** > **Import from Git** > `Jbvix/sisnav-costeiro` (o `netlify.toml` já define build e publish).
2. **Environment variables**: `SISNAV_API_BASE = https://<url-do-railway>` (sem barra no fim) → **Trigger deploy**.
3. Domínio: *Domain management* > `sisnav.tuglife.live` → no DNS do domínio, CNAME `sisnav` → `<site>.netlify.app`.

## 4. Avisos-Rádio DHN — favorito "Enviar ao SISNAV" (v3.8.0)

### Por que um favorito?
A área de Avisos-Rádio do site da Marinha usa o desafio anti-robô da Cloudflare. Testes de 30/10/2026:

| Origem | Resultado |
|---|---|
| Railway (servidor) | 403 |
| Cloudflare Worker | 403 |
| PowerShell no PC | 403 |
| Edge headless (sem janela) | desafio "Um momento…" |
| Navegador real, aberto por uma pessoa | ✅ passa |

Só um navegador de verdade passa. O favorito aproveita isso: o navegador do oficial lê o JSON oficial (`avradio_NN.json`) e o entrega ao SISNAV. Como a CSP da Marinha proíbe `fetch` para outros sites, o envio é feito por **formulário** (`POST /api/dhn/avradio-upload`). O servidor confere o convite, o formato e a data, e grava em `sisnav_kv` (chave `dhn_avradio_last`). *Analogia: é o mensageiro que já tem o crachá do porto — entra, pega o boletim no quadro de avisos e leva ao passadiço.*

### Criar o favorito (uma vez por computador)
**Chrome**
1. Abra `tools/favorito_enviar_ao_sisnav.js` no GitHub e copie a **linha que começa com `javascript:`** (no fim do arquivo).
2. Se a barra de favoritos não aparece: `Ctrl+Shift+B`.
3. Clique com o botão direito na barra de favoritos > **Adicionar página…**
4. **Nome:** `Enviar ao SISNAV`. **URL:** cole a linha `javascript:` > **Salvar**.

**Edge**
1. Copie a linha `javascript:` como acima.
2. `Ctrl+Shift+B` para mostrar a barra de favoritos.
3. Botão direito na barra > **Adicionar favorito**.
4. **Nome:** `Enviar ao SISNAV`. **URL:** cole a linha > **Salvar**.

### Uso diário
1. Abra a página oficial **Avisos-Rádio Náuticos e SAR** do CHM: `https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar`. Se aparecer "Um momento…", aguarde ou resolva o desafio.
2. Com a lista de avisos na tela, clique em **Enviar ao SISNAV**.
3. Na 1ª vez, cole o **token do seu convite** (o código depois de `token=` no link recebido). Ele fica guardado só nesse navegador.
4. Abre uma aba nova com **"Avisos-Rádio recebidos"**. Pronto: o botão CHM do Appraisal já usa os dados novos.
5. A cópia vale por **24 h**. Passado isso, o texto do Appraisal mostra "ATENÇÃO: cópia com N h" — repita os passos 1 e 2.

### Mensagens possíveis
| Mensagem | Significado | Ação |
|---|---|---|
| **Avisos-Rádio recebidos** — "N avisos da DHN … recebidos" | gravado no banco | nada |
| **Nada a atualizar** — "O SISNAV já tem uma versão mais nova" | a cópia enviada é mais antiga que a salva | nada |
| **Convite inválido** | token ausente, revogado ou digitado errado | na página da Marinha, aperte `F12` > aba **Console** > digite `localStorage.removeItem('sisnav_invite_token')` > `Enter`; feche o F12 e clique no favorito de novo com o token correto |
| **Envio rejeitado** — "não parece ser da DHN" / "fora do formato" | página errada ou o site da Marinha mudou o arquivo | confira se está na página do passo 1; se persistir, avise o administrador |
| Alerta "abra a página Avisos-Rádio…" | o favorito foi clicado fora da página certa | abrir a página do passo 1 |

## 5. Desligar o cPanel (só depois de validar)
- Manter `~/sisnav_app` por 7 dias como contingência; depois desativar o app Python no cPanel.

## Limites e custos
- Railway: plano Hobby ≈ US$ 5/mês (sem plano gratuito permanente).
- Netlify: plano gratuito cobre o front (≈35 MB de biblioteca).
- Supabase: sem custo extra (projeto existente).
- O disco do Railway é efêmero: GPX enviados ficam no índice (`sisnav_kv`), mas o arquivo .gpx em si some no próximo deploy — **próxima etapa sugerida**: Supabase Storage para GPX.
