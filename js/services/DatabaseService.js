/**
 * ARQUIVO: DatabaseService.js
 * MÓDULO: Persistência de Dados (Local)
 * DESCRIÇÃO:
 * Gerencia o armazenamento local de dados de convites, usuários e configurações.
 * Utiliza LocalStorage para simular um banco de dados persistente no navegador.
 */

const DatabaseService = {

    KEYS: {
        INVITES: 'sisnav_invites_v1',
        ADMIN: 'sisnav_admin_v1',
        SETTINGS: 'sisnav_settings_v1'
    },

    // SPRINT (HOTFIX): Convites Hardcoded como Fallback (Backup)
    STATIC_INVITES: [
        {
            token: 'tmtk5s1hwm6vtv2iw3',
            password: '2WR-N3U',
            type: 'planning',
            status: 'active',
            email: 'usuario.producao@sisnav.com'
        },
        {
            token: 'vts-monitor-access',
            password: 'VIEW-ONLY',
            type: 'monitor',
            status: 'active',
            email: 'ponte.comando@sisnav.com'
        }
    ],

    /**
     * Inicializa o banco de dados.
     */
    init: function () {
        // Admin Local (Simplificado)
        if (!localStorage.getItem(this.KEYS.ADMIN)) {
            const defaultAdmin = {
                username: 'admin',
                passwordHash: 'admin123'
            };
            localStorage.setItem(this.KEYS.ADMIN, JSON.stringify(defaultAdmin));
        }
    },

    /**
     * [ASYNC] Retorna a lista de convites do SERVIDOR.
     */
    getInvites: async function () {
        try {
            // Use relative path to support subdirectories
            const response = await fetch('api/invites/list', { cache: 'no-store' });
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
                headers: { 'Content-Type': 'application/json' },
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
                headers: { 'Content-Type': 'application/json' },
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
                headers: { 'Content-Type': 'application/json' },
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
                headers: { 'Content-Type': 'application/json' },
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
     * Valida admin (Mantido Local por enquanto).
     */
    validateAdmin: function (user, pass) {
        const stored = JSON.parse(localStorage.getItem(this.KEYS.ADMIN));
        return (stored.username === user && stored.passwordHash === pass);
    }
};

export default DatabaseService;
