/**
 * ARQUIVO: AuthService.js
 * MÓDULO: Autenticação e Sessão
 * DESCRIÇÃO:
 * Gerencia o ciclo de vida da sessão (Login, Logout, Validação).
 * Abstrai a lógica de verificação de tokens e senhas.
 *
 * Autor: Jossian Brito (Charlie Bravo) | Data: 2026-10-13 18:45 (UTC-3)
 * Versão: 3.5.0-sec
 * MODIFICAÇÕES v3.5.0-sec: adminLogin agora é assíncrono e validado no
 * servidor; a chave aprovada fica só na sessão da aba (sessionStorage) e é
 * removida no logout.
 */

import DatabaseService from './DatabaseService.js?v=Sec350';

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
    adminLogin: async function (user, pass) {
        if (await DatabaseService.validateAdmin(user, pass)) {
            sessionStorage.setItem('sisnav_admin_key', pass); // v3.5.0-sec
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
        sessionStorage.removeItem('sisnav_admin_key'); // v3.5.0-sec
        window.location.href = 'login.html'; // Redireciona
    }
};

export default AuthService;
