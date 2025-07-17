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
            
            diaAtual = diaFim + 1; // Próxima atividade começa no dia seguinte
        } else {
            inicioInput.value = '';
            fimInput.value = '';
        }
    }
    
    // Atualizar prazo total se existir campo
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
    
    // Atualizar campo de prazo total se existir
    const prazoExecucaoInput = document.getElementById('prazoExecucao');
    if (prazoExecucaoInput && prazoTotal > 0) {
        prazoExecucaoInput.value = prazoTotal + ' dias';
    }
}

// Adicionar primeira linha automaticamente ao carregar
document.addEventListener('DOMContentLoaded', function() {
    // Se não houver linhas no cronograma, adicionar uma
    const tbody = document.querySelector('#cronogramaTable tbody');
    if (tbody && tbody.rows.length === 0) {
        addCronogramaRow();
    }
    
    // Adicionar listeners para inputs de duração existentes
    const duracaoInputs = document.querySelectorAll('.duracao-input');
    duracaoInputs.forEach(input => {
        input.addEventListener('change', calcularCronograma);
    });
});

// Função para cálculo do valor total (sem somar automaticamente)
function calcularValorTotal() {
    const valorTotalInput = document.getElementById('valorTotal');
    const totalMaoObraInput = document.getElementById('totalMaoObra');
    const totalMateriaisInput = document.getElementById('totalMateriais');
    const totalEquipamentosInput = document.getElementById('totalEquipamentos');
    
    if (!valorTotalInput) return;
    
    // IMPORTANTE: O valor total NÃO é calculado automaticamente
    // Ele deve ser inserido manualmente pelo usuário
    
    // Se o usuário quiser, pode calcular o custo direto para referência
    if (totalMaoObraInput && totalMateriaisInput && totalEquipamentosInput) {
        const maoObra = parseFloat(totalMaoObraInput.value.replace(/\./g, '').replace(',', '.')) || 0;
        const materiais = parseFloat(totalMateriaisInput.value.replace(/\./g, '').replace(',', '.')) || 0;
        const equipamentos = parseFloat(totalEquipamentosInput.value.replace(/\./g, '').replace(',', '.')) || 0;
        
        const custoDireto = maoObra + materiais + equipamentos;
        
        // Mostrar custo direto em algum lugar para referência (opcional)
        const custoLabel = document.querySelector('label[for="valorTotal"]');
        if (custoLabel && custoDireto > 0) {
            custoLabel.innerHTML = `Valor Total da Proposta <span style="font-size: 12px; color: #666;">(Custo Direto: R$ ${custoDireto.toLocaleString('pt-BR', {minimumFractionDigits: 2})})</span>`;
        }
    }
}

// Função auxiliar para formatar entrada de moeda
function formatarEntradaMoeda(input) {
    let valor = input.value.replace(/\D/g, '');
    
    if (valor.length === 0) {
        input.value = '';
        return;
    }
    
    // Converter para número e formatar
    valor = (parseInt(valor) / 100).toFixed(2);
    valor = valor.replace('.', ',');
    valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    input.value = valor;
}