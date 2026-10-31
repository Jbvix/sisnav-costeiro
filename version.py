# =============================================================================
# SISNAV COSTEIRO - version.py
# Autor: Jossian Brito (Charlie Bravo) | TugLife Systems
# Data/Hora: 2026-10-30 23:36 (UTC-3)   Versão: 3.10.2
# -----------------------------------------------------------------------------
# HISTÓRICO DE MODIFICAÇÕES
#  v3.10.2 (2026-10-30 23:36) - Favorito abre a aba no clique; gravação dos Avisos-Rádio confirmada.
#  v3.10.1 (2026-10-30 23:18) - Favorito "Enviar ao SISNAV" pelo domínio oficial (proxy).
#  v3.10.0 (2026-10-30 23:06) - Versão 3.10.0 (Etapa B: previsão do mar por perna, Open-Meteo).
#  v3.9.2 (2026-10-30 22:40) - Versão 3.9.2 (Planejamento, Monitoramento e painel admin claro).
#  v3.9.1 (2026-10-30 22:36) - Versão 3.9.1 (Avaliação: resumo, prontidão e formulário unificado).
#  v3.9.0 (2026-10-30 22:26) - Versão 3.9.0 (Padrão Passadiço: visual e iluminação).
#  v3.8.2 (2026-10-30 18:14) - Versão 3.8.2 (proxy Netlify -> Railway).
#  v3.8.1 (2026-10-30 17:06) - Arquivo NOVO (assistido por Claude): fonte única
#                              da versão do sistema. /api/health lê daqui.
# -----------------------------------------------------------------------------
# COMO USAR: a cada nova versão, altere SÓ estas duas constantes (e registre no
# CHANGELOG.md). Quem precisa da versão importa daqui em vez de repetir o texto.
# ANALOGIA: é o Diário de Navegação oficial - um só livro; os outros registros
# copiam dele. Antes, cada arquivo tinha o seu "caderninho" e cada um marcava
# uma versão diferente (o health dizia 3.6.0-cloud com o sistema já na 3.8.0).
# =============================================================================

SISNAV_VERSION = "3.10.2"            # Versionamento semântico: MAIOR.MENOR.CORREÇÃO
SISNAV_RELEASE_DATE = "2026-10-30"  # Data da versão (UTC-3)
