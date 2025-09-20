from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from datetime import datetime, time, timedelta
import uuid
import tkinter as tk
from tkinter import ttk
import webbrowser
import threading

# Importar todas as funções do banco de dados
from banco import (
    inicializar_banco,
    verificar_credenciais,
    contar_usuarios,
    criar_usuario,
    carregar_rotas_config,
    obter_rota_por_id,
    criar_rota,
    atualizar_rota,
    deletar_rota,
    carregar_percursos,
    obter_percursos_filtrados,
    criar_percurso,
    obter_percurso_por_id,
    atualizar_percurso,
    deletar_percurso
)

app = Flask(__name__, template_folder='utils', static_folder='utils')
CORS(app)

def solicitar_login():
    """Login modal via SQLite. Se não houver usuários, cria admin no banco e orienta o usuário."""
    # garante schema inicial
    try:
        _ = contar_usuarios()
    except Exception:
        inicializar_banco()

    # se ainda não houver usuários, garante admin/admin
    if contar_usuarios() == 0:
        try:
            criar_usuario('admin', 'Administrador', 'admin', is_admin=True)
        except Exception:
            pass 

    win = tk.Tk()
    win.title("Acesso – MaxTour")
    win.geometry("360x260")
    win.resizable(False, False)
    win.configure(bg="#2C3E50")
    ttk.Style().theme_use('clam')

    # centralizar
    win.update_idletasks()
    w, h = 360, 350
    x = (win.winfo_screenwidth() // 2) - (w // 2)
    y = (win.winfo_screenheight() // 2) - (h // 2)
    win.geometry(f"{w}x{h}+{x}+{y}")

    title = tk.Label(win, text="🔐 Acesso restrito", font=("Segoe UI", 14, "bold"),
                     bg="#2C3E50", fg="#ECF0F1")
    title.pack(pady=(16, 8))

    # dica primeiro acesso
    if contar_usuarios() == 1:
        tip = tk.Label(win, text="Primeiro acesso: usuário 'admin' / senha 'admin'\n(Altere depois em Usuários)",
                       font=("Segoe UI", 9), bg="#2C3E50", fg="#BDC3C7", justify="center")
        tip.pack()

    form = tk.Frame(win, bg="#2C3E50")
    form.pack(padx=24, fill="x", pady=(6, 0))

    tk.Label(form, text="Usuário", font=("Segoe UI", 10), bg="#2C3E50", fg="#BDC3C7").pack(anchor="w")
    ent_user = tk.Entry(form, font=("Segoe UI", 11))
    ent_user.pack(fill="x", pady=(2, 10))

    tk.Label(form, text="Senha", font=("Segoe UI", 10), bg="#2C3E50", fg="#BDC3C7").pack(anchor="w")
    ent_pass = tk.Entry(form, font=("Segoe UI", 11), show="•")
    ent_pass.pack(fill="x", pady=(2, 8))

    var_show = tk.BooleanVar(value=False)
    def toggle_show():
        ent_pass.config(show="" if var_show.get() else "•")
    tk.Checkbutton(form, text="Mostrar senha", variable=var_show, command=toggle_show,
                   bg="#2C3E50", fg="#BDC3C7",
                   activebackground="#2C3E50", selectcolor="#2C3E50").pack(anchor="w")

    lbl_err = tk.Label(win, text="", font=("Segoe UI", 9), bg="#2C3E50", fg="#FF6B6B")
    lbl_err.pack(pady=(6, 0))

    resultado = {"ok": False}

    def validar():
        u = ent_user.get().strip()
        p = ent_pass.get()
        user = verificar_credenciais(u, p)
        if user:
            resultado["ok"] = True
            win.destroy()
        else:
            lbl_err.config(text="Usuário ou senha inválidos.")
            win.bell()

    btns = tk.Frame(win, bg="#2C3E50")
    btns.pack(pady=14)
    tk.Button(btns, text="Entrar", command=validar,
              font=("Segoe UI", 10, "bold"),
              bg="#3498DB", fg="white", bd=0, padx=18, pady=8,
              activebackground="#2980B9", activeforeground="white").pack(side="left", padx=6)
    tk.Button(btns, text="Cancelar", command=win.destroy,
              font=("Segoe UI", 10, "bold"),
              bg="#E74C3C", fg="white", bd=0, padx=18, pady=8,
              activebackground="#C0392B", activeforeground="white").pack(side="left", padx=6)

    ent_user.bind("<Return>", lambda e: ent_pass.focus_set())
    ent_pass.bind("<Return>", lambda e: validar())
    ent_user.focus_set()
    win.protocol("WM_DELETE_WINDOW", win.destroy)
    win.mainloop()
    return resultado["ok"]

def criar_interface_servidor():
    """Cria uma interface gráfica moderna para mostrar o status do servidor"""
    import time
    
    def abrir_site():
        """Abre o site no navegador padrão com feedback visual"""
        # Animação do botão
        abrir_btn.configure(text="🔄 Abrindo...")
        root.update()
        webbrowser.open('http://localhost:5000')
        root.after(1500, lambda: abrir_btn.configure(text="🌐 Abrir Dashboard"))
    
    def fechar_aplicacao():
        """Fecha a aplicação com animação"""
        status_label.configure(text="🔴 Encerrando servidor...", foreground="#FF6B6B")
        root.update()
        root.after(1000, lambda: [root.quit(), root.destroy()])
    
    def animar_status():
        """Anima o status online"""
        cores = ["#4ECDC4", "#45B7B8", "#26C281", "#00D2D3"]
        for i, cor in enumerate(cores):
            root.after(i * 500, lambda c=cor: status_label.configure(foreground=c))
        root.after(2000, animar_status)  # Repetir animação
    
    # Criar janela principal
    root = tk.Tk()
    root.title("PCP MaxTour - Servidor de Gestão")
    root.geometry("480x430")
    root.resizable(False, False)
    root.configure(bg="#2C3E50")  # Fundo escuro elegante
    
    # Configurar estilo moderno
    style = ttk.Style()
    style.theme_use('clam')
    
    # Configurar cores personalizadas
    style.configure('Title.TLabel', 
                   background="#2C3E50", 
                   foreground="#ECF0F1", 
                   font=("Segoe UI", 20, "bold"))
    
    style.configure('Subtitle.TLabel', 
                   background="#2C3E50", 
                   foreground="#BDC3C7", 
                   font=("Segoe UI", 11))
    
    style.configure('Status.TLabel', 
                   background="#2C3E50", 
                   foreground="#4ECDC4", 
                   font=("Segoe UI", 14, "bold"))
    
    style.configure('URL.TLabel', 
                   background="#2C3E50", 
                   foreground="#3498DB", 
                   font=("Consolas", 11, "underline"))
    
    style.configure('Modern.TButton',
                   font=("Segoe UI", 10, "bold"),
                   padding=(20, 10))
    
    # Frame principal com padding
    main_frame = tk.Frame(root, bg="#2C3E50", padx=30, pady=20)
    main_frame.pack(fill="both", expand=True)
    
    # Header com logo e título
    header_frame = tk.Frame(main_frame, bg="#2C3E50")
    header_frame.pack(fill="x", pady=(0, 20))
    
    # Logo/Ícone grande
    logo_label = tk.Label(header_frame, text="🚌", font=("Segoe UI Emoji", 32), 
                         bg="#2C3E50", fg="#ECF0F1")
    logo_label.pack(side="left")
    
    # Títulos lado a lado
    title_frame = tk.Frame(header_frame, bg="#2C3E50")
    title_frame.pack(side="left", padx=(15, 0))
    
    titulo_label = tk.Label(title_frame, text="PCP MaxTour", 
                           font=("Segoe UI", 18, "bold"), 
                           bg="#2C3E50", fg="#ECF0F1")
    titulo_label.pack(anchor="w")
    
    subtitulo_label = tk.Label(title_frame, text="Sistema de Controle Operacional", 
                              font=("Segoe UI", 9), 
                              bg="#2C3E50", fg="#95A5A6")
    subtitulo_label.pack(anchor="w")
    
    # Linha separadora
    separador = tk.Frame(main_frame, height=2, bg="#34495E")
    separador.pack(fill="x", pady=(0, 25))
    
    # Container do status
    status_frame = tk.Frame(main_frame, bg="#34495E", relief="raised", bd=1)
    status_frame.pack(fill="x", pady=(0, 20), ipady=15)
    
    # Status do servidor com ícone animado
    status_label = tk.Label(status_frame, text="🟢 SERVIDOR ONLINE", 
                           font=("Segoe UI", 13, "bold"), 
                           bg="#34495E", fg="#4ECDC4")
    status_label.pack(pady=5)
    
    # URL clicável
    url_frame = tk.Frame(status_frame, bg="#34495E")
    url_frame.pack(pady=5)
    
    url_desc = tk.Label(url_frame, text="Endereço:", 
                       font=("Segoe UI", 9), 
                       bg="#34495E", fg="#95A5A6")
    url_desc.pack()
    
    url_label = tk.Label(url_frame, text="http://localhost:5000", 
                        font=("Consolas", 11, "bold"), 
                        bg="#34495E", fg="#3498DB", 
                        cursor="hand2")
    url_label.pack()
    url_label.bind("<Button-1>", lambda e: abrir_site())
    
    # Frame dos botões
    button_frame = tk.Frame(main_frame, bg="#2C3E50")
    button_frame.pack(fill="x", pady=(10, 0))
    
    # Botão principal - Abrir Dashboard
    abrir_btn = tk.Button(button_frame, text="🌐 Abrir Dashboard", 
                         command=abrir_site,
                         font=("Segoe UI", 11, "bold"),
                         bg="#3498DB", fg="white", 
                         relief="flat", bd=0,
                         padx=25, pady=12,
                         cursor="hand2",
                         activebackground="#2980B9",
                         activeforeground="white")
    abrir_btn.pack(side="left", padx=(0, 10))
    
    # Botão secundário - Fechar
    fechar_btn = tk.Button(button_frame, text="❌ Fechar Servidor", 
                          command=fechar_aplicacao,
                          font=("Segoe UI", 11, "bold"),
                          bg="#E74C3C", fg="white", 
                          relief="flat", bd=0,
                          padx=25, pady=12,
                          cursor="hand2",
                          activebackground="#C0392B",
                          activeforeground="white")
    fechar_btn.pack(side="right")
    
    # Efeitos hover nos botões
    def on_enter_abrir(e):
        abrir_btn.configure(bg="#2980B9")
    def on_leave_abrir(e):
        abrir_btn.configure(bg="#3498DB")
    
    def on_enter_fechar(e):
        fechar_btn.configure(bg="#C0392B")
    def on_leave_fechar(e):
        fechar_btn.configure(bg="#E74C3C")
    
    abrir_btn.bind("<Enter>", on_enter_abrir)
    abrir_btn.bind("<Leave>", on_leave_abrir)
    fechar_btn.bind("<Enter>", on_enter_fechar)
    fechar_btn.bind("<Leave>", on_leave_fechar)
    
    # Rodapé com informações
    footer_frame = tk.Frame(main_frame, bg="#2C3E50")
    footer_frame.pack(fill="x", side="bottom", pady=(20, 0))
    
    footer_label = tk.Label(footer_frame, 
                           text="💡 Clique na URL ou no botão para acessar o sistema", 
                           font=("Segoe UI", 8), 
                           bg="#2C3E50", fg="#7F8C8D")
    footer_label.pack()
    
    # Centralizar janela na tela
    root.update_idletasks()
    width = root.winfo_width()
    height = root.winfo_height()
    x = (root.winfo_screenwidth() // 2) - (width // 2)
    y = (root.winfo_screenheight() // 2) - (height // 2)
    root.geometry(f'{width}x{height}+{x}+{y}')
    
    # Iniciar animação do status
    root.after(1000, animar_status)
    
    # Ícone da janela (se disponível)
    try:
        root.iconbitmap("favicon.ico")
    except:
        pass
    
    return root

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
def criar_config_rota():
    """Cria uma nova rota"""
    try:
        nova_rota = request.get_json()
        
        # Validação básica
        campos_obrigatorios = ['id', 'nome', 'horarios']
        for campo in campos_obrigatorios:
            if campo not in nova_rota:
                return jsonify({'erro': f'Campo obrigatório: {campo}'}), 400
        
        # Verifica se a rota já existe
        rota_existente = obter_rota_por_id(nova_rota['id'])
        if rota_existente:
            return jsonify({'erro': 'Rota com este ID já existe'}), 400
        
        # Define valor padrão para 'ativa' se não fornecido
        if 'ativa' not in nova_rota:
            nova_rota['ativa'] = True
        
        # Cria a rota no banco
        rota_criada = criar_rota(nova_rota)
        return jsonify(rota_criada), 201
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/api/config/rotas/<rota_id>', methods=['PUT'])
def atualizar_config_rota(rota_id):
    """Atualiza configuração de uma rota"""
    try:
        dados_atualizacao = request.get_json()
        rota_atualizada = atualizar_rota(rota_id, dados_atualizacao)
        
        if rota_atualizada is None:
            return jsonify({'erro': 'Rota não encontrada'}), 404
        
        return jsonify(rota_atualizada)
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/api/config/rotas/<rota_id>', methods=['DELETE'])
def deletar_config_rota(rota_id):
    """Deleta uma rota"""
    try:
        rota_removida = deletar_rota(rota_id)
        
        if rota_removida is None:
            return jsonify({'erro': 'Rota não encontrada'}), 404
        
        return jsonify({'mensagem': 'Rota removida com sucesso', 'rota': rota_removida})
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500
    
# === ROTAS DE PERCURSO ===

@app.route('/api/percursos', methods=['GET'])
def obter_percursos():
    """Obtém todos os percursos com filtros opcionais"""
    # Filtros opcionais
    rota_id = request.args.get('rota')
    data_inicio = request.args.get('data_inicio')
    data_fim = request.args.get('data_fim')
    turno = request.args.get('turno')
    
    # Obter percursos filtrados
    percursos = obter_percursos_filtrados(rota_id, data_inicio, data_fim, turno)
    
    return jsonify(percursos)

@app.route('/api/percursos', methods=['POST'])
def registrar_percurso():
    """Registra um novo percurso"""
    try:
        novo_percurso = request.get_json()
        
        # Validação básica
        campos_obrigatorios = ['rota_id', 'data', 'turno']
        for campo in campos_obrigatorios:
            if campo not in novo_percurso:
                return jsonify({'erro': f'Campo obrigatório: {campo}'}), 400
        
        # Verifica se a rota existe
        rota = obter_rota_por_id(novo_percurso['rota_id'])
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
                primeiro_horario = horarios_programados[0]
                # Verifica se é horário de chegada ou saída na Martins
                if 'chegada_martins' in primeiro_horario:
                    novo_percurso['horario_saida_programado'] = primeiro_horario['chegada_martins']
                elif 'saida_martins' in primeiro_horario:
                    novo_percurso['horario_saida_programado'] = primeiro_horario['saida_martins']
                else:
                    # Fallback para estrutura antiga
                    novo_percurso['horario_saida_programado'] = primeiro_horario.get('saida', '')
                
                novo_percurso['horario_chegada_programado'] = primeiro_horario['chegada_maxima']
            else:
                # Estrutura antiga (compatibilidade)
                if 'chegada_martins' in horarios_programados:
                    novo_percurso['horario_saida_programado'] = horarios_programados['chegada_martins']
                elif 'saida_martins' in horarios_programados:
                    novo_percurso['horario_saida_programado'] = horarios_programados['saida_martins']
                else:
                    novo_percurso['horario_saida_programado'] = horarios_programados.get('saida', '')
                novo_percurso['horario_chegada_programado'] = horarios_programados.get('chegada_maxima', horarios_programados.get('chegada', ''))
        
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
        
        # Cria o percurso no banco
        percurso_criado = criar_percurso(novo_percurso)
        
        return jsonify(percurso_criado), 201
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/api/percursos/<percurso_id>', methods=['PUT'])
def atualizar_percurso_api(percurso_id):
    """Atualiza um percurso existente"""
    try:
        dados_atualizacao = request.get_json()
        
        # Obter percurso atual
        percurso_atual = obter_percurso_por_id(percurso_id)
        if not percurso_atual:
            return jsonify({'erro': 'Percurso não encontrado'}), 404
        
        # Se horários reais foram atualizados, recalcula atrasos
        if 'horario_saida_real' in dados_atualizacao or 'horario_chegada_real' in dados_atualizacao:
            rota = obter_rota_por_id(percurso_atual['rota_id'])
            if rota:
                horarios_programados = rota['horarios'][percurso_atual['turno']]
                
                # Determina horários programados baseados na estrutura
                if isinstance(horarios_programados, list):
                    horario_saida_prog = percurso_atual.get('horario_saida_programado')
                    horario_chegada_prog = percurso_atual.get('horario_chegada_programado')
                else:
                    # Estrutura única - verificar se tem campos novos ou antigos
                    if 'chegada_martins' in horarios_programados:
                        horario_saida_prog = horarios_programados['chegada_martins']
                    elif 'saida_martins' in horarios_programados:
                        horario_saida_prog = horarios_programados['saida_martins']
                    else:
                        horario_saida_prog = horarios_programados.get('saida', '')
                    
                    horario_chegada_prog = horarios_programados.get('chegada_maxima', horarios_programados.get('chegada', ''))
                
                if 'horario_saida_real' in dados_atualizacao and horario_saida_prog:
                    dados_atualizacao['atraso_saida'] = calcular_atraso(
                        horario_saida_prog,
                        dados_atualizacao['horario_saida_real']
                    )
                
                if 'horario_chegada_real' in dados_atualizacao and horario_chegada_prog:
                    dados_atualizacao['atraso_chegada'] = calcular_atraso(
                        horario_chegada_prog,
                        dados_atualizacao['horario_chegada_real']
                    )
        
        # Atualizar no banco
        percurso_atualizado = atualizar_percurso(percurso_id, dados_atualizacao)
        
        return jsonify(percurso_atualizado)
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/api/percursos/<percurso_id>', methods=['DELETE'])
def deletar_percurso_api(percurso_id):
    """Deleta um percurso"""
    try:
        percurso_removido = deletar_percurso(percurso_id)
        
        if percurso_removido is None:
            return jsonify({'erro': 'Percurso não encontrado'}), 404
        
        return jsonify({'mensagem': 'Percurso removido com sucesso', 'percurso': percurso_removido})
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# === RELATÓRIOS ===

@app.route('/api/relatorio/atrasos', methods=['GET'])
def relatorio_atrasos():
    """Gera relatório completo de atrasos"""
    # Filtros
    rota_id = request.args.get('rota')
    data_inicio = request.args.get('data_inicio')
    data_fim = request.args.get('data_fim')
    
    # Obter percursos filtrados diretamente do banco
    percursos_filtrados = obter_percursos_filtrados(rota_id, data_inicio, data_fim, None)
    config_rotas = carregar_rotas_config()
    rotas_config = config_rotas['rotas']
    
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
    # Para média de atraso de chegada, considerar apenas valores positivos (atrasos reais)
    atrasos_chegada_positivos = [a for a in atrasos_chegada if a > 0]
    media_atraso_chegada = round(sum(atrasos_chegada_positivos) / len(atrasos_chegada_positivos), 1) if atrasos_chegada_positivos else 0
    
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
        
        # Para média de atraso de chegada por rota, considerar apenas valores positivos
        atrasos_chegada_rota_positivos = [a for a in atrasos_chegada_rota if a > 0]
        
        estatisticas_por_rota[rota_nome] = {
            'total_percursos': len(percursos_rota),
            'media_atraso_saida': round(sum(atrasos_saida_rota) / len(atrasos_saida_rota), 1) if atrasos_saida_rota else 0,
            'media_atraso_chegada': round(sum(atrasos_chegada_rota_positivos) / len(atrasos_chegada_rota_positivos), 1) if atrasos_chegada_rota_positivos else 0,
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
    inicializar_banco()          # garante tabelas
    if not solicitar_login():    # valida no SQLite
        raise SystemExit(0)

    root = criar_interface_servidor()

    def rodar_flask():
        app.run(debug=False, host='0.0.0.0', port=5000, use_reloader=False)

    flask_thread = threading.Thread(target=rodar_flask, daemon=True)
    flask_thread.start()
    root.mainloop()

