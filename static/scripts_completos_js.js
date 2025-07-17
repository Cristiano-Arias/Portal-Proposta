// ========================================
// SCRIPTS COMPLETOS PARA O SISTEMA DE PROPOSTAS - CORRIGIDOS
// ========================================

// ===== CONFIGURAÇÕES GLOBAIS =====
const CONFIG = {
    backendUrl: window.location.origin,
    endpoints: {
        enviarProposta: '/api/enviar-proposta',
        verificarCnpj: '/api/verificar-cnpj',
        listarPropostas: '/api/propostas/listar',
        status: '/api/status',
        cadastrarFornecedor: '/api/cadastrar-fornecedor',
        cadastrarComprador: '/api/cadastrar-comprador',
        login: '/api/login',
        logout: '/api/logout'
    }
};

// ===== CRONOGRAMA AUTOMÁTICO - IMPLEMENTAÇÃO COMPLETA =====

/**
 * Adiciona uma nova linha ao cronograma com cálculo automático
 */
function addCronogramaRow() {
    const tbody = document.querySelector('#cronogramaTable tbody');
    if (!tbody) return;
    
    const newRow = tbody.insertRow();
    const rowCount = tbody.rows.length;
    
    newRow.innerHTML = `
        <td><input type="text" placeholder="Atividade ${rowCount}" class="atividade-input"></td>
        <td><input type="number" placeholder="10" min="1" class="duracao-input" onchange="calcularCronograma()"></td>
        <td><input type="text" readonly class="inicio-calculado" style="background: #f8f9fa;"></td>
        <td><input type="text" readonly class="fim-calculado" style="background: #f8f9fa;"></td>
        <td><button type="button" class="remove-btn" onclick="removeRowAndRecalculate(this, 'cronograma')">×</button></td>
    `;
    
    // Recalcular cronograma após adicionar linha
    calcularCronograma();
}

/**
 * Remove linha e recalcula cronograma
 */
function removeRowAndRecalculate(button, type) {
    const row = button.closest('tr');
    row.remove();
    
    if (type === 'cronograma') {
        calcularCronograma();
    } else {
        calcularTotais();
    }
}

/**
 * Função principal para calcular cronograma automaticamente
 * Calcula datas de início e fim baseado apenas na duração em dias
 */
function calcularCronograma() {
    const tbody = document.querySelector('#cronogramaTable tbody');
    if (!tbody) return;
    
    const rows = tbody.rows;
    let diaAtual = 1;
    let prazoTotalDias = 0;
    
    // Percorrer todas as linhas do cronograma
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const duracaoInput = row.querySelector('.duracao-input');
        const inicioInput = row.querySelector('.inicio-calculado');
        const fimInput = row.querySelector('.fim-calculado');
        
        if (!duracaoInput || !inicioInput || !fimInput) continue;
        
        const duracao = parseInt(duracaoInput.value) || 0;
        
        if (duracao > 0) {
            const diaFim = diaAtual + duracao - 1;
            
            // Atualizar campos calculados
            inicioInput.value = `Dia ${diaAtual}`;
            fimInput.value = `Dia ${diaFim}`;
            
            // Próxima atividade começa no dia seguinte ao fim da atual
            diaAtual = diaFim + 1;
            prazoTotalDias += duracao;
        } else {
            // Limpar campos se duração for inválida
            inicioInput.value = '';
            fimInput.value = '';
        }
    }
    
    // Atualizar prazo total calculado
    const prazoTotalElement = document.getElementById('prazoTotalCronograma');
    if (prazoTotalElement) {
        prazoTotalElement.textContent = prazoTotalDias;
    }
    
    // Atualizar campo principal de prazo de execução
    const prazoExecucaoInput = document.getElementById('prazoExecucao');
    if (prazoExecucaoInput) {
        prazoExecucaoInput.value = `${prazoTotalDias} dias`;
    }
    
    // Disparar evento personalizado para outras partes do sistema
    document.dispatchEvent(new CustomEvent('cronogramaAtualizado', {
        detail: { prazoTotal: prazoTotalDias }
    }));
}

/**
 * Inicializa o cronograma com dados padrão se necessário
 */
function inicializarCronograma() {
    const tbody = document.querySelector('#cronogramaTable tbody');
    if (!tbody) return;
    
    // Se não há linhas, adicionar uma linha padrão
    if (tbody.rows.length === 0) {
        addCronogramaRow();
        
        // Preencher com dados padrão
        const primeiraLinha = tbody.rows[0];
        if (primeiraLinha) {
            const atividadeInput = primeiraLinha.querySelector('.atividade-input');
            const duracaoInput = primeiraLinha.querySelector('.duracao-input');
            
            if (atividadeInput) atividadeInput.value = 'Mobilização';
            if (duracaoInput) duracaoInput.value = '15';
        }
    }
    
    // Calcular cronograma inicial
    calcularCronograma();
}

// ===== FUNÇÕES DE FORMATAÇÃO E CÁLCULO =====

/**
 * Formata valor monetário para exibição
 */
function formatarMoeda(valor) {
    if (!valor && valor !== 0) return '';
    let numero = parseFloat(valor);
    if (isNaN(numero)) return '';
    return numero.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Converte string de moeda para número
 */
function parseMoeda(valor) {
    if (typeof valor === 'number') return valor;
    if (typeof valor === 'string') {
        return parseFloat(valor.replace(/\./g, '').replace(',', '.').replace('R$', '').trim()) || 0;
    }
    return 0;
}

/**
 * Calcula totais comerciais - CORRIGIDO CONFORME SOLICITAÇÃO
 */
function calcularTotais() {
    // Calcular totais de cada categoria
    const totalMaoObra = calcularTotalTabela('maoObraTable');
    const totalMateriais = calcularTotalTabela('materiaisTable');
    const totalEquipamentos = calcularTotalTabela('equipamentosTable');
    
    // CUSTO DIRETO = APENAS (MO + Mat + Equip) - CONFORME SOLICITAÇÃO
    const custoDireto = totalMaoObra + totalMateriais + totalEquipamentos;
    
    // BDI sobre o custo direto
    const bdiPercentualInput = document.getElementById('bdiPercentual');
    const bdiPercentual = parseFloat(bdiPercentualInput?.value) || 0;
    const bdiValor = custoDireto * (bdiPercentual / 100);
    
    // VALOR TOTAL = Custo Direto + BDI (conforme solicitação)
    const valorTotal = custoDireto + bdiValor;
    
    // Atualizar campos na interface
    atualizarCamposCalculados({
        totalMaoObra,
        totalMateriais,
        totalEquipamentos,
        custoDireto,
        bdiPercentual,
        bdiValor,
        valorTotal
    });
}

/**
 * Atualiza campos calculados na interface
 */
function atualizarCamposCalculados(valores) {
    const campos = {
        'totalMaoObra': valores.totalMaoObra,
        'totalMateriais': valores.totalMateriais,
        'totalEquipamentos': valores.totalEquipamentos,
        'custoDirecto': valores.custoDireto,
        'bdiPercentualDisplay': valores.bdiPercentual.toFixed(1),
        'bdiValorDisplay': valores.bdiValor,
        'bdiValor': valores.bdiValor,
        'valorTotalCalculado': valores.valorTotal,
        'valorTotal': valores.valorTotal
    };
    
    Object.entries(campos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) {
            if (id === 'bdiPercentualDisplay') {
                elemento.textContent = valor;
            } else if (id === 'bdiValor' || id === 'valorTotal') {
                elemento.value = 'R$ ' + formatarMoeda(valor);
            } else {
                elemento.textContent = formatarMoeda(valor);
            }
        }
    });
}

/**
 * Calcula total de uma tabela específica
 */
function calcularTotalTabela(tableId) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return 0;
    
    let total = 0;
    
    for (const row of tbody.rows) {
        const quantidadeInput = row.cells[1]?.querySelector('input');
        const valorUnitarioInput = row.cells[2]?.querySelector('input');
        const valorTotalInput = row.cells[3]?.querySelector('input');
        
        if (!quantidadeInput || !valorUnitarioInput || !valorTotalInput) continue;
        
        const quantidade = parseFloat(quantidadeInput.value) || 0;
        const valorUnitario = parseMoeda(valorUnitarioInput.value);
        const valorTotalItem = quantidade * valorUnitario;
        
        // Atualizar campo de valor total da linha
        valorTotalInput.value = formatarMoeda(valorTotalItem);
        total += valorTotalItem;
    }
    
    return total;
}

// ===== GERENCIAMENTO DE TABELAS DINÂMICAS =====

/**
 * Adiciona nova linha a uma tabela
 */
function addRow(tableId) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    
    const newRow = tbody.insertRow();
    
    newRow.innerHTML = `
        <td><input type="text" placeholder="Item" class="item-input"></td>
        <td><input type="number" placeholder="1" min="0" step="0.01" class="quantidade-input" onchange="calcularTotais()"></td>
        <td><input type="text" placeholder="0,00" class="valor-unitario-input" onchange="calcularTotais()"></td>
        <td><input type="text" readonly class="valor-total-input" style="background: #f8f9fa;"></td>
        <td><button type="button" class="remove-btn" onclick="removeRowAndRecalculate(this, 'comercial')">×</button></td>
    `;
    
    // Adicionar formatação de moeda ao campo valor unitário
    const valorUnitarioInput = newRow.querySelector('.valor-unitario-input');
    if (valorUnitarioInput) {
        adicionarFormatacaoMoeda(valorUnitarioInput);
    }
}

/**
 * Adiciona formatação de moeda a um campo
 */
function adicionarFormatacaoMoeda(input) {
    input.addEventListener('blur', function() {
        if (this.value) {
            const valor = parseMoeda(this.value);
            this.value = formatarMoeda(valor);
        }
    });
    
    input.addEventListener('focus', function() {
        // Remove formatação para facilitar edição
        const valor = parseMoeda(this.value);
        if (valor > 0) {
            this.value = valor.toString().replace('.', ',');
        }
    });
}

// ===== VALIDAÇÃO DE CNPJ =====

/**
 * Configura validação de CNPJ duplicado
 */
function configurarValidacaoCNPJ() {
    const cnpjInput = document.getElementById('cnpj');
    const avisoDiv = document.getElementById('aviso-cnpj-duplicado');
    
    if (!cnpjInput || !avisoDiv) return;
    
    cnpjInput.addEventListener('blur', async function() {
        const cnpj = this.value.trim();
        const processoInput = document.getElementById('numeroProcesso');
        const processo = processoInput?.value.trim();
        
        // Limpar aviso anterior
        avisoDiv.textContent = '';
        this.style.borderColor = '';
        
        if (!cnpj || !processo) return;
        
        try {
            const response = await fetch(CONFIG.endpoints.verificarCnpj, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cnpj, processo })
            });
            
            const data = await response.json();
            
            if (data.duplicado) {
                avisoDiv.textContent = `⚠️ Este CNPJ já enviou uma proposta para este processo (Protocolo: ${data.protocolo}).`;
                avisoDiv.style.color = '#e74c3c';
                this.style.borderColor = '#e74c3c';
            }
        } catch (error) {
            console.error("Erro ao verificar CNPJ:", error);
            avisoDiv.textContent = '⚠️ Não foi possível verificar o CNPJ no momento.';
            avisoDiv.style.color = '#f39c12';
        }
    });
}

// ===== COLETA E ENVIO DE DADOS =====

/**
 * Coleta todos os dados do formulário
 */
function coletarDados() {
    return {
        processo: document.getElementById('numeroProcesso')?.value || '',
        objeto: document.getElementById('objetoProcesso')?.value || '',
        dados: coletarDadosEmpresa(),
        tecnica: coletarDadosTecnicos(),
        comercial: coletarDadosComerciais(),
        resumo: coletarResumo()
    };
}

/**
 * Coleta dados da empresa
 */
function coletarDadosEmpresa() {
    return {
        razaoSocial: document.getElementById('razaoSocial')?.value || '',
        cnpj: document.getElementById('cnpj')?.value || '',
        endereco: document.getElementById('endereco')?.value || '',
        telefone: document.getElementById('telefone')?.value || '',
        email: document.getElementById('email')?.value || '',
        respTecnico: document.getElementById('respTecnico')?.value || '',
        crea: document.getElementById('crea')?.value || ''
    };
}

/**
 * Coleta dados técnicos
 */
function coletarDadosTecnicos() {
    return {
        objetoConcorrencia: document.getElementById('objetoConcorrencia')?.value || '',
        escopoInclusos: document.getElementById('escopoInclusos')?.value || '',
        escopoExclusos: document.getElementById('escopoExclusos')?.value || '',
        metodologia: document.getElementById('metodologia')?.value || '',
        cronograma: coletarCronograma(),
        observacoes: document.getElementById('observacoes')?.value || ''
    };
}

/**
 * Coleta dados do cronograma
 */
function coletarCronograma() {
    const tbody = document.querySelector('#cronogramaTable tbody');
    if (!tbody) return [];
    
    const cronograma = [];
    
    for (const row of tbody.rows) {
        const atividade = row.querySelector('.atividade-input')?.value || '';
        const duracao = row.querySelector('.duracao-input')?.value || '';
        const inicio = row.querySelector('.inicio-calculado')?.value || '';
        const fim = row.querySelector('.fim-calculado')?.value || '';
        
        if (atividade && duracao) {
            cronograma.push({ atividade, duracao, inicio, fim });
        }
    }
    
    return cronograma;
}

/**
 * Coleta dados comerciais
 */
function coletarDadosComerciais() {
    return {
        maoObra: coletarTabelaComercial('maoObraTable'),
        materiais: coletarTabelaComercial('materiaisTable'),
        equipamentos: coletarTabelaComercial('equipamentosTable'),
        totalMaoObra: document.getElementById('totalMaoObra')?.textContent || '0,00',
        totalMateriais: document.getElementById('totalMateriais')?.textContent || '0,00',
        totalEquipamentos: document.getElementById('totalEquipamentos')?.textContent || '0,00',
        bdiPercentual: document.getElementById('bdiPercentual')?.value || '0',
        bdiValor: document.getElementById('bdiValor')?.value || 'R$ 0,00',
        validadeProposta: document.getElementById('validadeProposta')?.value || '60 dias',
        validadeDetalhada: document.getElementById('validadeDetalhada')?.value || ''
    };
}

/**
 * Coleta dados de uma tabela comercial
 */
function coletarTabelaComercial(tableId) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return [];
    
    const items = [];
    
    for (const row of tbody.rows) {
        const item = row.querySelector('.item-input')?.value || '';
        const quantidade = row.querySelector('.quantidade-input')?.value || '';
        const valorUnitario = row.querySelector('.valor-unitario-input')?.value || '';
        const valorTotal = row.querySelector('.valor-total-input')?.value || '';
        
        if (item && quantidade && valorUnitario) {
            items.push({ item, quantidade, valorUnitario, valorTotal });
        }
    }
    
    return items;
}

/**
 * Coleta dados do resumo
 */
function coletarResumo() {
    return {
        prazoExecucao: document.getElementById('prazoExecucao')?.value || '',
        valorTotal: document.getElementById('valorTotal')?.value || ''
    };
}

/**
 * Envia proposta para o servidor
 */
async function enviarProposta() {
    const dados = coletarDados();
    
    // Validações básicas
    if (!dados.dados.razaoSocial || !dados.dados.cnpj) {
        alert('Por favor, preencha os campos obrigatórios (Razão Social e CNPJ).');
        showTab('dados');
        return;
    }
    
    if (!dados.processo) {
        alert('Por favor, informe o número do processo.');
        return;
    }
    
    try {
        const response = await fetch(CONFIG.endpoints.enviarProposta, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });
        
        const result = await response.json();
        
        const mensagemDiv = document.getElementById('mensagem');
        if (!mensagemDiv) return;
        
        if (response.ok) {
            mensagemDiv.innerHTML = `
                <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <strong>✅ Proposta enviada com sucesso!</strong><br>
                    Protocolo: <strong>${result.protocolo}</strong><br>
                    Data: ${new Date(result.data_envio).toLocaleString('pt-BR')}
                </div>
            `;
        } else {
            if (result.erro === 'CNPJ_DUPLICADO') {
                mensagemDiv.innerHTML = `
                    <div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 8px; margin-top: 20px;">
                        <strong>⚠️ CNPJ Duplicado</strong><br>
                        ${result.mensagem}
                    </div>
                `;
            } else {
                throw new Error(result.erro || 'Erro desconhecido');
            }
        }
    } catch (error) {
        console.error('Erro ao enviar proposta:', error);
        const mensagemDiv = document.getElementById('mensagem');
        if (mensagemDiv) {
            mensagemDiv.innerHTML = `
                <div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <strong>❌ Erro ao enviar proposta</strong><br>
                    ${error.message}
                </div>
            `;
        }
    }
}

// ===== NAVEGAÇÃO ENTRE ABAS =====

/**
 * Mostra uma aba específica
 */
function showTab(tabName) {
    // Esconder todas as seções
    const sections = document.querySelectorAll('.form-section');
    sections.forEach(section => section.classList.remove('active'));
    
    // Remover classe active de todas as abas
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Mostrar seção selecionada
    const targetSection = document.getElementById(tabName);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Ativar aba selecionada
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // Atualizar progresso
    updateProgress(tabName);
}

/**
 * Atualiza barra de progresso
 */
function updateProgress(currentTab) {
    const progressMap = {
        'dados': 25,
        'tecnica': 50,
        'comercial': 75,
        'revisao': 100
    };
    
    const progress = progressMap[currentTab] || 0;
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressFill) progressFill.style.width = progress + '%';
    if (progressText) progressText.textContent = progress + '%';
}

// ===== INICIALIZAÇÃO =====

/**
 * Inicializa o sistema quando a página carrega
 */
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar cronograma
    inicializarCronograma();
    
    // Configurar validação de CNPJ
    configurarValidacaoCNPJ();
    
    // Calcular totais inicial
    calcularTotais();
    
    // Atualizar progresso inicial
    updateProgress('dados');
    
    // Adicionar formatação de moeda aos campos existentes
    const camposMoeda = document.querySelectorAll('.valor-unitario-input');
    camposMoeda.forEach(campo => {
        adicionarFormatacaoMoeda(campo);
    });
    
    // Adicionar listeners para recálculo automático
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('duracao-input')) {
            calcularCronograma();
        } else if (e.target.classList.contains('quantidade-input') || 
                   e.target.classList.contains('valor-unitario-input') ||
                   e.target.id === 'bdiPercentual') {
            calcularTotais();
        }
    });
    
    console.log('Sistema de propostas inicializado com sucesso!');
});

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.addCronogramaRow = addCronogramaRow;
window.removeRowAndRecalculate = removeRowAndRecalculate;
window.calcularCronograma = calcularCronograma;
window.calcularTotais = calcularTotais;
window.addRow = addRow;
window.showTab = showTab;
window.enviarProposta = enviarProposta;
window.formatarMoeda = formatarMoeda;
window.parseMoeda = parseMoeda;
