# Relatório de Plano de Implementação - API de Respostas do Kratos e Otimização do Windy

Migrar o assistente náutico Kratos do endpoint legado `/v1/chat/completions` para a nova **Responses API** (`/v1/responses`) do xAI. Isso é necessário para habilitar e suportar o modelo de raciocínio avançado **`grok-4.20-reasoning`**, que só é acessível através desta nova API.

## Mudanças Propostas

### 1. Servidor Backend (Flask)

Modificar as chamadas da API do xAI no arquivo `server.py` para usar a Responses API, ajustando o formato da requisição (parâmetro `input` em vez de `messages`) e o processamento de resposta (array `output` estruturado).

---

#### [MODIFY] [server.py](file:///c:/Users/jossi/OneDrive/Anexos/Documentos/Repository%20TugLife/sisnav-costeiro/sisnav-costeiro/server.py)

- No status do Kratos (`kratos_status()`):
  - Atualizar o modelo padrão de fallback de `grok-2` para `grok-4.20-reasoning`.
- No chat do Kratos (`kratos_chat()`):
  - Mudar o modelo padrão de fallback de `grok-2` para `grok-4.20-reasoning`.
  - Mudar a URL do endpoint para `https://api.x.ai/v1/responses`.
  - Atualizar o payload enviado para conter o parâmetro `input` em vez de `messages`.
  - Adaptar o parser da resposta para extrair o texto de `output[].content[].text`, adicionando um fallback resiliente ao padrão clássico da OpenAI para compatibilidade de retaguarda.

## Plano de Verificação

### Verificação Manual
1. Iniciar o servidor local.
2. Abrir o Kratos e enviar a pergunta: "Liste suas funções".
3. Verificar se a resposta é processada e exibida com sucesso na tela do chat, confirmando que o backend se comunicou corretamente com a Responses API do xAI e utilizou o modelo `grok-4.20-reasoning`.
4. Verificar o arquivo `data/kratos_debug.log` para confirmar que as chamadas e formatos de retorno foram devidamente registrados.
