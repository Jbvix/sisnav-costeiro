/**
 * ARQUIVO: AuthService.js
 * MÓDULO: Autenticação e Sessão
 * DESCRIÇÃO:
 * Gerencia o ciclo de vida da sessão (Login, Logout, Validação).
 * Abstrai a lógica de verificação de tokens e senhas.
 */

import DatabaseService from './DatabaseService.js?v=Hotfix3';

const AuthService = {

    SESSION_KEY: 'sisnav_session_v1',

    init: function () {
        DatabaseService.init();
    },

    /**
     * [ASYNC] Tenta realizar login com Token e Senha.
     * @returns {Promise<object>} Sessão criada ou erro.
     */
    login: async function (token, password) {
        // Validação no Servidor (ou fallback estático)
        const validation = await DatabaseService.validateInvite(token, password);

        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        // Login Sucesso
        const session = {
            token: token,
            type: validation.type, // 'planning' ou 'monitor'
            email: validation.email,
            loginTime: Date.now()
        };

        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        return { success: true, session: session };
    },

    /**
     * Login Administrativo.
     */
    adminLogin: function (user, pass) {
        if (DatabaseService.validateAdmin(user, pass)) {
            const session = {
                type: 'admin',
                user: user,
                loginTime: Date.now()
            };
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
            return { success: true };
        }
        return { success: false, error: 'Credenciais inválidas.' };
    },

    /**
     * Retorna a sessão atual.
     */
    getSession: function () {
        const data = sessionStorage.getItem(this.SESSION_KEY);
        return data ? JSON.parse(data) : null;
    },

    /**
     * Verifica se está autenticado.
     */
    isAuthenticated: function () {
        return !!this.getSession();
    },

    /**
     * Verifica permissão para admin.
     */
    isAdmin: function () {
        const s = this.getSession();
        return s && s.type === 'admin';
    },

    logout: function () {
        sessionStorage.removeItem(this.SESSION_KEY);
        window.location.href = 'login.html'; // Redireciona
    }
};

export default AuthService;
