#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime
import json
import os
import uuid
import logging

# Configuração do Flask
app = Flask(__name__, static_folder='static', static_url_path='')
app.config['JSON_AS_ASCII'] = False  # Importante para UTF-8
app.config['JSONIFY_MIMETYPE'] = 'application/json; charset=utf-8'
CORS(app)

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

# Diretório para armazenar propostas
PROPOSTAS_DIR = 'propostas'
if not os.path.exists(PROPOSTAS_DIR):
    os.makedirs(PROPOSTAS_DIR)

# Base de dados em memória (pode ser substituído por um banco de dados real)
propostas_db = {}

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

# Carrega propostas existentes ao iniciar
carregar_propostas()

@app.route('/', methods=['GET'])
def home():
    """Endpoint raiz - serve o arquivo HTML principal"""
    # Se existir um arquivo index.html na pasta static, serve ele
    if os.path.exists(os.path.join('static', 'index.html')):
        return send_from_directory('static', 'index.html')
    else:
        # Caso contrário, retorna informações da API
        return jsonify({
            "message": "Servidor de propostas funcionando - UTF-8 CORRIGIDO",
            "status": "online",
            "endpoints": [
                "/enviar-proposta",
                "/status",
                "/propostas/<id>",
                "/propostas/listar"
            ]
        }), 200

@app.route('/api/status', methods=['GET'])
def api_status():
    """Verifica o status do servidor via API"""
    return jsonify({
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "propostas_total": len(propostas_db),
        "encoding": "UTF-8",
        "versao": "1.0.0"
    }), 200

@app.route('/enviar-proposta', methods=['POST'])
def enviar_proposta():
    """Recebe e processa uma nova proposta"""
    try:
        # Verifica se há dados JSON na requisição
        if not request.is_json:
            return jsonify({
                "erro": "Conteúdo deve ser JSON",
                "status": "erro"
            }), 400
        
        data = request.get_json(force=True)
        
        # Validação básica dos campos obrigatórios
        campos_obrigatorios = ['nome', 'email', 'descricao']
        campos_faltando = [campo for campo in campos_obrigatorios if campo not in data]
        
        if campos_faltando:
            return jsonify({
                "erro": f"Campos obrigatórios faltando: {', '.join(campos_faltando)}",
                "status": "erro"
            }), 400
        
        # Gera ID único para a proposta
        proposta_id = str(uuid.uuid4())
        
        # Cria objeto da proposta
        proposta = {
            "id": proposta_id,
            "nome": data.get('nome'),
            "email": data.get('email'),
            "telefone": data.get('telefone', ''),
            "empresa": data.get('empresa', ''),
            "descricao": data.get('descricao'),
            "valor": data.get('valor', 0),
            "prazo": data.get('prazo', ''),
            "observacoes": data.get('observacoes', ''),
            "data_criacao": datetime.now().isoformat(),
            "status": "recebida"
        }
        
        # Armazena na memória
        propostas_db[proposta_id] = proposta
        
        # Salva em arquivo
        if salvar_proposta_arquivo(proposta_id, proposta):
            logger.info(f"Nova proposta recebida: {proposta_id}")
            
            return jsonify({
                "mensagem": "Proposta enviada com sucesso",
                "proposta_id": proposta_id,
                "status": "sucesso"
            }), 201
        else:
            return jsonify({
                "erro": "Erro ao salvar proposta",
                "status": "erro"
            }), 500
            
    except Exception as e:
        logger.error(f"Erro ao processar proposta: {str(e)}")
        return jsonify({
            "erro": "Erro interno ao processar proposta",
            "detalhes": str(e),
            "status": "erro"
        }), 500

@app.route('/propostas/<proposta_id>', methods=['GET'])
def obter_proposta(proposta_id):
    """Obtém uma proposta específica pelo ID"""
    if proposta_id in propostas_db:
        return jsonify(propostas_db[proposta_id]), 200
    else:
        return jsonify({
            "erro": "Proposta não encontrada",
            "status": "erro"
        }), 404

@app.route('/propostas/listar', methods=['GET'])
def listar_propostas():
    """Lista todas as propostas com paginação opcional"""
    try:
        # Parâmetros de paginação
        pagina = int(request.args.get('pagina', 1))
        por_pagina = int(request.args.get('por_pagina', 10))
        
        # Converte para lista e ordena por data
        propostas_lista = list(propostas_db.values())
        propostas_lista.sort(key=lambda x: x['data_criacao'], reverse=True)
        
        # Paginação
        inicio = (pagina - 1) * por_pagina
        fim = inicio + por_pagina
        propostas_pagina = propostas_lista[inicio:fim]
        
        return jsonify({
            "propostas": propostas_pagina,
            "total": len(propostas_lista),
            "pagina": pagina,
            "por_pagina": por_pagina,
            "total_paginas": (len(propostas_lista) + por_pagina - 1) // por_pagina
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao listar propostas: {str(e)}")
        return jsonify({
            "erro": "Erro ao listar propostas",
            "status": "erro"
        }), 500

@app.route('/propostas/<proposta_id>', methods=['PUT'])
def atualizar_proposta(proposta_id):
    """Atualiza o status de uma proposta"""
    try:
        if proposta_id not in propostas_db:
            return jsonify({
                "erro": "Proposta não encontrada",
                "status": "erro"
            }), 404
        
        data = request.get_json()
        
        # Atualiza apenas campos permitidos
        campos_atualizaveis = ['status', 'observacoes']
        for campo in campos_atualizaveis:
            if campo in data:
                propostas_db[proposta_id][campo] = data[campo]
        
        propostas_db[proposta_id]['data_atualizacao'] = datetime.now().isoformat()
        
        # Salva alterações
        if salvar_proposta_arquivo(proposta_id, propostas_db[proposta_id]):
            return jsonify({
                "mensagem": "Proposta atualizada com sucesso",
                "proposta": propostas_db[proposta_id]
            }), 200
        else:
            return jsonify({
                "erro": "Erro ao salvar alterações",
                "status": "erro"
            }), 500
            
    except Exception as e:
        logger.error(f"Erro ao atualizar proposta: {str(e)}")
        return jsonify({
            "erro": "Erro ao atualizar proposta",
            "status": "erro"
        }), 500

@app.errorhandler(404)
def nao_encontrado(e):
    """Handler para rotas não encontradas"""
    return jsonify({
        "erro": "Endpoint não encontrado",
        "status": "erro"
    }), 404

@app.errorhandler(500)
def erro_interno(e):
    """Handler para erros internos"""
    return jsonify({
        "erro": "Erro interno do servidor",
        "status": "erro"
    }), 500

if __name__ == '__main__':
    logger.info("Iniciando servidor de propostas...")
    # Configuração para Render
    port = int(os.environ.get('PORT', 5000))
    app.run(
        host='0.0.0.0',
        port=port,
        debug=False  # Desabilitar debug em produção
    )
