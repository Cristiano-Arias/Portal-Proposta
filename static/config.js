// config.js - Configurações do sistema
const CONFIG = {
    // URL da API - detecta automaticamente se está local ou em produção
    API_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' 
        : window.location.origin,
    
    // Intervalos de tempo
    AUTO_SAVE_INTERVAL: 30000, // 30 segundos
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutos
    
    // Mensagens
    MESSAGES: {
        SAVE_SUCCESS: 'Dados salvos com sucesso!',
        SAVE_ERROR: 'Erro ao salvar. Tente novamente.',
        SESSION_EXPIRED: 'Sua sessão expirou. Faça login novamente.'
    }
};

// Tornar global
window.CONFIG = CONFIG;

// Função para requisições à API
window.apiRequest = async function(endpoint, options = {}) {
    try {
        const url = `${CONFIG.API_URL}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};