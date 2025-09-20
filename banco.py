import sqlite3
import json
import uuid
from datetime import datetime
from contextlib import contextmanager
import secrets
import hashlib
import uuid
import sqlite3

# Nome do arquivo de banco de dados
DATABASE_FILE = 'dados.db'

@contextmanager
def obter_conexao():
    """Context manager para conexões com o banco de dados"""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row  # Para acessar colunas por nome
    try:
        yield conn
    finally:
        conn.close()

def inicializar_banco():
    """Cria as tabelas se não existirem"""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        
        # Tabela de rotas
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rotas (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                ativa INTEGER NOT NULL DEFAULT 1,
                horarios TEXT NOT NULL
            )
        ''')
        
        # Tabela de percursos
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS percursos (
                id TEXT PRIMARY KEY,
                rota_id TEXT NOT NULL,
                nome_rota TEXT NOT NULL,
                data TEXT NOT NULL,
                turno TEXT NOT NULL,
                horario_saida_programado TEXT,
                horario_chegada_programado TEXT,
                horario_saida_real TEXT,
                horario_chegada_real TEXT,
                atraso_saida INTEGER DEFAULT 0,
                atraso_chegada INTEGER DEFAULT 0,
                observacoes TEXT DEFAULT '',
                data_criacao TEXT NOT NULL,
                data_atualizacao TEXT,
                FOREIGN KEY (rota_id) REFERENCES rotas (id)
            )
        ''')
        
        # Tabela de usuários
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                nome TEXT,
                senha_hash TEXT NOT NULL,
                is_admin INTEGER NOT NULL DEFAULT 0,
                ativo INTEGER NOT NULL DEFAULT 1,
                criado_em TEXT NOT NULL,
                atualizado_em TEXT,
                ultimo_login TEXT
            )
        ''')
        conn.commit()

        # Cria admin padrão se base estiver vazia
        cursor.execute('SELECT COUNT(*) FROM usuarios')
        if cursor.fetchone()[0] == 0:
            criar_usuario('admin', 'Administrador', 'admin', is_admin=True)
        
        conn.commit()
        
        # Inserir dados padrão se a tabela de rotas estiver vazia
        cursor.execute('SELECT COUNT(*) FROM rotas')
        if cursor.fetchone()[0] == 0:
            inserir_dados_padrao()

def inserir_dados_padrao():
    """Insere dados padrão das rotas"""
    rotas_padrao = [
        {
            "id": "CANAA",
            "nome": "CANAÃ",
            "ativa": True,
            "horarios": {
                "primeiro_turno": [
                    {
                        "chegada_martins": "05:20",
                        "chegada_minima": "04:50",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "chegada_martins": "06:55",
                        "chegada_minima": "06:25",
                        "chegada_maxima": "07:00"
                    },
                    {
                        "saida_martins": "13:40",
                        "chegada_minima": "13:30",
                        "chegada_maxima": "13:40"
                    },
                    {
                        "saida_martins": "15:30",
                        "chegada_minima": "15:20",
                        "chegada_maxima": "15:30"
                    },
                    {
                        "saida_martins": "17:00",
                        "chegada_minima": "17:20",
                        "chegada_maxima": "17:30"
                    }
                ],
                "segundo_turno": [
                    {
                        "saida_martins": "23:00",
                        "chegada_minima": "23:10",
                        "chegada_maxima": "23:40"
                    },
                    {
                        "saida_martins": "01:00",
                        "chegada_minima": "01:10",
                        "chegada_maxima": "01:20"
                    },
                    {
                        "saida_martins": "02:55",
                        "chegada_minima": "02:50",
                        "chegada_maxima": "03:20"
                    },
                    {
                        "saida_martins": "05:00",
                        "chegada_minima": "05:10",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "saida_martins": "07:00",
                        "chegada_minima": "07:10",
                        "chegada_maxima": "07:20"
                    },
                    {
                        "chegada_martins": "15:00",
                        "chegada_minima": "15:00",
                        "chegada_maxima": "15:20"
                    },
                    {
                        "chegada_martins": "17:00",
                        "chegada_minima": "17:00",
                        "chegada_maxima": "17:20"
                    },
                    {
                        "chegada_martins": "21:00",
                        "chegada_minima": "21:00",
                        "chegada_maxima": "21:20"
                    }
                ]
            }
        },
        {
            "id": "PLANALTO",
            "nome": "PLANALTO",
            "ativa": True,
            "horarios": {
                "primeiro_turno": [
                    {
                        "chegada_martins": "05:20",
                        "chegada_minima": "04:50",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "chegada_martins": "06:55",
                        "chegada_minima": "06:25",
                        "chegada_maxima": "07:00"
                    },
                    {
                        "saida_martins": "13:40",
                        "chegada_minima": "13:30",
                        "chegada_maxima": "13:40"
                    },
                    {
                        "saida_martins": "15:30",
                        "chegada_minima": "15:20",
                        "chegada_maxima": "15:30"
                    },
                    {
                        "saida_martins": "17:00",
                        "chegada_minima": "17:20",
                        "chegada_maxima": "17:30"
                    }
                ],
                "segundo_turno": [
                    {
                        "saida_martins": "23:00",
                        "chegada_minima": "23:10",
                        "chegada_maxima": "23:40"
                    },
                    {
                        "saida_martins": "01:00",
                        "chegada_minima": "01:10",
                        "chegada_maxima": "01:20"
                    },
                    {
                        "saida_martins": "02:55",
                        "chegada_minima": "02:50",
                        "chegada_maxima": "03:20"
                    },
                    {
                        "saida_martins": "05:00",
                        "chegada_minima": "05:10",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "saida_martins": "07:00",
                        "chegada_minima": "07:10",
                        "chegada_maxima": "07:20"
                    },
                    {
                        "chegada_martins": "15:00",
                        "chegada_minima": "15:00",
                        "chegada_maxima": "15:20"
                    },
                    {
                        "chegada_martins": "17:00",
                        "chegada_minima": "17:00",
                        "chegada_maxima": "17:20"
                    },
                    {
                        "chegada_martins": "21:00",
                        "chegada_minima": "21:00",
                        "chegada_maxima": "21:20"
                    }
                ]
            }
        },
        {
            "id": "GUARANI",
            "nome": "GUARANI",
            "ativa": True,
            "horarios": {
                "primeiro_turno": [
                    {
                        "chegada_martins": "05:20",
                        "chegada_minima": "04:50",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "chegada_martins": "06:55",
                        "chegada_minima": "06:25",
                        "chegada_maxima": "07:00"
                    },
                    {
                        "saida_martins": "13:40",
                        "chegada_minima": "13:30",
                        "chegada_maxima": "13:40"
                    },
                    {
                        "saida_martins": "15:30",
                        "chegada_minima": "15:20",
                        "chegada_maxima": "15:30"
                    },
                    {
                        "saida_martins": "17:00",
                        "chegada_minima": "17:20",
                        "chegada_maxima": "17:30"
                    }
                ],
                "segundo_turno": [
                    {
                        "saida_martins": "23:00",
                        "chegada_minima": "23:10",
                        "chegada_maxima": "23:40"
                    },
                    {
                        "saida_martins": "01:00",
                        "chegada_minima": "01:10",
                        "chegada_maxima": "01:20"
                    },
                    {
                        "saida_martins": "02:55",
                        "chegada_minima": "02:50",
                        "chegada_maxima": "03:20"
                    },
                    {
                        "saida_martins": "05:00",
                        "chegada_minima": "05:10",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "saida_martins": "07:00",
                        "chegada_minima": "07:10",
                        "chegada_maxima": "07:20"
                    },
                    {
                        "chegada_martins": "15:00",
                        "chegada_minima": "15:00",
                        "chegada_maxima": "15:20"
                    },
                    {
                        "chegada_martins": "17:00",
                        "chegada_minima": "17:00",
                        "chegada_maxima": "17:20"
                    },
                    {
                        "chegada_martins": "21:00",
                        "chegada_minima": "21:00",
                        "chegada_maxima": "21:20"
                    }
                ]
            }
        },
        {
            "id": "LAGOINHA",
            "nome": "LAGOINHA",
            "ativa": True,
            "horarios": {
                "primeiro_turno": [
                    {
                        "chegada_martins": "05:20",
                        "chegada_minima": "04:50",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "chegada_martins": "06:55",
                        "chegada_minima": "06:25",
                        "chegada_maxima": "07:00"
                    },
                    {
                        "saida_martins": "13:40",
                        "chegada_minima": "13:30",
                        "chegada_maxima": "13:40"
                    },
                    {
                        "saida_martins": "15:30",
                        "chegada_minima": "15:20",
                        "chegada_maxima": "15:30"
                    },
                    {
                        "saida_martins": "17:00",
                        "chegada_minima": "17:20",
                        "chegada_maxima": "17:30"
                    }
                ],
                "segundo_turno": [
                    {
                        "saida_martins": "23:00",
                        "chegada_minima": "23:10",
                        "chegada_maxima": "23:40"
                    },
                    {
                        "saida_martins": "01:00",
                        "chegada_minima": "01:10",
                        "chegada_maxima": "01:20"
                    },
                    {
                        "saida_martins": "02:55",
                        "chegada_minima": "02:50",
                        "chegada_maxima": "03:20"
                    },
                    {
                        "saida_martins": "05:00",
                        "chegada_minima": "05:10",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "saida_martins": "07:00",
                        "chegada_minima": "07:10",
                        "chegada_maxima": "07:20"
                    },
                    {
                        "chegada_martins": "15:00",
                        "chegada_minima": "15:00",
                        "chegada_maxima": "15:20"
                    },
                    {
                        "chegada_martins": "17:00",
                        "chegada_minima": "17:00",
                        "chegada_maxima": "17:20"
                    },
                    {
                        "chegada_martins": "21:00",
                        "chegada_minima": "21:00",
                        "chegada_maxima": "21:20"
                    }
                ]
            }
        },
        {
            "id": "ALVORADA",
            "nome": "ALVORADA",
            "ativa": True,
            "horarios": {
                "primeiro_turno": [
                    {
                        "chegada_martins": "05:20",
                        "chegada_minima": "04:50",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "chegada_martins": "06:55",
                        "chegada_minima": "06:25",
                        "chegada_maxima": "07:00"
                    },
                    {
                        "saida_martins": "13:40",
                        "chegada_minima": "13:30",
                        "chegada_maxima": "13:40"
                    },
                    {
                        "saida_martins": "15:30",
                        "chegada_minima": "15:20",
                        "chegada_maxima": "15:30"
                    },
                    {
                        "saida_martins": "17:00",
                        "chegada_minima": "17:20",
                        "chegada_maxima": "17:30"
                    }
                ],
                "segundo_turno": [
                    {
                        "saida_martins": "23:00",
                        "chegada_minima": "23:10",
                        "chegada_maxima": "23:40"
                    },
                    {
                        "saida_martins": "01:00",
                        "chegada_minima": "01:10",
                        "chegada_maxima": "01:20"
                    },
                    {
                        "saida_martins": "02:55",
                        "chegada_minima": "02:50",
                        "chegada_maxima": "03:20"
                    },
                    {
                        "saida_martins": "05:00",
                        "chegada_minima": "05:10",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "saida_martins": "07:00",
                        "chegada_minima": "07:10",
                        "chegada_maxima": "07:20"
                    },
                    {
                        "chegada_martins": "15:00",
                        "chegada_minima": "15:00",
                        "chegada_maxima": "15:20"
                    },
                    {
                        "chegada_martins": "17:00",
                        "chegada_minima": "17:00",
                        "chegada_maxima": "17:20"
                    },
                    {
                        "chegada_martins": "21:00",
                        "chegada_minima": "21:00",
                        "chegada_maxima": "21:20"
                    }
                ]
            }
        },
        {
            "id": "SAO_JORGE",
            "nome": "SÃO JORGE",
            "ativa": True,
            "horarios": {
                "primeiro_turno": [
                    {
                        "chegada_martins": "05:20",
                        "chegada_minima": "04:50",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "chegada_martins": "06:55",
                        "chegada_minima": "06:25",
                        "chegada_maxima": "07:00"
                    },
                    {
                        "saida_martins": "13:40",
                        "chegada_minima": "13:30",
                        "chegada_maxima": "13:40"
                    },
                    {
                        "saida_martins": "15:30",
                        "chegada_minima": "15:20",
                        "chegada_maxima": "15:30"
                    },
                    {
                        "saida_martins": "17:00",
                        "chegada_minima": "17:20",
                        "chegada_maxima": "17:30"
                    }
                ],
                "segundo_turno": [
                    {
                        "saida_martins": "23:00",
                        "chegada_minima": "23:10",
                        "chegada_maxima": "23:40"
                    },
                    {
                        "saida_martins": "01:00",
                        "chegada_minima": "01:10",
                        "chegada_maxima": "01:20"
                    },
                    {
                        "saida_martins": "02:55",
                        "chegada_minima": "02:50",
                        "chegada_maxima": "03:20"
                    },
                    {
                        "saida_martins": "05:00",
                        "chegada_minima": "05:10",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "saida_martins": "07:00",
                        "chegada_minima": "07:10",
                        "chegada_maxima": "07:20"
                    },
                    {
                        "chegada_martins": "15:00",
                        "chegada_minima": "15:00",
                        "chegada_maxima": "15:20"
                    },
                    {
                        "chegada_martins": "17:00",
                        "chegada_minima": "17:00",
                        "chegada_maxima": "17:20"
                    },
                    {
                        "chegada_martins": "21:00",
                        "chegada_minima": "21:00",
                        "chegada_maxima": "21:20"
                    }
                ]
            }
        },
        {
            "id": "PEQUIS",
            "nome": "PEQUIS",
            "ativa": True,
            "horarios": {
                "primeiro_turno": [
                    {
                        "chegada_martins": "05:20",
                        "chegada_minima": "04:50",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "chegada_martins": "06:55",
                        "chegada_minima": "06:25",
                        "chegada_maxima": "07:00"
                    },
                    {
                        "saida_martins": "13:40",
                        "chegada_minima": "13:30",
                        "chegada_maxima": "13:40"
                    },
                    {
                        "saida_martins": "15:30",
                        "chegada_minima": "15:20",
                        "chegada_maxima": "15:30"
                    },
                    {
                        "saida_martins": "17:00",
                        "chegada_minima": "17:20",
                        "chegada_maxima": "17:30"
                    }
                ],
                "segundo_turno": [
                    {
                        "saida_martins": "23:00",
                        "chegada_minima": "23:10",
                        "chegada_maxima": "23:40"
                    },
                    {
                        "saida_martins": "01:00",
                        "chegada_minima": "01:10",
                        "chegada_maxima": "01:20"
                    },
                    {
                        "saida_martins": "02:55",
                        "chegada_minima": "02:50",
                        "chegada_maxima": "03:20"
                    },
                    {
                        "saida_martins": "05:00",
                        "chegada_minima": "05:10",
                        "chegada_maxima": "05:20"
                    },
                    {
                        "saida_martins": "07:00",
                        "chegada_minima": "07:10",
                        "chegada_maxima": "07:20"
                    },
                    {
                        "chegada_martins": "15:00",
                        "chegada_minima": "15:00",
                        "chegada_maxima": "15:20"
                    },
                    {
                        "chegada_martins": "17:00",
                        "chegada_minima": "17:00",
                        "chegada_maxima": "17:20"
                    },
                    {
                        "chegada_martins": "21:00",
                        "chegada_minima": "21:00",
                        "chegada_maxima": "21:20"
                    }
                ]
            }
        }
    ]
    
    with obter_conexao() as conn:
        cursor = conn.cursor()
        for rota in rotas_padrao:
            cursor.execute('''
                INSERT INTO rotas (id, nome, ativa, horarios) 
                VALUES (?, ?, ?, ?)
            ''', (rota['id'], rota['nome'], 1 if rota['ativa'] else 0, json.dumps(rota['horarios'])))
        conn.commit()

# === FUNÇÕES PARA ROTAS ===

def carregar_rotas_config():
    """Carrega a configuração das rotas do banco de dados"""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM rotas')
        rows = cursor.fetchall()
        
        rotas = []
        for row in rows:
            rota = {
                'id': row['id'],
                'nome': row['nome'],
                'ativa': bool(row['ativa']),
                'horarios': json.loads(row['horarios'])
            }
            rotas.append(rota)
        
        return {'rotas': rotas}

def salvar_rotas_config(config):
    """Salva a configuração das rotas no banco de dados"""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        
        # Limpa todas as rotas existentes
        cursor.execute('DELETE FROM rotas')
        
        # Insere as novas rotas
        for rota in config['rotas']:
            cursor.execute('''
                INSERT INTO rotas (id, nome, ativa, horarios) 
                VALUES (?, ?, ?, ?)
            ''', (rota['id'], rota['nome'], 1 if rota['ativa'] else 0, json.dumps(rota['horarios'])))
        
        conn.commit()

def obter_rota_por_id(rota_id):
    """Obtém uma rota específica por ID"""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM rotas WHERE id = ?', (rota_id,))
        row = cursor.fetchone()
        
        if row:
            return {
                'id': row['id'],
                'nome': row['nome'],
                'ativa': bool(row['ativa']),
                'horarios': json.loads(row['horarios'])
            }
        return None

def criar_rota(rota_data):
    """Cria uma nova rota"""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO rotas (id, nome, ativa, horarios) 
            VALUES (?, ?, ?, ?)
        ''', (rota_data['id'], rota_data['nome'], 1 if rota_data['ativa'] else 0, json.dumps(rota_data['horarios'])))
        conn.commit()
        return rota_data

def atualizar_rota(rota_id, dados_atualizacao):
    """Atualiza uma rota existente"""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        
        # Obter rota atual
        cursor.execute('SELECT * FROM rotas WHERE id = ?', (rota_id,))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        # Atualizar dados
        rota_atual = {
            'id': row['id'],
            'nome': row['nome'],
            'ativa': bool(row['ativa']),
            'horarios': json.loads(row['horarios'])
        }
        
        rota_atual.update(dados_atualizacao)
        
        # Salvar no banco
        cursor.execute('''
            UPDATE rotas 
            SET nome = ?, ativa = ?, horarios = ? 
            WHERE id = ?
        ''', (rota_atual['nome'], 1 if rota_atual['ativa'] else 0, json.dumps(rota_atual['horarios']), rota_id))
        
        conn.commit()
        return rota_atual

def deletar_rota(rota_id):
    """Deleta uma rota"""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        
        # Obter rota antes de deletar
        cursor.execute('SELECT * FROM rotas WHERE id = ?', (rota_id,))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        rota_removida = {
            'id': row['id'],
            'nome': row['nome'],
            'ativa': bool(row['ativa']),
            'horarios': json.loads(row['horarios'])
        }
        
        # Deletar rota
        cursor.execute('DELETE FROM rotas WHERE id = ?', (rota_id,))
        conn.commit()
        
        return rota_removida

# === FUNÇÕES PARA PERCURSOS ===

def carregar_percursos():
    """Carrega os dados de percursos do banco de dados"""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM percursos ORDER BY data_criacao DESC')
        rows = cursor.fetchall()
        
        percursos = []
        for row in rows:
            percurso = {
                'id': row['id'],
                'rota_id': row['rota_id'],
                'nome_rota': row['nome_rota'],
                'data': row['data'],
                'turno': row['turno'],
                'horario_saida_programado': row['horario_saida_programado'],
                'horario_chegada_programado': row['horario_chegada_programado'],
                'horario_saida_real': row['horario_saida_real'],
                'horario_chegada_real': row['horario_chegada_real'],
                'atraso_saida': row['atraso_saida'],
                'atraso_chegada': row['atraso_chegada'],
                'observacoes': row['observacoes'] or '',
                'data_criacao': row['data_criacao'],
                'data_atualizacao': row['data_atualizacao']
            }
            percursos.append(percurso)
        
        return {'percursos': percursos}

def salvar_percursos(dados):
    """Salva os dados de percursos no banco de dados (compatibilidade)"""
    # Esta função é mantida para compatibilidade, mas não é mais necessária
    # pois os percursos são salvos individualmente
    pass

def obter_percursos_filtrados(rota_id=None, data_inicio=None, data_fim=None, turno=None):
    """Obtém percursos com filtros aplicados"""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        
        query = 'SELECT * FROM percursos WHERE 1=1'
        params = []
        
        if rota_id:
            query += ' AND rota_id = ?'
            params.append(rota_id)
        
        if data_inicio:
            query += ' AND data >= ?'
            params.append(data_inicio)
        
        if data_fim:
            query += ' AND data <= ?'
            params.append(data_fim)
        
        if turno:
            query += ' AND turno = ?'
            params.append(turno)
        
        query += ' ORDER BY data_criacao DESC'
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        percursos = []
        for row in rows:
            percurso = {
                'id': row['id'],
                'rota_id': row['rota_id'],
                'nome_rota': row['nome_rota'],
                'data': row['data'],
                'turno': row['turno'],
                'horario_saida_programado': row['horario_saida_programado'],
                'horario_chegada_programado': row['horario_chegada_programado'],
                'horario_saida_real': row['horario_saida_real'],
                'horario_chegada_real': row['horario_chegada_real'],
                'atraso_saida': row['atraso_saida'],
                'atraso_chegada': row['atraso_chegada'],
                'observacoes': row['observacoes'] or '',
                'data_criacao': row['data_criacao'],
                'data_atualizacao': row['data_atualizacao']
            }
            percursos.append(percurso)
        
        return percursos

def criar_percurso(percurso_data):
    """Cria um novo percurso"""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        
        # Gerar ID se não fornecido
        if 'id' not in percurso_data:
            percurso_data['id'] = str(uuid.uuid4())
        
        # Data de criação se não fornecida
        if 'data_criacao' not in percurso_data:
            percurso_data['data_criacao'] = datetime.now().isoformat()
        
        cursor.execute('''
            INSERT INTO percursos (
                id, rota_id, nome_rota, data, turno,
                horario_saida_programado, horario_chegada_programado,
                horario_saida_real, horario_chegada_real,
                atraso_saida, atraso_chegada, observacoes,
                data_criacao, data_atualizacao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            percurso_data['id'],
            percurso_data['rota_id'],
            percurso_data['nome_rota'],
            percurso_data['data'],
            percurso_data['turno'],
            percurso_data.get('horario_saida_programado'),
            percurso_data.get('horario_chegada_programado'),
            percurso_data.get('horario_saida_real'),
            percurso_data.get('horario_chegada_real'),
            percurso_data.get('atraso_saida', 0),
            percurso_data.get('atraso_chegada', 0),
            percurso_data.get('observacoes', ''),
            percurso_data['data_criacao'],
            percurso_data.get('data_atualizacao')
        ))
        
        conn.commit()
        return percurso_data

def obter_percurso_por_id(percurso_id):
    """Obtém um percurso específico por ID"""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM percursos WHERE id = ?', (percurso_id,))
        row = cursor.fetchone()
        
        if row:
            return {
                'id': row['id'],
                'rota_id': row['rota_id'],
                'nome_rota': row['nome_rota'],
                'data': row['data'],
                'turno': row['turno'],
                'horario_saida_programado': row['horario_saida_programado'],
                'horario_chegada_programado': row['horario_chegada_programado'],
                'horario_saida_real': row['horario_saida_real'],
                'horario_chegada_real': row['horario_chegada_real'],
                'atraso_saida': row['atraso_saida'],
                'atraso_chegada': row['atraso_chegada'],
                'observacoes': row['observacoes'] or '',
                'data_criacao': row['data_criacao'],
                'data_atualizacao': row['data_atualizacao']
            }
        return None

def atualizar_percurso(percurso_id, dados_atualizacao):
    """Atualiza um percurso existente"""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        
        # Obter percurso atual
        cursor.execute('SELECT * FROM percursos WHERE id = ?', (percurso_id,))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        # Atualizar dados
        percurso_atual = {
            'id': row['id'],
            'rota_id': row['rota_id'],
            'nome_rota': row['nome_rota'],
            'data': row['data'],
            'turno': row['turno'],
            'horario_saida_programado': row['horario_saida_programado'],
            'horario_chegada_programado': row['horario_chegada_programado'],
            'horario_saida_real': row['horario_saida_real'],
            'horario_chegada_real': row['horario_chegada_real'],
            'atraso_saida': row['atraso_saida'],
            'atraso_chegada': row['atraso_chegada'],
            'observacoes': row['observacoes'] or '',
            'data_criacao': row['data_criacao'],
            'data_atualizacao': row['data_atualizacao']
        }
        
        percurso_atual.update(dados_atualizacao)
        percurso_atual['data_atualizacao'] = datetime.now().isoformat()
        
        # Salvar no banco
        cursor.execute('''
            UPDATE percursos 
            SET rota_id = ?, nome_rota = ?, data = ?, turno = ?,
                horario_saida_programado = ?, horario_chegada_programado = ?,
                horario_saida_real = ?, horario_chegada_real = ?,
                atraso_saida = ?, atraso_chegada = ?, observacoes = ?,
                data_atualizacao = ?
            WHERE id = ?
        ''', (
            percurso_atual['rota_id'],
            percurso_atual['nome_rota'],
            percurso_atual['data'],
            percurso_atual['turno'],
            percurso_atual['horario_saida_programado'],
            percurso_atual['horario_chegada_programado'],
            percurso_atual['horario_saida_real'],
            percurso_atual['horario_chegada_real'],
            percurso_atual['atraso_saida'],
            percurso_atual['atraso_chegada'],
            percurso_atual['observacoes'],
            percurso_atual['data_atualizacao'],
            percurso_id
        ))
        
        conn.commit()
        return percurso_atual

def deletar_percurso(percurso_id):
    """Deleta um percurso"""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        
        # Obter percurso antes de deletar
        cursor.execute('SELECT * FROM percursos WHERE id = ?', (percurso_id,))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        percurso_removido = {
            'id': row['id'],
            'rota_id': row['rota_id'],
            'nome_rota': row['nome_rota'],
            'data': row['data'],
            'turno': row['turno'],
            'horario_saida_programado': row['horario_saida_programado'],
            'horario_chegada_programado': row['horario_chegada_programado'],
            'horario_saida_real': row['horario_saida_real'],
            'horario_chegada_real': row['horario_chegada_real'],
            'atraso_saida': row['atraso_saida'],
            'atraso_chegada': row['atraso_chegada'],
            'observacoes': row['observacoes'] or '',
            'data_criacao': row['data_criacao'],
            'data_atualizacao': row['data_atualizacao']
        }
        
        # Deletar percurso
        cursor.execute('DELETE FROM percursos WHERE id = ?', (percurso_id,))
        conn.commit()
        
        return percurso_removido


# === SENHAS (PBKDF2/SHA256) ===
_PBKDF2_ITER = 200_000

def _hash_password(password: str) -> str:
    """Gera hash 'pbkdf2_sha256$iter$salthex$hashhex'."""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, _PBKDF2_ITER)
    return f"pbkdf2_sha256${_PBKDF2_ITER}${salt.hex()}${dk.hex()}"

def _verify_password(stored: str, provided: str) -> bool:
    try:
        algo, iters, salthex, hashhex = stored.split('$', 3)
        if algo != 'pbkdf2_sha256':
            return False
        iters = int(iters)
        salt = bytes.fromhex(salthex)
        expected = bytes.fromhex(hashhex)
        dk = hashlib.pbkdf2_hmac('sha256', provided.encode('utf-8'), salt, iters)
        # comparação em tempo constante
        return hashlib.sha256(dk).digest() == hashlib.sha256(expected).digest()
    except Exception:
        return False

# === USUÁRIOS ===
def criar_usuario(username: str, nome: str, senha_plana: str, is_admin: bool = False, ativo: bool = True):
    with obter_conexao() as conn:
        cursor = conn.cursor()
        user_id = str(uuid.uuid4())
        agora = datetime.now().isoformat()
        senha_hash = _hash_password(senha_plana)
        cursor.execute('''
            INSERT INTO usuarios (id, username, nome, senha_hash, is_admin, ativo, criado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, username, nome, senha_hash, 1 if is_admin else 0, 1 if ativo else 0, agora))
        conn.commit()
        return {
            'id': user_id, 'username': username, 'nome': nome,
            'is_admin': bool(is_admin), 'ativo': bool(ativo), 'criado_em': agora
        }

def obter_usuario_por_username(username: str):
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM usuarios WHERE username = ?', (username,))
        row = cursor.fetchone()
        return dict(row) if row else None

def verificar_credenciais(username: str, senha_plana: str):
    """Retorna dict do usuário se ok (e atualiza ultimo_login), senão None."""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM usuarios WHERE username = ? AND ativo = 1', (username,))
        row = cursor.fetchone()
        if not row:
            return None
        if not _verify_password(row['senha_hash'], senha_plana):
            return None
        agora = datetime.now().isoformat()
        cursor.execute('UPDATE usuarios SET ultimo_login = ?, atualizado_em = ? WHERE id = ?',
                       (agora, agora, row['id']))
        conn.commit()
        return dict(row)

def atualizar_usuario(user_id: str, **dados):
    """Atualiza nome, username, senha (senha_plana), is_admin, ativo."""
    campos = []
    valores = []
    if 'nome' in dados:
        campos.append('nome = ?'); valores.append(dados['nome'])
    if 'username' in dados:
        campos.append('username = ?'); valores.append(dados['username'])
    if 'senha_plana' in dados and dados['senha_plana']:
        campos.append('senha_hash = ?'); valores.append(_hash_password(dados['senha_plana']))
    if 'is_admin' in dados:
        campos.append('is_admin = ?'); valores.append(1 if dados['is_admin'] else 0)
    if 'ativo' in dados:
        campos.append('ativo = ?'); valores.append(1 if dados['ativo'] else 0)
    if not campos:
        return None
    campos.append('atualizado_em = ?'); valores.append(datetime.now().isoformat())
    valores.append(user_id)
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(f'UPDATE usuarios SET {", ".join(campos)} WHERE id = ?', valores)
        conn.commit()
        return obter_usuario_por_id(user_id)

def obter_usuario_por_id(user_id: str):
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM usuarios WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def listar_usuarios():
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id, username, nome, is_admin, ativo, criado_em, atualizado_em, ultimo_login FROM usuarios ORDER BY criado_em DESC')
        return [dict(r) for r in cursor.fetchall()]

def contar_usuarios():
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM usuarios')
        return cursor.fetchone()[0]

def deletar_usuario(user_id: str):
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM usuarios WHERE id = ?', (user_id,))
        conn.commit()
        return True
