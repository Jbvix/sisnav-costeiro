#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
EXEMPLOS DE USO - CHM Multi-Source Scraper
================================================================================

Autor: Jossian Brito (Charlie Bravo)
Data: 2025-01-13
Versão: 2.0.0

DESCRIÇÃO:
----------
Este script demonstra diferentes formas de utilizar o CHM Multi-Source Scraper
com exemplos práticos de cenários reais de operação de rebocadores.

EXEMPLOS INCLUÍDOS:
-------------------
1. Captura completa de todas as fontes
2. Captura seletiva (apenas fontes específicas)
3. Análise de dados capturados
4. Filtragem por região
5. Detecção de alertas críticos

================================================================================
"""

import sys
import os
from datetime import datetime

# Importa a classe do scraper
# (Assumindo que chm_scraper_multiplo.py está no mesmo diretório)
try:
    from chm_scraper_multiplo import CHMMultiScraper, URLS_CHM, NOMES_FONTES
    import pandas as pd
except ImportError as e:
    print(f"❌ Erro de importação: {e}")
    print("Certifique-se de que chm_scraper_multiplo.py está no mesmo diretório")
    sys.exit(1)


# ============================================================================
# EXEMPLO 1: CAPTURA COMPLETA
# ============================================================================

def exemplo_1_captura_completa():
    """
    Exemplo mais simples: captura de todas as fontes com configurações padrão.
    
    CENÁRIO:
    --------
    Empresa de rebocadores precisa de um overview completo das condições
    náuticas em toda costa brasileira antes de planejar operações do dia.
    """
    print("\n" + "=" * 80)
    print("EXEMPLO 1: CAPTURA COMPLETA DE TODAS AS FONTES")
    print("=" * 80 + "\n")
    
    print("📋 CENÁRIO:")
    print("   Visão completa das condições náuticas na costa brasileira")
    print("   para planejamento operacional diário.\n")
    
    # Criar scraper e executar captura completa
    scraper = CHMMultiScraper()
    sucesso = scraper.executar_captura_completa()
    
    if sucesso:
        print("\n✅ Todos os relatórios foram gerados!")
        print(f"📁 Verifique o diretório: {scraper.diretorio_saida}")
    
    return sucesso


# ============================================================================
# EXEMPLO 2: CAPTURA SELETIVA
# ============================================================================

def exemplo_2_captura_seletiva():
    """
    Captura apenas fontes específicas de interesse.
    
    CENÁRIO:
    --------
    Rebocador operando apenas na região Sul (Santos/Paranaguá/Rio Grande).
    Não precisa de informações sobre Norte e Leste.
    """
    print("\n" + "=" * 80)
    print("EXEMPLO 2: CAPTURA SELETIVA - REGIÃO SUL")
    print("=" * 80 + "\n")
    
    print("📋 CENÁRIO:")
    print("   Rebocador operando exclusivamente na região Sul")
    print("   Fontes necessárias: METEOROMARINHA, Mau Tempo e Avisos Sul\n")
    
    scraper = CHMMultiScraper(diretorio_saida='chm_regiao_sul')
    
    try:
        # Configurar navegador
        if not scraper._configurar_driver():
            print("❌ Erro ao configurar navegador")
            return False
        
        # Captura seletiva
        print("📊 Capturando METEOROMARINHA...")
        dados_meteo = scraper.capturar_meteoromarinha()
        scraper.dados_coletados['01_meteoromarinha'] = dados_meteo
        scraper.salvar_relatorio_individual(dados_meteo, '01_meteoromarinha')
        
        print("⚠️  Capturando Avisos de Mau Tempo...")
        dados_mau_tempo = scraper.capturar_avisos_mau_tempo()
        scraper.dados_coletados['02_avisos_mau_tempo'] = dados_mau_tempo
        scraper.salvar_relatorio_individual(dados_mau_tempo, '02_avisos_mau_tempo')
        
        print("📻 Capturando Avisos Rádio Sul...")
        dados_sul = scraper.capturar_avisos_radio_nauticos('sul')
        scraper.dados_coletados['05_avisos_radio_sul'] = dados_sul
        scraper.salvar_relatorio_individual(dados_sul, '05_avisos_radio_sul')
        
        # Gerar consolidado
        scraper.gerar_relatorio_consolidado()
        
        print("\n✅ Captura seletiva concluída!")
        print(f"📁 Diretório: {scraper.diretorio_saida}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        return False
        
    finally:
        if scraper.driver:
            scraper.driver.quit()


# ============================================================================
# EXEMPLO 3: ANÁLISE DE DADOS
# ============================================================================

def exemplo_3_analise_dados(diretorio_dados: str = None):
    """
    Analisa dados capturados e gera resumo operacional.
    
    CENÁRIO:
    --------
    Após captura, gerar relatório executivo com:
    - Status de cada fonte
    - Alertas críticos
    - Recomendações operacionais
    """
    print("\n" + "=" * 80)
    print("EXEMPLO 3: ANÁLISE DE DADOS CAPTURADOS")
    print("=" * 80 + "\n")
    
    print("📋 CENÁRIO:")
    print("   Analisar dados capturados e gerar recomendações operacionais\n")
    
    if not diretorio_dados:
        print("⚠️  Nenhum diretório especificado. Execute exemplo 1 ou 2 primeiro.")
        return
    
    # Verificar se diretório existe
    if not os.path.exists(diretorio_dados):
        print(f"❌ Diretório não encontrado: {diretorio_dados}")
        return
    
    print(f"📂 Analisando diretório: {diretorio_dados}\n")
    
    # Ler relatório consolidado
    csv_consolidado = os.path.join(diretorio_dados, "00_relatorio_consolidado.csv")
    
    if not os.path.exists(csv_consolidado):
        print("❌ Relatório consolidado não encontrado")
        return
    
    try:
        df = pd.read_csv(csv_consolidado)
        
        print("📊 ANÁLISE RESUMIDA:")
        print("-" * 80)
        print(f"Total de fontes capturadas: {len(df)}")
        print(f"Fontes com sucesso: {(df['status'] == 'sucesso').sum()}")
        print(f"Fontes com erro: {(df['status'] == 'erro').sum()}")
        print()
        
        # Verificar alertas críticos
        print("⚠️  VERIFICAÇÃO DE ALERTAS CRÍTICOS:")
        print("-" * 80)
        
        # Ler arquivo de avisos de mau tempo
        txt_mau_tempo = os.path.join(diretorio_dados, "02_avisos_mau_tempo.txt")
        if os.path.exists(txt_mau_tempo):
            with open(txt_mau_tempo, 'r', encoding='utf-8') as f:
                conteudo = f.read()
                if 'NÃO HÁ AVISO' in conteudo or 'tem_avisos_ativos: False' in conteudo:
                    print("✅ Nenhum aviso de mau tempo ativo")
                else:
                    print("🚨 ATENÇÃO: Avisos de mau tempo ATIVOS!")
                    print("   Recomendação: Revisar operações planejadas")
        
        # Contar avisos por região
        regioes = ['norte', 'leste', 'sul']
        print("\n📻 AVISOS RÁDIO NÁUTICOS POR REGIÃO:")
        print("-" * 80)
        
        for regiao in regioes:
            txt_regiao = os.path.join(diretorio_dados, f"0{regioes.index(regiao)+3}_avisos_radio_{regiao}.txt")
            if os.path.exists(txt_regiao):
                with open(txt_regiao, 'r', encoding='utf-8') as f:
                    conteudo = f.read()
                    # Extrair total de avisos
                    if 'total_avisos:' in conteudo:
                        linha = [l for l in conteudo.split('\n') if 'total_avisos:' in l][0]
                        total = linha.split(':')[1].strip()
                        print(f"   {regiao.upper()}: {total} avisos")
        
        print("\n" + "=" * 80)
        print("✅ ANÁLISE CONCLUÍDA")
        print("=" * 80 + "\n")
        
    except Exception as e:
        print(f"❌ Erro ao analisar dados: {e}")


# ============================================================================
# EXEMPLO 4: MONITORAMENTO CONTÍNUO
# ============================================================================

def exemplo_4_monitoramento_continuo():
    """
    Demonstra como implementar monitoramento contínuo.
    
    CENÁRIO:
    --------
    Centro de operações que precisa de atualizações a cada 6 horas.
    
    NOTA: Este é um exemplo conceitual. Para produção, use cron/scheduler.
    """
    print("\n" + "=" * 80)
    print("EXEMPLO 4: MONITORAMENTO CONTÍNUO (CONCEITUAL)")
    print("=" * 80 + "\n")
    
    print("📋 CENÁRIO:")
    print("   Centro de operações com atualizações a cada 6 horas\n")
    
    print("💡 IMPLEMENTAÇÃO SUGERIDA:")
    print("-" * 80)
    print("""
Para monitoramento contínuo em produção, use uma das opções:

OPÇÃO 1: CRON (Linux/Mac)
--------------------------
# Edite crontab
crontab -e

# Adicione linha para execução a cada 6 horas (0h, 6h, 12h, 18h)
0 */6 * * * /usr/bin/python3 /caminho/para/chm_scraper_multiplo.py

OPÇÃO 2: TASK SCHEDULER (Windows)
----------------------------------
1. Abra "Agendador de Tarefas"
2. Criar Tarefa Básica
3. Gatilho: Diariamente, repetir a cada 6 horas
4. Ação: Executar python chm_scraper_multiplo.py

OPÇÃO 3: PYTHON SCHEDULER
--------------------------
import schedule
import time

def job():
    scraper = CHMMultiScraper()
    scraper.executar_captura_completa()

# Agendar execução a cada 6 horas
schedule.every(6).hours.do(job)

while True:
    schedule.run_pending()
    time.sleep(60)  # Verificar a cada minuto

OPÇÃO 4: SYSTEMD (Linux Server)
--------------------------------
# Criar arquivo /etc/systemd/system/chm-scraper.service
[Unit]
Description=CHM Data Scraper
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /caminho/para/chm_scraper_multiplo.py
User=seu_usuario

[Install]
WantedBy=multi-user.target

# Criar timer /etc/systemd/system/chm-scraper.timer
[Unit]
Description=CHM Scraper Timer

[Timer]
OnCalendar=*-*-* 0,6,12,18:00:00
Persistent=true

[Install]
WantedBy=timers.target

# Ativar
sudo systemctl enable chm-scraper.timer
sudo systemctl start chm-scraper.timer
    """)
    
    print("\n⚠️  IMPORTANTE: Respeite os servidores do CHM!")
    print("   - Não execute com frequência excessiva")
    print("   - 4x/dia (a cada 6 horas) é adequado")
    print("   - Monitore logs para detectar problemas")


# ============================================================================
# EXEMPLO 5: INTEGRAÇÃO COM SISTEMA EXTERNO
# ============================================================================

def exemplo_5_integracao_api():
    """
    Demonstra como preparar dados para integração com API externa.
    
    CENÁRIO:
    --------
    Dados capturados devem ser enviados para sistema TugLife via API REST.
    """
    print("\n" + "=" * 80)
    print("EXEMPLO 5: PREPARAÇÃO PARA INTEGRAÇÃO API")
    print("=" * 80 + "\n")
    
    print("📋 CENÁRIO:")
    print("   Enviar dados capturados para sistema TugLife via API REST\n")
    
    print("💡 ESTRUTURA JSON SUGERIDA:")
    print("-" * 80)
    
    exemplo_json = {
        "timestamp": "2025-01-13T15:30:00Z",
        "fonte_dados": "CHM - Marinha do Brasil",
        "coleta": {
            "meteoromarinha": {
                "status": "sucesso",
                "data_previsao": "13/JAN/2025",
                "hora_previsao": "1200Z",
                "sistemas": ["FRENTE", "ZCIT"]
            },
            "avisos_mau_tempo": {
                "status": "sucesso",
                "tem_avisos_ativos": False,
                "metarea": "V"
            },
            "avisos_radio": {
                "norte": {"total": 12, "status": "sucesso"},
                "leste": {"total": 8, "status": "sucesso"},
                "sul": {"total": 15, "status": "sucesso"}
            }
        },
        "alertas_criticos": [],
        "recomendacao": "Operações normais"
    }
    
    import json
    print(json.dumps(exemplo_json, indent=2, ensure_ascii=False))
    
    print("\n\n💡 CÓDIGO EXEMPLO DE ENVIO:")
    print("-" * 80)
    print("""
import requests
import json

def enviar_para_tuglife(dados):
    url_api = "https://api.tuglife.com.br/v1/nautical-data"
    headers = {
        "Authorization": "Bearer SEU_TOKEN_AQUI",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url_api, json=dados, headers=headers)
        if response.status_code == 200:
            print("✅ Dados enviados com sucesso")
        else:
            print(f"❌ Erro: {response.status_code}")
    except Exception as e:
        print(f"❌ Erro ao enviar: {e}")

# Usar após captura
scraper = CHMMultiScraper()
scraper.executar_captura_completa()

# Preparar dados
dados_api = preparar_dados_para_api(scraper.dados_coletados)

# Enviar
enviar_para_tuglife(dados_api)
    """)


# ============================================================================
# MENU PRINCIPAL
# ============================================================================

def menu_principal():
    """
    Menu interativo para executar exemplos.
    """
    print("\n" + "=" * 80)
    print("⚓ CHM MULTI-SOURCE SCRAPER - EXEMPLOS DE USO")
    print("=" * 80 + "\n")
    
    print("Escolha um exemplo para executar:\n")
    print("1️⃣  - Captura Completa (todas as fontes)")
    print("2️⃣  - Captura Seletiva (região Sul)")
    print("3️⃣  - Análise de Dados (requer captura prévia)")
    print("4️⃣  - Monitoramento Contínuo (conceitual)")
    print("5️⃣  - Integração com API (conceitual)")
    print("0️⃣  - Sair\n")
    
    escolha = input("Digite o número da opção: ").strip()
    
    if escolha == '1':
        exemplo_1_captura_completa()
    elif escolha == '2':
        exemplo_2_captura_seletiva()
    elif escolha == '3':
        # Pedir diretório
        print("\nDigite o caminho do diretório de dados:")
        print("(exemplo: chm_output_20250113_151530)")
        diretorio = input("Diretório: ").strip()
        exemplo_3_analise_dados(diretorio)
    elif escolha == '4':
        exemplo_4_monitoramento_continuo()
    elif escolha == '5':
        exemplo_5_integracao_api()
    elif escolha == '0':
        print("\n👋 Até logo!\n")
        return
    else:
        print("\n❌ Opção inválida!")
    
    # Perguntar se quer continuar
    print("\n" + "-" * 80)
    continuar = input("\nExecutar outro exemplo? (s/n): ").strip().lower()
    if continuar == 's':
        menu_principal()


# ============================================================================
# PONTO DE ENTRADA
# ============================================================================

if __name__ == "__main__":
    menu_principal()
