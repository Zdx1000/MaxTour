from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import json
import os
from datetime import datetime, time, timedelta
import uuid

app = Flask(__name__, template_folder='utils', static_folder='utils')
CORS(app)

# Arquivos JSON para armazenar os dados
ROTAS_FILE = 'rotas_config.json'
PERCURSOS_FILE = 'percursos.json'

def carregar_rotas_config():
    """Carrega a configuração das rotas"""
    if os.path.exists(ROTAS_FILE):
        try:
            with open(ROTAS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            pass
    
    config_padrao = {
        "rotas": [
            {
                "id": "CANAA",
                "nome": "CANAÃ",
                "ativa": True,
                "horarios": {
                    "primeiro_turno": {
                        "saida": "06:00",
                        "chegada": "06:45"
                    },
                    "segundo_turno": {
                        "saida": "18:00",
                        "chegada": "18:45"
                    }
                }
            },
            {
                "id": "PLANALTO",
                "nome": "PLANALTO",
                "ativa": True,
                "horarios": {
                    "primeiro_turno": {
                        "saida": "06:30",
                        "chegada": "07:15"
                    },
                    "segundo_turno": {
                        "saida": "18:30",
                        "chegada": "19:15"
                    }
                }
            },
            {
                "id": "GUARANI",
                "nome": "GUARANI",
                "ativa": True,
                "horarios": {
                    "primeiro_turno": {
                        "saida": "07:00",
                        "chegada": "07:30"
                    },
                    "segundo_turno": {
                        "saida": "19:00",
                        "chegada": "19:30"
                    }
                }
            },
            {
                "id": "LAGOINHA",
                "nome": "LAGOINHA",
                "ativa": True,
                "horarios": {
                    "primeiro_turno": {
                        "saida": "05:45",
                        "chegada": "06:30"
                    },
                    "segundo_turno": {
                        "saida": "17:45",
                        "chegada": "18:30"
                    }
                }
            },
            {
                "id": "ALVORADA",
                "nome": "ALVORADA",
                "ativa": True,
                "horarios": {
                    "primeiro_turno": {
                        "saida": "06:15",
                        "chegada": "07:00"
                    },
                    "segundo_turno": {
                        "saida": "18:15",
                        "chegada": "19:00"
                    }
                }
            },
            {
                "id": "SAO_JORGE",
                "nome": "SÃO JORGE",
                "ativa": True,
                "horarios": {
                    "primeiro_turno": {
                        "saida": "07:30",
                        "chegada": "08:15"
                    },
                    "segundo_turno": {
                        "saida": "19:30",
                        "chegada": "20:15"
                    }
                }
            },
            {
                "id": "PEQUIS",
                "nome": "PEQUIS",
                "ativa": True,
                "horarios": {
                    "primeiro_turno": {
                        "saida": "05:30",
                        "chegada": "06:15"
                    },
                    "segundo_turno": {
                        "saida": "17:30",
                        "chegada": "18:15"
                    }
                }
            }
        ]
    }
    
    salvar_rotas_config(config_padrao)
    return config_padrao

def salvar_rotas_config(config):
    """Salva a configuração das rotas"""
    with open(ROTAS_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

def carregar_percursos():
    """Carrega os dados de percursos"""
    if os.path.exists(PERCURSOS_FILE):
        try:
            with open(PERCURSOS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {"percursos": []}
    return {"percursos": []}

def salvar_percursos(dados):
    """Salva os dados de percursos"""
    with open(PERCURSOS_FILE, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)

def calcular_atraso(horario_previsto, horario_real):
    """Calcula o atraso em minutos entre dois horários"""
    try:
        if not horario_previsto or not horario_real:
            return 0
        
        # Converte strings de horário para objetos time
        hora_prev = datetime.strptime(horario_previsto, "%H:%M").time()
        hora_real = datetime.strptime(horario_real, "%H:%M").time()
        
        # Converte para datetime para fazer a subtração
        data_base = datetime.now().date()
        dt_prev = datetime.combine(data_base, hora_prev)
        dt_real = datetime.combine(data_base, hora_real)
        
        # Calcula a diferença básica
        diferenca = dt_real - dt_prev
        diferenca_minutos = int(diferenca.total_seconds() / 60)
        
        # Se a diferença for muito grande (mais de 12 horas), provavelmente
        # é um caso onde o horário real passou da meia-noite
        if diferenca_minutos > 720:  # 12 horas = 720 minutos
            # Subtrai 24 horas (1440 minutos) para voltar ao dia anterior
            diferenca_minutos -= 1440
        elif diferenca_minutos < -720:  # Caso inverso
            # Adiciona 24 horas para o próximo dia
            diferenca_minutos += 1440
        
        return diferenca_minutos
    except ValueError:
        return 0

@app.route('/')
def index():
    """Página principal - Dashboard"""
    return render_template('dashboard.html')

@app.route('/dashboard')
def dashboard():
    """Dashboard principal"""
    return render_template('dashboard.html')

@app.route('/style.css')
def serve_css():
    """Serve o arquivo CSS"""
    from flask import send_from_directory
    return send_from_directory('utils', 'style.css')

@app.route('/dashboard.js')
def serve_js():
    """Serve o arquivo JavaScript"""
    from flask import send_from_directory
    return send_from_directory('utils', 'dashboard.js')

@app.route('/script.js')
def serve_old_js():
    """Serve o arquivo JavaScript (compatibilidade)"""
    from flask import send_from_directory
    return send_from_directory('utils', 'dashboard.js')

@app.route('/<filename>.html')
def serve_html_files(filename):
    """Serve arquivos HTML da pasta utils"""
    from flask import send_from_directory
    return send_from_directory('utils', f'{filename}.html')

# === ROTAS DE CONFIGURAÇÃO ===

@app.route('/api/config/rotas', methods=['GET'])
def obter_config_rotas():
    """Obtém configuração de todas as rotas"""
    config = carregar_rotas_config()
    return jsonify(config['rotas'])

@app.route('/api/config/rotas', methods=['POST'])
def criar_rota():
    """Cria uma nova rota"""
    try:
        config = carregar_rotas_config()
        nova_rota = request.get_json()
        
        # Validação básica
        campos_obrigatorios = ['id', 'nome', 'horarios']
        for campo in campos_obrigatorios:
            if campo not in nova_rota:
                return jsonify({'erro': f'Campo obrigatório: {campo}'}), 400
        
        # Verifica se ID já existe
        if any(r['id'] == nova_rota['id'] for r in config['rotas']):
            return jsonify({'erro': 'ID da rota já existe'}), 400
        
        # Define valores padrão
        nova_rota['ativa'] = nova_rota.get('ativa', True)
        
        config['rotas'].append(nova_rota)
        salvar_rotas_config(config)
        
        return jsonify(nova_rota), 201
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/api/config/rotas/<rota_id>', methods=['PUT'])
def atualizar_config_rota(rota_id):
    """Atualiza configuração de uma rota"""
    try:
        config = carregar_rotas_config()
        rota_index = next((i for i, r in enumerate(config['rotas']) if r['id'] == rota_id), None)
        
        if rota_index is None:
            return jsonify({'erro': 'Rota não encontrada'}), 404
        
        dados_atualizacao = request.get_json()
        config['rotas'][rota_index].update(dados_atualizacao)
        salvar_rotas_config(config)
        
        return jsonify(config['rotas'][rota_index])
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/api/config/rotas/<rota_id>', methods=['DELETE'])
def deletar_rota(rota_id):
    """Deleta uma rota"""
    config = carregar_rotas_config()
    rota_index = next((i for i, r in enumerate(config['rotas']) if r['id'] == rota_id), None)
    
    if rota_index is None:
        return jsonify({'erro': 'Rota não encontrada'}), 404
    
    rota_removida = config['rotas'].pop(rota_index)
    salvar_rotas_config(config)
    
    return jsonify({'mensagem': 'Rota removida com sucesso', 'rota': rota_removida})

# === ROTAS DE PERCURSO ===

@app.route('/api/percursos', methods=['GET'])
def obter_percursos():
    """Obtém todos os percursos"""
    dados = carregar_percursos()
    
    # Filtros opcionais
    rota_id = request.args.get('rota')
    data_inicio = request.args.get('data_inicio')
    data_fim = request.args.get('data_fim')
    turno = request.args.get('turno')
    
    percursos = dados['percursos']
    
    if rota_id:
        percursos = [p for p in percursos if p.get('rota_id') == rota_id]
    
    if data_inicio:
        percursos = [p for p in percursos if p.get('data') >= data_inicio]
    
    if data_fim:
        percursos = [p for p in percursos if p.get('data') <= data_fim]
    
    if turno:
        percursos = [p for p in percursos if p.get('turno') == turno]
    
    return jsonify(percursos)

@app.route('/api/percursos', methods=['POST'])
def registrar_percurso():
    """Registra um novo percurso"""
    try:
        dados = carregar_percursos()
        config_rotas = carregar_rotas_config()
        novo_percurso = request.get_json()
        
        # Validação básica
        campos_obrigatorios = ['rota_id', 'data', 'turno']
        for campo in campos_obrigatorios:
            if campo not in novo_percurso:
                return jsonify({'erro': f'Campo obrigatório: {campo}'}), 400
        
        # Verifica se a rota existe
        rota = next((r for r in config_rotas['rotas'] if r['id'] == novo_percurso['rota_id']), None)
        if not rota:
            return jsonify({'erro': 'Rota não encontrada'}), 400
        
        # Verifica se turno é válido
        if novo_percurso['turno'] not in ['primeiro_turno', 'segundo_turno']:
            return jsonify({'erro': 'Turno deve ser "primeiro_turno" ou "segundo_turno"'}), 400
        
        # Adiciona ID único e dados calculados
        novo_percurso['id'] = str(uuid.uuid4())
        novo_percurso['data_criacao'] = datetime.now().isoformat()
        novo_percurso['nome_rota'] = rota['nome']
        
        # Obtém horários programados da rota
        horarios_programados = rota['horarios'][novo_percurso['turno']]
        
        # Se os horários programados já foram fornecidos, usa eles
        if 'horario_saida_programado' not in novo_percurso:
            if isinstance(horarios_programados, list):
                # Nova estrutura com múltiplos horários - usa o primeiro como padrão
                novo_percurso['horario_saida_programado'] = horarios_programados[0]['saida']
                novo_percurso['horario_chegada_programado'] = horarios_programados[0]['chegada_maxima']
            else:
                # Estrutura antiga (compatibilidade)
                novo_percurso['horario_saida_programado'] = horarios_programados['saida']
                novo_percurso['horario_chegada_programado'] = horarios_programados['chegada']
        
        # Calcula atrasos se horários reais foram fornecidos
        if 'horario_saida_real' in novo_percurso:
            novo_percurso['atraso_saida'] = calcular_atraso(
                novo_percurso['horario_saida_programado'],
                novo_percurso['horario_saida_real']
            )
        
        if 'horario_chegada_real' in novo_percurso:
            novo_percurso['atraso_chegada'] = calcular_atraso(
                novo_percurso['horario_chegada_programado'],
                novo_percurso['horario_chegada_real']
            )
        
        dados['percursos'].append(novo_percurso)
        salvar_percursos(dados)
        
        return jsonify(novo_percurso), 201
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/api/percursos/<percurso_id>', methods=['PUT'])
def atualizar_percurso(percurso_id):
    """Atualiza um percurso existente"""
    try:
        dados = carregar_percursos()
        config_rotas = carregar_rotas_config()
        percurso_index = next((i for i, p in enumerate(dados['percursos']) if p['id'] == percurso_id), None)
        
        if percurso_index is None:
            return jsonify({'erro': 'Percurso não encontrado'}), 404
        
        dados_atualizacao = request.get_json()
        percurso = dados['percursos'][percurso_index]
        
        # Atualiza dados
        percurso.update(dados_atualizacao)
        percurso['data_atualizacao'] = datetime.now().isoformat()
        
        # Recalcula atrasos se necessário
        rota = next((r for r in config_rotas['rotas'] if r['id'] == percurso['rota_id']), None)
        if rota:
            horarios_programados = rota['horarios'][percurso['turno']]
            
            # Determina horários programados baseados na estrutura
            if isinstance(horarios_programados, list):
                # Nova estrutura - usa os horários já salvos no percurso
                horario_saida_prog = percurso.get('horario_saida_programado')
                horario_chegada_prog = percurso.get('horario_chegada_programado')
            else:
                # Estrutura antiga
                horario_saida_prog = horarios_programados['saida']
                horario_chegada_prog = horarios_programados['chegada']
            
            if 'horario_saida_real' in percurso and horario_saida_prog:
                percurso['atraso_saida'] = calcular_atraso(
                    horario_saida_prog,
                    percurso['horario_saida_real']
                )
            
            if 'horario_chegada_real' in percurso and horario_chegada_prog:
                percurso['atraso_chegada'] = calcular_atraso(
                    horario_chegada_prog,
                    percurso['horario_chegada_real']
                )
        
        salvar_percursos(dados)
        return jsonify(percurso)
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/api/percursos/<percurso_id>', methods=['DELETE'])
def deletar_percurso(percurso_id):
    """Deleta um percurso"""
    dados = carregar_percursos()
    percurso_index = next((i for i, p in enumerate(dados['percursos']) if p['id'] == percurso_id), None)
    
    if percurso_index is None:
        return jsonify({'erro': 'Percurso não encontrado'}), 404
    
    percurso_removido = dados['percursos'].pop(percurso_index)
    salvar_percursos(dados)
    
    return jsonify({'mensagem': 'Percurso removido com sucesso', 'percurso': percurso_removido})

# === RELATÓRIOS ===

@app.route('/api/relatorio', methods=['GET'])
def gerar_relatorio():
    """Gera relatório integrado do sistema MaxTour"""
    dados_percursos = carregar_percursos()
    config_rotas = carregar_rotas_config()
    
    percursos = dados_percursos['percursos']
    rotas_config = config_rotas['rotas']
    
    # Estatísticas de percursos/atrasos
    total_percursos = len(percursos)
    atrasos_saida = [p.get('atraso_saida', 0) for p in percursos if 'atraso_saida' in p]
    atrasos_chegada = [p.get('atraso_chegada', 0) for p in percursos if 'atraso_chegada' in p]
    
    # Performance das rotas
    rotas_performance = {}
    for rota in rotas_config:
        rota_id = rota['id']
        percursos_rota = [p for p in percursos if p.get('rota_id') == rota_id]
        
        if percursos_rota:
            atrasos_rota = [p.get('atraso_saida', 0) for p in percursos_rota if 'atraso_saida' in p]
            atraso_medio = round(sum(atrasos_rota) / len(atrasos_rota), 2) if atrasos_rota else 0
            pontuais = len([a for a in atrasos_rota if a <= 0])
            
            rotas_performance[rota['nome']] = {
                'total_percursos': len(percursos_rota),
                'atraso_medio': atraso_medio,
                'percursos_pontuais': pontuais,
                'percentual_pontualidade': round((pontuais / len(percursos_rota)) * 100, 1) if percursos_rota else 0
            }
    
    relatorio = {
        'resumo_operacional': {
            'total_rotas_ativas': len([r for r in rotas_config if r.get('ativa', True)]),
            'total_percursos_registrados': total_percursos,
            'atraso_medio_geral': round(sum(atrasos_saida) / len(atrasos_saida), 2) if atrasos_saida else 0,
            'maior_atraso_registrado': max(atrasos_saida) if atrasos_saida else 0,
            'percursos_pontuais': len([a for a in atrasos_saida if a <= 0]),
            'percentual_pontualidade_geral': round((len([a for a in atrasos_saida if a <= 0]) / len(atrasos_saida)) * 100, 1) if atrasos_saida else 0
        },
        'performance_por_rota': rotas_performance,
        'data_geracao': datetime.now().isoformat()
    }
    
    return jsonify(relatorio)

@app.route('/api/relatorio/atrasos', methods=['GET'])
def relatorio_atrasos():
    """Gera relatório completo de atrasos"""
    dados_percursos = carregar_percursos()
    dados_rotas = carregar_rotas_config()
    percursos = dados_percursos['percursos']
    rotas_config = dados_rotas['rotas']
    
    # Filtros
    rota_id = request.args.get('rota')
    data_inicio = request.args.get('data_inicio')
    data_fim = request.args.get('data_fim')
    
    # Aplicar filtros
    percursos_filtrados = percursos.copy()
    
    if rota_id:
        percursos_filtrados = [p for p in percursos_filtrados if p.get('rota_id') == rota_id]
    
    if data_inicio:
        percursos_filtrados = [p for p in percursos_filtrados if p.get('data') >= data_inicio]
    
    if data_fim:
        percursos_filtrados = [p for p in percursos_filtrados if p.get('data') <= data_fim]
    
    # Mapear nomes das rotas
    rota_nomes = {rota['id']: rota['nome'] for rota in rotas_config}
    
    # Adicionar nome da rota aos percursos
    for percurso in percursos_filtrados:
        percurso['nome_rota'] = rota_nomes.get(percurso.get('rota_id'), percurso.get('rota_id', 'Desconhecida'))
    
    # Calcular estatísticas gerais
    total_percursos = len(percursos_filtrados)
    
    if total_percursos == 0:
        return jsonify({
            'resumo': {
                'total_percursos': 0,
                'media_atraso_saida': 0,
                'media_atraso_chegada': 0,
                'maior_atraso_saida': 0,
                'maior_atraso_chegada': 0,
                'pontualidade_saida': 0,
                'pontualidade_chegada': 0
            },
            'por_rota': {},
            'detalhes': [],
            'data_geracao': datetime.now().isoformat()
        })
    
    # Calcular métricas gerais
    atrasos_saida = [p.get('atraso_saida', 0) for p in percursos_filtrados]
    atrasos_chegada = [p.get('atraso_chegada', 0) for p in percursos_filtrados]
    
    media_atraso_saida = round(sum(atrasos_saida) / len(atrasos_saida), 1) if atrasos_saida else 0
    media_atraso_chegada = round(sum(atrasos_chegada) / len(atrasos_chegada), 1) if atrasos_chegada else 0
    
    pontualidade_saida = round((len([a for a in atrasos_saida if a <= 0]) / len(atrasos_saida)) * 100, 1) if atrasos_saida else 0
    pontualidade_chegada = round((len([a for a in atrasos_chegada if a <= 0]) / len(atrasos_chegada)) * 100, 1) if atrasos_chegada else 0
    
    # Agrupar por rota
    por_rota = {}
    for percurso in percursos_filtrados:
        rota_nome = percurso['nome_rota']
        if rota_nome not in por_rota:
            por_rota[rota_nome] = []
        por_rota[rota_nome].append(percurso)
    
    # Calcular estatísticas por rota
    estatisticas_por_rota = {}
    for rota_nome, percursos_rota in por_rota.items():
        atrasos_saida_rota = [p.get('atraso_saida', 0) for p in percursos_rota]
        atrasos_chegada_rota = [p.get('atraso_chegada', 0) for p in percursos_rota]
        
        estatisticas_por_rota[rota_nome] = {
            'total_percursos': len(percursos_rota),
            'media_atraso_saida': round(sum(atrasos_saida_rota) / len(atrasos_saida_rota), 1) if atrasos_saida_rota else 0,
            'media_atraso_chegada': round(sum(atrasos_chegada_rota) / len(atrasos_chegada_rota), 1) if atrasos_chegada_rota else 0,
            'maior_atraso_saida': max(atrasos_saida_rota) if atrasos_saida_rota else 0,
            'maior_atraso_chegada': max(atrasos_chegada_rota) if atrasos_chegada_rota else 0,
            'pontualidade_saida': round((len([a for a in atrasos_saida_rota if a <= 0]) / len(atrasos_saida_rota)) * 100, 1) if atrasos_saida_rota else 0,
            'pontualidade_chegada': round((len([a for a in atrasos_chegada_rota if a <= 0]) / len(atrasos_chegada_rota)) * 100, 1) if atrasos_chegada_rota else 0
        }
    
    # Preparar detalhes dos percursos
    detalhes_formatados = []
    for percurso in sorted(percursos_filtrados, key=lambda x: (x.get('data', ''), x.get('nome_rota', ''))):
        detalhes_formatados.append({
            'data': percurso.get('data', ''),
            'rota': percurso.get('nome_rota', ''),
            'turno': percurso.get('turno', ''),
            'saida_programada': percurso.get('horario_saida_programado', ''),
            'saida_real': percurso.get('horario_saida_real', ''),
            'chegada_programada': percurso.get('horario_chegada_programado', ''),
            'chegada_real': percurso.get('horario_chegada_real', ''),
            'atraso_saida': percurso.get('atraso_saida', 0),
            'atraso_chegada': percurso.get('atraso_chegada', 0),
            'observacoes': percurso.get('observacoes', '')
        })
    
    relatorio = {
        'resumo': {
            'total_percursos': total_percursos,
            'media_atraso_saida': media_atraso_saida,
            'media_atraso_chegada': media_atraso_chegada,
            'maior_atraso_saida': max(atrasos_saida) if atrasos_saida else 0,
            'maior_atraso_chegada': max(atrasos_chegada) if atrasos_chegada else 0,
            'pontualidade_saida': pontualidade_saida,
            'pontualidade_chegada': pontualidade_chegada
        },
        'por_rota': estatisticas_por_rota,
        'detalhes': detalhes_formatados,
        'data_geracao': datetime.now().isoformat()
    }
    
    return jsonify(relatorio)



if __name__ == '__main__':
    # Inicializa configurações padrão
    carregar_rotas_config()
    app.run(debug=True, host='0.0.0.0', port=5000)

