#!/usr/bin/env bash
# =============================================================================
# SISNAV COSTEIRO - scripts/build_netlify.sh
# Autor: Jossian Brito (Charlie Bravo) | Assistido por Claude
# Data/Hora: 2026-10-30 21:20 (UTC-3)   Versão: 1.1 (v3.8.2)
# -----------------------------------------------------------------------------
# HISTÓRICO DE MODIFICAÇÕES
#  1.1 (v3.8.2, 2026-10-30 21:20) - Gera dist/_redirects: o Netlify repassa
#      /api/* ao Railway (proxy, status 200). O navegador fala só com o
#      domínio do site; redes que bloqueiam railway.app deixam de quebrar o
#      login. Endereço do Railway vem da MESMA variável SISNAV_API_BASE.
#  1.0 (v3.6.0-cloud, 2026-10-29) - Versão inicial.
# -----------------------------------------------------------------------------
# Monta a pasta dist/ só com o FRONT-END (o Netlify publica dist/).
# Código Python, scripts de debug, docs internos e dados sensíveis ficam fora:
# o que não embarca não pode vazar.
# Variável de ambiente: SISNAV_API_BASE = URL do Railway (sem barra no fim).
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist

# Páginas e assets do front
cp index.html login.html admin.html admin_dashboard.html manual.html dist/
cp -r css js gpx dist/
cp maritimo_mare_meteo.json tides_scraped.csv weather_scraped.csv dist/ 2>/dev/null || true

# Biblioteca: só o que o app consulta (txt, json, imagens, PDFs de marés/cartas).
# Fora: .docx de viagens, fotos de WhatsApp, planilhas e o scraper.
cp -r library dist/library
find dist/library \( -name '*.docx' -o -name 'WhatsApp*' -o -name '*.xlsx' \) -delete
rm -rf "dist/library/scraper chm" dist/library/docs
rm -f dist/library/CONTACTS.txt   # dados pessoais: servidos pela API com convite

# Injeta a URL da API no roteador do front
API="${SISNAV_API_BASE:-}"
sed -i "s#__SISNAV_API_BASE__#${API}#" dist/js/config.js
# v3.8.2 - Proxy /api/* -> Railway (regra de "rewrite" do Netlify: status 200
# = o Netlify busca a resposta no Railway e a entrega como se fosse dele).
# O "!" força a regra mesmo se existir arquivo com o mesmo nome em dist/.
# Sem SISNAV_API_BASE, não há proxy (modo mesma origem / cPanel).
if [ -n "${API}" ]; then
    printf '/api/*  %s/api/:splat  200!\n' "${API%/}" > dist/_redirects
    echo "build_netlify: proxy /api/* -> ${API%/}/api/"
fi

echo "build_netlify: dist/ pronto (API_BASE='${API:-mesma origem}')"
