#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
CHM MULTI-SOURCE SCRAPER - Sistema de Captura Integrada de Dados Náuticos
================================================================================

Autor: Jossian Brito (Charlie Bravo)
Data de Criação: 2025-01-13 
Hora de Criação: 15:15 UTC
Versão: 2.0.0 - Multi-Fonte Expandida

DESCRIÇÃO:
-----------
Sistema integrado para captura de múltiplas fontes de dados náuticos do CHM:
1. METEOROMARINHA - Previsões meteorológicas 24h
2. AVISOS DE MAU TEMPO - Alertas METAREA V
3. AVISOS RÁDIO NÁUTICOS - Norte (Regiões I, II, III)
4. AVISOS RÁDIO NÁUTICOS - Leste (Regiões IV, V, VI)
5. AVISOS RÁDIO NÁUTICOS - Sul (Regiões VII, VIII, IX)

ANALOGIA MARÍTIMA:
------------------
Como um rebocador que precisa coletar informações de múltiplas fontes antes
de uma operação complexa:
- Capitania dos Portos (avisos náuticos)
- Centro Meteorológico (previsões)
- Estação de Rádio Costeira (avisos de mau tempo)
- Cartas de Navegação (regiões norte, leste, sul)

Este sistema funciona como um CENTRO DE OPERAÇÕES integrado, coletando dados
de todas as fontes relevantes e gerando relatórios separados por categoria.

FUNCIONALIDADES:
----------------
1. Captura simultânea de 5 fontes diferentes
2. Relatórios separados por fonte (CSV + TXT)
3. Consolidação em relatório master
4. Sistema de priorização de alertas críticos
5. Detecção automática de avisos de mau tempo ativos
6. Classificação por regiões geográficas (Norte, Leste, Sul)

ESTRUTURA DE ARQUIVOS GERADOS:
-------------------------------
chm_output_YYYYMMDD_HHMMSS/
├── 01_meteoromarinha.csv
├── 01_meteoromarinha.txt
├── 02_avisos_mau_tempo.csv
├── 02_avisos_mau_tempo.txt
├── 03_avisos_radio_norte.csv
├── 03_avisos_radio_norte.txt
├── 04_avisos_radio_leste.csv
├── 04_avisos_radio_leste.txt
├── 05_avisos_radio_sul.csv
├── 05_avisos_radio_sul.txt
├── 00_relatorio_consolidado.csv
└── 00_relatorio_consolidado.txt

MODIFICAÇÕES:
-------------
2025-01-13 15:15 - Versão 2.0.0 com captura multi-fonte
                  - Adicionado scraper de avisos de mau tempo
                  - Adicionado scrapers de avisos rádio náuticos (N/L/S)
                  - Sistema de relatórios separados por fonte
                  - Relatório consolidado master
                  - Classificação por criticidade de alertas
================================================================================
"""

# ============================================================================
# IMPORTAÇÕES
# ============================================================================

import time
import csv
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from webdriver_manager.chrome import ChromeDriverManager
    from bs4 import BeautifulSoup
    import pandas as pd
except ImportError as e:
    print(f"❌ Erro de importação: {e}")
    print("\n📦 Execute: pip install selenium beautifulsoup4 pandas webdriver-manager")
    exit(1)


# ============================================================================
# CONFIGURAÇÃO DE LOGGING
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(levelname)s] - %(message)s',
    handlers=[
        logging.FileHandler('chm_multi_scraper.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURAÇÕES GLOBAIS
# ============================================================================

# URLs das fontes de dados do CHM
URLS_CHM = {
    'meteoromarinha': 'https://www.marinha.mil.br/chm/dados-do-smm-meteoromarinha/previsao-24-horas',
    'avisos_mau_tempo': 'https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo',
    'avisos_radio_norte': 'https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar/norte',
    'avisos_radio_leste': 'https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar/leste',
    'avisos_radio_sul': 'https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar/sul'
}

# Nomes legíveis das fontes
NOMES_FONTES = {
    'meteoromarinha': 'METEOROMARINHA - Previsão 24 Horas',
    'avisos_mau_tempo': 'Avisos de Mau Tempo (METAREA V)',
    'avisos_radio_norte': 'Avisos Rádio Náuticos - NORTE',
    'avisos_radio_leste': 'Avisos Rádio Náuticos - LESTE',
    'avisos_radio_sul': 'Avisos Rádio Náuticos - SUL'
}


# ============================================================================
# CLASSE PRINCIPAL - SCRAPER MULTI-FONTE
# ============================================================================

class CHMMultiScraper:
    """
    Sistema integrado de captura de múltiplas fontes do CHM.
    
    ANALOGIA MARÍTIMA:
    ------------------
    Esta classe representa o CENTRO DE OPERAÇÕES de uma empresa de rebocadores,
    que coleta informações de múltiplas fontes simultaneamente para garantir
    operações seguras:
    
    - Previsão meteorológica (METEOROMARINHA)
    - Alertas de mau tempo (avisos críticos)
    - Avisos rádio náuticos por região (Norte, Leste, Sul)
    
    Como um coordenador de operações que consulta:
    - Capitania dos Portos
    - Centro Meteorológico
    - Estação Costeira de Rádio
    - Serviços de informação náutica regionais
    """
    
    def __init__(self, diretorio_saida: str = None):
        """
        Inicializa o sistema multi-fonte.
        
        PARÂMETROS:
        -----------
        diretorio_saida : str, opcional
            Diretório para salvar os arquivos. Se None, cria automaticamente.
        """
        self.driver = None
        self.timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Cria diretório de saída se não especificado
        if not diretorio_saida:
            self.diretorio_saida = f'chm_output_{self.timestamp}'
        else:
            self.diretorio_saida = diretorio_saida
        
        # Cria o diretório
        os.makedirs(self.diretorio_saida, exist_ok=True)
        
        # Armazena dados de todas as fontes
        self.dados_coletados = {}
        
        logger.info("🚢 Sistema Multi-Fonte CHM Inicializado")
        logger.info(f"📁 Diretório de saída: {self.diretorio_saida}")
    
    
    def _configurar_driver(self):
        """
        Configura o navegador Chrome em modo headless.
        """
        logger.info("⚙️  Configurando navegador Chrome...")
        
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument(
            'user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/120.0.0.0 Safari/537.36'
        )
        
        try:
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.driver.set_page_load_timeout(30)
            logger.info("✅ Navegador configurado com sucesso")
            return True
        except Exception as e:
            logger.error(f"❌ Erro ao configurar navegador: {e}")
            return False
    
    
    def _navegar_e_capturar(self, url: str, timeout: int = 5) -> str:
        """
        Navega para URL e captura conteúdo HTML.
        
        PARÂMETROS:
        -----------
        url : str
            URL a ser acessada
        timeout : int
            Tempo de espera para carregamento (segundos)
        
        RETORNO:
        --------
        str : Conteúdo HTML da página
        """
        logger.info(f"🧭 Navegando para: {url}")
        
        try:
            self.driver.get(url)
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            time.sleep(timeout)  # Aguarda carregamento de conteúdo dinâmico
            
            html_content = self.driver.page_source
            logger.info("✅ Conteúdo capturado")
            return html_content
            
        except Exception as e:
            logger.error(f"❌ Erro ao navegar: {e}")
            return None
    
    
    def _extrair_texto_limpo(self, html: str) -> str:
        """
        Extrai texto limpo do HTML.
        
        COMPORTAMENTO:
        --------------
        Remove tags HTML, scripts, estilos e caracteres desnecessários,
        retornando apenas o texto útil.
        """
        if not html:
            return ""
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove scripts e estilos
        for script in soup(['script', 'style']):
            script.decompose()
        
        # Obtém texto
        texto = soup.get_text(separator='\n', strip=True)
        
        # Limpa linhas vazias múltiplas
        linhas = [linha.strip() for linha in texto.split('\n') if linha.strip()]
        texto_limpo = '\n'.join(linhas)
        
        return texto_limpo
    
    
    def capturar_meteoromarinha(self) -> Dict:
        """
        Captura dados do METEOROMARINHA - Previsão 24 Horas.
        
        RETORNO:
        --------
        Dict contendo:
        - fonte: Nome da fonte
        - timestamp: Hora da captura
        - url: URL acessada
        - dados: Dados estruturados
        - texto_completo: Texto completo da página
        - status: 'sucesso' ou 'erro'
        """
        logger.info("\n" + "=" * 80)
        logger.info("📊 CAPTURANDO: METEOROMARINHA")
        logger.info("=" * 80)
        
        dados = {
            'fonte': 'meteoromarinha',
            'nome_fonte': NOMES_FONTES['meteoromarinha'],
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'url': URLS_CHM['meteoromarinha'],
            'dados': {},
            'texto_completo': '',
            'status': 'erro'
        }
        
        try:
            html = self._navegar_e_capturar(URLS_CHM['meteoromarinha'])
            if html:
                dados['texto_completo'] = self._extrair_texto_limpo(html)
                
                # Extração de dados específicos
                import re
                texto = dados['texto_completo']
                
                # Data e hora
                data_match = re.search(r'(\d{2}/[A-Z]{3}/\d{4})', texto)
                hora_match = re.search(r'(\d{4}Z)', texto)
                
                dados['dados'] = {
                    'data_previsao': data_match.group(1) if data_match else 'N/A',
                    'hora_previsao': hora_match.group(1) if hora_match else 'N/A',
                    'pressoes': re.findall(r'(ALTA|BAIXA)\s+(\d{4})', texto),
                    'tem_frente': 'FRENTE' in texto,
                    'tem_cavado': 'CAVADO' in texto,
                    'tem_zcit': 'ZCIT' in texto
                }
                
                dados['status'] = 'sucesso'
                logger.info("✅ METEOROMARINHA capturado com sucesso")
                
        except Exception as e:
            logger.error(f"❌ Erro ao capturar METEOROMARINHA: {e}")
        
        return dados
    
    
    def capturar_avisos_mau_tempo(self) -> Dict:
        """
        Captura Avisos de Mau Tempo (METAREA V).
        
        COMPORTAMENTO:
        --------------
        Verifica se há avisos ativos na METAREA V e captura detalhes.
        """
        logger.info("\n" + "=" * 80)
        logger.info("⚠️  CAPTURANDO: AVISOS DE MAU TEMPO")
        logger.info("=" * 80)
        
        dados = {
            'fonte': 'avisos_mau_tempo',
            'nome_fonte': NOMES_FONTES['avisos_mau_tempo'],
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'url': URLS_CHM['avisos_mau_tempo'],
            'dados': {},
            'texto_completo': '',
            'status': 'erro'
        }
        
        try:
            html = self._navegar_e_capturar(URLS_CHM['avisos_mau_tempo'])
            if html:
                dados['texto_completo'] = self._extrair_texto_limpo(html)
                texto = dados['texto_completo']
                
                # Verifica se há avisos ativos
                sem_avisos = 'NÃO HÁ AVISO' in texto or 'NAO HA AVISO' in texto
                
                dados['dados'] = {
                    'tem_avisos_ativos': not sem_avisos,
                    'metarea': 'V',
                    'mensagem': 'Nenhum aviso ativo' if sem_avisos else 'Avisos ativos detectados'
                }
                
                if not sem_avisos:
                    logger.warning("⚠️  ATENÇÃO: Avisos de mau tempo ATIVOS!")
                else:
                    logger.info("✅ Nenhum aviso de mau tempo ativo")
                
                dados['status'] = 'sucesso'
                
        except Exception as e:
            logger.error(f"❌ Erro ao capturar avisos de mau tempo: {e}")
        
        return dados
    
    
    def capturar_avisos_radio_nauticos(self, regiao: str) -> Dict:
        """
        Captura Avisos Rádio Náuticos por região.
        
        PARÂMETROS:
        -----------
        regiao : str
            'norte', 'leste' ou 'sul'
        
        COMPORTAMENTO:
        --------------
        Avisos Rádio Náuticos são divididos em regiões geográficas:
        - NORTE: Regiões I, II, III (Amapá até Ceará)
        - LESTE: Regiões IV, V, VI (RN até Espírito Santo)
        - SUL: Regiões VII, VIII, IX (Rio de Janeiro até Rio Grande do Sul)
        """
        regiao_upper = regiao.upper()
        fonte_key = f'avisos_radio_{regiao}'
        
        logger.info("\n" + "=" * 80)
        logger.info(f"📻 CAPTURANDO: AVISOS RÁDIO NÁUTICOS - {regiao_upper}")
        logger.info("=" * 80)
        
        dados = {
            'fonte': fonte_key,
            'nome_fonte': NOMES_FONTES[fonte_key],
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'url': URLS_CHM[fonte_key],
            'dados': {},
            'texto_completo': '',
            'status': 'erro'
        }
        
        try:
            html = self._navegar_e_capturar(URLS_CHM[fonte_key])
            if html:
                dados['texto_completo'] = self._extrair_texto_limpo(html)
                texto = dados['texto_completo']
                
                # Extração de avisos ativos
                import re
                
                # Procura por números de avisos (formato: 0001/25, 0002/25, etc)
                avisos = re.findall(r'\d{4}/\d{2}', texto)
                
                dados['dados'] = {
                    'regiao': regiao_upper,
                    'total_avisos': len(avisos),
                    'avisos_identificados': avisos[:10] if avisos else [],  # Primeiros 10
                    'tem_avisos': len(avisos) > 0
                }
                
                logger.info(f"✅ Região {regiao_upper}: {len(avisos)} avisos encontrados")
                dados['status'] = 'sucesso'
                
        except Exception as e:
            logger.error(f"❌ Erro ao capturar avisos rádio {regiao}: {e}")
        
        return dados
    
    
    def salvar_relatorio_individual(self, dados: Dict, prefixo: str):
        """
        Salva relatório individual de uma fonte.
        
        PARÂMETROS:
        -----------
        dados : Dict
            Dados capturados da fonte
        prefixo : str
            Prefixo do arquivo (ex: '01_meteoromarinha')
        """
        # Nome base dos arquivos
        base_nome = os.path.join(self.diretorio_saida, prefixo)
        
        # Salva CSV
        csv_path = f"{base_nome}.csv"
        try:
            df_data = {
                'fonte': [dados['nome_fonte']],
                'timestamp_captura': [dados['timestamp']],
                'url': [dados['url']],
                'status': [dados['status']],
                'dados_estruturados': [str(dados['dados'])],
                'preview_texto': [dados['texto_completo'][:300] + '...']
            }
            
            df = pd.DataFrame(df_data)
            df.to_csv(csv_path, index=False, encoding='utf-8-sig')
            logger.info(f"💾 CSV salvo: {csv_path}")
            
        except Exception as e:
            logger.error(f"❌ Erro ao salvar CSV: {e}")
        
        # Salva TXT completo
        txt_path = f"{base_nome}.txt"
        try:
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write("=" * 80 + "\n")
                f.write(f"FONTE: {dados['nome_fonte']}\n")
                f.write("=" * 80 + "\n\n")
                f.write(f"Timestamp da Captura: {dados['timestamp']}\n")
                f.write(f"URL: {dados['url']}\n")
                f.write(f"Status: {dados['status']}\n\n")
                f.write("DADOS ESTRUTURADOS:\n")
                f.write("-" * 80 + "\n")
                for key, value in dados['dados'].items():
                    f.write(f"{key}: {value}\n")
                f.write("\n" + "=" * 80 + "\n")
                f.write("TEXTO COMPLETO:\n")
                f.write("=" * 80 + "\n\n")
                f.write(dados['texto_completo'])
            
            logger.info(f"📝 TXT salvo: {txt_path}")
            
        except Exception as e:
            logger.error(f"❌ Erro ao salvar TXT: {e}")
    
    
    def gerar_relatorio_consolidado(self):
        """
        Gera relatório consolidado com todas as fontes.
        
        COMPORTAMENTO:
        --------------
        Cria um relatório master que resume informações de todas as fontes
        capturadas, com priorização de alertas críticos.
        """
        logger.info("\n" + "=" * 80)
        logger.info("📋 GERANDO RELATÓRIO CONSOLIDADO")
        logger.info("=" * 80)
        
        csv_path = os.path.join(self.diretorio_saida, "00_relatorio_consolidado.csv")
        txt_path = os.path.join(self.diretorio_saida, "00_relatorio_consolidado.txt")
        
        try:
            # CSV consolidado
            dados_csv = []
            for fonte, dados in self.dados_coletados.items():
                dados_csv.append({
                    'ordem': fonte.split('_')[0],
                    'fonte': dados['nome_fonte'],
                    'timestamp': dados['timestamp'],
                    'status': dados['status'],
                    'resumo': str(dados['dados'])[:100]
                })
            
            df = pd.DataFrame(dados_csv)
            df = df.sort_values('ordem')
            df.to_csv(csv_path, index=False, encoding='utf-8-sig')
            logger.info(f"✅ Relatório consolidado CSV: {csv_path}")
            
            # TXT consolidado
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write("=" * 80 + "\n")
                f.write("RELATÓRIO CONSOLIDADO - SISTEMA CHM MULTI-FONTE\n")
                f.write("=" * 80 + "\n\n")
                f.write(f"Data/Hora da Captura: {self.timestamp}\n")
                f.write(f"Total de Fontes: {len(self.dados_coletados)}\n\n")
                
                # Resumo executivo
                f.write("RESUMO EXECUTIVO:\n")
                f.write("-" * 80 + "\n")
                
                for fonte, dados in sorted(self.dados_coletados.items()):
                    f.write(f"\n✓ {dados['nome_fonte']}\n")
                    f.write(f"  Status: {dados['status']}\n")
                    f.write(f"  Timestamp: {dados['timestamp']}\n")
                    
                    # Destaca alertas críticos
                    if 'mau_tempo' in fonte:
                        tem_avisos = dados['dados'].get('tem_avisos_ativos', False)
                        if tem_avisos:
                            f.write(f"  ⚠️  ALERTA: Avisos de mau tempo ATIVOS!\n")
                    
                    if 'radio' in fonte:
                        total = dados['dados'].get('total_avisos', 0)
                        f.write(f"  Avisos: {total}\n")
                
                f.write("\n" + "=" * 80 + "\n")
                f.write("FIM DO RELATÓRIO CONSOLIDADO\n")
                f.write("=" * 80 + "\n")
            
            logger.info(f"✅ Relatório consolidado TXT: {txt_path}")
            
        except Exception as e:
            logger.error(f"❌ Erro ao gerar relatório consolidado: {e}")
    
    
    def executar_captura_completa(self):
        """
        Executa captura de todas as fontes e gera relatórios.
        
        FLUXO DE EXECUÇÃO:
        ------------------
        1. Configurar navegador
        2. Capturar METEOROMARINHA
        3. Capturar Avisos de Mau Tempo
        4. Capturar Avisos Rádio Norte
        5. Capturar Avisos Rádio Leste
        6. Capturar Avisos Rádio Sul
        7. Gerar relatórios individuais
        8. Gerar relatório consolidado
        9. Fechar navegador
        """
        logger.info("\n" + "=" * 80)
        logger.info("🚢 INICIANDO CAPTURA MULTI-FONTE")
        logger.info("=" * 80)
        
        inicio = time.time()
        
        try:
            # 1. Configurar navegador
            if not self._configurar_driver():
                logger.error("❌ Falha ao configurar navegador. Abortando.")
                return False
            
            # 2. Capturar METEOROMARINHA
            dados_meteo = self.capturar_meteoromarinha()
            self.dados_coletados['01_meteoromarinha'] = dados_meteo
            self.salvar_relatorio_individual(dados_meteo, '01_meteoromarinha')
            
            # 3. Capturar Avisos de Mau Tempo
            dados_mau_tempo = self.capturar_avisos_mau_tempo()
            self.dados_coletados['02_avisos_mau_tempo'] = dados_mau_tempo
            self.salvar_relatorio_individual(dados_mau_tempo, '02_avisos_mau_tempo')
            
            # 4. Capturar Avisos Rádio Norte
            dados_norte = self.capturar_avisos_radio_nauticos('norte')
            self.dados_coletados['03_avisos_radio_norte'] = dados_norte
            self.salvar_relatorio_individual(dados_norte, '03_avisos_radio_norte')
            
            # 5. Capturar Avisos Rádio Leste
            dados_leste = self.capturar_avisos_radio_nauticos('leste')
            self.dados_coletados['04_avisos_radio_leste'] = dados_leste
            self.salvar_relatorio_individual(dados_leste, '04_avisos_radio_leste')
            
            # 6. Capturar Avisos Rádio Sul
            dados_sul = self.capturar_avisos_radio_nauticos('sul')
            self.dados_coletados['05_avisos_radio_sul'] = dados_sul
            self.salvar_relatorio_individual(dados_sul, '05_avisos_radio_sul')
            
            # 7. Gerar relatório consolidado
            self.gerar_relatorio_consolidado()
            
            # Tempo total
            duracao = time.time() - inicio
            
            logger.info("\n" + "=" * 80)
            logger.info("✅ CAPTURA MULTI-FONTE CONCLUÍDA COM SUCESSO")
            logger.info(f"⏱️  Tempo total: {duracao:.2f} segundos")
            logger.info(f"📁 Arquivos salvos em: {self.diretorio_saida}")
            logger.info("=" * 80 + "\n")
            
            return True
            
        except Exception as e:
            logger.error(f"\n❌ ERRO CRÍTICO: {e}")
            return False
            
        finally:
            if self.driver:
                logger.info("🔌 Fechando navegador...")
                self.driver.quit()


# ============================================================================
# FUNÇÃO PRINCIPAL
# ============================================================================

def main():
    """
    Função principal de execução.
    """
    print("\n" + "=" * 80)
    print("⚓ CHM MULTI-SOURCE SCRAPER v2.0.0")
    print("   Sistema Integrado de Captura de Dados Náuticos")
    print("   Autor: Jossian Brito (Charlie Bravo)")
    print("   Data: 2025-01-13")
    print("=" * 80 + "\n")
    
    print("FONTES DE DADOS:")
    print("-" * 80)
    for key, nome in NOMES_FONTES.items():
        print(f"  ✓ {nome}")
    print()
    
    # Cria e executa scraper
    scraper = CHMMultiScraper()
    sucesso = scraper.executar_captura_completa()
    
    if sucesso:
        print("\n✅ Operação concluída! Verifique os arquivos no diretório de saída.")
    else:
        print("\n❌ Operação finalizada com erros. Verifique o log.")


# ============================================================================
# PONTO DE ENTRADA
# ============================================================================

if __name__ == "__main__":
    main()
