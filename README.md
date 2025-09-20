# MaxTour – PCP (Dashboard + API)

Aplicação de controle operacional com:
- Backend Flask servindo APIs e o dashboard estático
- Autenticação local (SQLite + PBKDF2-SHA256)
- Launcher em Tkinter (login e controle do servidor)
- Dashboard premium (ApexCharts, SheetJS) com foco em desempenho

## Requisitos

- Windows 10/11
- Python 3.12 ou 3.13 (64-bit recomendado)
- PowerShell (padrão do Windows)

## Instalação

1) (Opcional) Criar e ativar um ambiente virtual

```powershell
python -m venv .venv ; .\.venv\Scripts\Activate.ps1
```

2) Instalar dependências

```powershell
pip install -r requirements.txt
```

Observações:
- `sqlite3`, `hashlib`, `uuid`, `json`, `tkinter` são da biblioteca padrão (no Windows, o Python oficial já inclui Tkinter).
- Se estiver em Linux, `tkinter` pode exigir pacote do SO (ex.: `sudo apt install python3-tk`).

## Como executar

Execute o servidor com interface Tkinter:

```powershell
python servidor.py
```

Fluxo de execução:
- A base `dados.db` é inicializada (tabelas e dados padrão de rotas)
- Se não houver usuários, é criado `admin/admin` (alterar depois)
- A janela de login Tkinter é exibida
- Ao autenticar, a janela principal inicia o Flask em background e permite abrir o Dashboard (http://localhost:5000)

Credenciais iniciais (se base vazia):
- Usuário: `admin`
- Senha: `admin`

## Estrutura de pastas

```
.
├── banco.py              # Camada de dados (SQLite, CRUD, auth PBKDF2)
├── servidor.py           # Flask + UI Tkinter (launcher)
├── utils/
│   ├── dashboard.html    # Interface do Dashboard
│   ├── dashboard.js      # Lógica do frontend (ApexCharts/SheetJS)
│   └── style.css         # Estilos
├── dados.db              # Banco SQLite (gerado em runtime)
├── requirements.txt      # Dependências Python
└── README.md             # Este guia
```

## Endpoints principais

- GET `/api/config/rotas` – lista as rotas
- CRUD `/api/config/rotas/<id>` – cria/atualiza/remove
- GET `/api/percursos` – lista percursos com filtros (`rota`, `data_inicio`, `data_fim`, `turno`)
- POST `/api/percursos` – cria percurso (calcula atrasos ao informar horários reais)
- PUT/DELETE `/api/percursos/<id>` – atualiza/deleta percurso
- GET `/api/relatorio/atrasos` – resumo, por rota e detalhes

## Notas de desempenho (frontend)

- Debounce nas atualizações de gráficos
- Renderização em lote no relatório por rota
- Animações do ApexCharts reduzem/desligam com dataset grande
- CSS com font-smoothing global; overlay anti-banding opcional

Para ativar o anti-banding (opcional), adicione no final do `body` do `utils/dashboard.html`:

```html
<div class="anti-banding-overlay"></div>
```

## Dicas e problemas comuns

- Porta ocupada (5000): feche processos Flask antigos ou altere a porta em `servidor.py`.
- Falha ao abrir janela Tkinter: verifique se está usando o Python oficial e não o da Microsoft Store.
- Primeiro acesso: use `admin/admin` e troque a senha depois pelo banco (funções em `banco.py`).

## Licença

Uso interno. Ajuste conforme a política da sua organização.
