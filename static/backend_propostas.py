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
usuarios_db = {}  # Para cadastro de fornecedores
compradores_db = {}  # Para cadastro de compradores

def salvar_json(db, filename):
    """Salva um banco de dados em memória para um arquivo JSON."""
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(db, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"Erro ao salvar {filename}: {str(e)}")
        return False

def carregar_json(filename):
    """Carrega um arquivo JSON para um banco de dados em memória."""
    if os.path.exists(filename):
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Erro ao carregar {filename}: {str(e)}")
    return {}

def salvar_proposta_arquivo(proposta_id, proposta_data):
    """Salva a proposta em arquivo JSON"""
    return salvar_json({proposta_id: proposta_data}, os.path.join(PROPOSTAS_DIR, f'proposta_{proposta_id}.json'))

def carregar_propostas():
    """Carrega todas as propostas do diretório"""
    global propostas_db
    try:
        for filename in os.listdir(PROPOSTAS_DIR):
            if filename.endswith('.json'):
                proposta = carregar_json(os.path.join(PROPOSTAS_DIR, filename))
                propostas_db.update(proposta)
    except Exception as e:
        logger.error(f"Erro ao carregar propostas: {str(e)}")

def calcular_totais_comerciais(dados):
    """Calcula totais da proposta comercial - CORRIGIDO CONFORME SOLICITAÇÃO"""
    try:
        comercial = dados.get('comercial', {})
        
        # Converter valores string para float
        def str_to_float(value):
            if isinstance(value, str):
                return float(value.replace('.', '').replace(',', '.').replace('R$', '').strip() or '0')
            return float(value or 0)
        
        # CUSTO DIRETO = APENAS Mão de Obra + Materiais + Equipamentos (SEM SERVIÇOS)
        mao_obra = str_to_float(comercial.get('totalMaoObra', 0))
        materiais = str_to_float(comercial.get('totalMateriais', 0))
        equipamentos = str_to_float(comercial.get('totalEquipamentos', 0))
        
        custo_direto = mao_obra + materiais + equipamentos
        
        bdi_percentual = float(comercial.get('bdiPercentual', 0))
        bdi_valor = custo_direto * (bdi_percentual / 100)
        
        # VALOR TOTAL = Custo Direto + BDI (conforme solicitado)
        valor_total = custo_direto + bdi_valor
        
        # Formatar valores para exibição
        def format_currency(value):
            return f"R$ {value:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        
        return {
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
            'mao_obra': 'R$ 0,00',
            'materiais': 'R$ 0,00',
            'equipamentos': 'R$ 0,00',
            'custo_direto': 'R$ 0,00',
            'bdi_percentual': '0.0',
            'bdi_valor': 'R$ 0,00',
            'valor_total': 'R$ 0,00',
            'valor_total_num': 0
        }

def gerar_word_proposta(dados, protocolo):
    """Gera documento Word da proposta - COMPLETO COM TODAS AS INFORMAÇÕES"""
    if not DOCX_AVAILABLE:
        return None
        
    try:
        doc = Document()
        
        # Configurar margens
        sections = doc.sections
        for section in sections:
            section.top_margin = Inches(1)
            section.bottom_margin = Inches(1)
            section.left_margin = Inches(1)
            section.right_margin = Inches(1)
        
        # Título e Protocolo
        title = doc.add_heading('PROPOSTA TÉCNICA E COMERCIAL', 0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        protocolo_para = doc.add_paragraph(f'Protocolo: {protocolo}')
        protocolo_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        protocolo_para.style = 'Intense Quote'
        
        doc.add_page_break()
        
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
        
        # 5. CRONOGRAMA
        doc.add_heading('5. CRONOGRAMA DE EXECUÇÃO', level=1)
        cronograma = dados.get('tecnica', {}).get('cronograma', [])
        if cronograma:
            cronograma_table = doc.add_table(rows=1, cols=4)
            cronograma_table.style = 'Light Grid Accent 1'
            hdr_cells = cronograma_table.rows[0].cells
            hdr_cells[0].text = 'Atividade'
            hdr_cells[1].text = 'Duração (dias)'
            hdr_cells[2].text = 'Início'
            hdr_cells[3].text = 'Fim'
            
            for atividade in cronograma:
                row_cells = cronograma_table.add_row().cells
                row_cells[0].text = atividade.get('atividade', '')
                row_cells[1].text = str(atividade.get('duracao', ''))
                row_cells[2].text = atividade.get('inicio', '')
                row_cells[3].text = atividade.get('fim', '')
        
        # 6. PRAZO
        doc.add_heading('6. PRAZO DE EXECUÇÃO', level=1)
        doc.add_paragraph(f"Prazo total: {dados.get('resumo', {}).get('prazoExecucao', 'Não informado')}")
        
        # 7. VALOR DA PROPOSTA
        doc.add_heading('7. VALOR DA PROPOSTA', level=1)
        totais = calcular_totais_comerciais(dados)
        
        valor_table = doc.add_table(rows=4, cols=2)
        valor_table.style = 'Light Grid Accent 1'
        
        valor_items = [
            ('Custo Direto (MO + Mat + Equip):', totais.get('custo_direto', 'R$ 0,00')),
            ('BDI (%):', f"{totais.get('bdi_percentual', '0.0')}%"),
            ('Valor BDI:', totais.get('bdi_valor', 'R$ 0,00')),
            ('VALOR TOTAL DA PROPOSTA:', totais.get('valor_total', 'R$ 0,00'))
        ]
        
        for i, (label, value) in enumerate(valor_items):
            valor_table.cell(i, 0).text = label
            valor_table.cell(i, 1).text = value
            if i == 3:  # Última linha em negrito
                for cell in valor_table.rows[i].cells:
                    for paragraph in cell.paragraphs:
                        for run in paragraph.runs:
                            run.font.bold = True
        
        # 8. CONDIÇÕES (NOME ALTERADO CONFORME SOLICITAÇÃO)
        doc.add_heading('8. CONDIÇÕES', level=1)
        doc.add_paragraph(f"Validade da Proposta: {dados.get('comercial', {}).get('validadeProposta', '60 dias')}")
        
        condicoes_adicionais = dados.get('comercial', {}).get('validadeDetalhada', '')
        if condicoes_adicionais:
            doc.add_paragraph(condicoes_adicionais)
        
        # 9. OBSERVAÇÕES GERAIS
        doc.add_heading('9. OBSERVAÇÕES GERAIS', level=1)
        observacoes = dados.get('tecnica', {}).get('observacoes', '')
        if observacoes:
            doc.add_paragraph(observacoes)
        
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
        ws = wb.active
        ws.title = "Proposta Comercial"
        
        # Cabeçalho
        ws['A1'] = 'PROPOSTA COMERCIAL'
        ws['A1'].font = Font(size=16, bold=True)
        ws['A2'] = f'Protocolo: {protocolo}'
        
        # Dados da empresa
        ws['A4'] = 'DADOS DA EMPRESA'
        ws['A4'].font = Font(bold=True)
        
        empresa_data = [
            ['Razão Social:', dados.get('dados', {}).get('razaoSocial', '')],
            ['CNPJ:', dados.get('dados', {}).get('cnpj', '')],
            ['Endereço:', dados.get('dados', {}).get('endereco', '')],
            ['Telefone:', dados.get('dados', {}).get('telefone', '')],
            ['E-mail:', dados.get('dados', {}).get('email', '')]
        ]
        
        for i, (label, value) in enumerate(empresa_data, start=5):
            ws[f'A{i}'] = label
            ws[f'B{i}'] = value
        
        # Valores comerciais
        ws['A12'] = 'VALORES COMERCIAIS'
        ws['A12'].font = Font(bold=True)
        
        totais = calcular_totais_comerciais(dados)
        
        valores_data = [
            ['Mão de Obra:', totais.get('mao_obra', 'R$ 0,00')],
            ['Materiais:', totais.get('materiais', 'R$ 0,00')],
            ['Equipamentos:', totais.get('equipamentos', 'R$ 0,00')],
            ['Custo Direto:', totais.get('custo_direto', 'R$ 0,00')],
            ['BDI (%):', f"{totais.get('bdi_percentual', '0.0')}%"],
            ['Valor BDI:', totais.get('bdi_valor', 'R$ 0,00')],
            ['VALOR TOTAL:', totais.get('valor_total', 'R$ 0,00')]
        ]
        
        for i, (label, value) in enumerate(valores_data, start=13):
            ws[f'A{i}'] = label
            ws[f'B{i}'] = value
            if i == 19:  # Última linha
                ws[f'A{i}'].font = Font(bold=True)
                ws[f'B{i}'].font = Font(bold=True)
        
        # Salvar em memória
        excel_buffer = BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)
        
        return excel_buffer
    except Exception as e:
        logger.error(f"Erro ao gerar Excel: {str(e)}")
        return None

# Carrega dados ao iniciar
carregar_propostas()
usuarios_db = carregar_json('usuarios.json')
compradores_db = carregar_json('compradores.json')
processos_db = carregar_json('processos.json')

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
                "/api/download/<tipo>/<id>",
                "/api/verificar-cnpj",
                "/api/cadastrar-fornecedor",
                "/api/cadastrar-comprador"
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
        "usuarios_total": len(usuarios_db),
        "compradores_total": len(compradores_db),
        "encoding": "UTF-8",
        "versao": "1.0.1"
    }), 200

# NOVA ROTA: Verificar CNPJ duplicado por processo
@app.route('/api/verificar-cnpj', methods=['POST'])
def verificar_cnpj():
    """Verifica se um CNPJ já enviou proposta para um processo específico"""
    try:
        dados = request.get_json()
        cnpj = dados.get('cnpj', '').strip()
        processo = dados.get('processo', '').strip()
        
        if not cnpj or not processo:
            return jsonify({"erro": "CNPJ e Processo são obrigatórios"}), 400
        
        # Verificar se já existe proposta com este CNPJ para este processo
        for proposta_id, proposta in propostas_db.items():
            proposta_cnpj = proposta.get('dados', {}).get('cnpj', '').strip()
            proposta_processo = proposta.get('processo', '').strip()
            
            if proposta_cnpj == cnpj and proposta_processo == processo:
                return jsonify({
                    "duplicado": True,
                    "protocolo": proposta.get('protocolo'),
                    "data_envio": proposta.get('data_criacao'),
                    "mensagem": f"Este CNPJ já enviou uma proposta para este processo (Protocolo: {proposta.get('protocolo')})"
                }), 200
        
        return jsonify({"duplicado": False}), 200
        
    except Exception as e:
        logger.error(f"Erro ao verificar CNPJ: {str(e)}")
        return jsonify({"erro": "Erro interno do servidor"}), 500

# NOVA ROTA: Cadastrar fornecedor
@app.route('/api/cadastrar-fornecedor', methods=['POST'])
def cadastrar_fornecedor():
    """Cadastra um novo fornecedor no sistema"""
    try:
        dados = request.get_json()
        email = dados.get('email', '').strip().lower()
        
        if not email:
            return jsonify({"sucesso": False, "erro": "E-mail é obrigatório"}), 400
        
        if email in usuarios_db:
            return jsonify({"sucesso": False, "erro": "E-mail já cadastrado"}), 409
        
        # Criar novo usuário fornecedor
        user_id = str(uuid.uuid4())
        usuarios_db[email] = {
            "id": user_id,
            "tipo": "fornecedor",
            "email": email,
            "razao_social": dados.get('razaoSocial', ''),
            "cnpj": dados.get('cnpj', ''),
            "telefone": dados.get('telefone', ''),
            "endereco": dados.get('endereco', ''),
            "responsavel": dados.get('responsavel', ''),
            "data_cadastro": datetime.now().isoformat(),
            "ativo": True
        }
        
        # Salvar no arquivo
        salvar_json(usuarios_db, 'usuarios.json')
        
        logger.info(f"Fornecedor cadastrado: {email}")
        return jsonify({"sucesso": True, "mensagem": "Fornecedor cadastrado com sucesso!"}), 201
        
    except Exception as e:
        logger.error(f"Erro ao cadastrar fornecedor: {str(e)}")
        return jsonify({"sucesso": False, "erro": "Erro interno do servidor"}), 500

# NOVA ROTA: Cadastrar comprador
@app.route('/api/cadastrar-comprador', methods=['POST'])
def cadastrar_comprador():
    """Cadastra um novo comprador no sistema"""
    try:
        dados = request.get_json()
        email = dados.get('email', '').strip().lower()
        
        if not email:
            return jsonify({"sucesso": False, "erro": "E-mail é obrigatório"}), 400
        
        if email in compradores_db:
            return jsonify({"sucesso": False, "erro": "E-mail de comprador já cadastrado"}), 409
        
        # Criar novo comprador
        comprador_id = str(uuid.uuid4())
        compradores_db[email] = {
            "id": comprador_id,
            "email": email,
            "nome": dados.get('nome', ''),
            "orgao": dados.get('orgao', ''),
            "cargo": dados.get('cargo', ''),
            "telefone": dados.get('telefone', ''),
            "data_cadastro": datetime.now().isoformat(),
            "ativo": True
        }
        
        # Salvar no arquivo
        salvar_json(compradores_db, 'compradores.json')
        
        logger.info(f"Comprador cadastrado: {email}")
        return jsonify({"sucesso": True, "mensagem": "Comprador cadastrado com sucesso!"}), 201
        
    except Exception as e:
        logger.error(f"Erro ao cadastrar comprador: {str(e)}")
        return jsonify({"sucesso": False, "erro": "Erro interno do servidor"}), 500

# ROTA: Login simples
@app.route('/api/login', methods=['POST'])
def login():
    """Login simples para demonstração"""
    try:
        dados = request.get_json()
        email = dados.get('email', '').strip().lower()
        
        # Verificar se é fornecedor
        if email in usuarios_db:
            usuario = usuarios_db[email]
            return jsonify({
                "sucesso": True,
                "usuario": {
                    "id": usuario["id"],
                    "email": email,
                    "tipo": "fornecedor",
                    "nome": usuario.get("razao_social", "")
                },
                "token": f"token_{usuario['id']}"
            }), 200
        
        # Verificar se é comprador
        if email in compradores_db:
            comprador = compradores_db[email]
            return jsonify({
                "sucesso": True,
                "usuario": {
                    "id": comprador["id"],
                    "email": email,
                    "tipo": "comprador",
                    "nome": comprador.get("nome", "")
                },
                "token": f"token_{comprador['id']}"
            }), 200
        
        return jsonify({"sucesso": False, "erro": "Usuário não encontrado"}), 401
        
    except Exception as e:
        logger.error(f"Erro no login: {str(e)}")
        return jsonify({"sucesso": False, "erro": "Erro interno do servidor"}), 500

# ROTA: Logout
@app.route('/api/logout', methods=['POST'])
def logout():
    """Logout - em um sistema real, invalidaria o token"""
    return jsonify({"sucesso": True, "mensagem": "Logout realizado com sucesso"}), 200

@app.route('/api/enviar-proposta', methods=['POST', 'OPTIONS'])
def enviar_proposta():
    """Recebe e processa uma nova proposta"""
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        dados = request.get_json()
        
        if not dados:
            return jsonify({"erro": "Dados não fornecidos"}), 400
        
        # Gerar ID único e protocolo
        proposta_id = str(uuid.uuid4())
        protocolo = f"PROP-{datetime.now().strftime('%Y%m%d')}-{proposta_id[:8].upper()}"
        
        # Verificar duplicidade de CNPJ para o processo
        cnpj = dados.get('dados', {}).get('cnpj', '').strip()
        processo = dados.get('processo', '').strip()
        
        if cnpj and processo:
            for existing_id, existing_proposta in propostas_db.items():
                existing_cnpj = existing_proposta.get('dados', {}).get('cnpj', '').strip()
                existing_processo = existing_proposta.get('processo', '').strip()
                
                if existing_cnpj == cnpj and existing_processo == processo:
                    return jsonify({
                        "erro": "CNPJ_DUPLICADO",
                        "mensagem": f"Este CNPJ já enviou uma proposta para este processo (Protocolo: {existing_proposta.get('protocolo')})"
                    }), 409
        
        # Criar estrutura da proposta
        proposta = {
            "id": proposta_id,
            "protocolo": protocolo,
            "data_criacao": datetime.now().isoformat(),
            "processo": processo,
            "dados": dados.get('dados', {}),
            "tecnica": dados.get('tecnica', {}),
            "comercial": dados.get('comercial', {}),
            "resumo": dados.get('resumo', {}),
            "status": "enviada",
            "totais": calcular_totais_comerciais(dados)
        }
        
        # Salvar proposta
        propostas_db[proposta_id] = proposta
        salvar_proposta_arquivo(proposta_id, proposta)
        
        logger.info(f"Proposta recebida: {protocolo}")
        
        return jsonify({
            "sucesso": True,
            "protocolo": protocolo,
            "id": proposta_id,
            "mensagem": "Proposta enviada com sucesso!",
            "data_envio": proposta["data_criacao"]
        }), 201
        
    except Exception as e:
        logger.error(f"Erro ao processar proposta: {str(e)}")
        return jsonify({"erro": "Erro interno do servidor"}), 500

@app.route('/api/propostas/listar', methods=['GET'])
def listar_propostas():
    """Lista todas as propostas"""
    try:
        propostas_lista = []
        for proposta_id, proposta in propostas_db.items():
            propostas_lista.append({
                "id": proposta_id,
                "protocolo": proposta.get("protocolo"),
                "processo": proposta.get("processo"),
                "empresa": proposta.get("dados", {}).get("razaoSocial"),
                "cnpj": proposta.get("dados", {}).get("cnpj"),
                "valor_total": proposta.get("totais", {}).get("valor_total"),
                "data_criacao": proposta.get("data_criacao"),
                "status": proposta.get("status")
            })
        
        # Ordenar por data de criação (mais recente primeiro)
        propostas_lista.sort(key=lambda x: x["data_criacao"], reverse=True)
        
        return jsonify({
            "propostas": propostas_lista,
            "total": len(propostas_lista)
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao listar propostas: {str(e)}")
        return jsonify({"erro": "Erro interno do servidor"}), 500

@app.route('/api/propostas/<proposta_id>', methods=['GET'])
def obter_proposta(proposta_id):
    """Obtém uma proposta específica"""
    try:
        if proposta_id not in propostas_db:
            return jsonify({"erro": "Proposta não encontrada"}), 404
        
        proposta = propostas_db[proposta_id]
        return jsonify(proposta), 200
        
    except Exception as e:
        logger.error(f"Erro ao obter proposta: {str(e)}")
        return jsonify({"erro": "Erro interno do servidor"}), 500

@app.route('/api/download/<tipo>/<proposta_id>', methods=['GET'])
def download_documento(tipo, proposta_id):
    """Gera e faz download de documentos da proposta"""
    try:
        if proposta_id not in propostas_db:
            return jsonify({"erro": "Proposta não encontrada"}), 404
        
        proposta = propostas_db[proposta_id]
        protocolo = proposta.get("protocolo")
        
        if tipo == 'word':
            buffer = gerar_word_proposta(proposta, protocolo)
            if buffer:
                return Response(
                    buffer.getvalue(),
                    mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    headers={"Content-Disposition": f"attachment; filename=proposta_{protocolo}.docx"}
                )
        
        elif tipo == 'excel':
            buffer = gerar_excel_proposta(proposta, protocolo)
            if buffer:
                return Response(
                    buffer.getvalue(),
                    mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    headers={"Content-Disposition": f"attachment; filename=proposta_{protocolo}.xlsx"}
                )
        
        return jsonify({"erro": "Tipo de documento não suportado"}), 400
        
    except Exception as e:
        logger.error(f"Erro ao gerar documento: {str(e)}")
        return jsonify({"erro": "Erro interno do servidor"}), 500

# Servir arquivos estáticos
@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    logger.info("Iniciando servidor de propostas...")
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
