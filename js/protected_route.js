/**
 * Middleware de Proteção de Rota
 * Injetado no <head> de index.html
 */
import AuthService from './services/AuthService.js?v=Sprint1';

// Init DB/Auth
AuthService.init();

if (!AuthService.isAuthenticated()) {
    console.warn("SISNAV Security: Acesso não autorizado. Redirecionando...");
    // Salva a URL tentada para redirect (Opcional, futuro)
    window.location.href = 'login.html';
} else {
    console.log("SISNAV Security: Sessão Válida. Acesso Liberado.");
    const session = AuthService.getSession();
    console.log(`Logado como: ${session.type}`);
}
