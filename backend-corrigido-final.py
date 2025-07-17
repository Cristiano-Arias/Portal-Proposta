#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, jsonify, send_from_directory, render_template_string
from flask_cors import CORS
from datetime import datetime
import json
import os
import uuid
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

# Configuração do Flask
app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False
app.config['JSONIFY_MIMETYPE'] = 'application/json; charset=utf-8'
CORS(app)

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Diretórios
PROPOSTAS_DIR = 'propostas'
STATIC_DIR = 'static'

# Criar diretórios se não existirem
for dir_name in [PROPOSTAS_DIR, STATIC_DIR]:
    try:
        if not os.path.exists(dir_name):
            os.makedirs(dir_name)
            logger.info(f"Diretório {dir_name} criado")
    except Exception as e:
        logger.error(f"Erro ao criar diretório {dir_name}: {e}")

# Base de dados em memória
propostas_db = {}
processos_db = {}

# Configurações de email (usar variáveis de ambiente em produção)
EMAIL_CONFIG = {
    'server': os.environ.get('EMAIL_SERVER', 'smtp.gmail.com'),
    'port': int(os.environ.get('EMAIL_PORT', 587)),
    'user': os.environ.get('EMAIL_USER', ''),
    'password': os.environ.get('EMAIL_PASS', ''),
    'destinatario': os.environ.get('EMAIL_SUPRIMENTOS', '')
}

def enviar_email_proposta(protocolo, dados_proposta):
    """Envia email com os dados da proposta"""
    if not EMAIL_CONFIG['user'] or not EMAIL_CONFIG['password']:
        logger.warning("Configurações de email não definidas")
        return False
    
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_CONFIG['user']
        msg['To'] = EMAIL_CONFIG['destinatario']
        msg['Subject'] = f"Nova Proposta - {protocolo}"
        
        # Extrai informações principais
        empresa = dados_proposta.get('dados', {}).get('razaoSocial', 'N/A')
        cnpj = dados_proposta.get('dados', {}).get('cnpj', 'N/A')
        valor_total = dados_proposta.get('comercial', {}).get('valorTotal', '0,00')
        processo = dados_proposta.get('processo', 'N/A')
        
        corpo = f"""
        NOVA PROPOSTA RECEBIDA
        
        Protocolo: {protocolo}
        Processo: {processo}
        
        DADOS DA EMPRESA:
        Empresa: {empresa}
        CNPJ: {cnpj}
        Email: {dados_proposta.get('dados', {}).get('email', 'N/A')}
        Telefone: {dados_proposta.get('dados', {}).get('telefone', 'N/A')}
        
        RESUMO DA PROPOSTA:
        Valor Total: R$ {valor_total}
        Prazo de Execução: {dados_proposta.get('tecnica', {}).get('prazoExecucao', 'N/A')}
        
        Data/Hora: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}
        
        ==========================================
        PROPOSTA COMPLETA EM ANEXO
        ==========================================
        """
        
        msg.attach(MIMEText(corpo, 'plain'))
        
        # Anexa os dados completos como JSON
        anexo = MIMEBase('application', 'json')
        anexo.set_payload(json.dumps(dados_proposta, ensure_ascii=False, indent=2).encode('utf-8'))
        encoders.encode_base64(anexo)
        anexo.add_header('Content-Disposition', f'attachment; filename=proposta_{protocolo}.json')
        msg.attach(anexo)
        
        # Envia o email
        server = smtplib.SMTP(EMAIL_CONFIG['server'], EMAIL_CONFIG['port'])
        server.starttls()
        server.login(EMAIL_CONFIG['user'], EMAIL_CONFIG['password'])
        server.send_message(msg)
        server.quit()
        
        logger.info(f"Email enviado com sucesso para proposta {protocolo}")
        return True
        
    except Exception as e:
        logger.error(f"Erro ao enviar email: {str(e)}")
        return False

def salvar_proposta_arquivo(proposta_id, proposta_data):
    """Salva a proposta em arquivo JSON"""
    try:
        # Garante que o ID seja válido para nome de arquivo
        safe_id = str(proposta_id).replace('/', '_').replace('\\', '_').replace(':', '_')
        filename = os.path.join(PROPOSTAS_DIR, f'proposta_{safe_id}.json')
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(proposta_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Proposta salva: {filename}")
        return True
    except Exception as e:
        logger.error(f"Erro ao salvar proposta: {str(e)}")
        return False

def carregar_dados():
    """Carrega propostas e processos do diretório"""
    try:
        if not os.path.exists(PROPOSTAS_DIR):
            logger.info(f"Diretório {PROPOSTAS_DIR} não existe ainda")
            return
            
        # Carrega propostas
        for filename in os.listdir(PROPOSTAS_DIR):
            if filename.endswith('.json') and filename.startswith('proposta_'):
                filepath = os.path.join(PROPOSTAS_DIR, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        proposta = json.load(f)
                        propostas_db[proposta.get('protocolo', proposta.get('id'))] = proposta
                except Exception as e:
                    logger.error(f"Erro ao carregar {filename}: {e}")
        
        logger.info(f"Carregadas {len(propostas_db)} propostas")
        
        # Carrega processos se existir arquivo
        processos_file = os.path.join(PROPOSTAS_DIR, 'processos.json')
        if os.path.exists(processos_file):
            with open(processos_file, 'r', encoding='utf-8') as f:
                processos = json.load(f)
                for processo in processos:
                    processos_db[processo['numero']] = processo
                    
    except Exception as e:
        logger.error(f"Erro ao carregar dados: {str(e)}")

# Carrega dados existentes ao iniciar
carregar_dados()

@app.route('/')
def home():
    """Serve a página principal ou informações da API"""
    static_index = os.path.join(STATIC_DIR, 'index.html')
    if os.path.exists(static_index):
        return send_from_directory(STATIC_DIR, 'index.html')
    else:
        return jsonify({
            "message": "Sistema de Propostas - API",
            "status": "online",
            "endpoints": [
                "/portal-propostas",
                "/api/enviar-proposta",
                "/api/status",
                "/api/propostas/listar",
                "/api/processos/listar"
            ]
        }), 200

@app.route('/portal-propostas')
def portal_propostas():
    """Serve o portal de propostas"""
    portal_path = os.path.join(STATIC_DIR, 'portal-propostas-novo.html')
    if os.path.exists(portal_path):
        return send_from_directory(STATIC_DIR, 'portal-propostas-novo.html')
    else:
        # Se o arquivo não existir, retorna um HTML básico
        return render_template_string("""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Portal de Propostas</title>
            <meta charset="UTF-8">
        </head>
        <body>
            <h1>Portal de Propostas</h1>
            <p>O arquivo portal-propostas-novo.html não foi encontrado.</p>
            <p>Por favor, faça o upload do arquivo para a pasta static/</p>
            <hr>
            <p><a href="/api/status">Verificar Status da API</a></p>
        </body>
        </html>
        """)

@app.route('/api/status', methods=['GET'])
def api_status():
    """Verifica o status do servidor"""
    return jsonify({
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "propostas_total": len(propostas_db),
        "processos_total": len(processos_db),
        "encoding": "UTF-8",
        "versao": "2.0.1",
        "email_configurado": bool(EMAIL_CONFIG['user']),
        "diretorios": {
            "propostas": os.path.exists(PROPOSTAS_DIR),
            "static": os.path.exists(STATIC_DIR)
        }
    }), 200

@app.route('/api/enviar-proposta', methods=['POST'])
def enviar_proposta():
    """Recebe proposta do portal novo"""
    try:
        data = request.get_json(force=True)
        
        # Gera protocolo único
        protocolo = data.get('protocolo')
        if not protocolo:
            protocolo = f"PROP-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{str(uuid.uuid4())[:8].upper()}"
        
        # Estrutura completa da proposta
        proposta = {
            "protocolo": protocolo,
            "data_envio": datetime.now().isoformat(),
            "processo": data.get('processo', 'N/A'),
            "status": "recebida",
            "dados": data.get('dados', {}),
            "resumo": data.get('resumo', {}),
            "tecnica": data.get('tecnica', {}),
            "comercial": data.get('comercial', {})
        }
        
        # Armazena na memória
        propostas_db[protocolo] = proposta
        
        # Salva em arquivo
        if salvar_proposta_arquivo(protocolo, proposta):
            logger.info(f"Nova proposta recebida: {protocolo}")
            
            # Tenta enviar email (não bloqueia se falhar)
            email_enviado = enviar_email_proposta(protocolo, proposta)
            
            return jsonify({
                "success": True,
                "protocolo": protocolo,
                "mensagem": "Proposta enviada com sucesso!",
                "email_enviado": email_enviado,
                "data": datetime.now().strftime('%d/%m/%Y %H:%M:%S')
            }), 201
        else:
            return jsonify({
                "success": False,
                "erro": "Erro ao salvar proposta"
            }), 500
            
    except Exception as e:
        logger.error(f"Erro ao processar proposta: {str(e)}")
        return jsonify({
            "success": False,
            "erro": "Erro interno ao processar proposta",
            "detalhes": str(e)
        }), 500

@app.route('/api/propostas/listar', methods=['GET'])
def listar_propostas():
    """Lista todas as propostas"""
    try:
        # Filtros opcionais
        processo = request.args.get('processo')
        cnpj = request.args.get('cnpj')
        
        propostas_lista = list(propostas_db.values())
        
        # Aplica filtros
        if processo:
            propostas_lista = [p for p in propostas_lista if p.get('processo') == processo]
        if cnpj:
            propostas_lista = [p for p in propostas_lista if p.get('dados', {}).get('cnpj') == cnpj]
        
        # Ordena por data
        propostas_lista.sort(key=lambda x: x.get('data_envio', ''), reverse=True)
        
        return jsonify({
            "propostas": propostas_lista,
            "total": len(propostas_lista)
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao listar propostas: {str(e)}")
        return jsonify({
            "erro": "Erro ao listar propostas"
        }), 500

@app.route('/api/processos/<numero>', methods=['GET'])
def obter_processo(numero):
    """Obtém informações de um processo específico"""
    if numero in processos_db:
        return jsonify(processos_db[numero]), 200
    else:
        # Retorna dados padrão se não encontrar
        return jsonify({
            "numero": numero,
            "objeto": "Processo não cadastrado",
            "prazo": datetime.now().isoformat()
        }), 200

@app.route('/api/processos/listar', methods=['GET'])
def listar_processos():
    """Lista todos os processos"""
    return jsonify({
        "processos": list(processos_db.values()),
        "total": len(processos_db)
    }), 200

# Endpoints para arquivos estáticos
@app.route('/<path:filename>')
def serve_static(filename):
    """Serve arquivos estáticos com tratamento de erro"""
    try:
        # Previne path traversal
        if '..' in filename or filename.startswith('/'):
            return jsonify({"erro": "Caminho inválido"}), 400
            
        file_path = os.path.join(STATIC_DIR, filename)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return send_from_directory(STATIC_DIR, filename)
        else:
            return jsonify({"erro": "Arquivo não encontrado"}), 404
    except Exception as e:
        logger.error(f"Erro ao servir arquivo {filename}: {e}")
        return jsonify({"erro": "Erro ao acessar arquivo"}), 500

@app.errorhandler(404)
def nao_encontrado(e):
    return jsonify({"erro": "Endpoint não encontrado"}), 404

@app.errorhandler(500)
def erro_interno(e):
    return jsonify({"erro": "Erro interno do servidor"}), 500

if __name__ == '__main__':
    logger.info("Iniciando servidor de propostas v2.0.1...")
    logger.info(f"Diretório de trabalho: {os.getcwd()}")
    logger.info(f"Arquivos no diretório: {os.listdir('.')}")
    
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug_mode
    )
