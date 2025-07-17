// ========================================
// SISTEMA DE AUTENTICAÇÃO - CORRIGIDO
// ========================================

const Auth = {
    // Configurações
    config: {
        tokenKey: 'auth_token',
        userKey: 'user_data',
        sessionTimeout: 24 * 60 * 60 * 1000 // 24 horas
    },

    // Verificar se usuário está autenticado
    verificarAutenticacao: function(tiposPermitidos = []) {
        try {
            const token = localStorage.getItem(this.config.tokenKey);
            const userData = localStorage.getItem(this.config.userKey);
            
            if (!token || !userData) {
                this.redirecionarLogin();
                return null;
            }
            
            const usuario = JSON.parse(userData);
            
            // Verificar se o tipo de usuário é permitido
            if (tiposPermitidos.length > 0) {
                const tiposArray = Array.isArray(tiposPermitidos) ? tiposPermitidos : [tiposPermitidos];
                if (!tiposArray.includes(usuario.tipo)) {
                    alert('Acesso negado. Você não tem permissão para acessar esta página.');
                    this.logout();
                    return null;
                }
            }
            
            return usuario;
        } catch (error) {
            console.error('Erro na verificação de autenticação:', error);
            this.logout();
            return null;
        }
    },

    // Realizar login
    login: async function(email, senha) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, senha })
            });
            
            const data = await response.json();
            
            if (data.sucesso) {
                // Salvar dados do usuário
                localStorage.setItem(this.config.tokenKey, data.token);
                localStorage.setItem(this.config.userKey, JSON.stringify(data.usuario));
                
                return { sucesso: true, usuario: data.usuario };
            } else {
                return { sucesso: false, erro: data.erro };
            }
        } catch (error) {
            console.error('Erro no login:', error);
            return { sucesso: false, erro: 'Erro de conexão com o servidor' };
        }
    },

    // Realizar logout - CORRIGIDO
    logout: function() {
        try {
            // Limpar dados do localStorage
            localStorage.removeItem(this.config.tokenKey);
            localStorage.removeItem(this.config.userKey);
            
            // Fazer chamada para o backend para invalidar sessão
            fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            }).catch(error => {
                console.warn('Erro ao notificar logout no servidor:', error);
            });
            
            // Redirecionar para página de login
            this.redirecionarLogin();
        } catch (error) {
            console.error('Erro no logout:', error);
            // Mesmo com erro, redirecionar para login
            this.redirecionarLogin();
        }
    },

    // Redirecionar para login
    redirecionarLogin: function() {
        // Verificar se já está na página de login para evitar loop
        if (!window.location.pathname.includes('login') && !window.location.pathname.includes('index.html')) {
            window.location.href = 'index.html';
        }
    },

    // Exibir informações do usuário - CORRIGIDO
    exibirInfoUsuario: function(elementId = 'infoUsuario') {
        try {
            const userData = localStorage.getItem(this.config.userKey);
            if (!userData) return;
            
            const usuario = JSON.parse(userData);
            const elemento = document.getElementById(elementId);
            
            if (elemento) {
                elemento.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="color: white; font-weight: 600;">
                            Olá, ${usuario.nome || usuario.email}
                        </span>
                        <span style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 12px; font-size: 12px;">
                            ${this.getTipoUsuarioLabel(usuario.tipo)}
                        </span>
                        <button onclick="Auth.logout()" style="
                            background: rgba(255,255,255,0.2); 
                            color: white; 
                            border: none; 
                            padding: 8px 15px; 
                            border-radius: 6px; 
                            cursor: pointer;
                            font-weight: 600;
                            transition: background 0.3s;
                        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                           onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                            🚪 Sair
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Erro ao exibir info do usuário:', error);
        }
    },

    // Obter label do tipo de usuário
    getTipoUsuarioLabel: function(tipo) {
        const labels = {
            'admin': 'Administrador',
            'comprador': 'Comprador',
            'fornecedor': 'Fornecedor'
        };
        return labels[tipo] || tipo;
    },

    // Filtrar dados por permissão
    filtrarDadosPorPermissao: function(dados, tipo) {
        const usuario = this.getUsuarioAtual();
        if (!usuario) return [];
        
        // Admin vê tudo
        if (usuario.tipo === 'admin') {
            return dados;
        }
        
        // Comprador vê apenas seus próprios dados
        if (usuario.tipo === 'comprador') {
            return dados.filter(item => item.criadoPor === usuario.id);
        }
        
        // Fornecedor vê apenas dados públicos
        return dados.filter(item => item.publico === true);
    },

    // Obter usuário atual
    getUsuarioAtual: function() {
        try {
            const userData = localStorage.getItem(this.config.userKey);
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('Erro ao obter usuário atual:', error);
            return null;
        }
    },

    // Verificar se tem permissão específica
    temPermissao: function(permissao) {
        const usuario = this.getUsuarioAtual();
        if (!usuario) return false;
        
        const permissoes = {
            'admin': ['criar_processo', 'editar_processo', 'deletar_processo', 'ver_todas_propostas', 'cadastrar_comprador'],
            'comprador': ['criar_processo', 'editar_processo', 'ver_propostas_processo'],
            'fornecedor': ['enviar_proposta', 'ver_propria_proposta']
        };
        
        return permissoes[usuario.tipo]?.includes(permissao) || false;
    },

    // Cadastrar fornecedor
    cadastrarFornecedor: async function(dadosFornecedor) {
        try {
            const response = await fetch('/api/cadastrar-fornecedor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dadosFornecedor)
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Erro ao cadastrar fornecedor:', error);
            return { sucesso: false, erro: 'Erro de conexão com o servidor' };
        }
    },

    // Cadastrar comprador
    cadastrarComprador: async function(dadosComprador) {
        try {
            const response = await fetch('/api/cadastrar-comprador', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dadosComprador)
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Erro ao cadastrar comprador:', error);
            return { sucesso: false, erro: 'Erro de conexão com o servidor' };
        }
    }
};

// Verificar autenticação automaticamente quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
    // Só verificar se não estiver na página de login
    if (!window.location.pathname.includes('login') && !window.location.pathname.includes('index.html')) {
        Auth.verificarAutenticacao();
    }
});

// Exportar para uso global
window.Auth = Auth;
