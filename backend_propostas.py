#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from datetime import datetime
import json
import os
import uuid
import logging
from io import BytesIO
import base64

# Imports para geração de documentos
try:
    from docx import Document
    from docx.shared import Inches, Pt
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False
    print("python-docx não instalado. Funcionalidade Word limitada.")

try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    EXCEL_AVAILABLE = True
except ImportError:
    EXCEL_AVAILABLE = False
    print("openpyxl não instalado. Funcionalidade Excel limitada.")

# Configuração do Flask
app = Flask(__name__, static_folder='static', static_url_path='')
app.config['JSON_AS_ASCII'] = False
app.config['JSONIFY_MIMETYPE'] = 'application/json; charset=utf-8'
CORS(app, origins=["*"], allow_headers=["Content-Type"], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('propostas.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Diretórios
PROPOSTAS_DIR = 'propostas'
UPLOADS_DIR = 'uploads'
for directory in [PROPOSTAS_DIR, UPLOADS_DIR]:
    if not os.path.exists(directory):
        os.makedirs(directory)

# Base de dados em memória
propostas_db = {}
processos_db = {}

def salvar_proposta_arquivo(proposta_id, proposta_data):
    """Salva a proposta em arquivo JSON"""
    try:
        filename = os.path.join(PROPOSTAS_DIR, f'proposta_{proposta_id}.json')
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(proposta_data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"Erro ao salvar proposta: {str(e)}")
        return False

def carregar_propostas():
    """Carrega todas as propostas do diretório"""
    try:
        for filename in os.listdir(PROPOSTAS_DIR):
            if filename.endswith('.json'):
                filepath = os.path.join(PROPOSTAS_DIR, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    proposta = json.load(f)
                    propostas_db[proposta['id']] = proposta
    except Exception as e:
        logger.error(f"Erro ao carregar propostas: {str(e)}")

def calcular_totais_comerciais(dados):
    """Calcula totais da proposta comercial"""
    try:
        comercial = dados.get('comercial', {})
        
        # Converter valores string para float
        def str_to_float(value):
            if isinstance(value, str):
                return float(value.replace('.', '').replace(',', '.').replace('R$', '').strip())
            return float(value or 0)
        
        servicos = str_to_float(comercial.get('totalServicos', 0))
        mao_obra = str_to_float(comercial.get('totalMaoObra', 0))
        materiais = str_to_float(comercial.get('totalMateriais', 0))
        equipamentos = str_to_float(comercial.get('totalEquipamentos', 0))
        
        custo_direto = servicos + mao_obra + materiais + equipamentos
        
        bdi_percentual = float(comercial.get('bdiPercentual', 0))
        bdi_valor = custo_direto * (bdi_percentual / 100)
        
        valor_total = custo_direto + bdi_valor
        
        # Formatar valores para exibição
        def format_currency(value):
            return f"R$ {value:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        
        return {
            'servicos': format_currency(servicos),
            'mao_obra': format_currency(mao_obra),
            'materiais': format_currency(materiais),
            'equipamentos': format_currency(equipamentos),
            'custo_direto': format_currency(custo_direto),
            'bdi_percentual': f"{bdi_percentual:.1f}",
            'bdi_valor': format_currency(bdi_valor),
            'valor_total': format_currency(valor_total),
            'valor_total_num': valor_total
        }
    except Exception as e:
        logger.error(f"Erro ao calcular totais: {str(e)}")
        return {
            'servicos': 'R$ 0,00',
            'mao_obra': 'R$ 0,00',
            'materiais': 'R$ 0,00',
            'equipamentos': 'R$ 0,00',
            'custo_direto': 'R$ 0,00',
            'bdi_percentual': '0',
            'bdi_valor': 'R$ 0,00',
            'valor_total': 'R$ 0,00',
            'valor_total_num': 0
        }

def gerar_word_proposta(dados, protocolo):
    """Gera documento Word da proposta"""
    if not DOCX_AVAILABLE:
        return None
        
    try:
        doc = Document()
        
        # Título
        titulo = doc.add_heading(f'PROPOSTA TÉCNICA E COMERCIAL', 0)
        titulo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # Protocolo
        p = doc.add_paragraph()
        p.add_run(f'Protocolo: {protocolo}').bold = True
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # 1. DADOS DA EMPRESA
        doc.add_heading('1. DADOS DA EMPRESA', level=1)
        
        table = doc.add_table(rows=8, cols=2)
        table.style = 'Light Grid Accent 1'
        
        dados_empresa = [
            ('Razão Social:', dados.get('dados', {}).get('razaoSocial', '')),
            ('CNPJ:', dados.get('dados', {}).get('cnpj', '')),
            ('Endereço:', dados.get('dados', {}).get('endereco', '')),
            ('Telefone:', dados.get('dados', {}).get('telefone', '')),
            ('E-mail:', dados.get('dados', {}).get('email', '')),
            ('Responsável Técnico:', dados.get('dados', {}).get('respTecnico', '')),
            ('CREA/CAU:', dados.get('dados', {}).get('crea', '')),
            ('Validade Proposta:', dados.get('comercial', {}).get('validadeProposta', '60 dias'))
        ]
        
        for i, (label, value) in enumerate(dados_empresa):
            table.cell(i, 0).text = label
            table.cell(i, 1).text = value
        
        # 2. OBJETO DA CONCORRÊNCIA
        doc.add_page_break()
        doc.add_heading('2. OBJETO DA CONCORRÊNCIA', level=1)
        doc.add_paragraph(dados.get('tecnica', {}).get('objetoConcorrencia', ''))
        
        # 3. ESCOPO DOS SERVIÇOS
        doc.add_heading('3. ESCOPO DOS SERVIÇOS', level=1)
        
        doc.add_heading('3.1 Serviços Inclusos', level=2)
        escopo_inclusos = dados.get('tecnica', {}).get('escopoInclusos', '')
        if escopo_inclusos:
            for item in escopo_inclusos.split('\n'):
                if item.strip():
                    doc.add_paragraph(f'• {item.strip()}', style='List Bullet')
        
        doc.add_heading('3.2 Serviços Excluídos', level=2)
        escopo_excluidos = dados.get('tecnica', {}).get('escopoExclusos', '')
        if escopo_excluidos:
            doc.add_paragraph(escopo_excluidos)
        
        # 4. METODOLOGIA
        doc.add_heading('4. METODOLOGIA DE EXECUÇÃO', level=1)
        doc.add_paragraph(dados.get('tecnica', {}).get('metodologia', ''))
        
        # 5. PRAZO
        doc.add_heading('5. PRAZO DE EXECUÇÃO', level=1)
        doc.add_paragraph(f"Prazo total: {dados.get('resumo', {}).get('prazoExecucao', 'Não informado')}")
        
        # 6. VALOR DA PROPOSTA
        doc.add_heading('6. VALOR DA PROPOSTA', level=1)
        totais = calcular_totais_comerciais(dados)
        doc.add_paragraph(f"Valor Total: {totais['valor_total']}", style='Heading 2')
        
        # Salvar em memória
        word_buffer = BytesIO()
        doc.save(word_buffer)
        word_buffer.seek(0)
        
        return word_buffer
    except Exception as e:
        logger.error(f"Erro ao gerar Word: {str(e)}")
        return None

def gerar_excel_proposta(dados, protocolo):
    """Gera planilha Excel da proposta"""
    if not EXCEL_AVAILABLE:
        return None
        
    try:
        wb = Workbook()
        
        # Estilos
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        
        # Aba Resumo
        ws = wb.active
        ws.title = "Resumo"
        
        ws['A1'] = f"PROPOSTA {protocolo}"
        ws['A1'].font = Font(bold=True, size=16)
        
        # Dados da empresa
        ws['A3'] = "DADOS DA EMPRESA"
        ws['A3'].font = Font(bold=True)
        ws['A4'] = "Razão Social:"
        ws['B4'] = dados.get('dados', {}).get('razaoSocial', '')
        ws['A5'] = "CNPJ:"
        ws['B5'] = dados.get('dados', {}).get('cnpj', '')
        
        # Valores
        ws['A7'] = "RESUMO FINANCEIRO"
        ws['A7'].font = Font(bold=True)
        
        totais = calcular_totais_comerciais(dados)
        ws['A8'] = "Valor Total:"
        ws['B8'] = totais['valor_total']
        ws['B8'].font = Font(bold=True)
        
        # Salvar em memória
        excel_buffer = BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)
        
        return excel_buffer
    except Exception as e:
        logger.error(f"Erro ao gerar Excel: {str(e)}")
        return None

# Carrega propostas ao iniciar
carregar_propostas()

# ROTAS DA API

@app.route('/', methods=['GET'])
def home():
    """Serve o arquivo HTML principal ou info da API"""
    if os.path.exists(os.path.join('static', 'index.html')):
        return send_from_directory('static', 'index.html')
    else:
        return jsonify({
            "message": "Servidor de propostas funcionando - UTF-8 CORRIGIDO",
            "status": "online",
            "endpoints": [
                "/api/enviar-proposta",
                "/api/status",
                "/api/propostas/<id>",
                "/api/propostas/listar",
                "/api/processos/listar",
                "/api/download/<tipo>/<id>"
            ]
        }), 200

@app.route('/api/status', methods=['GET'])
@app.route('/status', methods=['GET'])
def api_status():
    """Status do servidor"""
    return jsonify({
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "propostas_total": len(propostas_db),
        "processos_total": len(processos_db),
        "encoding": "UTF-8",
        "versao": "1.0.0",
        "mail_configured": os.environ.get('EMAIL_USER') is not None
    }), 200

@app.route('/api/enviar-proposta', methods=['POST', 'OPTIONS'])
@app.route('/enviar-proposta', methods=['POST', 'OPTIONS'])
def enviar_proposta():
    """Recebe e processa uma nova proposta"""
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        dados = request.get_json(force=True)
        logger.info(f"Recebendo proposta: {dados.get('protocolo')}")
        
        # Gera ID único
        proposta_id = str(uuid.uuid4())
        
        # Estrutura completa da proposta
        proposta = {
            "id": proposta_id,
            "protocolo": dados.get('protocolo', f'PROP-{datetime.now().strftime("%Y%m%d%H%M%S")}'),
            "data_criacao": datetime.now().isoformat(),
            "status": "recebida",
            "dados_empresa": dados.get('dados', {}),
            "proposta_tecnica": dados.get('tecnica', {}),
            "proposta_comercial": dados.get('comercial', {}),
            "resumo": dados.get('resumo', {}),
            "processo": dados.get('processo', ''),
            "anexos": []
        }
        
        # Calcular totais
        totais = calcular_totais_comerciais(dados)
        proposta['totais_calculados'] = totais
        
        # Gerar documentos
        anexos = []
        
        # Gerar Word
        word_buffer = gerar_word_proposta(dados, proposta['protocolo'])
        if word_buffer:
            word_filename = f"proposta_{proposta['protocolo']}.docx"
            word_path = os.path.join(UPLOADS_DIR, word_filename)
            with open(word_path, 'wb') as f:
                f.write(word_buffer.getvalue())
            anexos.append({
                "tipo": "word",
                "nome": word_filename,
                "caminho": word_path
            })
        
        # Gerar Excel
        excel_buffer = gerar_excel_proposta(dados, proposta['protocolo'])
        if excel_buffer:
            excel_filename = f"proposta_{proposta['protocolo']}.xlsx"
            excel_path = os.path.join(UPLOADS_DIR, excel_filename)
            with open(excel_path, 'wb') as f:
                f.write(excel_buffer.getvalue())
            anexos.append({
                "tipo": "excel",
                "nome": excel_filename,
                "caminho": excel_path
            })
        
        proposta['anexos'] = anexos
        
        # Salvar proposta
        propostas_db[proposta_id] = proposta
        salvar_proposta_arquivo(proposta_id, proposta)
        
        return jsonify({
            "sucesso": True,
            "mensagem": "Proposta enviada com sucesso",
            "proposta_id": proposta_id,
            "protocolo": proposta['protocolo'],
            "anexos": [a['nome'] for a in anexos]
        }), 201
        
    except Exception as e:
        logger.error(f"Erro ao processar proposta: {str(e)}")
        return jsonify({
            "sucesso": False,
            "erro": "Erro ao processar proposta",
            "detalhes": str(e)
        }), 500

@app.route('/api/propostas/<proposta_id>', methods=['GET'])
def obter_proposta(proposta_id):
    """Obtém uma proposta específica"""
    if proposta_id in propostas_db:
        return jsonify(propostas_db[proposta_id]), 200
    else:
        return jsonify({"erro": "Proposta não encontrada"}), 404

@app.route('/api/propostas/listar', methods=['GET'])
def listar_propostas():
    """Lista todas as propostas com paginação"""
    try:
        pagina = int(request.args.get('pagina', 1))
        por_pagina = int(request.args.get('por_pagina', 10))
        filtro_processo = request.args.get('processo', '')
        
        # Filtrar propostas
        propostas_lista = list(propostas_db.values())
        
        if filtro_processo:
            propostas_lista = [p for p in propostas_lista if filtro_processo.lower() in p.get('processo', '').lower()]
        
        # Ordenar por data
        propostas_lista.sort(key=lambda x: x['data_criacao'], reverse=True)
        
        # Paginação
        inicio = (pagina - 1) * por_pagina
        fim = inicio + por_pagina
        propostas_pagina = propostas_lista[inicio:fim]
        
        # Preparar resposta simplificada
        propostas_resumo = []
        for p in propostas_pagina:
            propostas_resumo.append({
                "id": p['id'],
                "protocolo": p['protocolo'],
                "empresa": p['dados_empresa'].get('razaoSocial', 'Não informado'),
                "cnpj": p['dados_empresa'].get('cnpj', ''),
                "valor": p.get('totais_calculados', {}).get('valor_total', 'R$ 0,00'),
                "data": p['data_criacao'],
                "status": p['status'],
                "processo": p.get('processo', '')
            })
        
        return jsonify({
            "propostas": propostas_resumo,
            "total": len(propostas_lista),
            "pagina": pagina,
            "por_pagina": por_pagina,
            "total_paginas": (len(propostas_lista) + por_pagina - 1) // por_pagina
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao listar propostas: {str(e)}")
        return jsonify({"erro": "Erro ao listar propostas"}), 500

@app.route('/api/processos/listar', methods=['GET'])
def listar_processos():
    """Lista todos os processos únicos das propostas"""
    try:
        processos = set()
        for proposta in propostas_db.values():
            processo = proposta.get('processo', '')
            if processo:
                processos.add(processo)
        
        return jsonify({
            "processos": sorted(list(processos)),
            "total": len(processos)
        }), 200
    except Exception as e:
        logger.error(f"Erro ao listar processos: {str(e)}")
        return jsonify({"erro": "Erro ao listar processos"}), 500

@app.route('/api/download/<tipo>/<proposta_id>', methods=['GET'])
def download_arquivo(tipo, proposta_id):
    """Download de arquivos anexos"""
    try:
        if proposta_id not in propostas_db:
            return jsonify({"erro": "Proposta não encontrada"}), 404
        
        proposta = propostas_db[proposta_id]
        
        # Procurar arquivo do tipo solicitado
        for anexo in proposta.get('anexos', []):
            if anexo['tipo'] == tipo and os.path.exists(anexo['caminho']):
                return send_from_directory(
                    os.path.dirname(anexo['caminho']),
                    os.path.basename(anexo['caminho']),
                    as_attachment=True,
                    download_name=anexo['nome']
                )
        
        return jsonify({"erro": f"Arquivo {tipo} não encontrado"}), 404
        
    except Exception as e:
        logger.error(f"Erro ao fazer download: {str(e)}")
        return jsonify({"erro": "Erro ao processar download"}), 500

@app.route('/api/propostas/<proposta_id>', methods=['PUT'])
def atualizar_proposta(proposta_id):
    """Atualiza o status de uma proposta"""
    try:
        if proposta_id not in propostas_db:
            return jsonify({"erro": "Proposta não encontrada"}), 404
        
        data = request.get_json()
        
        # Atualizar campos permitidos
        campos_atualizaveis = ['status', 'observacoes']
        for campo in campos_atualizaveis:
            if campo in data:
                propostas_db[proposta_id][campo] = data[campo]
        
        propostas_db[proposta_id]['data_atualizacao'] = datetime.now().isoformat()
        
        # Salvar alterações
        if salvar_proposta_arquivo(proposta_id, propostas_db[proposta_id]):
            return jsonify({
                "mensagem": "Proposta atualizada com sucesso",
                "proposta": propostas_db[proposta_id]
            }), 200
        else:
            return jsonify({"erro": "Erro ao salvar alterações"}), 500
            
    except Exception as e:
        logger.error(f"Erro ao atualizar proposta: {str(e)}")
        return jsonify({"erro": "Erro ao atualizar proposta"}), 500

# Servir arquivos estáticos
@app.route('/<path:path>')
def serve_static(path):
    """Serve arquivos estáticos da pasta static"""
    if os.path.exists(os.path.join('static', path)):
        return send_from_directory('static', path)
    else:
        return jsonify({"erro": "Arquivo não encontrado"}), 404

@app.errorhandler(404)
def nao_encontrado(e):
    return jsonify({"erro": "Endpoint não encontrado"}), 404

@app.errorhandler(500)
def erro_interno(e):
    return jsonify({"erro": "Erro interno do servidor"}), 500

if __name__ == '__main__':
    logger.info("Iniciando servidor de propostas...")
    # Configuração para Render
    port = int(os.environ.get('PORT', 5000))
    app.run(
        host='0.0.0.0',
        port=port,
        debug=False
    )