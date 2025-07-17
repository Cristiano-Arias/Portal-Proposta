// ========================================
// SISTEMA DE AUTENTICAÇÃO CORRIGIDO
// Arquivo: auth.js
// ========================================

const Auth = {
    // Verificar se usuário está autenticado
    verificarAutenticacao: function(tipoRequerido = null) {
        console.log('🔍 Verificando autenticação...');
        
        const sessao = sessionStorage.getItem('sessao_ativa');
        
        if (!sessao) {
            console.log('❌ Nenhuma sessão encontrada');
            this.redirecionarParaLogin();
            return false;
        }
        
        try {
            const sessaoObj = JSON.parse(sessao);
            console.log('✅ Sessão encontrada:', sessaoObj.nome, '(' + sessaoObj.tipo + ')');
            
            // Verificar expiração (30 minutos)
            const inicio = new Date(sessaoObj.inicio);
            const agora = new Date();
            const minutos = (agora - inicio) / 60000;
            
            if (minutos > 30) {
                console.log('⏰ Sessão expirada');
                this.logout('Sessão expirada. Faça login novamente.');
                return false;
            }
            
            // Verificar tipo de usuário se especificado
            if (tipoRequerido) {
                // Admin pode acessar tudo
                if (sessaoObj.tipo === 'admin') {
                    console.log('👑 Acesso admin autorizado');
                    return sessaoObj;
                }
                
                // Verificar se o tipo corresponde
                if (Array.isArray(tipoRequerido)) {
                    if (!tipoRequerido.includes(sessaoObj.tipo)) {
                        console.log('🚫 Tipo de usuário não autorizado');
                        alert('Você não tem permissão para acessar esta área.');
                        this.redirecionarPorTipo(sessaoObj.tipo);
                        return false;
                    }
                } else if (sessaoObj.tipo !== tipoRequerido) {
                    console.log('🚫 Tipo de usuário não autorizado');
                    alert('Você não tem permissão para acessar esta área.');
                    this.redirecionarPorTipo(sessaoObj.tipo);
                    return false;
                }
            }
            
            // Atualizar última atividade
            sessaoObj.ultimaAtividade = new Date().toISOString();
            sessionStorage.setItem('sessao_ativa', JSON.stringify(sessaoObj));
            
            console.log('✅ Autenticação válida');
            return sessaoObj;
            
        } catch (error) {
            console.error('💥 Erro ao verificar sessão:', error);
            this.logout();
            return false;
        }
    },
    
    // Obter dados do usuário atual
    getUsuarioAtual: function() {
        const sessao = sessionStorage.getItem('sessao_ativa');
        if (sessao) {
            try {
                return JSON.parse(sessao);
            } catch (error) {
                console.error('💥 Erro ao obter usuário atual:', error);
                return null;
            }
        }
        return null;
    },
    
    // Fazer logout - VERSÃO CORRIGIDA
    logout: function(mensagem = null) {
        console.log('🚪 Fazendo logout...');
        
        const usuario = this.getUsuarioAtual();
        
        if (usuario) {
            // Registrar logout
            this.registrarLog(usuario.usuarioId, 'logout', 'sucesso');
            console.log('📝 Logout registrado para:', usuario.nome);
        }
        
        // Limpar TODAS as sessões
        sessionStorage.clear();
        
        // Limpar dados temporários
        localStorage.removeItem('proposta_atual');
        
        console.log('🧹 Sessão limpa');
        
        // Mostrar mensagem se fornecida
        if (mensagem) {
            alert(mensagem);
        }
        
        // Redirecionar para login
        this.redirecionarParaLogin();
    },
    
    // Redirecionar para login
    redirecionarParaLogin: function() {
        console.log('🔄 Redirecionando para login...');
        
        // Verificar se já está na página de login
        if (window.location.pathname.includes('index.html') || 
            window.location.pathname.includes('login.html') ||
            window.location.pathname === '/') {
            console.log('📍 Já está na página de login');
            return;
        }
        
        // Redirecionar
        window.location.href = 'index.html';
    },
    
    // Redirecionar baseado no tipo de usuário
    redirecionarPorTipo: function(tipo) {
        console.log('🔄 Redirecionando por tipo:', tipo);
        
        switch(tipo) {
            case 'admin':
            case 'comprador':
                window.location.href = 'sistema-gestao-corrigido2.html';
                break;
            case 'fornecedor':
                window.location.href = 'dashboard-fornecedor.html';
                break;
            case 'auditor':
                window.location.href = 'dashboard-auditor.html';
                break;
            default:
                this.redirecionarParaLogin();
        }
    },
    
    // Registrar log de atividade
    registrarLog: function(usuarioId, acao, detalhes) {
        try {
            const logs = JSON.parse(localStorage.getItem('logs_atividade') || '[]');
            
            logs.push({
                usuarioId: usuarioId,
                acao: acao,
                detalhes: detalhes,
                timestamp: new Date().toISOString(),
                pagina: window.location.pathname
            });
            
            // Manter apenas últimos 5000 logs
            if (logs.length > 5000) {
                logs.shift();
            }
            
            localStorage.setItem('logs_atividade', JSON.stringify(logs));
        } catch (error) {
            console.error('💥 Erro ao registrar log:', error);
        }
    },
    
    // Adicionar informações do usuário ao header - VERSÃO CORRIGIDA
    exibirInfoUsuario: function(elementId = 'infoUsuario') {
        const usuario = this.getUsuarioAtual();
        const elemento = document.getElementById(elementId);
        
        if (usuario && elemento) {
            let tipoExibicao = usuario.tipo;
            if (usuario.tipo === 'comprador') {
                tipoExibicao = usuario.nivelAcesso || 'Comprador';
                tipoExibicao = tipoExibicao.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
            
            elemento.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="color: #fff; opacity: 0.8;">Olá,</span>
                    <strong style="color: #fff;">${usuario.nome}</strong>
                    <span style="color: #fff; opacity: 0.8;">|</span>
                    <span style="color: #fff; font-size: 12px; opacity: 0.8;">${tipoExibicao}</span>
                    <span style="color: #fff; opacity: 0.8;">|</span>
                    <button onclick="Auth.logout()" style="background: rgba(255,255,255,0.2); border: none; color: #fff; cursor: pointer; font-weight: 600; padding: 5px 15px; border-radius: 5px; transition: all 0.3s; font-size: 14px;">
                        🚪 Sair
                    </button>
                </div>
            `;
            
            console.log('👤 Info do usuário exibida:', usuario.nome);
        } else {
            console.log('⚠️ Elemento ou usuário não encontrado para exibir info');
        }
    },
    
    // Verificar permissões específicas
    temPermissao: function(permissao) {
        const usuario = this.getUsuarioAtual();
        if (!usuario) return false;
        
        const permissoes = {
            admin: [
                'criar_processo',
                'editar_processo',
                'deletar_processo',
                'ver_todos_processos',
                'ver_todas_propostas',
                'gerar_relatorios',
                'gerenciar_usuarios',
                'criar_compradores'
            ],
            comprador: [
                'criar_processo',
                'editar_proprio_processo',
                'deletar_proprio_processo',
                'ver_proprios_processos',
                'ver_propostas_proprios_processos',
                'gerar_relatorios_proprios_processos'
            ],
            comprador_senior: [
                'criar_processo',
                'editar_proprio_processo',
                'deletar_proprio_processo',
                'ver_todos_processos',
                'ver_propostas_proprios_processos',
                'gerar_relatorios'
            ],
            gerente: [
                'criar_processo',
                'editar_processo',
                'aprovar_processo',
                'ver_todos_processos',
                'ver_todas_propostas',
                'gerar_relatorios'
            ],
            fornecedor: [
                'ver_processos_ativos',
                'enviar_proposta',
                'ver_proprias_propostas',
                'editar_propria_proposta'
            ],
            auditor: [
                'ver_todos_processos',
                'ver_todas_propostas',
                'gerar_relatorios'
            ]
        };
        
        // Para compradores, usar o nível de acesso específico
        let tipoPermissao = usuario.tipo;
        if (usuario.tipo === 'comprador' && usuario.nivelAcesso) {
            tipoPermissao = usuario.nivelAcesso;
        }
        
        const permissoesUsuario = permissoes[tipoPermissao] || [];
        return permissoesUsuario.includes(permissao);
    },
    
    // Filtrar dados baseado no tipo de usuário
    filtrarDadosPorPermissao: function(dados, tipo) {
        const usuario = this.getUsuarioAtual();
        if (!usuario) return [];
        
        switch(tipo) {
            case 'processos':
                // Admin e gerente veem todos
                if (usuario.tipo === 'admin' || usuario.nivelAcesso === 'gerente' || usuario.nivelAcesso === 'comprador_senior') {
                    return dados;
                }
                
                // Comprador vê apenas seus processos
                if (usuario.tipo === 'comprador') {
                    return dados.filter(p => p.criadoPor === usuario.usuarioId);
                }
                
                // Fornecedor só vê processos ativos
                if (usuario.tipo === 'fornecedor') {
                    const agora = new Date();
                    return dados.filter(p => new Date(p.prazo) > agora);
                }
                
                return dados;
                
            case 'propostas':
                // Admin, gerente e auditor veem todas
                if (usuario.tipo === 'admin' || usuario.nivelAcesso === 'gerente' || usuario.tipo === 'auditor') {
                    return dados;
                }
                
                // Comprador vê apenas propostas dos seus processos
                if (usuario.tipo === 'comprador') {
                    // Primeiro, pegar os processos do comprador
                    const processos = JSON.parse(localStorage.getItem('processos') || '[]');
                    const meusProcessos = processos
                        .filter(p => p.criadoPor === usuario.usuarioId)
                        .map(p => p.numero);
                    
                    // Filtrar propostas
                    return dados.filter(proposta => meusProcessos.includes(proposta.processo));
                }
                
                // Fornecedor só vê suas próprias propostas
                if (usuario.tipo === 'fornecedor') {
                    return dados.filter(p => p.cnpj === usuario.cnpj);
                }
                
                return dados;
                
            default:
                return dados;
        }
    },
    
    // Verificar se pode editar processo
    podeEditarProcesso: function(processo) {
        const usuario = this.getUsuarioAtual();
        if (!usuario) return false;
        
        // Admin e gerente podem editar qualquer processo
        if (usuario.tipo === 'admin' || usuario.nivelAcesso === 'gerente') {
            return true;
        }
        
        // Comprador só pode editar seus próprios processos
        if (usuario.tipo === 'comprador' && processo.criadoPor === usuario.usuarioId) {
            return true;
        }
        
        return false;
    },
    
    // Proteger elementos da página baseado em permissões
    protegerElementos: function() {
        const usuario = this.getUsuarioAtual();
        if (!usuario) return;
        
        // Esconder elementos baseado em data-permissao
        document.querySelectorAll('[data-permissao]').forEach(elemento => {
            const permissaoRequerida = elemento.getAttribute('data-permissao');
            if (!this.temPermissao(permissaoRequerida)) {
                elemento.style.display = 'none';
            }
        });
        
        // Desabilitar inputs se usuário for auditor
        if (usuario.tipo === 'auditor') {
            document.querySelectorAll('input, textarea, select, button[type="submit"]').forEach(elemento => {
                elemento.disabled = true;
            });
        }
    },
    
    // Inicializar autenticação na página
    inicializar: function(tipoRequerido = null) {
        console.log('🚀 Inicializando sistema de autenticação...');
        
        // Verificar autenticação
        const usuario = this.verificarAutenticacao(tipoRequerido);
        
        if (usuario) {
            // Exibir informações do usuário
            this.exibirInfoUsuario();
            
            // Proteger elementos
            this.protegerElementos();
            
            // Registrar acesso à página
            this.registrarLog(usuario.usuarioId, 'acesso_pagina', window.location.pathname);
            
            console.log('✅ Sistema de autenticação inicializado');
            return usuario;
        }
        
        return false;
    }
};

// ========================================
// AUTO-INICIALIZAÇÃO
// ========================================

// Verificar se não está na página de login
if (!window.location.pathname.includes('index.html') && 
    !window.location.pathname.includes('login.html') &&
    !window.location.pathname.includes('cadastro-fornecedor.html')) {
    
    // Auto-inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            Auth.inicializar();
        });
    } else {
        Auth.inicializar();
    }
}

// ========================================
// COMO USAR ESTE SISTEMA CORRIGIDO
// ========================================

/*
// 1. Para páginas que admin e compradores podem acessar:
window.addEventListener('DOMContentLoaded', function() {
    const usuario = Auth.verificarAutenticacao(['admin', 'comprador']);
    if (usuario) {
        Auth.exibirInfoUsuario();
        Auth.protegerElementos();
        
        // Filtrar dados baseado no usuário
        const processos = Auth.filtrarDadosPorPermissao(todosProcessos, 'processos');
        const propostas = Auth.filtrarDadosPorPermissao(todasPropostas, 'propostas');
    }
});

// 2. Para verificar se pode editar um processo:
if (Auth.podeEditarProcesso(processo)) {
    // Mostrar botões de edição
}

// 3. Para criar processo com rastreamento de proprietário:
const novoProcesso = {
    // ... outros campos ...
    criadoPor: usuario.usuarioId,
    criadoEm: new Date().toISOString()
};

// 4. Para fazer logout:
Auth.logout();

// 5. Para verificar permissões:
if (Auth.temPermissao('criar_processo')) {
    // Mostrar botão de criar processo
}
*/
