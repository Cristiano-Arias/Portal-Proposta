// config.js - Configurações centralizadas do sistema
const CONFIG = {
    // ===== CONFIGURAÇÕES DE API =====
    // Detecta automaticamente se está rodando local ou em produção
    API_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' 
        : window.location.origin,
    
    // ===== CONFIGURAÇÕES DE TEMPO =====
    AUTO_SAVE_INTERVAL: 30000,        // Auto-save a cada 30 segundos
    SESSION_TIMEOUT: 30 * 60 * 1000,  // Sessão expira em 30 minutos
    REFRESH_INTERVAL: 10000,          // Atualizar dados a cada 10 segundos
    
    // ===== CONFIGURAÇÕES DE VALIDAÇÃO =====
    MAX_FILE_SIZE: 10 * 1024 * 1024,  // Máximo 10MB por arquivo
    ALLOWED_FILE_TYPES: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
    MIN_PASSWORD_LENGTH: 8,
    
    // ===== CONFIGURAÇÕES DE INTERFACE =====
    ITEMS_PER_PAGE: 20,               // Itens por página em listagens
    DATE_FORMAT: 'DD/MM/YYYY',        // Formato de data brasileiro
    CURRENCY_FORMAT: 'pt-BR',         // Formato de moeda
    
    // ===== MENSAGENS PADRÃO =====
    MESSAGES: {
        SAVE_SUCCESS: '✅ Dados salvos com sucesso!',
        SAVE_ERROR: '❌ Erro ao salvar. Tente novamente.',
        SESSION_EXPIRED: '⏱️ Sua sessão expirou. Faça login novamente.',
        NETWORK_ERROR: '🌐 Erro de conexão. Verifique sua internet.',
        INVALID_LOGIN: '❌ Email ou senha incorretos.',
        REQUIRED_FIELDS: '⚠️ Preencha todos os campos obrigatórios.',
        CONFIRM_DELETE: '⚠️ Tem certeza que deseja excluir?',
        LOADING: '⏳ Carregando...',
        NO_DATA: '📭 Nenhum dado encontrado.'
    },
    
    // ===== ROTAS DO SISTEMA =====
    ROUTES: {
        LOGIN: '/',
        DASHBOARD: '/sistema-gestao-corrigido2.html',
        PORTAL_PROPOSTAS: '/portal-propostas-novo.html',
        RELATORIOS: '/modulo-relatorios.html',
        FORNECEDOR: '/dashboard-fornecedor.html',
        CADASTRO_COMPRADOR: '/cadastro-comprador.html',
        CADASTRO_FORNECEDOR: '/cadastro-fornecedor.html'
    },
    
    // ===== TIPOS DE USUÁRIO =====
    USER_TYPES: {
        ADMIN: 'admin',
        COMPRADOR: 'comprador',
        FORNECEDOR: 'fornecedor',
        AUDITOR: 'auditor'
    },
    
    // ===== NÍVEIS DE ACESSO COMPRADOR =====
    BUYER_LEVELS: {
        JUNIOR: 'comprador',
        SENIOR: 'comprador_senior',
        GERENTE: 'gerente'
    },
    
    // ===== MODALIDADES DE LICITAÇÃO =====
    MODALIDADES: [
        'Pregão Eletrônico',
        'Pregão Presencial',
        'Concorrência',
        'Tomada de Preços',
        'Convite',
        'Concurso',
        'Leilão'
    ],
    
    // ===== STATUS DO PROCESSO =====
    PROCESS_STATUS: {
        DRAFT: 'rascunho',
        ACTIVE: 'ativo',
        SUSPENDED: 'suspenso',
        CANCELLED: 'cancelado',
        FINISHED: 'encerrado'
    },
    
    // ===== CONFIGURAÇÕES DE EMAIL =====
    EMAIL: {
        SUPPORT: 'suporte@suaempresa.com',
        NO_REPLY: 'noreply@suaempresa.com',
        MAX_ATTACHMENTS: 5,
        MAX_ATTACHMENT_SIZE: 25 * 1024 * 1024  // 25MB total
    },
    
    // ===== CONFIGURAÇÕES DE DEBUG =====
    DEBUG: window.location.hostname === 'localhost',
    SHOW_CONSOLE_LOGS: true,
    
    // ===== VERSÃO DO SISTEMA =====
    VERSION: '1.0.0',
    LAST_UPDATE: '2024-01-15'
};

// Tornar CONFIG global e imutável
Object.freeze(CONFIG);
window.CONFIG = CONFIG;

// ===== FUNÇÕES UTILITÁRIAS GLOBAIS =====

// Função para log condicional
window.debugLog = function(message, data = null) {
    if (CONFIG.DEBUG && CONFIG.SHOW_CONSOLE_LOGS) {
        if (data) {
            console.log(`[DEBUG] ${message}`, data);
        } else {
            console.log(`[DEBUG] ${message}`);
        }
    }
};

// Função para formatar moeda
window.formatCurrency = function(value) {
    return new Intl.NumberFormat(CONFIG.CURRENCY_FORMAT, {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

// Função para formatar data
window.formatDate = function(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR');
};

// Função para verificar timeout da sessão
window.checkSessionTimeout = function() {
    const sessao = sessionStorage.getItem('sessao_ativa');
    if (!sessao) return false;
    
    const sessaoObj = JSON.parse(sessao);
    const inicio = new Date(sessaoObj.inicio);
    const agora = new Date();
    const tempoDecorrido = agora - inicio;
    
    if (tempoDecorrido > CONFIG.SESSION_TIMEOUT) {
        alert(CONFIG.MESSAGES.SESSION_EXPIRED);
        window.location.href = CONFIG.ROUTES.LOGIN;
        return false;
    }
    
    return true;
};

// Função para fazer requisições à API
window.apiRequest = async function(endpoint, options = {}) {
    try {
        const url = `${CONFIG.API_URL}${endpoint}`;
        debugLog(`API Request: ${options.method || 'GET'} ${url}`);
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        debugLog('API Response:', data);
        return data;
        
    } catch (error) {
        console.error('API Error:', error);
        alert(CONFIG.MESSAGES.NETWORK_ERROR);
        throw error;
    }
};

// Auto verificar sessão a cada minuto
if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
    setInterval(checkSessionTimeout, 60000);
}

// Exibir versão no console
console.log(`🚀 Sistema de Propostas v${CONFIG.VERSION}`);
console.log(`📅 Última atualização: ${CONFIG.LAST_UPDATE}`);
console.log(`🔧 Modo: ${CONFIG.DEBUG ? 'Desenvolvimento' : 'Produção'}`);
console.log(`🌐 API URL: ${CONFIG.API_URL}`);