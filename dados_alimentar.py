#!/usr/bin/env python3
"""
Script para alimentar o banco de dados com dados fictícios
Período: 01/07/2025 a 08/07/2025 (exceto domingos)
Todas as rotas, todos os horários, com atrasos aleatórios de 1-10min ou no horário
"""

import sqlite3
import uuid
import random
from datetime import datetime, timedelta
from banco import carregar_rotas_config, inicializar_banco

def calcular_horario_real(horario_programado, atraso_minutos):
    """Calcula o horário real baseado no programado + atraso"""
    try:
        if not horario_programado:
            return None
        
        # Converter horário programado para datetime
        hora, minuto = map(int, horario_programado.split(':'))
        dt_programado = datetime.now().replace(hour=hora, minute=minuto, second=0, microsecond=0)
        
        # Adicionar atraso
        dt_real = dt_programado + timedelta(minutes=atraso_minutos)
        
        # Retornar como string HH:MM
        return dt_real.strftime('%H:%M')
    except:
        return horario_programado

def gerar_dados_ficticios():
    """Gera dados fictícios para o período especificado"""
    
    # Inicializar banco
    inicializar_banco()
    
    # Carregar configuração das rotas
    config = carregar_rotas_config()
    rotas = config.get('rotas', [])
    
    if not rotas:
        print("❌ Nenhuma rota encontrada! Certifique-se de que há rotas configuradas.")
        return
    
    # Conectar ao banco
    conn = sqlite3.connect('dados.db')
    cursor = conn.cursor()
    
    # Período: 01/07/2025 a 08/07/2025
    data_inicio = datetime(2025, 1, 1)
    data_fim = datetime(2025, 8, 8)
    
    total_percursos = 0
    
    print("🚌 Iniciando geração de dados fictícios...")
    print(f"📅 Período: {data_inicio.strftime('%d/%m/%Y')} a {data_fim.strftime('%d/%m/%Y')}")
    print(f"🛣️  Rotas encontradas: {len(rotas)}")
    
    # Iterar por cada dia no período
    data_atual = data_inicio
    while data_atual <= data_fim:
        # Pular domingos (weekday 6 = domingo)
        if data_atual.weekday() == 6:  # 6 = domingo
            print(f"⏭️  Pulando domingo: {data_atual.strftime('%d/%m/%Y')}")
            data_atual += timedelta(days=1)
            continue
        
        data_str = data_atual.strftime('%Y-%m-%d')
        dia_semana = data_atual.strftime('%A')
        
        print(f"\n📆 Processando {dia_semana}, {data_atual.strftime('%d/%m/%Y')}...")
        
        # Para cada rota
        for rota in rotas:
            rota_id = rota['id']
            rota_nome = rota['nome']
            horarios = rota.get('horarios', {})
            
            print(f"  🚍 Rota: {rota_nome}")
            
            # Para cada turno (primeiro_turno e segundo_turno)
            for turno_nome, horarios_turno in horarios.items():
                if not horarios_turno:
                    continue
                
                turno_display = "1º Turno" if turno_nome == "primeiro_turno" else "2º Turno"
                print(f"    ⏰ {turno_display}")
                
                # Garantir que horarios_turno seja uma lista
                if isinstance(horarios_turno, dict):
                    horarios_turno = [horarios_turno]
                
                # Para cada horário do turno
                for idx, horario in enumerate(horarios_turno):
                    # Determinar horários programados
                    if 'chegada_martins' in horario:
                        horario_saida_prog = horario['chegada_martins']
                    elif 'saida_martins' in horario:
                        horario_saida_prog = horario['saida_martins']
                    else:
                        horario_saida_prog = horario.get('saida', '')
                    
                    horario_chegada_prog = horario.get('chegada_maxima', horario.get('chegada', ''))
                    
                    if not horario_saida_prog:
                        continue
                    
                    # Gerar atraso aleatório (70% no horário, 30% com atraso de 1-10 min)
                    if random.random() < 0.7:  # 70% chance de estar no horário
                        atraso_saida = 0
                        atraso_chegada = 0
                        status_desc = "No horário"
                    else:  # 30% chance de ter atraso de 1-10 minutos
                        atraso_saida = random.randint(-10, 10)
                        atraso_chegada = random.randint(-10, 10)
                        status_desc = f"Atraso {max(atraso_saida, atraso_chegada)}min"
                    
                    # Calcular horários reais
                    horario_saida_real = calcular_horario_real(horario_saida_prog, atraso_saida)
                    horario_chegada_real = calcular_horario_real(horario_chegada_prog, atraso_chegada) if horario_chegada_prog else None
                    
                    # Gerar dados do percurso
                    percurso = {
                        'id': str(uuid.uuid4()),
                        'rota_id': rota_id,
                        'nome_rota': rota_nome,
                        'data': data_str,
                        'turno': turno_nome,
                        'horario_saida_programado': horario_saida_prog,
                        'horario_chegada_programado': horario_chegada_prog,
                        'horario_saida_real': horario_saida_real,
                        'horario_chegada_real': horario_chegada_real,
                        'atraso_saida': atraso_saida,
                        'atraso_chegada': atraso_chegada,
                        'observacoes': f'Dados fictícios - {status_desc}',
                        'data_criacao': datetime.now().isoformat(),
                        'data_atualizacao': None
                    }
                    
                    # Inserir no banco
                    cursor.execute('''
                        INSERT INTO percursos (
                            id, rota_id, nome_rota, data, turno,
                            horario_saida_programado, horario_chegada_programado,
                            horario_saida_real, horario_chegada_real,
                            atraso_saida, atraso_chegada, observacoes,
                            data_criacao, data_atualizacao
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        percurso['id'], percurso['rota_id'], percurso['nome_rota'],
                        percurso['data'], percurso['turno'],
                        percurso['horario_saida_programado'], percurso['horario_chegada_programado'],
                        percurso['horario_saida_real'], percurso['horario_chegada_real'],
                        percurso['atraso_saida'], percurso['atraso_chegada'],
                        percurso['observacoes'], percurso['data_criacao'], percurso['data_atualizacao']
                    ))
                    
                    total_percursos += 1
                    print(f"      ✅ {horario_saida_prog} - {status_desc}")
        
        data_atual += timedelta(days=1)
    
    # Confirmar transação
    conn.commit()
    conn.close()
    
    print(f"\n🎉 Dados fictícios gerados com sucesso!")
    print(f"📊 Total de percursos criados: {total_percursos}")
    print(f"📅 Período: 01/07/2025 a 08/07/2025 (exceto domingos)")
    print(f"⚡ Status: 70% no horário, 30% com atraso de 1-10 minutos")

def limpar_dados_periodo():
    """Remove dados do período especificado antes de gerar novos"""
    conn = sqlite3.connect('dados.db')
    cursor = conn.cursor()
    
    # Deletar dados do período
    cursor.execute('''
        DELETE FROM percursos 
        WHERE data BETWEEN '2025-07-01' AND '2025-07-08'
        AND observacoes LIKE '%Dados fictícios%'
    ''')
    
    removidos = cursor.rowcount
    conn.commit()
    conn.close()
    
    if removidos > 0:
        print(f"🗑️  Removidos {removidos} registros fictícios anteriores")

if __name__ == '__main__':
    print("🚌 GERADOR DE DADOS FICTÍCIOS - PCP MaxTour")
    print("=" * 50)
    
    # Perguntar se deve limpar dados anteriores
    resposta = input("🤔 Limpar dados fictícios anteriores do período? (s/n): ").lower().strip()
    if resposta in ['s', 'sim', 'y', 'yes']:
        limpar_dados_periodo()
    
    # Gerar novos dados
    try:
        gerar_dados_ficticios()
    except Exception as e:
        print(f"❌ Erro durante a geração: {e}")
        import traceback
        traceback.print_exc()
    
    input("\n✅ Pressione Enter para finalizar...")