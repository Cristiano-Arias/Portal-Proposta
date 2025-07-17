// ========================================
// SCRIPTS COMPLETOS PARA O SISTEMA DE PROPOSTAS
// ========================================

// ===== CONFIGURAÇÕES GLOBAIS =====
const CONFIG = {
    backendUrl: window.location.origin, // Usa a mesma URL do frontend
    endpoints: {
        enviarProposta: '/api/enviar-proposta',
        verificarCnpj: '/api/verificar-cnpj',
        listarPropostas: '/api/propostas/listar',
        status: '/api/status'
    }
};

// ===== FUNÇÕES DE CÁLCULO DE VALORES =====

// Função para calcular totais comerciais CORRIGIDA
function calcularTotais() {
    // Pegar valores dos campos
    const totalServicosInput = document.getElementById('totalServicos');
    const totalMaoObraInput = document.getElementById('totalMaoObra');
    const totalMateriaisInput = document.getElementById('totalMateriais');
    const totalEquipamentosInput = document.getElementById('totalEquipamentos');
    const bdiPercentualInput = document.getElementById('bdiPercentual');
    const bdiValorInput = document.getElementById('bdiValor');
    const valorTotalInput = document.getElementById('valorTotal');
    const custoDirectoInput = document.getElementById('custoDirecto');
    
    // Converter valores para número
    const totalServicos = parseFloat(totalServicosInput?.value.replace(/\./g, '').replace(',', '.')) || 0;
    const maoObra = parseFloat(totalMaoObraInput?.value.replace(/\./g, '').replace(',', '.')) || 0;
    const materiais = parseFloat(totalMateriaisInput?.value.replace(/\./g, '').replace(',', '.')) || 0;
    const equipamentos = parseFloat(totalEquipamentosInput?.value.replace(/\./g, '').replace(',', '.')) || 0;
    const bdiPercentual = parseFloat(bdiPercentualInput?.value.replace(',', '.')) || 0;
    
    // IMPORTANTE: Custo Direto = APENAS (MO + Mat + Equip)
    const custoDireto = maoObra + materiais + equipamentos;
    
    // Calcular BDI sobre o custo direto
    const bdiValor = custoDireto * (bdiPercentual / 100);
    
    // Valor Total = Custo Direto + BDI
    const valorTotal = custoDireto + bdiValor;
    
    // Atualizar campos calculados
    if (custoDirectoInput) {
        custoDirectoInput.value = formatarMoeda(custoDireto);
    }
    
    if (bdiValorInput) {
        bdiValorInput.value = formatarMoeda(bdiValor);
    }
    
    if (valorTotalInput) {
        valorTotalInput.value = formatarMoeda(valorTotal);
    }
}

// Função auxiliar para formatar valores monetários
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
}

// ===== CRONOGRAMA AUTOMÁTICO =====

// Função para adicionar linha no cronograma com cálculo automático
function addCronogramaRow() {
    const tbody = document.querySelector('#cronogramaTable tbody');
    const rowCount = tbody.rows.length;
    const newRow = tbody.insertRow();
    
    newRow.innerHTML = `
        <td><input type="text" placeholder="Atividade ${rowCount + 1}"></td>
        <td><input type="number" placeholder="30" class="duracao-input" min="1" onchange="calcularCronograma()"></td>
        <td><input type="text" placeholder="Calculado automaticamente" readonly></td>
        <td><input type="text" placeholder="Calculado automaticamente" readonly></td>
        <td><button type="button" class="remove-btn" onclick="removeRowAndRecalculate(this)">×</button></td>
    `;
    
    calcularCronograma();
}

// Remove linha e recalcula
function removeRowAndRecalculate(button) {
    const row = button.closest('tr');
    row.remove();
    calcularCronograma();
}

// Função principal para calcular cronograma automaticamente
function calcularCronograma() {
    const tbody = document.querySelector('#cronogramaTable tbody');
    const rows = tbody.rows;
    let diaAtual = 1;
    
    for (let i = 0; i < rows.length; i++) {
        const duracaoInput = rows[i].cells[1].querySelector('input');
        const inicioInput = rows[i].cells[2].querySelector('input');
        const fimInput = rows[i].cells[3].querySelector('input');
        
        const duracao = parseInt(duracaoInput.value) || 0;
        
        if (duracao > 0) {
            const diaFim = diaAtual + duracao - 1;
            
            inicioInput.value = `Dia ${diaAtual}`;
            fimInput.value = `Dia ${diaFim}`;
            
            diaAtual = diaFim + 1;
        } else {
            inicioInput.value = '';
            fimInput.value = '';
        }
    }
    
    atualizarPrazoTotal();
}

// Atualiza o prazo total baseado no cronograma
function atualizarPrazoTotal() {
    const tbody = document.querySelector('#cronogramaTable tbody');
    const rows = tbody.rows;
    let prazoTotal = 0;
    
    for (let i = 0; i < rows.length; i++) {
        const duracaoInput = rows[i].cells[1].querySelector('input');
        const duracao = parseInt(duracaoInput.value) || 0;
        prazoTotal += duracao;
    }
    
    const prazoExecucaoInput = document.getElementById('prazoExecucao');
    if (prazoExecucaoInput && prazoTotal > 0) {
        prazoExecucaoInput.value = prazoTotal + ' dias';
    }
}

// ===== VALIDAÇÃO CNPJ POR PROCESSO =====

// Função para verificar se CNPJ já enviou proposta para este processo
function verificarCNPJDuplicado(cnpj, processoAtual) {
    const cnpjLimpo = cnpj.replace(/[^\d]/g, '');
    const propostas = JSON.parse(localStorage.getItem('sistema_propostas') || '[]');
    
    const propostaDuplicada = propostas.find(proposta => {
        const cnpjProposta = proposta.cnpj?.replace(/[^\d]/g, '');
        const processoProposta = proposta.processo || proposta.dadosCompletos?.processo;
        
        return cnpjProposta === cnpjLimpo && processoProposta === processoAtual;
    });
    
    return propostaDuplicada;
}

// Validação via API
async function verificarCNPJViaAPI(cnpj, processo) {
    try {
        const response = await fetch(`${CONFIG.backendUrl}${CONFIG.endpoints.verificarCnpj}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ cnpj, processo })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Erro ao verificar CNPJ:', error);
        return { duplicado: false };
    }
}

// Adicionar validação em tempo real no campo CNPJ
function adicionarValidacaoCNPJ() {
    const cnpjInput = document.getElementById('cnpj');
    if (!cnpjInput) return;
    
    cnpjInput.addEventListener('blur', async function() {
        const processoAtual = document.getElementById('processo')?.value || 
                             new URLSearchParams(window.location.search).get('processo');
        
        if (this.value && processoAtual) {
            // Verificar via API
            const resultado = await verificarCNPJViaAPI(this.value, processoAtual);
            
            if (resultado.duplicado) {
                this.style.borderColor = '#e74c3c';
                this.style.backgroundColor = '#ffe6e6';
                
                let avisoElement = document.getElementById('aviso-cnpj-duplicado');
                if (!avisoElement) {
                    avisoElement = document.createElement('div');
                    avisoElement.id = 'aviso-cnpj-duplicado';
                    avisoElement.style.cssText = 'color: #e74c3c; font-size: 12px; margin-top: 5px;';
                    this.parentElement.appendChild(avisoElement);
                }
                
                avisoElement.innerHTML = `⚠️ Este CNPJ já possui proposta para este processo (Protocolo: ${resultado.protocolo})`;
            } else {
                this.style.borderColor = '';
                this.style.backgroundColor = '';
                
                const avisoElement = document.getElementById('aviso-cnpj-duplicado');
                if (avisoElement) {
                    avisoElement.remove();
                }
            }
        }
    });
}

// ===== ENVIO DE PROPOSTA =====

// Função para coletar todos os dados do formulário
function coletarDados() {
    const dados = {
        protocolo: gerarProtocolo(),
        processo: document.getElementById('processo')?.value || new URLSearchParams(window.location.search).get('processo'),
        dados: {
            razaoSocial: document.getElementById('razaoSocial').value,
            cnpj: document.getElementById('cnpj').value,
            endereco: document.getElementById('endereco').value,
            cidade: document.getElementById('cidade').value,
            telefone: document.getElementById('telefone').value,
            email: document.getElementById('email').value,
            respTecnico: document.getElementById('respTecnico').value,
            crea: document.getElementById('crea').value
        },
        tecnica: {
            objetoConcorrencia: document.getElementById('objetoConcorrencia').value,
            escopoInclusos: document.getElementById('escopoInclusos').value,
            escopoExclusos: document.getElementById('escopoExclusos').value,
            metodologia: document.getElementById('metodologia').value,
            sequenciaExecucao: document.getElementById('sequenciaExecucao').value,
            prazoExecucao: document.getElementById('prazoExecucao').value,
            prazoMobilizacao: document.getElementById('prazoMobilizacao').value,
            garantias: document.getElementById('garantias').value,
            estruturaCanteiro: document.getElementById('estruturaCanteiro').value,
            obrigacoesContratada: document.getElementById('obrigacoesContratada').value,
            obrigacoesContratante: document.getElementById('obrigacoesContratante').value,
            condicoesPremissas: document.getElementById('condicoesPremissas').value,
            experienciaEmpresa: document.getElementById('experienciaEmpresa').value,
            atestadosObras: document.getElementById('atestadosObras').value,
            observacoesFinais: document.getElementById('observacoesFinais').value,
            cronograma: coletarCronograma(),
            equipe: coletarEquipe(),
            materiais: coletarMateriais(),
            equipamentos: coletarEquipamentos()
        },
        comercial: {
            totalServicos: document.getElementById('totalServicos').value,
            totalMaoObra: document.getElementById('totalMaoObra').value,
            totalMateriais: document.getElementById('totalMateriais').value,
            totalEquipamentos: document.getElementById('totalEquipamentos').value,
            bdiPercentual: document.getElementById('bdiPercentual').value,
            validadeProposta: document.getElementById('validadeProposta').value
        },
        resumo: {
            prazoExecucao: document.getElementById('prazoExecucao').value,
            formaPagamento: document.getElementById('formaPagamento').value
        }
    };
    
    return dados;
}

// Função para gerar protocolo único
function gerarProtocolo() {
    const data = new Date();
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    const hora = String(data.getHours()).padStart(2, '0');
    const minuto = String(data.getMinutes()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `PROP-${ano}${mes}${dia}-${hora}${minuto}-${random}`;
}

// Função para enviar proposta com validação
async function enviarPropostaComValidacao() {
    const processoAtual = document.getElementById('processo')?.value || 
                         new URLSearchParams(window.location.search).get('processo');
    
    if (!processoAtual) {
        mostrarMensagem('Por favor, selecione um processo de concorrência', 'error');
        return;
    }
    
    const cnpjInput = document.getElementById('cnpj');
    if (!cnpjInput || !cnpjInput.value) {
        mostrarMensagem('Por favor, informe o CNPJ', 'error');
        return;
    }
    
    // Verificar duplicação via API
    const resultado = await verificarCNPJViaAPI(cnpjInput.value, processoAtual);
    
    if (resultado.duplicado) {
        mostrarMensagem(`
            <strong>❌ CNPJ já cadastrado!</strong><br>
            Este CNPJ já enviou uma proposta para este processo.<br>
            <small>Protocolo anterior: ${resultado.protocolo}</small><br>
            <small>Data: ${new Date(resultado.data).toLocaleString('pt-BR')}</small>
        `, 'error');
        
        cnpjInput.style.borderColor = '#e74c3c';
        cnpjInput.style.backgroundColor = '#ffe6e6';
        cnpjInput.focus();
        
        return;
    }
    
    // Se não há duplicação, continuar com o envio
    enviarProposta();
}

// Função principal de envio
async function enviarProposta() {
    const dados = coletarDados();
    
    mostrarMensagem('Enviando proposta...', 'info');
    
    try {
        const response = await fetch(`${CONFIG.backendUrl}${CONFIG.endpoints.enviarProposta}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(dados)
        });
        
        const resultado = await response.json();
        
        if (resultado.sucesso) {
            mostrarMensagem(`
                <strong>✅ Proposta enviada com sucesso!</strong><br>
                <strong>Protocolo:</strong> ${resultado.protocolo}<br>
                <strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}<br>
                <small>📎 Anexos gerados: ${resultado.anexos.join(', ')}</small>
            `, 'success');
            
            // Salvar no localStorage
            const propostas = JSON.parse(localStorage.getItem('sistema_propostas') || '[]');
            propostas.push({
                protocolo: resultado.protocolo,
                data: new Date().toISOString(),
                empresa: dados.dados.razaoSocial,
                cnpj: dados.dados.cnpj,
                valor: dados.comercial.valorTotal,
                processo: dados.processo,
                dadosCompletos: dados
            });
            localStorage.setItem('sistema_propostas', JSON.stringify(propostas));
            
            // Limpar formulário após 5 segundos
            setTimeout(() => {
                if (confirm('Deseja criar uma nova proposta?')) {
                    localStorage.removeItem('proposta_atual');
                    window.location.reload();
                }
            }, 5000);
        } else {
            mostrarMensagem(`<strong>❌ Erro:</strong> ${resultado.erro}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao enviar:', error);
        mostrarMensagem('Erro ao conectar com o servidor', 'error');
    }
}

// Função para mostrar mensagens
function mostrarMensagem(texto, tipo) {
    const mensagemDiv = document.getElementById('mensagem');
    if (!mensagemDiv) return;
    
    mensagemDiv.className = tipo === 'error' ? 'error-message' : 
                           tipo === 'success' ? 'success-message' : 
                           'info-message';
    mensagemDiv.innerHTML = texto;
    mensagemDiv.style.display = 'block';
    
    if (tipo === 'success' || tipo === 'error') {
        setTimeout(() => {
            mensagemDiv.style.display = 'none';
        }, 10000);
    }
}

// ===== FUNÇÕES AUXILIARES DE COLETA =====

function coletarCronograma() {
    const tbody = document.querySelector('#cronogramaTable tbody');
    if (!tbody) return [];
    
    const cronograma = [];
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('input');
        if (cells.length >= 4 && cells[0].value) {
            cronograma.push([
                cells[0].value,
                cells[1].value,
                cells[2].value,
                cells[3].value
            ]);
        }
    });
    
    return cronograma;
}

function coletarEquipe() {
    const tbody = document.querySelector('#equipeTable tbody');
    if (!tbody) return [];
    
    const equipe = [];
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('input');
        if (cells.length >= 5 && cells[1].value) {
            equipe.push([
                cells[0].value,
                cells[1].value,
                cells[2].value,
                cells[3].value,
                cells[4].value
            ]);
        }
    });
    
    return equipe;
}

function coletarMateriais() {
    const tbody = document.querySelector('#materiaisTable tbody');
    if (!tbody) return [];
    
    const materiais = [];
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('input');
        if (cells.length >= 4 && cells[0].value) {
            materiais.push([
                cells[0].value,
                cells[1].value,
                cells[2].value,
                cells[3].value
            ]);
        }
    });
    
    return materiais;
}

function coletarEquipamentos() {
    const tbody = document.querySelector('#equipamentosTable tbody');
    if (!tbody) return [];
    
    const equipamentos = [];
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('input');
        if (cells.length >= 4 && cells[0].value) {
            equipamentos.push([
                cells[0].value,
                cells[1].value,
                cells[2].value,
                cells[3].value
            ]);
        }
    });
    
    return equipamentos;
}

// ===== INICIALIZAÇÃO =====

document.addEventListener('DOMContentLoaded', function() {
    // Adicionar validação ao campo CNPJ
    adicionarValidacaoCNPJ();
    
    // Adicionar listeners para cálculos
    const inputs = [
        'totalServicos', 'totalMaoObra', 'totalMateriais', 
        'totalEquipamentos', 'bdiPercentual'
    ];
    
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', calcularTotais);
            input.addEventListener('blur', calcularTotais);
        }
    });
    
    // Inicializar cronograma se não houver linhas
    const tbody = document.querySelector('#cronogramaTable tbody');
    if (tbody && tbody.rows.length === 0) {
        addCronogramaRow();
    }
    
    // Substituir botão de enviar se existir
    const btnEnviar = document.querySelector('button[onclick="enviarProposta()"]');
    if (btnEnviar) {
        btnEnviar.setAttribute('onclick', 'enviarPropostaComValidacao()');
    }
    
    // Calcular totais iniciais
    calcularTotais();
    
    // Configurar auto-save
    setInterval(() => {
        const dados = coletarDados();
        localStorage.setItem('proposta_atual', JSON.stringify(dados));
    }, 30000); // A cada 30 segundos
});

// ===== FUNÇÕES GLOBAIS PARA USO NO HTML =====
window.calcularTotais = calcularTotais;
window.calcularCronograma = calcularCronograma;
window.addCronogramaRow = addCronogramaRow;
window.removeRowAndRecalculate = removeRowAndRecalculate;
window.enviarPropostaComValidacao = enviarPropostaComValidacao;
window.verificarCNPJDuplicado = verificarCNPJDuplicado;