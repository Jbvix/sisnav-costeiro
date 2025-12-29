# 04 - Processos, Testes e Deploy

## 1. Processo de Atualização de Dados (Data Update)
Para manter o sistema funcional, os dados de maré e meteorologia precisam ser atualizados a cada 10-15 dias.

### Passo 1: Execução do Script
Em um ambiente com Python e Internet (pode ser sua máquina local ou o servidor):
1.  Abra o terminal na pasta do projeto.
2.  Execute: `python rebuild_csv.py`
3.  Aguarde o progresso (o script fará uma pausa entre requisições para não ser bloqueado).

### Passo 2: Verificação
1.  Verifique se o arquivo `tides_scraped.csv` foi modificado (data de modificação atual).
2.  Verifique se o tamanho é coerente (> 20KB).

### Passo 3: Publicação (Se rodou local)
1.  Faça o upload dos arquivos `.csv` gerados para a pasta raiz do servidor via FTP ou Git.

---

## 2. Processo de Deploy (cPanel/Passenger)

Este guia cobre a implantação na hospedagem **TugLife** (cPanel + CloudLinux).

### Pré-requisitos
*   Acesso ao cPanel.
*   Python 3.10+ configurado via "Setup Python App".

### Passo 1: Upload dos Arquivos
Copie toda a pasta do projeto para `public_html/sisnav` (ou diretório da aplicação).
*   **Importante**: Não sobrescreva `passenger_wsgi.py` se ele já estiver configurado corretamente com o caminho do interpretador.

### Passo 2: Instalação de Dependências
No terminal do cPanel (ou via SSH virtual):
```bash
cd /home/usuario/sisnav
pip install -r requirements.txt
```
*   Dependências principais: `flask`, `requests`, `beautifulsoup4`.

### Passo 3: Reinício da Aplicação
Sempre que o código Python (`server.py`) for alterado, o servidor precisa ser reiniciado:
1.  Vá no cPanel > **Setup Python App**.
2.  Clique no botão **Restart** (ícone de recarregar) ao lado da aplicação.
    *   *Alternativa*: Crie/Toque num arquivo vazio chamado `tmp/restart.txt`.

---

## 3. Plano de Testes (QA)

Antes de liberar uma versão para o navio:

### Teste de Regressão (Manual)
1.  **Abrir App**: A tela inicial carrega sem erros de console?
2.  **Traçar Rota**: Selecione "Mucuripe" -> "Suape". O mapa desenha a linha azul? O ETA aparece?
3.  **Maré**: Na aba Appraisal, ao selecionar Suape e uma data futura, o gráfico de maré aparece?

### Teste de Transmissão (Fleet)
1.  Abra o app em duas abas/dispositivos.
2.  Dispositivo A: Clique "GPS Real". Verifique se fica Vermelho ("GPS ATIVO").
3.  Dispositivo B: Adicione `?mode=viewer` na URL. Verifique se o ícone do navio aparece no mapa em < 30 segundos.
