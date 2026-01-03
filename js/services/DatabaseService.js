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

    /**
     * Inicializa o banco de dados com valores padrão se vazio.
     */
    init: function () {
        if (!localStorage.getItem(this.KEYS.INVITES)) {
            localStorage.setItem(this.KEYS.INVITES, JSON.stringify([]));
        }

        // Configura Admin padrão se não existir
        if (!localStorage.getItem(this.KEYS.ADMIN)) {
            const defaultAdmin = {
                username: 'admin',
                passwordHash: 'admin123' // Em produção usar hash real. Aqui é simplificado.
            };
            localStorage.setItem(this.KEYS.ADMIN, JSON.stringify(defaultAdmin));
        }
    },

    /**
     * Retorna a lista de convites.
     */
    getInvites: function () {
        const data = localStorage.getItem(this.KEYS.INVITES);
        return data ? JSON.parse(data) : [];
    },

    /**
     * Salva um novo convite.
     * @param {object} invite - Objeto invite { token, email, pass, type, status }
     */
    saveInvite: function (invite) {
        const list = this.getInvites();
        list.push(invite);
        localStorage.setItem(this.KEYS.INVITES, JSON.stringify(list));
    },

    /**
     * Atualiza um convite existente (ex: marcar como usado).
     */
    updateInvite: function (token, updates) {
        const list = this.getInvites();
        const index = list.findIndex(i => i.token === token);
        if (index !== -1) {
            list[index] = { ...list[index], ...updates };
            localStorage.setItem(this.KEYS.INVITES, JSON.stringify(list));
            return true;
        }
        return false;
    },

    /**
     * Busca convite por Token.
     */
    findInviteByToken: function (token) {
        const list = this.getInvites();
        return list.find(i => i.token === token);
    },

    /**
     * Valida credenciais de Admin.
     */
    validateAdmin: function (user, pass) {
        const stored = JSON.parse(localStorage.getItem(this.KEYS.ADMIN));
        // Comparação direta simplificada para protótipo
        return (stored.username === user && stored.passwordHash === pass);
    }
};

export default DatabaseService;
