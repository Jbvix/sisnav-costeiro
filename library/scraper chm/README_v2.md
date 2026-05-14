# ⚓ CHM MULTI-SOURCE SCRAPER v2.0.0

Sistema Integrado de Captura de Múltiplas Fontes de Dados Náuticos do CHM

**Autor:** Jossian Brito (Charlie Bravo)  
**Data:** 2025-01-13  
**Versão:** 2.0.0 - Multi-Fonte Expandida  

---

## 🆕 NOVIDADES DA VERSÃO 2.0

### Expansão de Fontes

A versão 2.0 expande significativamente as capacidades de captura, incluindo:

✅ **5 Fontes de Dados Integradas:**

1. **METEOROMARINHA** - Previsão Meteorológica 24 Horas
2. **Avisos de Mau Tempo** - METAREA V (alertas críticos)
3. **Avisos Rádio Náuticos NORTE** - Regiões I, II, III
4. **Avisos Rádio Náuticos LESTE** - Regiões IV, V, VI
5. **Avisos Rádio Náuticos SUL** - Regiões VII, VIII, IX

### Relatórios Separados

Cada fonte gera:
- 📊 **Arquivo CSV** estruturado
- 📝 **Arquivo TXT** completo
- 📋 **Relatório Consolidado** master

---

## 📋 ESTRUTURA DE ARQUIVOS GERADOS

Ao executar o sistema, é criado um diretório com timestamp contendo todos os relatórios:

```
chm_output_20250113_151530/
│
├── 00_relatorio_consolidado.csv      # ⭐ Relatório Master
├── 00_relatorio_consolidado.txt      # ⭐ Resumo Executivo
│
├── 01_meteoromarinha.csv             # Previsão 24h
├── 01_meteoromarinha.txt
│
├── 02_avisos_mau_tempo.csv           # Alertas METAREA V
├── 02_avisos_mau_tempo.txt
│
├── 03_avisos_radio_norte.csv         # Avisos Norte
├── 03_avisos_radio_norte.txt
│
├── 04_avisos_radio_leste.csv         # Avisos Leste
├── 04_avisos_radio_leste.txt
│
├── 05_avisos_radio_sul.csv           # Avisos Sul
└── 05_avisos_radio_sul.txt
```

---

## 🚀 INSTALAÇÃO

### Pré-requisitos

- **Python 3.8+**
- **Google Chrome** instalado
- Conexão com internet

### Instalação das Dependências

```bash
pip install -r requirements.txt
```

**Dependências instaladas:**
- `selenium` - Navegação automatizada
- `beautifulsoup4` - Parse de HTML
- `pandas` - Manipulação de dados
- `webdriver-manager` - Gerenciamento automático do ChromeDriver

---

## 💻 USO

### Execução Básica

```bash
python chm_scraper_multiplo.py
```

### O que acontece:

1. 🔧 **Configuração** - Prepara o navegador Chrome (headless)
2. 📊 **METEOROMARINHA** - Captura previsão 24h
3. ⚠️  **Mau Tempo** - Verifica avisos ativos
4. 📻 **Norte** - Coleta avisos rádio náuticos (Regiões I, II, III)
5. 📻 **Leste** - Coleta avisos rádio náuticos (Regiões IV, V, VI)
6. 📻 **Sul** - Coleta avisos rádio náuticos (Regiões VII, VIII, IX)
7. 📋 **Consolidação** - Gera relatório master
8. 💾 **Salvamento** - Grava todos os arquivos

### Tempo Estimado

⏱️ **Aproximadamente 30-45 segundos** para captura completa de todas as fontes.

---

## 📊 DESCRIÇÃO DAS FONTES

### 1. METEOROMARINHA (Previsão 24 Horas)

**URL:** `https://www.marinha.mil.br/chm/dados-do-smm-meteoromarinha/previsao-24-horas`

**Conteúdo:**
- Pressão atmosférica (HPA)
- Sistemas meteorológicos (frentes, cavados, ZCIT)
- Condições de vento (Escala Beaufort)
- Altura de ondas (metros)

**Dados Estruturados Extraídos:**
- `data_previsao` - Data da previsão (DD/MMM/YYYY)
- `hora_previsao` - Hora de referência (HHMMZ)
- `pressoes` - Lista de centros de alta/baixa pressão
- `tem_frente` - Presença de frentes
- `tem_cavado` - Presença de cavados
- `tem_zcit` - Presença de ZCIT

---

### 2. AVISOS DE MAU TEMPO (METAREA V)

**URL:** `https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo`

**Conteúdo:**
- Avisos ativos de mau tempo
- Área de responsabilidade: METAREA V (Atlântico Sul)

**Dados Estruturados Extraídos:**
- `tem_avisos_ativos` - Boolean indicando se há avisos
- `metarea` - Área de responsabilidade (V)
- `mensagem` - Status dos avisos

**⚠️ IMPORTANTE:**
Este é um dos indicadores mais críticos. Quando há avisos ativos, operações de rebocadores devem ser reavaliadas.

---

### 3. AVISOS RÁDIO NÁUTICOS - NORTE

**URL:** `https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar/norte`

**Regiões Cobertas:**
- **Região I** - Amapá e Pará
- **Região II** - Maranhão e Piauí
- **Região III** - Ceará e Rio Grande do Norte (parte)

**Dados Estruturados:**
- `regiao` - NORTE
- `total_avisos` - Quantidade de avisos ativos
- `avisos_identificados` - Números dos avisos (ex: 0001/25, 0002/25)
- `tem_avisos` - Boolean

---

### 4. AVISOS RÁDIO NÁUTICOS - LESTE

**URL:** `https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar/leste`

**Regiões Cobertas:**
- **Região IV** - Rio Grande do Norte (parte) e Paraíba
- **Região V** - Pernambuco, Alagoas e Sergipe
- **Região VI** - Bahia e Espírito Santo

**Dados Estruturados:**
- `regiao` - LESTE
- `total_avisos` - Quantidade de avisos ativos
- `avisos_identificados` - Números dos avisos
- `tem_avisos` - Boolean

---

### 5. AVISOS RÁDIO NÁUTICOS - SUL

**URL:** `https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar/sul`

**Regiões Cobertas:**
- **Região VII** - Rio de Janeiro e São Paulo
- **Região VIII** - Paraná e Santa Catarina
- **Região IX** - Rio Grande do Sul

**Dados Estruturados:**
- `regiao` - SUL
- `total_avisos` - Quantidade de avisos ativos
- `avisos_identificados` - Números dos avisos
- `tem_avisos` - Boolean

---

## 📈 EXEMPLO DE SAÍDA

### Relatório Consolidado (TXT)

```
================================================================================
RELATÓRIO CONSOLIDADO - SISTEMA CHM MULTI-FONTE
================================================================================

Data/Hora da Captura: 20250113_151530
Total de Fontes: 5

RESUMO EXECUTIVO:
--------------------------------------------------------------------------------

✓ METEOROMARINHA - Previsão 24 Horas
  Status: sucesso
  Timestamp: 2025-01-13 15:15:45
  
✓ Avisos de Mau Tempo (METAREA V)
  Status: sucesso
  Timestamp: 2025-01-13 15:16:12
  ⚠️  ALERTA: Avisos de mau tempo ATIVOS!
  
✓ Avisos Rádio Náuticos - NORTE
  Status: sucesso
  Timestamp: 2025-01-13 15:16:38
  Avisos: 12

✓ Avisos Rádio Náuticos - LESTE
  Status: sucesso
  Timestamp: 2025-01-13 15:17:04
  Avisos: 8

✓ Avisos Rádio Náuticos - SUL
  Status: sucesso
  Timestamp: 2025-01-13 15:17:30
  Avisos: 15

================================================================================
```

---

## 🔧 PERSONALIZAÇÃO

### Capturar apenas fontes específicas

Você pode modificar o script para capturar apenas as fontes que precisa:

```python
# Exemplo: Capturar apenas METEOROMARINHA e Mau Tempo
scraper = CHMMultiScraper()
scraper._configurar_driver()

# Captura seletiva
dados_meteo = scraper.capturar_meteoromarinha()
dados_mau_tempo = scraper.capturar_avisos_mau_tempo()

scraper.salvar_relatorio_individual(dados_meteo, '01_meteoromarinha')
scraper.salvar_relatorio_individual(dados_mau_tempo, '02_avisos_mau_tempo')
```

### Alterar diretório de saída

```python
scraper = CHMMultiScraper(diretorio_saida='meus_dados_chm')
scraper.executar_captura_completa()
```

---

## 🛡️ TRATAMENTO DE ERROS

O sistema implementa tratamento robusto de erros:

✅ **Timeout de 30 segundos** por página  
✅ **Logs detalhados** em `chm_multi_scraper.log`  
✅ **Continua execução** mesmo se uma fonte falhar  
✅ **Status individual** para cada fonte  
✅ **Fechamento seguro** do navegador  

---

## 📚 CASOS DE USO

### 1. Planejamento de Operações de Rebocadores

```
CENÁRIO: Planejar manobra de atracação em Fortaleza
FONTES CONSULTADAS:
- METEOROMARINHA → Condições gerais
- Avisos Mau Tempo → Verificar restrições
- Avisos Rádio Norte → Verificar avisos região III (Ceará)
```

### 2. Monitoramento de Frota

```
CENÁRIO: Empresa com rebocadores em Santos (SP), Salvador (BA), Belém (PA)
FONTES CONSULTADAS:
- METEOROMARINHA → Visão geral Brasil
- Avisos Rádio Norte → Belém
- Avisos Rádio Leste → Salvador
- Avisos Rádio Sul → Santos
```

### 3. Análise Histórica

```
CENÁRIO: Estudar padrões meteorológicos ao longo do tempo
PROCESSO:
1. Executar scraper diariamente (agendado)
2. Acumular dados históricos
3. Analisar tendências com pandas/matplotlib
```

---

## 🔮 ROADMAP - VERSÃO 3.0

### Funcionalidades Planejadas:

🔄 **Automação Completa**
- Agendamento automático (cron/scheduler)
- Execução periódica (4x/dia alinhada com ciclos meteorológicos)

💾 **Banco de Dados**
- PostgreSQL para histórico
- Queries SQL para análises
- API REST para consulta

📊 **Dashboard Interativo**
- Visualização em tempo real
- Mapas com Leaflet/Folium
- Gráficos de tendências

🔔 **Sistema de Alertas**
- Email/SMS para avisos críticos
- Integração com Telegram/WhatsApp
- Priorização por região de operação

🤖 **Machine Learning**
- Previsão de padrões
- Análise de correlações
- Recomendações automáticas

---

## 🐛 TROUBLESHOOTING

### Erro: "Timeout ao acessar página"

**Causa:** Conexão lenta ou servidor CHM instável  
**Solução:** Aumentar timeout na linha 281:
```python
time.sleep(5)  # Aumentar para 10 segundos
```

### Erro: "Nenhum aviso encontrado" mas site mostra avisos

**Causa:** Estrutura HTML do site pode ter mudado  
**Solução:** Verificar padrão regex na extração (linhas 430-450)

### Múltiplos arquivos gerados

**Comportamento esperado:** Sistema gera 11 arquivos por execução  
**Para consolidar:** Use apenas `00_relatorio_consolidado.*`

---

## 📞 CONTATO E SUPORTE

**Jossian Brito (Charlie Bravo)**

- 🔗 LinkedIn: https://www.linkedin.com/in/jossianbrito/
- 🐦 X: https://x.com/jossiancosta
- 📝 Medium: https://medium.com/@jossiancosta

---

## 📄 LICENÇA E TERMOS

Este sistema foi desenvolvido para fins de:
- ✅ Pesquisa e desenvolvimento
- ✅ Apoio à segurança da navegação
- ✅ Educação em programação

**Uso Responsável:**
- Respeitar termos de uso do site da Marinha
- Não sobrecarregar servidores
- Utilizar dados apenas para fins legítimos

---

## ⚓ CHANGELOG

### v2.0.0 (2025-01-13)
- ✨ **NOVO:** Captura de 5 fontes simultâneas
- ✨ **NOVO:** Avisos de Mau Tempo (METAREA V)
- ✨ **NOVO:** Avisos Rádio Náuticos por região (N/L/S)
- ✨ **NOVO:** Relatório consolidado master
- ✨ **NOVO:** Estrutura de diretórios organizada
- ✨ **NOVO:** Detecção automática de alertas críticos
- 🔧 **MELHORIA:** Sistema de logging expandido
- 🔧 **MELHORIA:** Tratamento de erros robusto

### v1.0.0 (2025-01-13)
- 🎉 Versão inicial com METEOROMARINHA
- 🎉 Exportação CSV e TXT
- 🎉 Tutorial educacional de indentação

---

**Navegue com segurança! ⚓🌊**
