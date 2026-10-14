/**
 * ARQUIVO: DatabaseService.js
 * MÓDULO: Persistência de Dados (Local)
 * DESCRIÇÃO:
 * Gerencia o armazenamento local de dados de convites, usuários e configurações.
 * Utiliza LocalStorage para simular um banco de dados persistente no navegador.
 *
 * Autor: Jossian Brito (Charlie Bravo) | Data: 2026-10-13 18:45 (UTC-3)
 * Versão: 3.5.0-sec
 * MODIFICAÇÕES v3.5.0-sec (assistido por Claude):
 *  - Removidos os convites e a senha de admin escritos no código (qualquer
 *    visitante lia este arquivo). Convites agora existem só no servidor.
 *  - Chamadas administrativas enviam o cabeçalho X-Admin-Key (guardado só na
 *    sessão da aba, sessionStorage) e o servidor valida.
 *  - validateAdmin passa a consultar /api/admin/login (servidor decide).
 */

const DatabaseService = {

    KEYS: {
        INVITES: 'sisnav_invites_v1',
        ADMIN: 'sisnav_admin_v1',
        SETTINGS: 'sisnav_settings_v1'
    },

    // SPRINT (HOTFIX): Convites Hardcoded como Fallback (Backup)
    STATIC_INVITES: [], // v3.5.0-sec: removidos (migrados para data/sisnav_invites_db.json no servidor)

    /**
     * Inicializa o banco de dados.
     */
    init: function () {
        // v3.5.0-sec: admin padrão local removido - login de admin é validado no servidor.
    },

    /**
     * v3.5.0-sec: monta cabeçalhos JSON + chave de admin (se houver sessão admin).
     * A chave nunca é gravada em localStorage: some ao fechar a aba.
     */
    _jsonHeaders: function () {
        const h = { 'Content-Type': 'application/json' };
        const k = sessionStorage.getItem('sisnav_admin_key');
        if (k) h['X-Admin-Key'] = k;
        return h;
    },

    /**
     * [ASYNC] Retorna a lista de convites do SERVIDOR.
     */
    getInvites: async function () {
        try {
            // Use relative path to support subdirectories
            const response = await fetch('api/invites/list', { cache: 'no-store', headers: this._jsonHeaders() });
            if (!response.ok) throw new Error('Falha ao buscar convites');
            const serverInvites = await response.json();

            // Merge visual para Admin (Server + Static)
            return [...this.STATIC_INVITES, ...serverInvites];
        } catch (e) {
            console.warn("Backend offline/inacessível. Mostrando apenas estáticos.", e);
            return this.STATIC_INVITES;
        }
    },

    /**
     * [ASYNC] Salva um novo convite no SERVIDOR.
     */
    saveInvite: async function (invite) {
        try {
            const response = await fetch('api/invites/create', {
                method: 'POST',
                headers: this._jsonHeaders(),
                body: JSON.stringify(invite)
            });
            return response.ok;
        } catch (e) {
            console.error("Erro ao salvar convite:", e);
            return false;
        }
    },

    /**
     * [ASYNC] Atualiza um convite no SERVIDOR (ex: revogar).
     */
    updateInvite: async function (token, updates) {
        try {
            const response = await fetch('api/invites/update', {
                method: 'POST',
                headers: this._jsonHeaders(),
                body: JSON.stringify({ token, updates })
            });
            return response.ok;
        } catch (e) {
            console.error("Erro ao atualizar convite:", e);
            return false;
        }
    },

    /**
     * [ASYNC] Deleta um convite permanentemente do SERVIDOR.
     */
    deleteInvite: async function (token) {
        try {
            const response = await fetch('api/invites/delete', {
                method: 'POST',
                headers: this._jsonHeaders(),
                body: JSON.stringify({ token })
            });
            return response.ok;
        } catch (e) {
            console.error("Erro ao deletar convite:", e);
            return false;
        }
    },

    /**
     * [ASYNC] Valida token diretamente no servidor.
     */
    validateInvite: async function (token, password) {
        // 1. Check Static First (Local Fallback)
        const staticInvite = this.STATIC_INVITES.find(i => i.token === token);
        if (staticInvite) {
            if (staticInvite.status !== 'active') return { valid: false, error: 'Revogado/Inativo (Static)' };
            if (staticInvite.password !== password) return { valid: false, error: 'Senha incorreta (Static)' };
            return { valid: true, type: staticInvite.type, email: staticInvite.email };
        }

        // 2. Check Server
        try {
            const response = await fetch('api/invites/validate', {
                method: 'POST',
                headers: this._jsonHeaders(),
                body: JSON.stringify({ token, password })
            });

            if (response.ok) {
                return await response.json();
            } else {
                const err = await response.json();
                return { valid: false, error: err.error || 'Erro de validação' };
            }
        } catch (e) {
            return { valid: false, error: 'Erro de conexão com servidor' };
        }
    },

    /**
     * [ASYNC] Busca convite por Token.
     */
    findInviteByToken: async function (token) {
        const list = await this.getInvites();
        return list.find(i => i.token === token);
    },

    /**
     * [ASYNC] v3.5.0-sec: valida a chave de admin NO SERVIDOR.
     * O campo "senha" da tela de admin é a chave guardada em ~/.sisnav_admin_key.
     */
    validateAdmin: async function (user, pass) {
        try {
            const r = await fetch('api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: user, key: pass })
            });
            return r.ok;
        } catch (e) {
            console.error('Erro ao validar admin:', e);
            return false;
        }
    }
};

export default DatabaseService;
