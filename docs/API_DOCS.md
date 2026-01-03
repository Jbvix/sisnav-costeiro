# Documentação da API - SISNAV Costeiro v3.1

Esta API é servida pelo backend Python (`server.py`) e é utilizada pelo frontend para Gestão de Acesso e (futuramente) salvar rotas.

**Base URL:** `https://tuglife.live/api`

## 1. Gestão de Convites (Auth)

### Listar Convites

Retorna todos os convites ativos no sistema. Requer autenticação de Admin.

* **Endpoint:** `GET /invites/list`
* **Response (200 OK):**

    ```json
    [
      {
        "token": "a1b2c3d4",
        "name": "Comandante X",
        "type": "planning",
        "created_at": "2025-12-25T10:00:00",
        "last_usage": "2026-01-01T15:30:00"
      }
    ]
    ```

### Criar Convite

Gera um novo token de acesso.

* **Endpoint:** `POST /invites/create`
* **Body:**

    ```json
    {
      "name": "Nome do Usuário",
      "type": "planning" // ou "admin", "monitor"
    }
    ```

* **Response (201 Created):**

    ```json
    { "success": true, "token": "novo_token_gerado" }
    ```

### Validar Token (Login)

Verifica se um token é válido e retorna o perfil do usuário.

* **Endpoint:** `POST /invites/validate`
* **Body:**

    ```json
    { "token": "token_do_usuario", "password": "senha_do_usuario" }
    ```

* **Response (200 OK):**

    ```json
    { 
      "valid": true, 
      "role": "planning", 
      "name": "Comandante X" 
    }
    ```

### Atualizar/Revogar Convite

Modifica senha ou deleta um convite.

* **Endpoint:** `POST /invites/update`
* **Body:**

    ```json
    {
      "token": "token_alvo",
      "action": "delete" // ou "update_password"
    }
    ```

## 2. Monitoramento de Frota (Fleet)

### Posição de Navios

Retorna a última posição conhecida das embarcações (Simulado ou NMEA).

* **Endpoint:** `GET /fleet`
* **Response:**

    ```json
    [
      {
        "id": "vessel_01",
        "name": "Tug Alpha",
        "lat": -23.1234,
        "lon": -45.1234,
        "sog": 10.5,
        "cog": 180,
        "last_seen": 1735930000
      }
    ]
    ```
