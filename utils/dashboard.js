// API Base URL
const API_BASE = 'http://localhost:5000/api';

// Estado global da aplicação
let rotas = [];
let jornadas = [];
let currentTab = 'dashboard';

// Variáveis dos gráficos
let candlestickChart = null;
let pizzaChart = null;

// Variáveis do sistema de tooltip
let tooltipElement = null; // Tooltip global reutilizável
let tooltipTimeout = null;
let isTooltipVisible = false;
let currentTooltipTarget = null;
let mouseOverTooltip = false;
let tooltipTransitionTimeout = null;
let lastTooltipShowTime = 0;
let hideTooltipTimer = null;
let lastTooltipContent = ''; // Cache do último conteúdo para evitar re-render desnecessário

// Cache e otimizações para ApexCharts tooltips
const _tooltipCache = new Map(); // Cache global para HTML de tooltips
let _cachedSelectValues = { turno: '1', tipoHorario: 'saida' }; // Cache de valores dos selects

// Blocos HTML constantes para tooltips - criados uma vez para reutilização
const _tooltipConstants = {
    headerGradient: 'background: linear-gradient(145deg, rgba(15, 23, 42, 0.97), rgba(30, 41, 59, 0.95));',
    topBar: '<div style="position: absolute;top: 0;left: 0;right: 0;height: 4px;background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7, #c084fc);"></div>',
    baseStyle: 'color: #f8fafc;padding: 24px;border-radius: 18px;box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4), 0 10px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1);border: 1px solid rgba(148, 163, 184, 0.3);font-family: "Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;font-size: 13px;min-width: 320px;max-width: 360px;backdrop-filter: blur(20px);-webkit-backdrop-filter: blur(20px);position: relative;overflow: hidden;animation: tooltipFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);'
};

// Função para atualizar cache de selects - chamada nos eventos change
function updateSelectCache() {
    const turnoSelect = document.getElementById('analytics-turno');
    const tipoSelect = document.getElementById('analytics-tipo-horario');
    _cachedSelectValues.turno = turnoSelect ? turnoSelect.value : '1';
    _cachedSelectValues.tipoHorario = tipoSelect ? tipoSelect.value : 'saida';
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    
    initializeApp();
    setupEventListeners();
    updateClock();
    updateHeaderDate();
    setInterval(updateClock, 1000);
    
    // Configurar cache de selects para otimização de tooltips
    updateSelectCache();
    const turnoSelect = document.getElementById('analytics-turno');
    const tipoSelect = document.getElementById('analytics-tipo-horario');
    if (turnoSelect) turnoSelect.addEventListener('change', updateSelectCache);
    if (tipoSelect) tipoSelect.addEventListener('change', updateSelectCache);
});

// Atualizar relógio e data no header
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('pt-BR');
    const timeElement = document.getElementById('current-time');
    
    if (timeElement) {
        timeElement.textContent = timeString;
    }
}

function updateHeaderDate() {
    const now = new Date();
    const dateString = now.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    const dateElement = document.getElementById('current-date');
    
    if (dateElement) {
        dateElement.textContent = dateString;
    }
}

async function initializeApp() {
    
    try {
        await carregarRotas();
        await carregarJornadas();
        await carregarDashboard();
        
        // Carregar dados de performance de turnos com dados reais
        setTimeout(async () => {
            await carregarPerformanceTurnosEnhanced();
        }, 2000); // Delay para garantir que os dados principais estejam carregados
        
        // Inicializar recursos premium dos relatórios
        addRelatorioStyles();
        
    } catch (error) {
        console.error('❌ Erro na inicialização da aplicação:', error);
    }
    
    // Define data atual nos filtros (usando função utilitária)
    const dataString = obterDataHoje();
    
    const filtroData = document.getElementById('filtro-data');
    const jornadaData = document.getElementById('jornada-data');
    const dataInicio = document.getElementById('data-inicio');
    const dataFim = document.getElementById('data-fim');
    
    if (filtroData) filtroData.value = dataString;
    if (jornadaData) jornadaData.value = dataString;
    if (dataInicio) dataInicio.value = dataString;
    if (dataFim) dataFim.value = dataString;
    
    // Configurar filtros de analytics
    const analyticsDataInicio = document.getElementById('analytics-data-inicio');
    const analyticsDataFim = document.getElementById('analytics-data-fim');
    
    if (analyticsDataInicio) analyticsDataInicio.value = dataString;
    if (analyticsDataFim) analyticsDataFim.value = dataString;
    
    // Inicializar gráficos
    inicializarGraficosAnalytics();
    
    // Garantir que os KPIs sejam atualizados após todos os elementos estarem prontos
    setTimeout(() => {
        atualizarKPIs(null);
    }, 200);
}

function inicializarGraficosAnalytics() {
    // Garantir que as rotas sejam carregadas antes de configurar os filtros
    setTimeout(async () => {
        // Aguardar carregamento das rotas se necessário
        if (!rotas || rotas.length === 0) {
            await carregarRotas();
        }
        
        // Configurar filtros de horário baseados no turno padrão e rotas carregadas
        atualizarFiltroHorario();
    }, 100);
    
    // Criar gráficos vazios
    setTimeout(() => {
        criarGraficoCandlestick();
        criarGraficoPizza();
        
        // Carregar dados iniciais após criar os gráficos
        setTimeout(() => {
            atualizarGraficosAnalytics();
        }, 500);
    }, 1000); // Delay para garantir que os elementos existam
}

function setupEventListeners() {
    // Navegação das abas
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            switchTab(tab);
        });
    });

    // Forms
    const formJornada = document.getElementById('form-jornada');
    const formRota = document.getElementById('form-rota');
    
    if (formJornada) formJornada.addEventListener('submit', salvarJornada);
    if (formRota) formRota.addEventListener('submit', salvarRota);

    // Filtros
    const filtroRota = document.getElementById('filtro-rota');
    const filtroTurno = document.getElementById('filtro-turno');
    const filtroData = document.getElementById('filtro-data');
    
    if (filtroRota) filtroRota.addEventListener('change', filtrarJornadas);
    if (filtroTurno) filtroTurno.addEventListener('change', filtrarJornadas);
    if (filtroData) filtroData.addEventListener('change', filtrarJornadas);
}

function switchTab(tabName) {
    // Remove active das abas
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Ativa nova aba
    const navItem = document.querySelector(`[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(tabName);
    
    if (navItem) navItem.classList.add('active');
    if (tabContent) tabContent.classList.add('active');

    // Atualiza título
    const titles = {
        dashboard: 'Sistema MaxTour',
        jornadas: 'Controle de Jornadas',
        rotas: 'Configuração de Rotas',
        relatorios: 'Relatórios de Performance'
    };
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = titles[tabName] || 'Sistema MaxTour';

    currentTab = tabName;

    // Carrega dados específicos da aba
    if (tabName === 'dashboard') {
        carregarDashboard();
    } else if (tabName === 'jornadas') {
        // Define data de hoje no filtro sempre que abrir a aba Jornadas
        const filtroData = document.getElementById('filtro-data');
        if (filtroData) {
            filtroData.value = obterDataHoje();
        }
        renderizarJornadas();
    } else if (tabName === 'rotas') {
        renderizarRotasConfig();
    }
}

// === API CALLS ===

async function carregarRotas() {
    try {
        const response = await fetch(`${API_BASE}/config/rotas`);
        const data = await response.json();
        
        // A API retorna diretamente o array de rotas, não um objeto com propriedade 'rotas'
        rotas = Array.isArray(data) ? data : (data.rotas || []);
        
        console.log(`📊 ${rotas.length} rotas carregadas`);
        
        // Validar consistência dos dados carregados
        validarConsistenciaRotas();
        
        // Atualiza selects
        atualizarSelectRotas();
        
        // Atualizar sidebar com número real de rotas ativas
        atualizarSidebarRotasAtivas();
        
        // Atualizar horários disponíveis se modal de jornada estiver aberto
        const modalJornada = document.getElementById('modal-jornada');
        if (modalJornada && modalJornada.style.display === 'flex') {
            // Delay pequeno para garantir que os selects sejam atualizados primeiro
            setTimeout(() => {
                atualizarHorariosDisponiveis();
            }, 100);
        }
        
        // Atualizar gráficos após carregar rotas para usar a primeira rota automaticamente
        setTimeout(() => {
            if (currentTab === 'dashboard') {
                atualizarGraficosAnalytics();
            }
        }, 500);
        
        return rotas; // Retornar para permitir await
    } catch (error) {
        console.error('Erro ao carregar rotas:', error);
        rotas = [];
        atualizarSelectRotas();
        atualizarSidebarRotasAtivas();
        return [];
    }
}

// Função para atualizar o número de rotas ativas no sidebar
function atualizarSidebarRotasAtivas() {
    const sidebarElement = document.getElementById('sidebar-online-routes');
    if (!sidebarElement) {
        console.warn('Elemento sidebar-online-routes não encontrado');
        return;
    }
    
    if (!rotas || !Array.isArray(rotas)) {
        sidebarElement.textContent = '0';
        return;
    }
    
    // Contar apenas rotas ativas
    const rotasAtivas = rotas.filter(rota => rota.ativa !== false).length;
    
    // Atualizar o elemento
    sidebarElement.textContent = rotasAtivas.toString();
    
    // Atualizar cor do ícone baseado no número de rotas
    const iconElement = sidebarElement.closest('.quick-stat-item')?.querySelector('.stat-icon');
    if (iconElement) {
        // Remover classes antigas
        iconElement.classList.remove('success', 'warning', 'danger');
        
        if (rotasAtivas >= 5) {
            iconElement.classList.add('success');
        } else if (rotasAtivas >= 3) {
            iconElement.classList.add('warning');
        } else {
            iconElement.classList.add('danger');
        }
    }
}

async function carregarJornadas() {
    try {
        const response = await fetch(`${API_BASE}/percursos`);
        jornadas = await response.json();
        // Se a resposta for uma lista diretamente, usar ela; senão, usar a propriedade percursos
        if (Array.isArray(jornadas)) {
            // A resposta já é um array
        } else if (jornadas.percursos) {
            jornadas = jornadas.percursos;
        }
        if (currentTab === 'jornadas') renderizarJornadas();
    } catch (error) {
        console.error('Erro ao carregar jornadas:', error);
        jornadas = [];
        if (currentTab === 'jornadas') renderizarJornadas();
    }
}

async function carregarDashboard() {
    try {
        // Carrega relatório geral
        const response = await fetch(`${API_BASE}/relatorio/atrasos`);
        const relatorio = await response.json();
        
        atualizarKPIs(relatorio);
        atualizarStatusRotas();
        atualizarPerformanceTurnos(relatorio);
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        
        // Limpar todos os KPIs em caso de erro
        atualizarKPIs(null);
        atualizarStatusRotas();
        atualizarPerformanceTurnos(null);
    }
}

// === DASHBOARD ===

function atualizarKPIs(relatorio) {
    const dataString = obterDataHoje();
    const jornadasHoje = jornadas.filter(j => j.data === dataString);
    
    // Calcular atrasos de HOJE dinamicamente baseado APENAS na chegada
    const atrasosHoje = jornadasHoje.filter(j => {
        // Verificar APENAS atraso de chegada
        if (j.horario_chegada_programado && j.horario_chegada_real) {
            const chegadaProgramada = converterHorarioParaMinutos(j.horario_chegada_programado);
            const chegadaReal = converterHorarioParaMinutos(j.horario_chegada_real);
            return chegadaReal > chegadaProgramada;
        }
        return false;
    });
    
    // Calcular atrasos de TODAS as jornadas dinamicamente baseado APENAS na chegada
    const atrasosGerais = jornadas.filter(j => {
        // Verificar APENAS atraso de chegada
        if (j.horario_chegada_programado && j.horario_chegada_real) {
            const chegadaProgramada = converterHorarioParaMinutos(j.horario_chegada_programado);
            const chegadaReal = converterHorarioParaMinutos(j.horario_chegada_real);
            return chegadaReal > chegadaProgramada;
        }
        return false;
    });
    
    // Pontualidade geral (todos os dias)
    const pontualidadeGeral = jornadas.length > 0 ? 
        Math.round(((jornadas.length - atrasosGerais.length) / jornadas.length) * 100) : 0;
    
    // Pontualidade hoje
    const pontualidadeHoje = jornadasHoje.length > 0 ? 
        Math.round(((jornadasHoje.length - atrasosHoje.length) / jornadasHoje.length) * 100) : 0;
    
    // Atualizar elementos da interface
    const pontualidadeGeralEl = document.getElementById('pontualidade-geral');
    const pontualidadeHojeEl = document.getElementById('pontualidade-hoje');
    const atrasosHojeEl = document.getElementById('atrasos-hoje');
    const jornadasHojeEl = document.getElementById('jornadas-hoje');
    const totalJornadas = document.getElementById('total-jornadas');
    
    if (pontualidadeGeralEl) {
        pontualidadeGeralEl.textContent = `${pontualidadeGeral}%`;
    } else {
        // Tentar novamente após um delay se o elemento não estiver disponível
        setTimeout(() => {
            const el = document.getElementById('pontualidade-geral');
            if (el) el.textContent = `${pontualidadeGeral}%`;
        }, 100);
    }
    
    if (pontualidadeHojeEl) {
        pontualidadeHojeEl.textContent = `${pontualidadeHoje}%`;
    } else {
        // Tentar novamente após um delay se o elemento não estiver disponível
        setTimeout(() => {
            const el = document.getElementById('pontualidade-hoje');
            if (el) el.textContent = `${pontualidadeHoje}%`;
        }, 100);
    }
    
    // Atrasos e jornadas agora são de TODOS os dias
    if (atrasosHojeEl) atrasosHojeEl.textContent = atrasosGerais.length;
    if (jornadasHojeEl) jornadasHojeEl.textContent = jornadas.length;
    if (totalJornadas) totalJornadas.textContent = jornadas.length;
}

function atualizarStatusRotas() {
    const grid = document.getElementById('rotas-status-grid');
    if (!grid) return;
    
    // Usar DocumentFragment para render em lote - evita reflows múltiplos
    const fragment = document.createDocumentFragment();

    rotas.forEach(rota => {
        const jornadasRota = jornadas.filter(j => j.rota_id === rota.id);
        const ultimaJornada = jornadasRota[jornadasRota.length - 1];
        
        let statusClass = '';
        let statusText = 'No horário';
        let ultimoUpdate = 'Sem dados';
        let chegadaPrevista = '--:--';
        let tooltipContent = '';

        if (ultimaJornada) {
            // Calcular status baseado APENAS na chegada
            const atrasoChegada = ultimaJornada.atraso_chegada || 0;
            const atrasoAbs = Math.abs(atrasoChegada);
            
            if (atrasoAbs > 15) {
                statusClass = atrasoChegada > 0 ? 'atraso-grave' : 'status-ok';
                statusText = atrasoChegada > 0 ? 'Atraso Grave' : 'Muito Adiantado';
            } else if (atrasoAbs > 5) {
                statusClass = atrasoChegada > 0 ? 'atraso-moderado' : 'status-ok';
                statusText = atrasoChegada > 0 ? 'Atraso Moderado' : 'Adiantado';
            } else if (atrasoAbs > 0) {
                statusClass = atrasoChegada > 0 ? 'atraso-leve' : 'status-ok';
                statusText = atrasoChegada > 0 ? 'Atraso Leve' : 'Levemente Adiantado';
            }
            
            // Formatar data do último update
            const dataUpdate = new Date(ultimaJornada.data + 'T00:00:00').toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit'
            });
            const horarioUpdate = ultimaJornada.horario_chegada_real || '--:--';
            ultimoUpdate = `${dataUpdate} às ${horarioUpdate}`;
            
            // Chegada prevista
            chegadaPrevista = ultimaJornada.horario_chegada_programado || '--:--';
            
            // Conteúdo do tooltip
            const saidaPrevista = ultimaJornada.horario_saida_programado || '--:--';
            const chegadaReal = ultimaJornada.horario_chegada_real || '--:--';
            
            tooltipContent = `
                <div class="tooltip-premium">
                    <div class="tooltip-header-premium">
                        <div class="tooltip-date-badge">
                            <i class="fas fa-calendar-alt"></i>
                            <span>${dataUpdate}</span>
                        </div>
                        <div class="tooltip-time-badge">
                            <i class="fas fa-clock"></i>
                            <span>${horarioUpdate}</span>
                        </div>
                    </div>
                    <div class="tooltip-content-premium">
                        <div class="tooltip-section-premium">
                            <div class="tooltip-item-premium departure">
                                <div class="tooltip-icon-container">
                                    <i class="fas fa-arrow-right"></i>
                                </div>
                                <div class="tooltip-info">
                                    <div class="tooltip-label-premium">Horário Martins</div>
                                    <div class="tooltip-times">
                                        <span class="time-expected">Programado: ${saidaPrevista}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="tooltip-item-premium arrival">
                                <div class="tooltip-icon-container">
                                    <i class="fas fa-flag-checkered"></i>
                                </div>
                                <div class="tooltip-info">
                                    <div class="tooltip-label-premium">Retorno/Destino</div>
                                    <div class="tooltip-times">
                                        <span class="time-expected">Prevista: ${chegadaPrevista}</span>
                                        <span class="time-actual">Real: ${chegadaReal}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tooltip-footer-premium">
                        <div class="route-name">${rota.nome}</div>
                        <div class="system-status">
                            <div class="status-indicator online"></div>
                            <span>Sistema Online</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            tooltipContent = `
                <div class="tooltip-premium">
                    <div class="tooltip-header-premium">
                        <div class="tooltip-status-badge no-data">
                            <i class="fas fa-info-circle"></i>
                            <span>Sem Dados Disponíveis</span>
                        </div>
                    </div>
                    <div class="tooltip-content-premium">
                        <div class="tooltip-section-premium">
                            <div class="tooltip-item-premium no-data">
                                <div class="tooltip-icon-container">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </div>
                                <div class="tooltip-info">
                                    <div class="tooltip-label-premium">Status</div>
                                    <div class="tooltip-message">
                                        <span>Nenhuma jornada registrada</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tooltip-footer-premium">
                        <div class="route-name">${rota.nome}</div>
                        <div class="system-status">
                            <div class="status-indicator online"></div>
                            <span>Sistema Online</span>
                        </div>
                    </div>
                </div>
            `;
        }

        const card = document.createElement('div');
        card.className = `rota-status-card ${statusClass}`;
        card.setAttribute('data-tooltip', tooltipContent);
        card.innerHTML = `
            <div class="rota-nome">${rota.nome}</div>
            <div class="rota-status">Status: ${statusText}</div>
            <div class="rota-chegada">Chegada Prevista: ${chegadaPrevista}</div>
            <div class="rota-update">Último: ${ultimoUpdate}</div>
        `;
        
        // Adicionar card ao fragment ao invés do DOM diretamente
        fragment.appendChild(card);
    });
    
    // Aplicar todos os cards de uma vez - um único reflow
    grid.replaceChildren(fragment);
    
    // Configurar delegação de eventos uma única vez após render
    setupTooltipDelegation(grid);
}

// Configurar delegação de eventos para tooltips - evita listeners individuais por card
function setupTooltipDelegation(grid) {
    // Remover listeners anteriores se existirem
    grid.removeEventListener('pointerover', handleTooltipShow);
    grid.removeEventListener('pointerout', handleTooltipHide);
    
    // Adicionar novos listeners delegados
    grid.addEventListener('pointerover', handleTooltipShow);
    grid.addEventListener('pointerout', handleTooltipHide);
}

function handleTooltipShow(e) {
    const card = e.target.closest('.rota-status-card');
    if (!card) return;
    
    // Cancelar TODOS os timeouts imediatamente
    clearAllTooltipTimers();
    
    // Se já há tooltip visível e é de outro card, esconder imediatamente
    if (isTooltipVisible && currentTooltipTarget && currentTooltipTarget !== card) {
        esconderTooltipImediato();
    }
    
    // Obter conteúdo do tooltip do data-attribute
    const tooltipContent = card.getAttribute('data-tooltip');
    if (tooltipContent) {
        // Criar evento mock para compatibilidade com mostrarTooltip existente
        const mockEvent = { currentTarget: card, target: card };
        mostrarTooltip(mockEvent, tooltipContent);
    }
}

function handleTooltipHide(e) {
    const card = e.target.closest('.rota-status-card');
    if (!card) return;
    
    // Verificar se mouse realmente saiu do card (não apenas mudou para um filho)
    if (!card.contains(e.relatedTarget)) {
        esconderTooltipComDelay();
    }
}

function clearAllTooltipTimers() {
    // Função utilitária para limpar todos os timers de tooltip
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
    if (tooltipTransitionTimeout) {
        clearTimeout(tooltipTransitionTimeout);
        tooltipTransitionTimeout = null;
    }
    if (hideTooltipTimer) {
        clearTimeout(hideTooltipTimer);
        hideTooltipTimer = null;
    }
}

function atualizarPerformanceTurnos(relatorio) {
    // Implementar cálculos específicos por turno
    const turno1 = jornadas.filter(j => j.turno === 'primeiro_turno');
    const turno2 = jornadas.filter(j => j.turno === 'segundo_turno');
    
    atualizarStatsTurno('turno1', turno1);
    atualizarStatsTurno('turno2', turno2);
}

function atualizarStatsTurno(turnoId, jornadasTurno) {
    // Calcular atrasos dinamicamente baseado APENAS na chegada
    const atrasadas = jornadasTurno.filter(j => {
        // Verificar APENAS atraso de chegada
        if (j.horario_chegada_programado && j.horario_chegada_real) {
            const chegadaProgramada = converterHorarioParaMinutos(j.horario_chegada_programado);
            const chegadaReal = converterHorarioParaMinutos(j.horario_chegada_real);
            return chegadaReal > chegadaProgramada;
        }
        return false;
    });
    
    const pontualidade = jornadasTurno.length > 0 ? 
        Math.round(((jornadasTurno.length - atrasadas.length) / jornadasTurno.length) * 100) : 0;
    
    // Calcular atraso total dinamicamente baseado APENAS na chegada
    const atrasoTotal = jornadasTurno.reduce((acc, j) => {
        // Considerar APENAS atraso de chegada
        if (j.horario_chegada_programado && j.horario_chegada_real) {
            const chegadaProgramada = converterHorarioParaMinutos(j.horario_chegada_programado);
            const chegadaReal = converterHorarioParaMinutos(j.horario_chegada_real);
            const atrasoChegada = Math.max(0, chegadaReal - chegadaProgramada);
            return acc + atrasoChegada;
        }
        return acc;
    }, 0);
    
    const atrasoMedio = jornadasTurno.length > 0 ? Math.round(atrasoTotal / jornadasTurno.length) : 0;

    const pontualidadeEl = document.getElementById(`pontualidade-${turnoId}`);
    const jornadasEl = document.getElementById(`jornadas-${turnoId}`);
    const atrasoEl = document.getElementById(`atraso-${turnoId}`);
    
    if (pontualidadeEl) pontualidadeEl.textContent = `${pontualidade}%`;
    if (jornadasEl) jornadasEl.textContent = jornadasTurno.length;
    if (atrasoEl) atrasoEl.textContent = `${atrasoMedio}min`;
}

// === JORNADAS ===

function atualizarHorariosDisponiveis() {
    const rotaId = document.getElementById('jornada-rota').value;
    const turno = document.getElementById('jornada-turno').value;
    const selectHorario = document.getElementById('jornada-horario-programado');
    
    // Limpar opções
    selectHorario.innerHTML = '<option value="">Selecione o horário</option>';
    
    if (!rotaId || !turno) {
        selectHorario.innerHTML = '<option value="">Selecione primeiro rota e turno</option>';
        return;
    }
    
    const rota = rotas.find(r => r.id === rotaId);
    if (!rota) {
        selectHorario.innerHTML = '<option value="">Rota não encontrada</option>';
        console.warn(`Rota ${rotaId} não encontrada nas rotas carregadas`);
        return;
    }
    
    if (!rota.horarios || !rota.horarios[turno] || !Array.isArray(rota.horarios[turno])) {
        selectHorario.innerHTML = '<option value="">Horários não disponíveis para este turno</option>';
        console.warn(`Horários não disponíveis para rota ${rota.nome}, turno ${turno}`);
        return;
    }
    
    console.log(`📅 Carregando ${rota.horarios[turno].length} horários para rota ${rota.nome}, ${turno}`);
    
    // Adicionar horários disponíveis
    rota.horarios[turno].forEach((horario, index) => {
        const option = document.createElement('option');
        option.value = index;
        // Usar nova estrutura de dados
        const horarioDisplay = horario.chegada_martins || horario.saida_martins || horario.saida || 'N/A';
        const tipo = horario.chegada_martins ? 'Chegada' : 'Saída';
        option.textContent = `${tipo}: ${horarioDisplay} - Tolerância: ${horario.chegada_minima} às ${horario.chegada_maxima}`;
        selectHorario.appendChild(option);
    });
    
    console.log(`✅ ${rota.horarios[turno].length} horários adicionados ao select`);
}

function preencherHorariosProgramados() {
    const rotaId = document.getElementById('jornada-rota').value;
    const turno = document.getElementById('jornada-turno').value;
    const horarioIndex = document.getElementById('jornada-horario-programado').value;
    
    if (!rotaId || !turno || horarioIndex === '') return;
    
    const rota = rotas.find(r => r.id === rotaId);
    if (!rota || !Array.isArray(rota.horarios[turno])) return;
    
    const horario = rota.horarios[turno][parseInt(horarioIndex)];
    if (!horario) return;
    
    // Preencher campos programados
    const horarioProgSaida = horario.chegada_martins || horario.saida_martins || horario.saida || '';
    document.getElementById('jornada-saida-programada').value = horarioProgSaida;
    document.getElementById('jornada-chegada-programada').value = horario.chegada_maxima;
}

function editarJornada(id) {
    const jornada = jornadas.find(j => j.id === id);
    if (!jornada) {
        mostrarNotificacao('Jornada não encontrada', 'error');
        return;
    }
    
    // Atualizar título do modal
    document.getElementById('modal-jornada-title').textContent = 'Editar Jornada';
    document.getElementById('btn-salvar-jornada').textContent = 'Atualizar Jornada';
    
    // Preencher formulário
    document.getElementById('jornada-id').value = jornada.id;
    document.getElementById('jornada-rota').value = jornada.rota_id;
    document.getElementById('jornada-data').value = jornada.data;
    document.getElementById('jornada-turno').value = jornada.turno;
    document.getElementById('jornada-saida-programada').value = jornada.horario_saida_programado || '';
    document.getElementById('jornada-chegada-programada').value = jornada.horario_chegada_programado || '';
    document.getElementById('jornada-chegada-real').value = jornada.horario_chegada_real || '';
    document.getElementById('jornada-observacoes').value = jornada.observacoes || '';
    
    // Atualizar horários disponíveis e selecionar o correto
    atualizarHorariosDisponiveis();
    
    // Tentar encontrar o horário programado correspondente
    setTimeout(() => {
        const rotaAtual = rotas.find(r => r.id === jornada.rota_id);
        if (rotaAtual && Array.isArray(rotaAtual.horarios[jornada.turno])) {
            const horarioIndex = rotaAtual.horarios[jornada.turno].findIndex(h => 
                (h.chegada_martins === jornada.horario_saida_programado) ||
                (h.saida_martins === jornada.horario_saida_programado) ||
                (h.saida === jornada.horario_saida_programado)
            );
            if (horarioIndex >= 0) {
                document.getElementById('jornada-horario-programado').value = horarioIndex;
            }
        }
    }, 100);
    
    // Abrir modal diretamente (sem limpar formulário)
    const modal = document.getElementById('modal-jornada');
    if (modal) modal.style.display = 'flex';
}

function limparFormularioJornada() {
    document.getElementById('form-jornada').reset();
    document.getElementById('jornada-id').value = '';
    document.getElementById('modal-jornada-title').textContent = 'Nova Jornada';
    document.getElementById('btn-salvar-jornada').textContent = 'Salvar Jornada';
    
    // Limpar select de horários
    const selectHorario = document.getElementById('jornada-horario-programado');
    selectHorario.innerHTML = '<option value="">Selecione primeiro rota e turno</option>';
    
    // Resetar estado do checkbox "não houve rota"
    const checkboxNaoHouve = document.getElementById('nao-houve-rota');
    if (checkboxNaoHouve) {
        checkboxNaoHouve.checked = false;
        toggleNaoHouveRota(); // Garantir que os campos estejam no estado correto
    }
    
    // Limpar observações de ausência se existirem
    const textareaObservacoes = document.getElementById('jornada-observacoes');
    if (textareaObservacoes && textareaObservacoes.value.includes('🚫 AUSÊNCIA DE ROTA:')) {
        const linhas = textareaObservacoes.value.split('\n');
        const observacoesLimpas = linhas.filter(linha => !linha.includes('🚫 AUSÊNCIA DE ROTA:')).join('\n').trim();
        textareaObservacoes.value = observacoesLimpas;
    }
}

// Função para controlar a exibição dos campos baseado no checkbox "Não houve rota"
function toggleNaoHouveRota() {
    const checkbox = document.getElementById('nao-houve-rota');
    const camposHorarios = document.getElementById('campos-horarios');
    const campoMotivo = document.getElementById('campo-motivo');
    const jornadaChegadaReal = document.getElementById('jornada-chegada-real');
    const jornadaMotivo = document.getElementById('jornada-motivo');
    
    if (!checkbox || !camposHorarios || !campoMotivo) return;
    
    if (checkbox.checked) {
        // Ocultar campos de horários normais
        camposHorarios.style.display = 'none';
        camposHorarios.classList.add('hidden');
        
        // Mostrar campo de motivo
        campoMotivo.style.display = 'block';
        campoMotivo.classList.remove('hidden');
        campoMotivo.classList.add('show-field');
        
        // Remover obrigatoriedade do horário de chegada
        if (jornadaChegadaReal) {
            jornadaChegadaReal.removeAttribute('required');
            jornadaChegadaReal.value = '';
        }
        
        // Tornar motivo obrigatório
        if (jornadaMotivo) {
            jornadaMotivo.setAttribute('required', 'required');
        }
        
        // Limpar campos de horários
        document.getElementById('jornada-saida-programada').value = '';
        document.getElementById('jornada-chegada-programada').value = '';
        
    } else {
        // Mostrar campos de horários normais
        camposHorarios.style.display = 'block';
        camposHorarios.classList.remove('hidden');
        
        // Ocultar campo de motivo
        campoMotivo.style.display = 'none';
        campoMotivo.classList.add('hidden');
        campoMotivo.classList.remove('show-field');
        
        // Remover obrigatoriedade do motivo
        if (jornadaMotivo) {
            jornadaMotivo.removeAttribute('required');
            jornadaMotivo.value = '';
        }
        
        // Limpar observações relacionadas ao motivo quando desmarca checkbox
        atualizarObservacaesComMotivo();
    }
    
    // Atualizar o texto do botão de salvar
    const btnSalvar = document.getElementById('btn-salvar-jornada');
    if (btnSalvar) {
        if (checkbox.checked) {
            btnSalvar.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Registrar Ausência';
            btnSalvar.className = 'btn-warning';
        } else {
            btnSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar Jornada';
            btnSalvar.className = 'btn-primary';
        }
    }
}

// Função para atualizar automaticamente as observações com o motivo selecionado
function atualizarObservacaesComMotivo() {
    const checkbox = document.getElementById('nao-houve-rota');
    const selectMotivo = document.getElementById('jornada-motivo');
    const textareaObservacoes = document.getElementById('jornada-observacoes');
    
    if (!checkbox || !selectMotivo || !textareaObservacoes) return;
    
    // Mapeamento dos valores do select para textos mais amigáveis
    const motivosTexto = {
        'manutencao': 'Manutenção do veículo',
        'falta_motorista': 'Falta de motorista',
        'problema_tecnico': 'Problema técnico',
        'condicoes_climaticas': 'Condições climáticas adversas',
        'feriado': 'Feriado/Ponto facultativo',
        'cancelamento_empresa': 'Cancelamento pela empresa',
        'outro': 'Outro motivo'
    };
    
    if (checkbox.checked && selectMotivo.value) {
        const motivoTexto = motivosTexto[selectMotivo.value] || selectMotivo.value;
        const prefixo = '🚫 AUSÊNCIA DE ROTA: ';
        
        // Verificar se já existe o prefixo nas observações
        let observacoesAtuais = textareaObservacoes.value;
        
        // Remover qualquer prefixo de ausência anterior
        if (observacoesAtuais.includes('🚫 AUSÊNCIA DE ROTA:')) {
            const linhas = observacoesAtuais.split('\n');
            observacoesAtuais = linhas.filter(linha => !linha.includes('🚫 AUSÊNCIA DE ROTA:')).join('\n').trim();
        }
        
        // Adicionar o novo motivo no início
        const novaObservacao = prefixo + motivoTexto;
        if (observacoesAtuais) {
            textareaObservacoes.value = novaObservacao + '\n\n' + observacoesAtuais;
        } else {
            textareaObservacoes.value = novaObservacao;
        }
    } else if (!checkbox.checked) {
        // Se o checkbox foi desmarcado, remover o prefixo de ausência das observações
        let observacoesAtuais = textareaObservacoes.value;
        if (observacoesAtuais.includes('🚫 AUSÊNCIA DE ROTA:')) {
            const linhas = observacoesAtuais.split('\n');
            const observacoesLimpas = linhas.filter(linha => !linha.includes('🚫 AUSÊNCIA DE ROTA:')).join('\n').trim();
            textareaObservacoes.value = observacoesLimpas;
        }
    }
}

function renderizarJornadas() {
    const tbody = document.getElementById('jornadas-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    let jornadasFiltradas = [...jornadas];
    
    // Aplicar filtros
    const filtroRota = document.getElementById('filtro-rota');
    const filtroTurno = document.getElementById('filtro-turno');
    const filtroData = document.getElementById('filtro-data');

    if (filtroRota && filtroRota.value) {
        jornadasFiltradas = jornadasFiltradas.filter(j => j.rota_id === filtroRota.value);
    }
    if (filtroTurno && filtroTurno.value) {
        jornadasFiltradas = jornadasFiltradas.filter(j => j.turno === filtroTurno.value);
    }
    if (filtroData && filtroData.value) {
        jornadasFiltradas = jornadasFiltradas.filter(j => j.data === filtroData.value);
    }

    jornadasFiltradas.forEach(jornada => {
        const rota = rotas.find(r => r.id === jornada.rota_id);
        
        // Verificar compatibilidade com configuração da rota
        const compatibilidade = verificarCompatibilidadeJornadaRota(jornada);
        
        // Calcular status baseado na chegada e tolerâncias
        const atrasoChegada = jornada.atraso_chegada || 0;
        
        let status = 'No horário';
        let statusClass = 'status-ok';
        let atrasoParaExibir = 0;
        
        // Obter tolerâncias da rota para o turno específico
        let toleranciaMinMinutos = 0;
        let toleranciaMaxMinutos = 0;
        
        if (rota && rota.horarios && jornada.horario_chegada_programado) {
            const horariosDoTurno = jornada.turno === 'primeiro_turno' ? rota.horarios.primeiro_turno : rota.horarios.segundo_turno;
            if (horariosDoTurno && horariosDoTurno.length > 0) {
                // Encontrar o horário correspondente ao horário programado da jornada
                const horarioProgramadoMinutos = converterHorarioParaMinutos(jornada.horario_chegada_programado);
                
                for (const horario of horariosDoTurno) {
                    const chegadaProgramadaHorario = horario.chegada_martins || horario.chegada_programada;
                    if (chegadaProgramadaHorario) {
                        const chegadaProgramadaMinutos = converterHorarioParaMinutos(chegadaProgramadaHorario);
                        
                        // Verificar se este é o horário correto (com uma tolerância de +/- 5 minutos)
                        if (Math.abs(chegadaProgramadaMinutos - horarioProgramadoMinutos) <= 5) {
                            // Calcular tolerâncias em minutos
                            if (horario.chegada_minima && horario.chegada_maxima) {
                                const chegadaMinMinutos = converterHorarioParaMinutos(horario.chegada_minima);
                                const chegadaMaxMinutos = converterHorarioParaMinutos(horario.chegada_maxima);
                                
                                toleranciaMinMinutos = chegadaMinMinutos - chegadaProgramadaMinutos;
                                toleranciaMaxMinutos = chegadaMaxMinutos - chegadaProgramadaMinutos;
                            }
                            break;
                        }
                    }
                }
            }
        }
        
        if (atrasoChegada !== 0) {
            atrasoParaExibir = Math.abs(atrasoChegada);
            
            if (atrasoChegada > toleranciaMaxMinutos) {
                // Chegada atrasada além da tolerância máxima
                status = `Atraso ${atrasoParaExibir}min`;
                statusClass = atrasoParaExibir > 10 ? 'status-grave' : 'status-leve';
            } else if (atrasoChegada < toleranciaMinMinutos) {
                // Chegada adiantada além da tolerância mínima
                status = `Adiantado ${atrasoParaExibir}min`;
                statusClass = 'status-ok';
            } else {
                // Dentro da faixa de tolerância - não mostrar como adiantado
                status = 'No horário';
                statusClass = 'status-ok';
            }
        }
        
        // Adicionar alerta se não for compatível
        let alertaCompatibilidade = '';
        if (!compatibilidade.compativel) {
            alertaCompatibilidade = `<small class="incompatibilidade-alerta" title="${compatibilidade.motivo}">⚠️ Configuração incompatível</small>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatarData(jornada.data)}</td>
            <td>${rota ? rota.nome : jornada.rota_id}${alertaCompatibilidade}</td>
            <td>${jornada.turno === 'primeiro_turno' ? '1º Turno' : '2º Turno'}</td>
            <td>${jornada.horario_saida_programado || '--:--'}</td>
            <td>${jornada.horario_chegada_real || '--:--'}</td>
            <td><span class="${statusClass}">${status}</span></td>
            <td>${atrasoParaExibir > 0 ? `${atrasoParaExibir}min` : '0min'}</td>
            <td>
                <button class="btn-action edit" onclick="editarJornada('${jornada.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action delete" onclick="excluirJornada('${jornada.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filtrarJornadas() {
    // Garante que a data do filtro seja sempre hoje se estiver vazia
    const filtroData = document.getElementById('filtro-data');
    if (filtroData && !filtroData.value) {
        filtroData.value = obterDataHoje();
    }
    
    renderizarJornadas();
}

async function salvarJornada(event) {
    event.preventDefault();
    
    const isEdicao = document.getElementById('jornada-id').value !== '';
    const jornadaId = document.getElementById('jornada-id').value;
    const naoHouveRota = document.getElementById('nao-houve-rota').checked;
    
    // Dados base da jornada
    const dadosJornada = {
        rota_id: document.getElementById('jornada-rota').value,
        data: document.getElementById('jornada-data').value,
        turno: document.getElementById('jornada-turno').value,
        observacoes: document.getElementById('jornada-observacoes').value
    };
    
    // Se não houve rota, adicionar campos específicos
    if (naoHouveRota) {
        dadosJornada.nao_houve_rota = true;
        dadosJornada.motivo_ausencia = document.getElementById('jornada-motivo').value;
        dadosJornada.status = 'ausente';
        
        // Horário programado baseado na seleção (mesmo sem rota real)
        const horarioProgramado = document.getElementById('jornada-horario-programado').value;
        if (horarioProgramado) {
            dadosJornada.horario_programado_referencia = horarioProgramado;
        }
    } else {
        // Jornada normal com horários
        dadosJornada.nao_houve_rota = false;
        dadosJornada.horario_saida_programado = document.getElementById('jornada-saida-programada').value;
        dadosJornada.horario_chegada_programado = document.getElementById('jornada-chegada-programada').value;
        dadosJornada.horario_chegada_real = document.getElementById('jornada-chegada-real').value;
        dadosJornada.status = dadosJornada.horario_chegada_real ? 'concluido' : 'programado';
    }

    try {
        let response;
        if (isEdicao) {
            response = await fetch(`${API_BASE}/percursos/${jornadaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosJornada)
            });
        } else {
            response = await fetch(`${API_BASE}/percursos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosJornada)
            });
        }

        if (response.ok) {
            const tipoRegistro = naoHouveRota ? 'ausência de rota' : 'jornada';
            const mensagem = isEdicao 
                ? `${tipoRegistro.charAt(0).toUpperCase() + tipoRegistro.slice(1)} atualizada com sucesso!`
                : `${tipoRegistro.charAt(0).toUpperCase() + tipoRegistro.slice(1)} registrada com sucesso!`;
            
            mostrarNotificacao(mensagem, naoHouveRota ? 'warning' : 'success');
            fecharModal('modal-jornada');
            carregarJornadas();
            limparFormularioJornada();
        } else {
            const error = await response.json();
            mostrarNotificacao(error.erro || 'Erro ao salvar registro', 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar jornada:', error);
        mostrarNotificacao('Erro ao salvar registro', 'error');
    }
}

async function excluirJornada(id) {
    if (!confirm('Tem certeza que deseja excluir esta jornada?')) return;

    try {
        const response = await fetch(`${API_BASE}/percursos/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            mostrarNotificacao('Jornada excluída com sucesso!', 'success');
            carregarJornadas();
        } else {
            mostrarNotificacao('Erro ao excluir jornada', 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir jornada:', error);
        mostrarNotificacao('Erro ao excluir jornada', 'error');
    }
}

// === ROTAS ===

function renderizarRotasConfig() {
    const grid = document.getElementById('rotas-config-grid');
    if (!grid) return;
    
    grid.innerHTML = '';

    rotas.forEach(rota => {
        const card = document.createElement('div');
        card.className = 'rota-config-card';
        
        // Gerar HTML para múltiplos horários
        let horariosHtml = '';
        
        if (Array.isArray(rota.horarios.primeiro_turno)) {
            // Nova estrutura com múltiplos horários
            horariosHtml = `
                <div class="rota-horarios">
                    <div class="horario-turno">
                        <h4><i class="fas fa-sun"></i> 1º Turno</h4>
                        <div class="horarios-lista">
                            ${rota.horarios.primeiro_turno.map(h => `
                                <div class="horario-item-display">
                                    ${h.chegada_martins ? `Chegada: ${h.chegada_martins}` : `Saída: ${h.saida_martins || h.saida}`} | Tolerância: ${h.chegada_minima} - ${h.chegada_maxima}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="horario-turno">
                        <h4><i class="fas fa-moon"></i> 2º Turno</h4>
                        <div class="horarios-lista">
                            ${rota.horarios.segundo_turno.map(h => `
                                <div class="horario-item-display">
                                    ${h.chegada_martins ? `Chegada: ${h.chegada_martins}` : `Saída: ${h.saida_martins || h.saida}`} | Tolerância: ${h.chegada_minima} - ${h.chegada_maxima}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Estrutura antiga (compatibilidade)
            horariosHtml = `
                <div class="rota-horarios">
                    <div class="horario-turno">
                        <h4>1º Turno</h4>
                        <p>Saída: ${rota.horarios.primeiro_turno.saida}</p>
                        <p>Chegada: ${rota.horarios.primeiro_turno.chegada}</p>
                    </div>
                    <div class="horario-turno">
                        <h4>2º Turno</h4>
                        <p>Saída: ${rota.horarios.segundo_turno.saida}</p>
                        <p>Chegada: ${rota.horarios.segundo_turno.chegada}</p>
                    </div>
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="rota-config-header">
                <h3>${rota.nome}</h3>
                <div class="rota-actions">
                    <button class="btn-action edit" onclick="editarRota('${rota.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action delete" onclick="excluirRota('${rota.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            ${horariosHtml}
        `;
        grid.appendChild(card);
    });
}

async function salvarRota(event) {
    event.preventDefault();
    
    // Coletar dados do primeiro turno
    const primeiroTurno = [];
    const tiposT1 = document.querySelectorAll('.turno1-tipo');
    const saidasT1 = document.querySelectorAll('.turno1-saida');
    const chegadasMinT1 = document.querySelectorAll('.turno1-chegada-min');
    const chegadasMaxT1 = document.querySelectorAll('.turno1-chegada-max');
    
    for (let i = 0; i < saidasT1.length; i++) {
        const tipo = tiposT1[i].value;
        const horarioBase = saidasT1[i].value;
        
        const horarioConfig = {
            chegada_minima: chegadasMinT1[i].value,
            chegada_maxima: chegadasMaxT1[i].value
        };
        
        // Definir o campo correto baseado no tipo
        if (tipo === 'chegada') {
            horarioConfig.chegada_martins = horarioBase;
        } else {
            horarioConfig.saida_martins = horarioBase;
            horarioConfig.saida = horarioBase; // compatibilidade
        }
        
        primeiroTurno.push(horarioConfig);
    }
    
    // Coletar dados do segundo turno
    const segundoTurno = [];
    const tiposT2 = document.querySelectorAll('.turno2-tipo');
    const saidasT2 = document.querySelectorAll('.turno2-saida');
    const chegadasMinT2 = document.querySelectorAll('.turno2-chegada-min');
    const chegadasMaxT2 = document.querySelectorAll('.turno2-chegada-max');
    
    for (let i = 0; i < saidasT2.length; i++) {
        const tipo = tiposT2[i].value;
        const horarioBase = saidasT2[i].value;
        
        const horarioConfig = {
            chegada_minima: chegadasMinT2[i].value,
            chegada_maxima: chegadasMaxT2[i].value
        };
        
        // Definir o campo correto baseado no tipo
        if (tipo === 'chegada') {
            horarioConfig.chegada_martins = horarioBase;
        } else {
            horarioConfig.saida_martins = horarioBase;
            horarioConfig.saida = horarioBase; // compatibilidade
        }
        
        segundoTurno.push(horarioConfig);
    }
    
    const dadosRota = {
        id: document.getElementById('rota-id').value,
        nome: document.getElementById('rota-nome').value,
        ativa: true,
        horarios: {
            primeiro_turno: primeiroTurno,
            segundo_turno: segundoTurno
        }
    };

    try {
        // Verificar se é edição (ID preenchido e rota existente) ou criação
        const rotaId = dadosRota.id;
        const isEdicao = rotaId && rotas.some(r => r.id === rotaId);
        
        const url = isEdicao ? `${API_BASE}/config/rotas/${rotaId}` : `${API_BASE}/config/rotas`;
        const method = isEdicao ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosRota)
        });

        if (response.ok) {
            const acao = isEdicao ? 'atualizada' : 'salva';
            mostrarNotificacao(`Rota ${acao} com sucesso!`, 'success');
            fecharModal('modal-rota');
            
            // Recarregar todas as dependências das rotas
            await carregarRotas();
            
            // Atualizar interface dependente das rotas
            atualizarInterfaceAposAlteracaoRota();
            
            document.getElementById('form-rota').reset();
        } else {
            const error = await response.json();
            mostrarNotificacao(error.erro || 'Erro ao salvar rota', 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar rota:', error);
        mostrarNotificacao('Erro ao salvar rota', 'error');
    }
}

function editarRota(id) {
    const rota = rotas.find(r => r.id === id);
    if (!rota) {
        mostrarNotificacao('Rota não encontrada', 'error');
        return;
    }
    
    // Limpar o formulário primeiro
    document.getElementById('form-rota').reset();
    
    // Preencher formulário com dados da rota
    document.getElementById('rota-id').value = rota.id;
    document.getElementById('rota-nome').value = rota.nome;
    
    // Preencher horários do primeiro turno
    const turno1Tipos = document.querySelectorAll('.turno1-tipo');
    const turno1Saidas = document.querySelectorAll('.turno1-saida');
    const turno1ChegadasMin = document.querySelectorAll('.turno1-chegada-min');
    const turno1ChegadasMax = document.querySelectorAll('.turno1-chegada-max');
    
    if (rota.horarios && rota.horarios.primeiro_turno) {
        rota.horarios.primeiro_turno.forEach((horario, index) => {
            if (index < turno1Tipos.length) {
                // Determinar tipo baseado nos campos disponíveis
                const tipo = horario.chegada_martins ? 'chegada' : 'saida';
                turno1Tipos[index].value = tipo;
                
                // Preencher horário (chegada_martins ou saida_martins/saida)
                const horarioDisplay = horario.chegada_martins || horario.saida_martins || horario.saida || '';
                if (turno1Saidas[index]) turno1Saidas[index].value = horarioDisplay;
                if (turno1ChegadasMin[index]) turno1ChegadasMin[index].value = horario.chegada_minima || '';
                if (turno1ChegadasMax[index]) turno1ChegadasMax[index].value = horario.chegada_maxima || '';
            }
        });
    }
    
    // Preencher horários do segundo turno
    const turno2Tipos = document.querySelectorAll('.turno2-tipo');
    const turno2Saidas = document.querySelectorAll('.turno2-saida');
    const turno2ChegadasMin = document.querySelectorAll('.turno2-chegada-min');
    const turno2ChegadasMax = document.querySelectorAll('.turno2-chegada-max');
    
    if (rota.horarios && rota.horarios.segundo_turno) {
        rota.horarios.segundo_turno.forEach((horario, index) => {
            if (index < turno2Tipos.length) {
                // Determinar tipo baseado nos campos disponíveis
                const tipo = horario.chegada_martins ? 'chegada' : 'saida';
                turno2Tipos[index].value = tipo;
                
                // Preencher horário (chegada_martins ou saida_martins/saida)
                const horarioDisplay = horario.chegada_martins || horario.saida_martins || horario.saida || '';
                if (turno2Saidas[index]) turno2Saidas[index].value = horarioDisplay;
                if (turno2ChegadasMin[index]) turno2ChegadasMin[index].value = horario.chegada_minima || '';
                if (turno2ChegadasMax[index]) turno2ChegadasMax[index].value = horario.chegada_maxima || '';
            }
        });
    }
    
    // Abrir modal
    const modal = document.getElementById('modal-rota');
    if (modal) modal.style.display = 'flex';
}

async function excluirRota(id) {
    if (!confirm('Tem certeza que deseja excluir esta rota?')) return;

    try {
        const response = await fetch(`${API_BASE}/config/rotas/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            mostrarNotificacao('Rota excluída com sucesso!', 'success');
            
            // Recarregar todas as dependências das rotas
            await carregarRotas();
            
            // Atualizar interface dependente das rotas
            atualizarInterfaceAposAlteracaoRota();
        } else {
            mostrarNotificacao('Erro ao excluir rota', 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir rota:', error);
        mostrarNotificacao('Erro ao excluir rota', 'error');
    }
}

// === RELATÓRIOS ===

async function gerarRelatorio() {
    const dataInicio = document.getElementById('data-inicio').value;
    const dataFim = document.getElementById('data-fim').value;
    const rotaFiltro = document.getElementById('filtro-rota-relatorio').value;

    // Validação básica
    if (!dataInicio || !dataFim) {
        mostrarNotificacao('Por favor, selecione as datas de início e fim', 'warning');
        return;
    }

    if (new Date(dataInicio) > new Date(dataFim)) {
        mostrarNotificacao('A data de início deve ser anterior à data de fim', 'warning');
        return;
    }

    // Mostrar loading no botão
    const btnGerar = document.getElementById('btn-gerar-relatorio');
    const btnText = btnGerar.querySelector('.btn-text');
    const btnLoading = btnGerar.querySelector('.btn-loading');
    
    btnGerar.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-block';

    try {
        // Mostrar container do relatório
        document.getElementById('relatorio-container').style.display = 'block';
        
        // Construir URL com parâmetros
        let url = `${API_BASE}/relatorio/atrasos?data_inicio=${dataInicio}&data_fim=${dataFim}`;
        if (rotaFiltro) {
            url += `&rota=${encodeURIComponent(rotaFiltro)}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const relatorio = await response.json();
        
        // Armazenar dados do relatório para exportação
        window.lastRelatorio = {
            detalhes: relatorio.detalhes || [],
            resumo: relatorio.resumo || {},
            por_rota: relatorio.por_rota || {},
            filtros: {
                dataInicio,
                dataFim,
                rota: rotaFiltro || 'Todas'
            }
        };
        
        // Verificar se os dados existem e forçar atualização
        if (relatorio && relatorio.detalhes) {
        } else {
        }
        
        renderizarRelatorio(relatorio);
        
        
        // Inicializar recursos premium após renderizar
        setTimeout(() => {
            initRelatoriosPremium();
            addRelatorioStyles();
        }, 100);
        
        // Habilitar botões de exportação
        document.getElementById('btn-export-excel').disabled = false;
        document.getElementById('btn-export-csv').disabled = false;
        
        mostrarNotificacao('Relatório gerado com sucesso!', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao gerar relatório:', error);
        mostrarNotificacao('Erro ao gerar relatório: ' + error.message, 'error');
    } finally {
        // Restaurar botão
        btnGerar.disabled = false;
        btnText.style.display = 'inline-block';
        btnLoading.style.display = 'none';
    }
}

function renderizarRelatorio(relatorio) {
    // Atualizar resumo geral premium
    if (relatorio.resumo) {
        
        const elementos = {
            'relatorio-total-percursos': relatorio.resumo.total_percursos || 0,
            'relatorio-media-atraso-saida': `${relatorio.resumo.media_atraso_saida || 0} min`,
            'relatorio-media-atraso-chegada': `${relatorio.resumo.media_atraso_chegada || 0} min`,
            'relatorio-maior-atraso-saida': `${relatorio.resumo.maior_atraso_saida || 0} min`,
            'relatorio-maior-atraso-chegada': `${relatorio.resumo.maior_atraso_chegada || 0} min`,
            'relatorio-pontualidade-saida': `${relatorio.resumo.pontualidade_saida || 0}%`,
            'relatorio-pontualidade-chegada': `${relatorio.resumo.pontualidade_chegada || 0}%`
        };
        
        Object.entries(elementos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.textContent = valor;
            } else {
                console.warn(`  ⚠️ Elemento ${id} não encontrado`);
            }
        });

    } else {
        console.warn('⚠️ Dados de resumo não encontrados');
    }

    // Atualizar tabela por rota premium
    atualizarRelatorioPorRota(relatorio.por_rota || {});
    
    // Atualizar tabela detalhada premium
    if (relatorio.detalhes && relatorio.detalhes.length > 0) {
    }
    atualizarRelatorioDetalhado(relatorio.detalhes || []);
    
}

// Função de teste para debugging
function testarRelatorioDetalhado() {
    
    const dadosTeste = [
        {
            "chegada_martins": "05:20",
            "chegada_real": "05:25",
            "chegada_minima": "04:50",
            "chegada_maxima": "05:20",
            "atraso": 5,
            "data": "2025-07-21",
            "rota": "CANAÃ",
            "turno": "primeiro_turno",
            "observacoes": "Teste com nova estrutura - chegada"
        },
        {
            "saida_martins": "13:30",
            "saida_real": "13:28",
            "chegada_minima": "13:20",
            "chegada_maxima": "13:30",
            "atraso": -2,
            "data": "2025-07-21",
            "rota": "CENTRO",
            "turno": "segundo_turno",
            "observacoes": "Teste com nova estrutura - saída"
        }
    ];
    atualizarRelatorioDetalhado(dadosTeste);
}

// === UTILITÁRIOS ===

// Função para atualizar interface após alteração em rotas
function atualizarInterfaceAposAlteracaoRota() {
    console.log('🔄 Atualizando interface após alteração de rota...');
    
    // Atualizar horários disponíveis se o modal de jornada estiver aberto
    const modalJornada = document.getElementById('modal-jornada');
    if (modalJornada && modalJornada.style.display === 'flex') {
        atualizarHorariosDisponiveis();
    }
    
    // Recarregar tabela de jornadas se estiver na aba jornadas
    if (currentTab === 'jornadas') {
        renderizarJornadas();
    }
    
    // Atualizar dashboard se estiver na aba dashboard
    if (currentTab === 'dashboard') {
        atualizarStatusRotas();
        // Recarregar KPIs após um delay para garantir dados atualizados
        setTimeout(() => {
            atualizarKPIs(null);
        }, 500);
    }
    
    // Atualizar gráficos de analytics se estiver na aba dashboard
    if (currentTab === 'dashboard') {
        setTimeout(() => {
            atualizarGraficosAnalytics();
        }, 1000);
    }
    
    console.log('✅ Interface atualizada após alteração de rota');
}

// Função para validar consistência dos dados de rotas
function validarConsistenciaRotas() {
    console.log('🔍 Validando consistência das rotas...');
    
    if (!rotas || !Array.isArray(rotas)) {
        console.warn('⚠️ Array de rotas não está definido ou não é um array');
        return false;
    }
    
    let problemas = [];
    
    rotas.forEach((rota, index) => {
        // Verificar estrutura básica
        if (!rota.id) {
            problemas.push(`Rota ${index}: ID não definido`);
        }
        if (!rota.nome) {
            problemas.push(`Rota ${index}: Nome não definido`);
        }
        
        // Verificar horários
        if (!rota.horarios) {
            problemas.push(`Rota ${rota.nome || index}: Horários não definidos`);
            return;
        }
        
        // Verificar turnos
        ['primeiro_turno', 'segundo_turno'].forEach(turno => {
            if (!rota.horarios[turno]) {
                problemas.push(`Rota ${rota.nome}: ${turno} não definido`);
                return;
            }
            
            if (Array.isArray(rota.horarios[turno])) {
                // Nova estrutura - validar cada horário
                rota.horarios[turno].forEach((horario, hIndex) => {
                    const temChegadaMartins = horario.chegada_martins;
                    const temSaidaMartins = horario.saida_martins || horario.saida;
                    
                    if (!temChegadaMartins && !temSaidaMartins) {
                        problemas.push(`Rota ${rota.nome}, ${turno}, horário ${hIndex}: Nem chegada_martins nem saida_martins definidos`);
                    }
                    
                    if (!horario.chegada_minima || !horario.chegada_maxima) {
                        problemas.push(`Rota ${rota.nome}, ${turno}, horário ${hIndex}: Tolerâncias (chegada_minima/maxima) não definidas`);
                    }
                });
            } else {
                // Estrutura antiga - validar campos básicos
                if (!rota.horarios[turno].saida && !rota.horarios[turno].chegada) {
                    problemas.push(`Rota ${rota.nome}, ${turno}: Horários de saída e chegada não definidos (estrutura antiga)`);
                }
            }
        });
    });
    
    if (problemas.length > 0) {
        console.warn('⚠️ Problemas encontrados nas rotas:');
        problemas.forEach(problema => console.warn(`   - ${problema}`));
        return false;
    } else {
        console.log('✅ Todas as rotas estão consistentes');
        return true;
    }
}

// Função para verificar compatibilidade entre jornada e configuração de rota
function verificarCompatibilidadeJornadaRota(jornada) {
    if (!jornada || !jornada.rota_id || !jornada.turno) {
        return { compativel: false, motivo: 'Dados da jornada incompletos' };
    }
    
    const rota = rotas.find(r => r.id === jornada.rota_id);
    if (!rota) {
        return { compativel: false, motivo: `Rota ${jornada.rota_id} não encontrada` };
    }
    
    if (!rota.horarios || !rota.horarios[jornada.turno]) {
        return { compativel: false, motivo: `Horários para ${jornada.turno} não configurados na rota ${rota.nome}` };
    }
    
    const horariosRota = rota.horarios[jornada.turno];
    
    // Se for estrutura antiga, sempre é compatível
    if (!Array.isArray(horariosRota)) {
        return { compativel: true, motivo: 'Estrutura antiga - compatibilidade assumida' };
    }
    
    // Para estrutura nova, verificar se o horário da jornada existe na configuração
    const horarioProgramadoJornada = jornada.horario_saida_programado;
    if (!horarioProgramadoJornada) {
        return { compativel: true, motivo: 'Horário programado não definido na jornada' };
    }
    
    const horarioEncontrado = horariosRota.find(h => 
        h.chegada_martins === horarioProgramadoJornada ||
        h.saida_martins === horarioProgramadoJornada ||
        h.saida === horarioProgramadoJornada
    );
    
    if (horarioEncontrado) {
        return { compativel: true, motivo: 'Horário encontrado na configuração da rota' };
    } else {
        return { 
            compativel: false, 
            motivo: `Horário ${horarioProgramadoJornada} não encontrado na configuração da rota ${rota.nome}` 
        };
    }
}

// Função para testar consistência completa do sistema
function testarConsistenciaCompleta() {
    console.log('🔍 Iniciando teste completo de consistência...');
    
    // 1. Validar rotas
    const rotasOk = validarConsistenciaRotas();
    
    // 2. Verificar jornadas em relação às rotas
    let jornadasInconsistentes = 0;
    if (jornadas && Array.isArray(jornadas)) {
        jornadas.forEach((jornada, index) => {
            const compatibilidade = verificarCompatibilidadeJornadaRota(jornada);
            if (!compatibilidade.compativel) {
                console.warn(`⚠️ Jornada ${index} (${jornada.data}): ${compatibilidade.motivo}`);
                jornadasInconsistentes++;
            }
        });
    }
    
    // 3. Verificar se todos os selects estão atualizados
    const selectsRotas = ['filtro-rota', 'jornada-rota', 'analytics-rota'];
    let selectsInconsistentes = 0;
    
    selectsRotas.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const opcoes = select.children.length - 1; // -1 para excluir a opção padrão
            if (opcoes !== rotas.length) {
                console.warn(`⚠️ Select ${selectId} tem ${opcoes} opções, mas há ${rotas.length} rotas`);
                selectsInconsistentes++;
            }
        }
    });
    
    // Resultado final
    const totalProblemas = (rotasOk ? 0 : 1) + jornadasInconsistentes + selectsInconsistentes;
    
    if (totalProblemas === 0) {
        console.log('✅ Sistema completamente consistente!');
        mostrarNotificacao('Sistema validado: Todas as configurações estão sincronizadas', 'success');
    } else {
        console.warn(`⚠️ ${totalProblemas} problemas de consistência encontrados`);
        mostrarNotificacao(`${totalProblemas} problemas de consistência encontrados. Verifique o console para detalhes.`, 'warning');
    }
    
    return totalProblemas === 0;
}

// Adicionar função de teste ao escopo global para debug
window.testarConsistencia = testarConsistenciaCompleta;

function obterDataHoje() {
    // Obtém a data atual local sem problemas de fuso horário
    const hoje = new Date();
    const dataLocal = new Date(hoje.getTime() - (hoje.getTimezoneOffset() * 60000));
    return dataLocal.toISOString().split('T')[0];
}

function atualizarSelectRotas() {
    const selects = ['filtro-rota', 'jornada-rota', 'analytics-rota'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) {
            return;
        }
        
        const currentValue = select.value;
        
        if (selectId === 'analytics-rota') {
            // Para analytics-rota, remove todas as opções (não mantém a primeira)
            select.innerHTML = '';
        } else {
            // Para outros selects, limpa opções existentes (exceto a primeira)
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
        }
        
        // Adiciona rotas
        if (rotas && rotas.length > 0) {
            rotas.forEach((rota, index) => {
                const option = document.createElement('option');
                option.value = rota.id;
                option.textContent = rota.nome;
                // Para analytics-rota, seleciona automaticamente a primeira rota
                if (selectId === 'analytics-rota' && index === 0) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
        
        // Restaura valor selecionado (exceto para analytics-rota que sempre usa a primeira)
        if (selectId !== 'analytics-rota') {
            select.value = currentValue;
        }
    });
    
    // Atualiza também o select de relatórios
    atualizarSelectRotasRelatorio();
}

function abrirModalJornada() {
    limparFormularioJornada();
    
    // Definir data de hoje para nova jornada
    const jornadaData = document.getElementById('jornada-data');
    if (jornadaData && !jornadaData.value) {
        jornadaData.value = obterDataHoje();
    }
    
    const modal = document.getElementById('modal-jornada');
    if (modal) modal.style.display = 'flex';
}

function abrirModalRota() {
    const modal = document.getElementById('modal-rota');
    if (modal) modal.style.display = 'flex';
}

function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function formatarData(data) {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
}

function mostrarNotificacao(mensagem, tipo) {
    // Criar elemento de notificação
    const notificacao = document.createElement('div');
    notificacao.className = `notificacao ${tipo}`;
    notificacao.innerHTML = `
        <i class="fas fa-${tipo === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
        <span>${mensagem}</span>
    `;
    
    // Adicionar ao body
    document.body.appendChild(notificacao);
    
    // Remover após 3 segundos
    setTimeout(() => {
        if (document.body.contains(notificacao)) {
            document.body.removeChild(notificacao);
        }
    }, 3000);
}

function atualizarRelatorioPorRota(porRotaData) {
    
    const tbody = document.getElementById('relatorio-rotas-tbody');
    if (!tbody) {
        console.error('❌ Elemento relatorio-rotas-tbody não encontrado');
        return;
    }
    
    tbody.innerHTML = '';
    
    // Verificar se há dados para processar
    if (!porRotaData || Object.keys(porRotaData).length === 0) {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td colspan="6" class="empty-state">
                <div class="empty-state-content">
                    <i class="fas fa-chart-bar"></i>
                    <h4>Nenhuma rota encontrada</h4>
                    <p>Não há dados de rotas para o período selecionado</p>
                </div>
            </td>
        `;
        return;
    }
    
    
    Object.entries(porRotaData).forEach(([nomeRota, stats]) => {
        
        // Garantir que as estatísticas existem com valores padrão
        const totalPercursos = stats.total_percursos || 0;
        const mediaAtrasoChegada = Number(stats.media_atraso_chegada || 0).toFixed(1);
        const maiorAtrasoChegada = stats.maior_atraso_chegada || 0;
        const pontualidadeChegada = Number(stats.pontualidade_chegada || 0).toFixed(1);
        
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>
                <span class="rota-badge">${nomeRota}</span>
            </td>
            <td>${totalPercursos}</td>
            <td>${mediaAtrasoChegada} min</td>
            <td>${maiorAtrasoChegada} min</td>
            <td>
                <div class="pontualidade-cell">
                    <span class="pontualidade-value">${pontualidadeChegada}%</span>
                    <div class="pontualidade-bar">
                        <div class="pontualidade-fill" style="width: ${pontualidadeChegada}%"></div>
                    </div>
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn-mini" title="Ver detalhes da rota" onclick="filtrarPorRota('${nomeRota}')">
                        <i class="fas fa-chart-line"></i>
                    </button>
                    <button class="action-btn-mini" title="Exportar dados da rota" onclick="exportarRotaEspecifica('${nomeRota}')">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </td>
        `;
    });
    
}

function atualizarRelatorioDetalhado(detalhes) {
    
    const tbody = document.getElementById('relatorio-detalhes-tbody');
    if (!tbody) {
        console.error('❌ Elemento relatorio-detalhes-tbody não encontrado');
        return;
    }

    
    // Se há dados, usar paginação
    if (detalhes && detalhes.length > 0) {
        
        // Inicializar ou atualizar a paginação
        if (!window.relatorioDetailsPagination) {
            window.relatorioDetailsPagination = new RelatorioDetalhesPagination(
                'relatorio-detalhes-table',
                detalhes,
                25
            );
        } else {
            window.relatorioDetailsPagination.updateData(detalhes);
        }
        
    } else {
        
        // Limpar tabela e mostrar mensagem
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div class="empty-state-content">
                        <i class="fas fa-inbox"></i>
                        <h4>Nenhum percurso encontrado</h4>
                        <p>Ajuste os filtros de data para visualizar os dados</p>
                    </div>
                </td>
            </tr>
        `;
        
        // Atualizar informações de paginação para estado vazio
        const paginationInfo = document.getElementById('pagination-info');
        const showingElement = document.getElementById('items-showing');
        const totalElement = document.getElementById('items-total');
        
        if (paginationInfo) paginationInfo.textContent = 'Nenhum item encontrado';
        if (showingElement) showingElement.textContent = '0';
        if (totalElement) totalElement.textContent = '0';
    }
}

function exportarRelatorio(formato) {
    // Verificar se há dados do relatório armazenados
    if (!window.lastRelatorio || !window.lastRelatorio.detalhes || window.lastRelatorio.detalhes.length === 0) {
        mostrarNotificacao('Gere um relatório primeiro', 'error');
        return;
    }
    
    const { detalhes, filtros } = window.lastRelatorio;
    
    try {
        if (formato === 'excel') {
            exportarParaExcel(detalhes, filtros);
        } else if (formato === 'csv') {
            exportarParaCSV(detalhes, filtros);
        }
    } catch (error) {
        console.error('Erro ao exportar relatório:', error);
        mostrarNotificacao('Erro ao exportar relatório: ' + error.message, 'error');
    }
}

function exportarParaExcel(detalhes, filtros) {
    // Preparar dados para o worksheet com nova estrutura
    const dados = detalhes.map(item => {
        // Detectar tipo de movimento
        const movimento = detectarTipoMovimento(item);
        
        // Extrair valores com verificação mais robusta
        const horarioMartins = (item[movimento.campo_martins] && item[movimento.campo_martins] !== '') ? item[movimento.campo_martins] : 'N/A';
        const horarioReal = (item[movimento.campo_real] && item[movimento.campo_real] !== '') ? item[movimento.campo_real] : 'N/A';
        const toleranciaMin = (item[movimento.campo_minima] && item[movimento.campo_minima] !== '') ? item[movimento.campo_minima] : 'N/A';
        const toleranciaMax = (item[movimento.campo_maxima] && item[movimento.campo_maxima] !== '') ? item[movimento.campo_maxima] : 'N/A';
        
        // Calcular atraso se não estiver definido
        let atraso = item.atraso;
        
        // Se não há atraso definido, tentar usar atraso_chegada ou atraso_saida
        if (atraso === undefined || atraso === null) {
            if (movimento.tipo === 'Chegada' && item.atraso_chegada !== undefined) {
                atraso = item.atraso_chegada;
            } else if (movimento.tipo === 'Saída' && item.atraso_saida !== undefined) {
                atraso = item.atraso_saida;
            } else if (horarioMartins !== 'N/A' && horarioReal !== 'N/A') {
                // Calcular atraso manualmente apenas se necessário
                try {
                    const [hM, mM] = horarioMartins.split(':').map(Number);
                    const [hR, mR] = horarioReal.split(':').map(Number);
                    const minutosMartin = hM * 60 + mM;
                    const minutosReal = hR * 60 + mR;
                    atraso = minutosReal - minutosMartin;
                } catch (error) {
                    atraso = 0;
                }
            } else {
                atraso = 0;
            }
        }
        
        return {
            'Data': formatarDataParaExportacao(item.data),
            'Rota': item.rota || 'N/A',
            'Turno': item.turno === 'primeiro_turno' ? '1º Turno' : '2º Turno',
            'Tipo Movimento': movimento.tipo,
            'Horário Programado': horarioMartins,
            'Horário Retorno/Destino': horarioReal,
            'Tolerância Mínima': toleranciaMin,
            'Tolerância Máxima': toleranciaMax,
            'Status': atraso || 0,
            'Observações': item.observacoes || ''
        };
    });
    
    // Criar worksheet
    const ws = XLSX.utils.json_to_sheet(dados);
    
    // Ajustar largura das colunas
    const colWidths = [
        { wch: 12 }, // Data
        { wch: 15 }, // Rota
        { wch: 12 }, // Turno
        { wch: 15 }, // Tipo Movimento
        { wch: 18 }, // Horário Programado
        { wch: 20 }, // Horário Retorno/Destino
        { wch: 16 }, // Tolerância Mínima
        { wch: 16 }, // Tolerância Máxima
        { wch: 14 }, // Status
        { wch: 30 }  // Observações
    ];
    ws['!cols'] = colWidths;
    
    // Criar workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório de Atrasos');
    
    // Gerar nome do arquivo
    const dataAtual = new Date().toISOString().split('T')[0];
    const nomeArquivo = `relatorio_${filtros.dataInicio}_${filtros.dataFim}_${dataAtual}.xlsx`;
    
    // Fazer download
    XLSX.writeFile(wb, nomeArquivo);
    
    mostrarNotificacao('Relatório Excel exportado com sucesso!', 'success');
}

function exportarParaCSV(detalhes, filtros) {
    // Preparar dados para o worksheet com nova estrutura
    const dados = detalhes.map(item => {
        // Detectar tipo de movimento
        const movimento = detectarTipoMovimento(item);
        
        // Extrair valores com verificação mais robusta
        const horarioMartins = (item[movimento.campo_martins] && item[movimento.campo_martins] !== '') ? item[movimento.campo_martins] : 'N/A';
        const horarioReal = (item[movimento.campo_real] && item[movimento.campo_real] !== '') ? item[movimento.campo_real] : 'N/A';
        const toleranciaMin = (item[movimento.campo_minima] && item[movimento.campo_minima] !== '') ? item[movimento.campo_minima] : 'N/A';
        const toleranciaMax = (item[movimento.campo_maxima] && item[movimento.campo_maxima] !== '') ? item[movimento.campo_maxima] : 'N/A';
        
        // Calcular atraso se não estiver definido
        let atraso = item.atraso;
        
        // Se não há atraso definido, tentar usar atraso_chegada ou atraso_saida
        if (atraso === undefined || atraso === null) {
            if (movimento.tipo === 'Chegada' && item.atraso_chegada !== undefined) {
                atraso = item.atraso_chegada;
            } else if (movimento.tipo === 'Saída' && item.atraso_saida !== undefined) {
                atraso = item.atraso_saida;
            } else if (horarioMartins !== 'N/A' && horarioReal !== 'N/A') {
                // Calcular atraso manualmente apenas se necessário
                try {
                    const [hM, mM] = horarioMartins.split(':').map(Number);
                    const [hR, mR] = horarioReal.split(':').map(Number);
                    const minutosMartin = hM * 60 + mM;
                    const minutosReal = hR * 60 + mR;
                    atraso = minutosReal - minutosMartin;
                } catch (error) {
                    atraso = 0;
                }
            } else {
                atraso = 0;
            }
        }
        
        return {
            'Data': formatarDataParaExportacao(item.data),
            'Rota': item.rota || 'N/A',
            'Turno': item.turno === 'primeiro_turno' ? '1º Turno' : '2º Turno',
            'Tipo Movimento': movimento.tipo,
            'Horário Programado': horarioMartins,
            'Horário Retorno/Destino': horarioReal,
            'Tolerância Mínima': toleranciaMin,
            'Tolerância Máxima': toleranciaMax,
            'Status': atraso || 0,
            'Observações': item.observacoes || ''
        };
    });
    
    // Criar worksheet
    const ws = XLSX.utils.json_to_sheet(dados);
    
    // Converter para CSV
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    
    // Criar Blob e fazer download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const dataAtual = new Date().toISOString().split('T')[0];
        const nomeArquivo = `relatorio_${filtros.dataInicio}_${filtros.dataFim}_${dataAtual}.csv`;
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', nomeArquivo);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Limpar URL do objeto
        URL.revokeObjectURL(url);
        
        mostrarNotificacao('Relatório CSV exportado com sucesso!', 'success');
    }
}

// Função auxiliar para formatar data para exportação
function formatarDataParaExportacao(data) {
    try {
        if (!data) return 'N/A';
        const dataObj = new Date(data + 'T00:00:00');
        return dataObj.toLocaleDateString('pt-BR');
    } catch (error) {
        return data || 'N/A';
    }
}

function atualizarSelectRotasRelatorio() {
    const select = document.getElementById('filtro-rota-relatorio');
    if (!select) return;
    
    const currentValue = select.value;
    
    // Limpa opções existentes (exceto a primeira)
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }
    
    // Adiciona rotas
    if (rotas && rotas.length > 0) {
        rotas.forEach(rota => {
            const option = document.createElement('option');
            option.value = rota.id;
            option.textContent = rota.nome;
            select.appendChild(option);
        });
    }
    
    // Restaura valor selecionado
    select.value = currentValue;
}

// Event listeners para fechar modais clicando fora
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// === GRÁFICOS ANALYTICS ===

function inicializarGraficosAnalytics() {
    // Destruir gráficos existentes se houver
    if (candlestickChart) {
        candlestickChart.destroy();
        candlestickChart = null;
    }
    if (pizzaChart) {
        pizzaChart.destroy();
        pizzaChart = null;
    }

    // Aguardar um pouco para garantir que o DOM está pronto
    setTimeout(() => {
        criarGraficoAreaDatetime();
        criarGraficoPizza();
        atualizarGraficosAnalytics();
    }, 100);
}

function criarGraficoAreaDatetime() {
    const chartContainer = document.getElementById('candlestick-chart');
    if (!chartContainer) {
        console.error('Container candlestick-chart não encontrado');
        return;
    }

    const options = {
        series: [
            {
                name: 'Horário Programado',
                data: []
            },
            {
                name: 'Horário Real',
                data: []
            }
        ],
        chart: {
            type: 'area',
            height: 450,
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 1000,
                animateGradually: {
                    enabled: true,
                    delay: 150
                },
                dynamicAnimation: {
                    enabled: true,
                    speed: 500
                }
            },
            zoom: {
                enabled: true,
                type: 'x',
                autoScaleYaxis: true,
                zoomedArea: {
                    fill: {
                        color: '#90CAF9',
                        opacity: 0.4
                    },
                    stroke: {
                        color: '#0D47A1',
                        opacity: 0.4,
                        width: 1
                    }
                }
            },
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    selection: true,
                    zoom: true,
                    zoomin: false,
                    zoomout: false,
                    pan: true,
                    reset: true
                }
            },
            dropShadow: {
                enabled: true,
                top: 3,
                left: 2,
                blur: 4,
                opacity: 0.1
            }
        },
        title: {
            text: 'Análise Temporal de Horários - Programado vs Real',
            align: 'left',
            margin: 20,
            offsetX: 0,
            offsetY: 0,
            floating: false,
            style: {
                fontSize: '18px',
                fontWeight: '600',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#2c3e50'
            }
        },
        subtitle: {
            text: 'Comparação entre horários programados e realizados',
            align: 'left',
            margin: 10,
            offsetX: 0,
            offsetY: 30,
            floating: false,
            style: {
                fontSize: '14px',
                fontWeight: '400',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                color: '#7f8c8d'
            }
        },
        xaxis: {
            type: 'datetime',
            labels: {
                style: {
                    colors: '#34495e',
                    fontSize: '12px',
                    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                    fontWeight: 400
                },
                datetimeFormatter: {
                    year: 'yyyy',
                    month: 'MMM \'yy',
                    day: 'dd MMM',
                    hour: 'HH:mm'
                }
            },
            axisBorder: {
                show: true,
                color: '#e0e6ed',
                height: 1,
                width: '100%',
                offsetX: 0,
                offsetY: 0
            },
            axisTicks: {
                show: true,
                borderType: 'solid',
                color: '#e0e6ed',
                height: 6,
                offsetX: 0,
                offsetY: 0
            }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#34495e',
                    fontSize: '12px',
                    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                    fontWeight: 400
                },
                formatter: function(value) {
                    const hours = Math.floor(value / 60);
                    const minutes = value % 60;
                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                }
            },
            axisBorder: {
                show: true,
                color: '#e0e6ed',
                offsetX: 0,
                offsetY: 0
            },
            axisTicks: {
                show: true,
                color: '#e0e6ed',
                width: 6,
                offsetX: 0,
                offsetY: 0
            }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'light',
                type: 'vertical',
                shadeIntensity: 0.5,
                gradientToColors: ['#74b9ff', '#fd79a8'],
                inverseColors: false,
                opacityFrom: 0.6,
                opacityTo: 0.1,
                stops: [0, 50, 100],
                colorStops: []
            }
        },
        colors: ['#0984e3', '#e17055'],
        stroke: {
            curve: 'smooth',
            width: 3,
            lineCap: 'round'
        },
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            followCursor: true,
            fillSeriesColor: false,
            theme: false,
            style: {
                fontSize: '0px',
                fontFamily: 'inherit'
            },
            onDatasetHover: {
                highlightDataSeries: true
            },
            custom: function({series, seriesIndex, dataPointIndex, w}) {
                const data = w.globals.initialSeries;
                if (!data || data.length === 0 || !data[0].data[dataPointIndex]) {
                    return `
                        <div style="
                            background: linear-gradient(145deg, #2c3e50, #34495e);
                            color: #ecf0f1;
                            padding: 15px;
                            border-radius: 12px;
                            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                            border: 1px solid rgba(255,255,255,0.1);
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            font-size: 13px;
                            min-width: 200px;
                            backdrop-filter: blur(10px);
                        ">
                            <div style="text-align: center; color: #e74c3c; font-weight: 600;">
                                📊 Dados não disponíveis
                            </div>
                        </div>
                    `;
                }

                const programado = data[0].data[dataPointIndex];
                const real = data[1] && data[1].data[dataPointIndex] ? data[1].data[dataPointIndex] : null;
                
                // Criar chave do cache baseada nos dados que afetam o conteúdo
                const cacheKey = `area_${dataPointIndex}_${programado.y}_${real ? real.y : 'null'}_${_cachedSelectValues.turno}_${_cachedSelectValues.tipoHorario}`;
                
                // Verificar cache primeiro - evita reconstrução desnecessária
                if (_tooltipCache.has(cacheKey)) {
                    return _tooltipCache.get(cacheKey);
                }
                
                const dataPonto = new Date(programado.x);
                const dataFormatada = dataPonto.toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                const horaFormatada = dataPonto.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                });

                // Converter minutos para formato HH:MM
                function minutosParaHorario(minutos) {
                    const hours = Math.floor(minutos / 60);
                    const mins = minutos % 60;
                    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                }

                // Calcular diferença e status
                let diferenca = '';
                let statusColor = '';
                let statusIcon = '';
                let statusText = '';
                let performanceBar = '';
                
                if (real && real.y !== null && real.y !== undefined) {
                    const diff = real.y - programado.y;
                    const diffAbs = Math.abs(diff);
                    
                    if (diff > 0) {
                        diferenca = `+${diffAbs} min`;
                        statusColor = '#e74c3c';
                        statusIcon = '⚠️';
                        statusText = 'Atraso';
                        performanceBar = `
                            <div style="background: rgba(231, 76, 60, 0.2); height: 6px; border-radius: 3px; margin: 5px 0; overflow: hidden;">
                                <div style="background: #e74c3c; height: 100%; width: ${Math.min(diffAbs, 60) / 60 * 100}%; border-radius: 3px; transition: width 0.3s ease;"></div>
                            </div>
                        `;
                    } else if (diff < 0) {
                        diferenca = `${diffAbs} min`;
                        statusColor = '#00b894';
                        statusIcon = '✅';
                        statusText = 'Adiantado';
                        performanceBar = `
                            <div style="background: rgba(0, 184, 148, 0.2); height: 6px; border-radius: 3px; margin: 5px 0; overflow: hidden;">
                                <div style="background: #00b894; height: 100%; width: ${Math.min(diffAbs, 60) / 60 * 100}%; border-radius: 3px; transition: width 0.3s ease;"></div>
                            </div>
                        `;
                    } else {
                        diferenca = 'Pontual';
                        statusColor = '#00cec9';
                        statusIcon = '🎯';
                        statusText = 'Pontual';
                        performanceBar = `
                            <div style="background: rgba(0, 206, 201, 0.2); height: 6px; border-radius: 3px; margin: 5px 0; overflow: hidden;">
                                <div style="background: #00cec9; height: 100%; width: 100%; border-radius: 3px; transition: width 0.3s ease;"></div>
                            </div>
                        `;
                    }
                }

                // Usar valores cacheados dos selects - evita DOM reads custosas
                const rotaNome = rotas.find(r => r.id === document.getElementById('analytics-rota')?.value)?.nome || 'Todas as Rotas';
                const turnoNome = _cachedSelectValues.turno === '1' ? '1º Turno' : '2º Turno';
                const tipoHorario = _cachedSelectValues.tipoHorario === 'saida' ? 'Saída' : 'Chegada';

                const htmlResult = `
                    <div style="
                        ${_tooltipConstants.headerGradient}
                        ${_tooltipConstants.baseStyle}
                    ">
                        ${_tooltipConstants.topBar}
                        
                        <div style="
                            text-align: center;
                            margin-bottom: 18px;
                            padding-bottom: 16px;
                            border-bottom: 1px solid rgba(148, 163, 184, 0.2);
                        ">
                            <div style="
                                font-size: 18px;
                                font-weight: 700;
                                color: #fbbf24;
                                margin-bottom: 6px;
                                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                            ">${horaFormatada}</div>
                            <div style="
                                font-size: 13px;
                                color: #cbd5e1;
                                font-weight: 500;
                                background: rgba(139, 92, 246, 0.1);
                                padding: 4px 12px;
                                border-radius: 20px;
                                border: 1px solid rgba(139, 92, 246, 0.2);
                                display: inline-block;
                            ">${rotaNome} • ${turnoNome} • ${tipoHorario}</div>
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <div style="
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                margin-bottom: 12px;
                                padding: 8px 0;
                            ">
                                <span style="
                                    color: #94a3b8; 
                                    font-size: 13px;
                                    font-weight: 600;
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                ">
                                    <span style="color: #6366f1;">📅</span>
                                    Programado
                                </span>
                                <span style="
                                    color: #6366f1;
                                    font-weight: 700;
                                    font-size: 15px;
                                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(79, 70, 229, 0.1));
                                    padding: 6px 12px;
                                    border-radius: 10px;
                                    border: 1px solid rgba(99, 102, 241, 0.3);
                                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                                ">${minutosParaHorario(programado.y)}</span>
                            </div>
                            
                            ${real ? `
                                <div style="
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                    margin-bottom: 16px;
                                    padding: 8px 0;
                                ">
                                    <span style="
                                        color: #94a3b8; 
                                        font-size: 13px;
                                        font-weight: 600;
                                        display: flex;
                                        align-items: center;
                                        gap: 6px;
                                    ">
                                        <span style="color: #f59e0b;">⏱️</span>
                                        Real
                                    </span>
                                    <span style="
                                        color: #f59e0b;
                                        font-weight: 700;
                                        font-size: 15px;
                                        background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.1));
                                        padding: 6px 12px;
                                        border-radius: 10px;
                                        border: 1px solid rgba(245, 158, 11, 0.3);
                                        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                                    ">${minutosParaHorario(real.y)}</span>
                                </div>
                                
                                <div style="
                                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04));
                                    padding: 16px;
                                    border-radius: 14px;
                                    border-left: 4px solid ${statusColor};
                                    border: 1px solid rgba(255, 255, 255, 0.1);
                                    margin-bottom: 12px;
                                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                                ">
                                    <div style="
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                        margin-bottom: 10px;
                                    ">
                                        <span style="
                                            font-weight: 700;
                                            color: ${statusColor};
                                            display: flex;
                                            align-items: center;
                                            gap: 8px;
                                            font-size: 14px;
                                        ">
                                            <span style="font-size: 16px;">${statusIcon}</span>
                                            ${statusText}
                                        </span>
                                        <span style="
                                            color: #f8fafc;
                                            font-weight: 800;
                                            font-size: 16px;
                                            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                                        ">${diferenca}</span>
                                    </div>
                                    ${performanceBar}
                                </div>
                                
                                ${Math.abs(real.y - programado.y) > 15 ? `
                                    <div style="
                                        background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.1));
                                        border: 1px solid rgba(245, 158, 11, 0.4);
                                        color: #fbbf24;
                                        padding: 12px 16px;
                                        border-radius: 12px;
                                        font-size: 13px;
                                        font-weight: 600;
                                        text-align: center;
                                        margin-top: 12px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        gap: 8px;
                                        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
                                    ">
                                        <span style="font-size: 16px;">🚨</span>
                                        <span style="text-transform: uppercase; letter-spacing: 0.5px;">
                                            Diferença significativa detectada
                                        </span>
                                    </div>
                                ` : ''}
                            ` : `
                                <div style="
                                    background: linear-gradient(135deg, rgba(148, 163, 184, 0.15), rgba(100, 116, 139, 0.1));
                                    border: 1px solid rgba(148, 163, 184, 0.3);
                                    color: #cbd5e1;
                                    padding: 16px;
                                    border-radius: 12px;
                                    text-align: center;
                                    font-style: italic;
                                    font-weight: 500;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    gap: 8px;
                                ">
                                    <span style="font-size: 16px;">📝</span>
                                    <span>Horário real não registrado</span>
                                </div>
                            `}
                        </div>
                        
                        <div style="
                            background: rgba(15, 23, 42, 0.5);
                            text-align: center;
                            margin-top: 16px;
                            padding: 12px 16px;
                            border-radius: 10px;
                            border-top: 1px solid rgba(148, 163, 184, 0.2);
                        ">
                            <small style="
                                color: #94a3b8;
                                font-size: 11px;
                                font-style: italic;
                                font-weight: 500;
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                            ">📈 Análise temporal de performance</small>
                        </div>
                    </div>
                `;
                
                // Armazenar no cache para próximas chamadas
                _tooltipCache.set(cacheKey, htmlResult);
                
                // Limpar cache se muito grande (evitar vazamento de memória)
                if (_tooltipCache.size > 100) {
                    const firstKey = _tooltipCache.keys().next().value;
                    _tooltipCache.delete(firstKey);
                }
                
                return htmlResult;
            }
        },
        markers: {
            size: 4,
            colors: ['#0984e3', '#e17055'],
            strokeColors: '#fff',
            strokeWidth: 2,
            strokeOpacity: 0.9,
            strokeDashArray: 0,
            fillOpacity: 1,
            discrete: [],
            shape: "circle",
            radius: 2,
            offsetX: 0,
            offsetY: 0,
            hover: {
                size: 8,
                sizeOffset: 3
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'center',
            floating: false,
            offsetY: -10,
            fontSize: '14px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            fontWeight: 500,
            labels: {
                colors: '#2c3e50',
                useSeriesColors: false
            },
            markers: {
                width: 12,
                height: 12,
                strokeWidth: 0,
                strokeColor: '#fff',
                fillColors: undefined,
                radius: 6,
                customHTML: undefined,
                onClick: undefined,
                offsetX: 0,
                offsetY: 0
            },
            itemMargin: {
                horizontal: 15,
                vertical: 5
            }
        },
        grid: {
            show: true,
            borderColor: '#e0e6ed',
            strokeDashArray: 3,
            position: 'back',
            xaxis: {
                lines: {
                    show: true
                }
            },
            yaxis: {
                lines: {
                    show: true
                }
            },
            row: {
                colors: undefined,
                opacity: 0.5
            },
            column: {
                colors: undefined,
                opacity: 0.5
            },
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            }
        },
        responsive: [{
            breakpoint: 768,
            options: {
                chart: {
                    height: 300
                },
                title: {
                    style: {
                        fontSize: '16px'
                    }
                },
                subtitle: {
                    style: {
                        fontSize: '12px'
                    }
                },
                legend: {
                    position: 'bottom',
                    fontSize: '12px'
                }
            }
        }]
    };

    candlestickChart = new ApexCharts(chartContainer, options);
    candlestickChart.render();
}
function criarGraficoPizza() {
    const chartContainer = document.getElementById('pizza-chart');
    if (!chartContainer) {
        console.error('Container pizza-chart não encontrado');
        return;
    }

    const options = {
        series: [],
        chart: {
            type: 'donut',
            height: 580,
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800,
                animateGradually: {
                    enabled: true,
                    delay: 150
                },
                dynamicAnimation: {
                    enabled: true,
                    speed: 350
                }
            },
            dropShadow: {
                enabled: true,
                top: 5,
                left: 0,
                blur: 10,
                opacity: 0.1
            }
        },

        labels: [],
        colors: [
            '#3498db', '#e74c3c', '#2ecc71', '#f39c12',
            '#9b59b6', '#1abc9c', '#34495e', '#e67e22',
            '#95a5a6', '#d35400', '#8e44ad', '#27ae60'
        ],
        legend: {
            show: false,
            position: 'bottom',
            horizontalAlign: 'center',
            fontSize: '13px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            markers: {
                width: 14,
                height: 14,
                radius: 3
            },
            itemMargin: {
                horizontal: 8,
                vertical: 5
            },
            onItemClick: {
                toggleDataSeries: true
            },
            onItemHover: {
                highlightDataSeries: true
            }
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    background: 'transparent',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '16px',
                            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                            fontWeight: 600,
                            color: '#2c3e50',
                            offsetY: -10,
                            formatter: function (val) {
                                return val.length > 12 ? val.substring(0, 12) + '...' : val;
                            }
                        },
                        value: {
                            show: true,
                            fontSize: '24px',
                            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                            fontWeight: 'bold',
                            color: '#34495e',
                            offsetY: 16,
                            formatter: function (val) {
                                const horas = Math.floor(val / 60);
                                const minutos = val % 60;
                                return horas > 0 ? `${horas}h ${minutos}m` : `${val}min`;
                            }
                        },
                        total: {
                            show: true,
                            showAlways: false,
                            label: 'Total Geral',
                            fontSize: '16px',
                            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                            fontWeight: 600,
                            color: '#2c3e50',
                            formatter: function (w) {
                                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                const horas = Math.floor(total / 60);
                                const minutos = total % 60;
                                return horas > 0 ? `${horas}h ${minutos}m` : `${total} min`;
                            }
                        }
                    }
                },
                expandOnClick: true,
                offsetX: 0,
                offsetY: 0,
                customScale: 1,
                dataLabels: {
                    offset: 0,
                    minAngleToShowLabel: 10
                }
            }
        },
        stroke: {
            show: true,
            curve: 'smooth',
            lineCap: 'butt',
            colors: ['#fff'],
            width: 2,
            dashArray: 0
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'light',
                type: 'vertical',
                shadeIntensity: 0.35,
                gradientToColors: undefined,
                inverseColors: false,
                opacityFrom: 1,
                opacityTo: 0.85,
                stops: [0, 100]
            }
        },
        tooltip: {
            enabled: true,
            theme: 'dark',
            style: {
                fontSize: '13px',
                fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
            },
            fillSeriesColor: false,
            custom: function({series, seriesIndex, dataPointIndex, w}) {
                
                try {
                    const value = series[seriesIndex] || 0;
                    const label = w.config.labels[seriesIndex] || 'Sem nome';
                    
                    // Usar seriesTotals se disponível ou calcular se necessário
                    const total = w.globals.seriesTotals ? 
                        w.globals.seriesTotals.reduce((a, b) => a + b, 0) : 
                        series.reduce((a, b) => a + b, 0);
                    
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                    
                    // Criar chave do cache baseada nos dados únicos
                    const cacheKey = `pizza_${seriesIndex}_${value}_${label}_${_cachedSelectValues.turno}_${_cachedSelectValues.tipoHorario}`;
                    
                    // Verificar cache primeiro
                    if (_tooltipCache.has(cacheKey)) {
                        return _tooltipCache.get(cacheKey);
                    }
                    
                    const horas = Math.floor(value / 60);
                    const minutos = value % 60;
                    const tempo = horas > 0 ? `${horas}h ${minutos}min` : `${value} min`;
                    
                    // Usar valores cacheados dos selects - evita DOM reads
                    const turnoNome = _cachedSelectValues.turno === '1' ? '1º Turno' : '2º Turno';
                    const tipoHorario = _cachedSelectValues.tipoHorario === 'saida' ? 'Saída' : 'Chegada';
                    
                    // Categorizar o nível de impacto premium
                    let nivelImpacto, corNivel, iconeNivel, descricaoImpacto;
                    
                    if (value <= 10) {
                        nivelImpacto = 'Baixo';
                        corNivel = '#22c55e';
                        iconeNivel = '✅';
                        descricaoImpacto = 'Performance excelente';
                    } else if (value <= 30) {
                        nivelImpacto = 'Moderado';
                        corNivel = '#f59e0b';
                        iconeNivel = '⚠️';
                        descricaoImpacto = 'Atenção necessária';
                    } else if (value <= 60) {
                        nivelImpacto = 'Alto';
                        corNivel = '#f97316';
                        iconeNivel = '🚨';
                        descricaoImpacto = 'Intervenção recomendada';
                    } else {
                        nivelImpacto = 'Crítico';
                        corNivel = '#ef4444';
                        iconeNivel = '🔥';
                        descricaoImpacto = 'Ação imediata necessária';
                    }

                    // Calcular barra de progresso do impacto
                    const progressoImpacto = Math.min((value / 120) * 100, 100);
                    
                    // Alerta especial para casos críticos - usar template literals
                    const alertaEspecial = value > 60 ? `
                        <div style="
                            background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(185, 28, 28, 0.1));
                            border: 1px solid rgba(239, 68, 68, 0.4);
                            border-radius: 12px;
                            padding: 14px 16px;
                            margin-top: 16px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 10px;
                            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
                        ">
                            <span style="font-size: 18px; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));">🚨</span>
                            <span style="
                                color: #fca5a5;
                                font-size: 13px;
                                font-weight: 700;
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                                text-align: center;
                            ">Rota necessita atenção especial</span>
                        </div>
                    ` : '';
                    
                    const htmlResult = `
                        <div style="
                            position: relative;
                            ${_tooltipConstants.headerGradient}
                            backdrop-filter: blur(20px);
                            -webkit-backdrop-filter: blur(20px);
                            border: 1px solid rgba(148, 163, 184, 0.3);
                            border-radius: 16px;
                            padding: 0;
                            color: #f8fafc;
                            font-family: Inter, Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif;
                            font-size: 13px;
                            min-width: 320px;
                            max-width: 360px;
                            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4), 0 10px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1);
                            transform: translateY(-8px);
                            animation: tooltipFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                            overflow: hidden;
                        ">
                            ${_tooltipConstants.topBar}
                            
                            <div style="
                                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                                color: white;
                                padding: 16px 20px;
                                border-radius: 15px 15px 0 0;
                                font-weight: 600;
                                font-size: 15px;
                                display: flex;
                                align-items: center;
                                gap: 10px;
                                text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                            ">
                                <i class="fas fa-chart-pie" style="
                                    color: #fbbf24;
                                    font-size: 16px;
                                    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
                                "></i>
                                <span>Distribuição por Rota</span>
                            </div>
                            
                            <div style="padding: 20px;">
                                <div style="
                                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(124, 58, 237, 0.1));
                                    border-left: 4px solid #8b5cf6;
                                    padding: 12px 16px;
                                    border-radius: 0 12px 12px 0;
                                    margin-bottom: 16px;
                                    border: 1px solid rgba(139, 92, 246, 0.2);
                                    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.1);
                                ">
                                    <strong style="color: #fbbf24; font-size: 16px; font-weight: 700;">${label}</strong><br>
                                    <span style="color: #cbd5e1; font-weight: 500;">${turnoNome} • ${tipoHorario}</span>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                                    <div style="
                                        background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
                                        border: 1px solid rgba(251, 191, 36, 0.3);
                                        border-radius: 12px;
                                        padding: 12px;
                                        text-align: center;
                                        box-shadow: 0 2px 8px rgba(251, 191, 36, 0.1);
                                    ">
                                        <div style="
                                            font-size: 11px;
                                            color: #fbbf24;
                                            font-weight: 600;
                                            margin-bottom: 6px;
                                            text-transform: uppercase;
                                            letter-spacing: 0.5px;
                                        ">🕒 ATRASOS</div>
                                        <div style="
                                            font-weight: 800;
                                            color: #fcd34d;
                                            font-size: 16px;
                                            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                                        ">${tempo}</div>
                                    </div>
                                    <div style="
                                        background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(79, 70, 229, 0.1));
                                        border: 1px solid rgba(99, 102, 241, 0.3);
                                        border-radius: 12px;
                                        padding: 12px;
                                        text-align: center;
                                        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
                                    ">
                                        <div style="
                                            font-size: 11px;
                                            color: #6366f1;
                                            font-weight: 600;
                                            margin-bottom: 6px;
                                            text-transform: uppercase;
                                            letter-spacing: 0.5px;
                                        ">📊 PARTICIPAÇÃO</div>
                                        <div style="
                                            font-weight: 800;
                                            color: #818cf8;
                                            font-size: 16px;
                                            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                                        ">${percentage}%</div>
                                    </div>
                                </div>
                                
                                <div style="
                                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04));
                                    border: 1px solid rgba(255, 255, 255, 0.1);
                                    border-radius: 12px;
                                    padding: 16px;
                                    margin-bottom: 12px;
                                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                                ">
                                    <div style="
                                        display: flex;
                                        align-items: center;
                                        justify-content: space-between;
                                        margin-bottom: 12px;
                                    ">
                                        <span style="
                                            display: flex;
                                            align-items: center;
                                            gap: 8px;
                                            font-weight: 600;
                                            color: #e2e8f0;
                                            font-size: 14px;
                                        ">
                                            <span style="font-size: 18px;">${iconeNivel}</span>
                                            Nível de Impacto
                                        </span>
                                        <span style="
                                            background: linear-gradient(135deg, ${corNivel}, ${corNivel}dd);
                                            color: white;
                                            padding: 6px 12px;
                                            border-radius: 20px;
                                            font-size: 11px;
                                            font-weight: 700;
                                            text-transform: uppercase;
                                            letter-spacing: 0.8px;
                                            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
                                            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                                        ">${nivelImpacto}</span>
                                    </div>
                                    
                                    <div style="
                                        font-size: 12px;
                                        color: #cbd5e1;
                                        margin-bottom: 10px;
                                        font-style: italic;
                                    ">${descricaoImpacto}</div>
                                    
                                    <div style="
                                        background: rgba(255, 255, 255, 0.1);
                                        height: 8px;
                                        border-radius: 6px;
                                        overflow: hidden;
                                        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
                                    ">
                                        <div style="
                                            background: linear-gradient(90deg, ${corNivel}, ${corNivel}cc);
                                            height: 100%;
                                            width: ${progressoImpacto}%;
                                            border-radius: 6px;
                                            transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                                            box-shadow: 0 0 12px rgba(255, 255, 255, 0.3);
                                        "></div>
                                    </div>
                                </div>
                                
                                ${alertaEspecial}
                            </div>
                            
                            <div style="
                                background: rgba(15, 23, 42, 0.5);
                                padding: 12px 20px;
                                text-align: center;
                                border-top: 1px solid rgba(148, 163, 184, 0.2);
                            ">
                                <small style="
                                    color: #94a3b8;
                                    font-size: 11px;
                                    font-style: italic;
                                    font-weight: 500;
                                ">📈 Análise baseada em atrasos acumulados</small>
                            </div>
                        </div>
                    `;
                    
                    // Armazenar no cache
                    _tooltipCache.set(cacheKey, htmlResult);
                    
                    // Limpar cache se muito grande
                    if (_tooltipCache.size > 100) {
                        const firstKey = _tooltipCache.keys().next().value;
                        _tooltipCache.delete(firstKey);
                    }
                    
                    return htmlResult;
                    
                } catch (error) {
                    console.error('❌ Erro no tooltip premium:', error);
                    return '<div style="background: #dc2626; color: white; padding: 12px; border-radius: 8px;">Erro: ' + error.message + '</div>';
                }
            }
        },
        dataLabels: {
            enabled: true,
            style: {
                fontSize: '12px',
                fontWeight: 'bold',
                colors: ['#fff']
            },
            formatter: function(val, opts) {
                return Math.round(val) + '%';
            },
            dropShadow: {
                enabled: true,
                top: 1,
                left: 1,
                blur: 1,
                opacity: 0.45
            }
        },
        states: {
            hover: {
                filter: {
                    type: 'lighten',
                    value: 0.15
                }
            },
            active: {
                allowMultipleDataPointsSelection: false,
                filter: {
                    type: 'darken',
                    value: 0.35
                }
            }
        },
        responsive: [{
            breakpoint: 768,
            options: {
                chart: {
                    height: 300
                },
                title: {
                    style: {
                        fontSize: '16px'
                    }
                },
                legend: {
                    position: 'bottom',
                    fontSize: '11px'
                },
                plotOptions: {
                    pie: {
                        donut: {
                            size: '60%',
                            labels: {
                                name: {
                                    fontSize: '14px'
                                },
                                value: {
                                    fontSize: '20px'
                                },
                                total: {
                                    fontSize: '14px'
                                }
                            }
                        }
                    }
                }
            }
        }]
    };

    pizzaChart = new ApexCharts(chartContainer, options);
    pizzaChart.render();
}

async function atualizarGraficosAnalytics() {
    // Aguardar o carregamento das rotas se necessário
    if (!rotas || rotas.length === 0) {
        await carregarRotas();
    }
    
    const rotaId = document.getElementById('analytics-rota').value;
    const turno = document.getElementById('analytics-turno').value;
    const horario = document.getElementById('analytics-horario').value;
    const dataInicio = document.getElementById('analytics-data-inicio').value;
    const dataFim = document.getElementById('analytics-data-fim').value;


    try {
        // Buscar dados do backend
        let url = `${API_BASE}/percursos?data_inicio=${dataInicio}&data_fim=${dataFim}`;
        
        const response = await fetch(url);
        let dados = await response.json();
        

        // Aplicar filtros de turno, horário e rota para o gráfico de área
        const dadosFiltrados = aplicarFiltrosAvancados(dados, turno, horario, rotaId);

        // Aplicar filtros sem rota para o gráfico de pizza (apenas turno, sem horário específico)
        const dadosPizza = aplicarFiltrosPizza(dados, turno);

        // Atualizar gráfico Area Datetime
        atualizarGraficoAreaDatetime(dadosFiltrados);

        // Atualizar gráfico Pizza (sem filtro de rota)
        atualizarGraficoPizza(dadosPizza);

        // Atualizar métricas
        atualizarMetricasPizza(dadosFiltrados);

    } catch (error) {
        console.error('Erro ao carregar dados dos gráficos:', error);
        
        // Limpar gráficos em caso de erro
        if (candlestickChart) {
            candlestickChart.updateSeries([]);
        }
        if (pizzaChart) {
            pizzaChart.updateSeries([]);
        }
        
        // Limpar métricas
        document.getElementById('total-jornadas-pizza').textContent = '0';
        document.getElementById('total-atrasos-pizza').textContent = '0';
    }
}

function aplicarFiltrosAvancados(dados, turno, horario, rotaId) {
    let dadosFiltrados = [...dados];

    // Filtrar por rota
    if (rotaId) {
        dadosFiltrados = dadosFiltrados.filter(jornada => {
            return jornada.rota_id === rotaId;
        });
    }

    // Filtrar por turno (sempre vai ter um turno selecionado)
    dadosFiltrados = dadosFiltrados.filter(jornada => {
        if (turno === '1') {
            return jornada.turno === 'primeiro_turno';
        } else if (turno === '2') {
            return jornada.turno === 'segundo_turno';
        }
        return false; // Não deveria chegar aqui pois sempre temos um turno
    });

    // Filtrar por horário específico (sempre vai ter um horário selecionado)
    // Nova lógica: comparar com horario_saida_programado que contém chegada_martins OU saida_martins
    dadosFiltrados = dadosFiltrados.filter(jornada => {
        return jornada.horario_saida_programado === horario;
    });

    return dadosFiltrados;
}

function aplicarFiltrosPizza(dados, turno) {
    let dadosFiltrados = [...dados];

    // Para o gráfico de pizza, filtramos apenas por turno para ter mais dados
    dadosFiltrados = dadosFiltrados.filter(jornada => {
        if (turno === '1') {
            return jornada.turno === 'primeiro_turno';
        } else if (turno === '2') {
            return jornada.turno === 'segundo_turno';
        }
        return false;
    });


    return dadosFiltrados;
}

function atualizarGraficoAreaDatetime(dados) {
    if (!candlestickChart) return;

    // Processar dados para o gráfico de área
    const dadosProcessados = processarDadosAreaDatetime(dados);
    
    // Atualizar título baseado nos filtros selecionados
    const horarioSelecionado = document.getElementById('analytics-horario').value;
    const turnoSelecionado = document.getElementById('analytics-turno').value;
    const rotaSelecionada = document.getElementById('analytics-rota').value;
    const tipoHorario = document.getElementById('analytics-tipo-horario').value;
    
    let titulo = 'Análise Temporal de Horários - ';
    
    // Adicionar tipo de horário ao título
    if (tipoHorario === 'saida') {
        titulo += 'Saída ';
    } else {
        titulo += 'Chegada ';
    }
    
    // Agora sempre temos um horário específico selecionado
    titulo += `Horário ${horarioSelecionado}`;
    
    // Sempre temos um turno específico selecionado
    const nomeTurno = turnoSelecionado === '1' ? '1º Turno' : '2º Turno';
    titulo += ` - ${nomeTurno}`;
    
    // Sempre temos uma rota específica selecionada
    const rotaNome = rotas.find(r => r.id === rotaSelecionada)?.nome || rotaSelecionada;
    titulo += ` - Rota ${rotaNome}`;

    // Definir nomes das séries baseado no tipo de horário
    let nomeSerieProgramada, nomeSerieReal;
    
    if (tipoHorario === 'saida') {
        nomeSerieProgramada = 'Horário Programado (Martins)';
        nomeSerieReal = 'Horário Retorno/Destino';
    } else {
        nomeSerieProgramada = 'Chegada Programada';
        nomeSerieReal = 'Horário Retorno/Destino';
    }

    candlestickChart.updateOptions({
        title: {
            text: titulo
        }
    });

    candlestickChart.updateSeries([
        {
            name: nomeSerieProgramada,
            data: dadosProcessados.programado
        },
        {
            name: nomeSerieReal,
            data: dadosProcessados.real
        }
    ]);
}

function atualizarGraficoPizza(dados) {
    if (!pizzaChart) return;

    if (!dados || dados.length === 0) {
        pizzaChart.updateOptions({
            labels: ['Nenhum dado disponível'],
            series: [1],
            title: {
                text: 'Distribuição de Atrasos por Rota - Sem dados'
            }
        });
        return;
    }

    // Garantir que as rotas estejam carregadas
    if (!rotas || rotas.length === 0) {
        setTimeout(() => atualizarGraficoPizza(dados), 500);
        return;
    }

    // Agrupar dados por rota calculando atrasos corretamente
    const dadosPorRota = {};
    
    dados.forEach((jornada) => {
        // Usar o nome da rota do campo 'nome_rota' dos percursos, ou buscar nas rotas carregadas
        let rotaNome = jornada.nome_rota;
        
        if (!rotaNome) {
            const rotaEncontrada = rotas.find(r => r.id === jornada.rota_id);
            rotaNome = rotaEncontrada ? rotaEncontrada.nome : jornada.rota_id;
        }
        
        if (!dadosPorRota[rotaNome]) {
            dadosPorRota[rotaNome] = 0;
        }
        
        // Calcular atraso total da jornada usando apenas atrasos de chegada
        let atrasoTotal = 0;
        
        // Usar apenas atrasos de chegada já que não temos mais horário real de saída
        if (jornada.atraso_chegada !== undefined && jornada.atraso_chegada !== null) {
            atrasoTotal += Math.max(0, jornada.atraso_chegada);
        } else if (jornada.horario_chegada_programado && jornada.horario_chegada_real) {
            // Calcular atraso de chegada manualmente
            const chegadaProgramada = converterHorarioParaMinutos(jornada.horario_chegada_programado);
            const chegadaReal = converterHorarioParaMinutos(jornada.horario_chegada_real);
            const atrasoChegada = chegadaReal - chegadaProgramada;
            atrasoTotal += Math.max(0, atrasoChegada);
        }
        
        dadosPorRota[rotaNome] += atrasoTotal;
    });

    // Incluir todas as rotas, mesmo as sem atraso para ter uma visão completa
    const rotasComDados = {};
    Object.keys(dadosPorRota).forEach(rota => {
        // Manter todas as rotas que têm dados, mesmo com 0 atrasos
        rotasComDados[rota] = dadosPorRota[rota];
    });

    // Se não há atrasos, mas há dados, mostrar as rotas com 0 atrasos
    if (Object.keys(rotasComDados).length === 0 && dados.length > 0) {
        // Agrupar por rota mesmo sem atrasos para mostrar que as rotas existem
        dados.forEach(jornada => {
            let rotaNome = jornada.nome_rota;
            if (!rotaNome) {
                const rotaEncontrada = rotas.find(r => r.id === jornada.rota_id);
                rotaNome = rotaEncontrada ? rotaEncontrada.nome : jornada.rota_id;
            }
            if (!rotasComDados[rotaNome]) {
                rotasComDados[rotaNome] = 0;
            }
        });
    }

    const labels = Object.keys(rotasComDados);
    const values = Object.values(rotasComDados);

    // Verificar se há dados para exibir
    if (labels.length === 0) {
        pizzaChart.updateOptions({
            labels: ['Nenhuma rota encontrada'],
            series: [1],
            title: {
                text: 'Distribuição de Atrasos por Rota - Sem rotas'
            }
        });
        return;
    }

    // Se todos os valores são 0, criar um valor mínimo para visualização
    const todosZero = values.every(v => v === 0);
    const valoresParaGrafico = todosZero ? values.map(() => 1) : values;

    // Obter informações dos filtros para o título
    const turnoSelect = document.getElementById('analytics-turno');
    const turnoNome = turnoSelect && turnoSelect.value === '1' ? '1º Turno' : '2º Turno';
    
    const tituloGrafico = todosZero 
        ? `Distribuição de Rotas - ${turnoNome} (Sem atrasos registrados)`
        : `Distribuição de Atrasos por Rota - ${turnoNome}`;

    pizzaChart.updateOptions({
        labels: labels,
        series: valoresParaGrafico,
        title: {
            text: tituloGrafico
        }
    });

}

function processarDadosCandlestick(dados) {
    const horarioSelecionado = document.getElementById('analytics-horario').value;
    
    if (horarioSelecionado) {
        // Modo específico: agrupar por data para um horário específico
        return processarDadosPorHorarioEspecifico(dados, horarioSelecionado);
    } else {
        // Modo geral: agrupar todos os horários por data
        return processarDadosGerais(dados);
    }
}

function processarDadosAreaDatetime(dados) {
    const horarioSelecionado = document.getElementById('analytics-horario').value;
    const tipoHorario = document.getElementById('analytics-tipo-horario').value;
    
    // Agrupar dados por data
    const dadosPorData = {};
    
    dados.forEach(jornada => {
        const data = jornada.data;
        if (!dadosPorData[data]) {
            dadosPorData[data] = {
                programados: [],
                reais: []
            };
        }
        
        // Converter horários para minutos desde 00:00 baseado no filtro
        // Nova lógica: usar apenas horario_chegada_real (campo "Horário Retorno/Destino")
        // O campo programado pode ser baseado em chegada_martins ou saida_martins
        
        if (tipoHorario === 'saida') {
            if (jornada.horario_saida_programado) {
                dadosPorData[data].programados.push(converterHorarioParaMinutos(jornada.horario_saida_programado));
            }
            // Usar sempre horario_chegada_real como horário real (único campo real que temos)
            if (jornada.horario_chegada_real) {
                dadosPorData[data].reais.push(converterHorarioParaMinutos(jornada.horario_chegada_real));
            }
        }
        
        // Incluir horários de chegada se o filtro for chegada
        if (tipoHorario === 'chegada') {
            if (jornada.horario_chegada_programado) {
                dadosPorData[data].programados.push(converterHorarioParaMinutos(jornada.horario_chegada_programado));
            }
            if (jornada.horario_chegada_real) {
                dadosPorData[data].reais.push(converterHorarioParaMinutos(jornada.horario_chegada_real));
            }
        }
    });
    
    // Processar dados para o formato de séries de área
    const dadosProgramados = [];
    const dadosReais = [];
    
    Object.keys(dadosPorData).sort().forEach(data => {
        const dadosData = dadosPorData[data];
        const timestamp = new Date(data).getTime();
        
        if (dadosData.programados.length > 0) {
            const mediaProgramada = dadosData.programados.reduce((a, b) => a + b, 0) / dadosData.programados.length;
            dadosProgramados.push({
                x: timestamp,
                y: mediaProgramada
            });
        }
        
        if (dadosData.reais.length > 0) {
            const mediaReal = dadosData.reais.reduce((a, b) => a + b, 0) / dadosData.reais.length;
            dadosReais.push({
                x: timestamp,
                y: mediaReal
            });
        }
    });
    
    return {
        programado: dadosProgramados,
        real: dadosReais
    };
}

function processarDadosPorHorarioEspecifico(dados, horarioEspecifico) {
    // Filtrar apenas jornadas do horário específico
    const dadosFiltrados = dados.filter(jornada => jornada.horario_saida_programado === horarioEspecifico);
    
    // Agrupar por data
    const dadosPorData = {};
    
    dadosFiltrados.forEach(jornada => {
        const data = jornada.data;
        if (!dadosPorData[data]) {
            dadosPorData[data] = {
                saidaProgramada: null,
                saidaReal: null,
                chegadaProgramada: null,
                chegadaReal: null
            };
        }
        
        // Para horário específico, vamos organizar:
        // y[0]: Saída Programada (Open)
        // y[1]: Chegada Real (High) 
        // y[2]: Chegada Programada (Low)
        // y[3]: Saída Real (Close)
        
        dadosPorData[data].saidaProgramada = converterHorarioParaMinutos(jornada.horario_saida_programado);
        dadosPorData[data].chegadaProgramada = converterHorarioParaMinutos(jornada.horario_chegada_programado);
        
        // Usar apenas horario_chegada_real (campo "Horário Retorno/Destino")
        if (jornada.horario_chegada_real) {
            dadosPorData[data].chegadaReal = converterHorarioParaMinutos(jornada.horario_chegada_real);
            // Para compatibilidade, usar chegada real como saída real também
            dadosPorData[data].saidaReal = converterHorarioParaMinutos(jornada.horario_chegada_real);
        }
    });
    
    // Converter para formato ApexCharts
    const resultado = [];
    
    Object.keys(dadosPorData).sort().forEach(data => {
        const dadosData = dadosPorData[data];
        
        if (dadosData.saidaProgramada && dadosData.chegadaProgramada) {
            const open = dadosData.saidaProgramada; // Saída Programada
            const close = dadosData.saidaReal || dadosData.saidaProgramada; // Saída Real ou Programada
            const low = dadosData.chegadaProgramada; // Chegada Programada
            const high = dadosData.chegadaReal || dadosData.chegadaProgramada; // Chegada Real ou Programada
            
            resultado.push({
                x: new Date(data).getTime(),
                y: [open, high, low, close]
            });
        }
    });
    
    return resultado;
}

function processarDadosGerais(dados) {
    // Agrupar por data (modo original)
    const dadosPorData = {};

    dados.forEach(jornada => {
        const data = jornada.data;
        if (!dadosPorData[data]) {
            dadosPorData[data] = {
                programados: [],
                reais: [],
                chegadaProgramada: [],
                chegadaReal: [],
                // Dados separados por turno
                turno1: {
                    saidaReal: [],
                    chegadaReal: [],
                    saidaProgramada: [],
                    chegadaProgramada: []
                },
                turno2: {
                    saidaReal: [],
                    chegadaReal: [],
                    saidaProgramada: [],
                    chegadaProgramada: []
                }
            };
        }

        // Converter horários para minutos desde 00:00
        if (jornada.horario_saida_programado) {
            dadosPorData[data].programados.push(converterHorarioParaMinutos(jornada.horario_saida_programado));
            
            // Separar horários programados por turno
            if (jornada.turno === 'primeiro_turno') {
                dadosPorData[data].turno1.saidaProgramada.push(converterHorarioParaMinutos(jornada.horario_saida_programado));
            } else if (jornada.turno === 'segundo_turno') {
                dadosPorData[data].turno2.saidaProgramada.push(converterHorarioParaMinutos(jornada.horario_saida_programado));
            }
        }
        // Usar apenas horario_chegada_real (campo "Horário Retorno/Destino")
        if (jornada.horario_chegada_real) {
            dadosPorData[data].reais.push(converterHorarioParaMinutos(jornada.horario_chegada_real));
            
            // Separar por turno
            if (jornada.turno === 'primeiro_turno') {
                dadosPorData[data].turno1.saidaReal.push(converterHorarioParaMinutos(jornada.horario_chegada_real));
            } else if (jornada.turno === 'segundo_turno') {
                dadosPorData[data].turno2.saidaReal.push(converterHorarioParaMinutos(jornada.horario_chegada_real));
            }
        }
        if (jornada.horario_chegada_programado) {
            dadosPorData[data].chegadaProgramada.push(converterHorarioParaMinutos(jornada.horario_chegada_programado));
            
            // Separar horários programados por turno
            if (jornada.turno === 'primeiro_turno') {
                dadosPorData[data].turno1.chegadaProgramada.push(converterHorarioParaMinutos(jornada.horario_chegada_programado));
            } else if (jornada.turno === 'segundo_turno') {
                dadosPorData[data].turno2.chegadaProgramada.push(converterHorarioParaMinutos(jornada.horario_chegada_programado));
            }
        }
        if (jornada.horario_chegada_real) {
            dadosPorData[data].chegadaReal.push(converterHorarioParaMinutos(jornada.horario_chegada_real));
            
            // Separar por turno
            if (jornada.turno === 'primeiro_turno') {
                dadosPorData[data].turno1.chegadaReal.push(converterHorarioParaMinutos(jornada.horario_chegada_real));
            } else if (jornada.turno === 'segundo_turno') {
                dadosPorData[data].turno2.chegadaReal.push(converterHorarioParaMinutos(jornada.horario_chegada_real));
            }
        }
    });

    // Processar dados para formato candlestick
    const candlestickData = [];

    Object.keys(dadosPorData).sort().forEach(data => {
        const dadosData = dadosPorData[data];
        
        if (dadosData.programados.length > 0 && dadosData.reais.length > 0) {
            // Calcular valores para o candlestick
            const abertura = dadosData.programados.reduce((a, b) => a + b, 0) / dadosData.programados.length; // Média programada
            const fechamento = dadosData.reais.reduce((a, b) => a + b, 0) / dadosData.reais.length; // Média real
            
            // Usar valores mínimos e máximos dos horários de chegada
            let minima = Math.min(...dadosData.reais, ...dadosData.programados);
            let maxima = Math.max(...dadosData.reais, ...dadosData.programados);
            
            // Se temos dados de chegada, usar eles para min/max
            if (dadosData.chegadaProgramada.length > 0) {
                minima = Math.min(minima, ...dadosData.chegadaProgramada);
            }
            if (dadosData.chegadaReal.length > 0) {
                maxima = Math.max(maxima, ...dadosData.chegadaReal);
            }
            
            // Calcular médias por turno para o tooltip
            const turno1MediaSaida = dadosData.turno1.saidaReal.length > 0 ? 
                dadosData.turno1.saidaReal.reduce((a, b) => a + b, 0) / dadosData.turno1.saidaReal.length : null;
            const turno1MediaChegada = dadosData.turno1.chegadaReal.length > 0 ? 
                dadosData.turno1.chegadaReal.reduce((a, b) => a + b, 0) / dadosData.turno1.chegadaReal.length : null;
            const turno1MediaSaidaProgramada = dadosData.turno1.saidaProgramada.length > 0 ? 
                dadosData.turno1.saidaProgramada.reduce((a, b) => a + b, 0) / dadosData.turno1.saidaProgramada.length : null;
            const turno1MediaChegadaProgramada = dadosData.turno1.chegadaProgramada.length > 0 ? 
                dadosData.turno1.chegadaProgramada.reduce((a, b) => a + b, 0) / dadosData.turno1.chegadaProgramada.length : null;
            
            const turno2MediaSaida = dadosData.turno2.saidaReal.length > 0 ? 
                dadosData.turno2.saidaReal.reduce((a, b) => a + b, 0) / dadosData.turno2.saidaReal.length : null;
            const turno2MediaChegada = dadosData.turno2.chegadaReal.length > 0 ? 
                dadosData.turno2.chegadaReal.reduce((a, b) => a + b, 0) / dadosData.turno2.chegadaReal.length : null;
            const turno2MediaSaidaProgramada = dadosData.turno2.saidaProgramada.length > 0 ? 
                dadosData.turno2.saidaProgramada.reduce((a, b) => a + b, 0) / dadosData.turno2.saidaProgramada.length : null;
            const turno2MediaChegadaProgramada = dadosData.turno2.chegadaProgramada.length > 0 ? 
                dadosData.turno2.chegadaProgramada.reduce((a, b) => a + b, 0) / dadosData.turno2.chegadaProgramada.length : null;
            
            candlestickData.push({
                x: new Date(data).getTime(),
                y: [abertura, maxima, minima, fechamento],
                // Dados extras para o tooltip
                turnoStats: {
                    turno1: {
                        mediaSaida: turno1MediaSaida,
                        mediaChegada: turno1MediaChegada,
                        mediaSaidaProgramada: turno1MediaSaidaProgramada,
                        mediaChegadaProgramada: turno1MediaChegadaProgramada,
                        totalJornadas: dadosData.turno1.saidaReal.length
                    },
                    turno2: {
                        mediaSaida: turno2MediaSaida,
                        mediaChegada: turno2MediaChegada,
                        mediaSaidaProgramada: turno2MediaSaidaProgramada,
                        mediaChegadaProgramada: turno2MediaChegadaProgramada,
                        totalJornadas: dadosData.turno2.saidaReal.length
                    }
                }
            });
        }
    });

    return candlestickData;
}

function atualizarMetricasPizza(dados) {
    const totalJornadas = dados.length;
    let totalMinutosAtraso = 0;
    let jornadasComAtraso = 0;

    dados.forEach(jornada => {
        let atrasoJornada = 0;
        
        // Atraso de chegada
        if (jornada.horario_chegada_programado && jornada.horario_chegada_real) {
            const chegadaProgramada = converterHorarioParaMinutos(jornada.horario_chegada_programado);
            const chegadaReal = converterHorarioParaMinutos(jornada.horario_chegada_real);
            const atrasoChegada = Math.max(0, chegadaReal - chegadaProgramada);
            atrasoJornada += atrasoChegada;
        }
        
        if (atrasoJornada > 0) {
            jornadasComAtraso++;
            totalMinutosAtraso += atrasoJornada;
        }
    });

    // Atualizar elementos se existirem
    const elementoJornadas = document.getElementById('total-jornadas-pizza');
    const elementoAtrasos = document.getElementById('total-atrasos-pizza');
    
    if (elementoJornadas) {
        elementoJornadas.textContent = totalJornadas;
    }
    
    if (elementoAtrasos) {
        const horas = Math.floor(totalMinutosAtraso / 60);
        const minutos = totalMinutosAtraso % 60;
        const tempoFormatado = horas > 0 ? `${horas}h ${minutos}min` : `${totalMinutosAtraso}min`;
        elementoAtrasos.textContent = `${tempoFormatado} (${jornadasComAtraso} jornadas)`;
    }
}

function converterHorarioParaMinutos(horario) {
    if (!horario) return 0;
    const [horas, minutos] = horario.split(':').map(Number);
    return horas * 60 + minutos;
}

// Função para atualizar filtro de horário baseado no turno, tipo de movimentação e dados reais do banco
function atualizarFiltroHorario() {
    const turnoSelect = document.getElementById('analytics-turno');
    const horarioSelect = document.getElementById('analytics-horario');
    const tipoHorarioSelect = document.getElementById('analytics-tipo-horario');
    
    // Limpar todas as opções atuais
    horarioSelect.innerHTML = '';
    
    const turnoSelecionado = turnoSelect.value;
    const tipoMovimentacao = tipoHorarioSelect ? tipoHorarioSelect.value : 'saida'; // Default para saída
    
    // Obter horários únicos das rotas carregadas baseado no tipo de movimentação
    const horariosUnicos = new Set();
    
    if (rotas && rotas.length > 0) {
        rotas.forEach(rota => {
            if (rota.horarios) {
                let horariosTurno = [];
                
                if (turnoSelecionado === '1' && rota.horarios.primeiro_turno) {
                    horariosTurno = rota.horarios.primeiro_turno;
                } else if (turnoSelecionado === '2' && rota.horarios.segundo_turno) {
                    horariosTurno = rota.horarios.segundo_turno;
                }
                
                // Extrair horários baseado no tipo de movimentação selecionado
                horariosTurno.forEach(h => {
                    if (tipoMovimentacao === 'saida') {
                        // Para tipo "saída", mostrar apenas horários saida_martins
                        if (h.saida_martins) {
                            horariosUnicos.add(h.saida_martins);
                        }
                    } else if (tipoMovimentacao === 'chegada') {
                        // Para tipo "chegada", mostrar apenas horários chegada_martins
                        if (h.chegada_martins) {
                            horariosUnicos.add(h.chegada_martins);
                        }
                    }
                });
            }
        });
    }
    
    // Se não conseguiu carregar horários das rotas, usar horários padrão filtrados por tipo
    if (horariosUnicos.size === 0) {
        if (turnoSelecionado === '1') {
            if (tipoMovimentacao === 'saida') {
                // Apenas horários de saída do 1º turno
                const horariosSaida1 = ['13:40', '15:30', '17:00'];
                horariosSaida1.forEach(horario => horariosUnicos.add(horario));
            } else if (tipoMovimentacao === 'chegada') {
                // Apenas horários de chegada do 1º turno
                const horariosChegada1 = ['05:20', '06:55'];
                horariosChegada1.forEach(horario => horariosUnicos.add(horario));
            }
        } else if (turnoSelecionado === '2') {
            if (tipoMovimentacao === 'saida') {
                // Apenas horários de saída do 2º turno
                const horariosSaida2 = ['23:00', '01:00', '02:55', '05:00', '07:00'];
                horariosSaida2.forEach(horario => horariosUnicos.add(horario));
            } else if (tipoMovimentacao === 'chegada') {
                // Apenas horários de chegada do 2º turno
                const horariosChegada2 = ['15:00', '17:00', '21:00'];
                horariosChegada2.forEach(horario => horariosUnicos.add(horario));
            }
        }
    }
    
    // Converter para array e ordenar
    const horariosOrdenados = Array.from(horariosUnicos).sort();
    
    // Adicionar opções ao select
    horariosOrdenados.forEach((horario, index) => {
        const option = document.createElement('option');
        option.value = horario;
        option.textContent = horario;
        if (index === 0) option.selected = true; // Seleciona o primeiro por padrão
        horarioSelect.appendChild(option);
    });
    
    // Atualizar gráficos após mudança de horário
    atualizarGraficosAnalytics();
}

// Event listener para o filtro de turno
document.addEventListener('DOMContentLoaded', function() {
    const turnoSelect = document.getElementById('analytics-turno');
    if (turnoSelect) {
        turnoSelect.addEventListener('change', atualizarFiltroHorario);
    }
    
    // Event listener para o filtro de tipo de horário
    const tipoHorarioSelect = document.getElementById('analytics-tipo-horario');
    if (tipoHorarioSelect) {
        tipoHorarioSelect.addEventListener('change', function() {
            // Atualizar lista de horários quando tipo de movimentação mudar
            atualizarFiltroHorario();
        });
    }
    
    // Event listeners para outros filtros de analytics
    const rotaSelect = document.getElementById('analytics-rota');
    const horarioSelect = document.getElementById('analytics-horario');
    const dataInicio = document.getElementById('analytics-data-inicio');
    const dataFim = document.getElementById('analytics-data-fim');
    
    if (rotaSelect) rotaSelect.addEventListener('change', atualizarGraficosAnalytics);
    if (horarioSelect) horarioSelect.addEventListener('change', atualizarGraficosAnalytics);
    if (dataInicio) dataInicio.addEventListener('change', atualizarGraficosAnalytics);
    if (dataFim) dataFim.addEventListener('change', atualizarGraficosAnalytics);
});

// === TOOLTIP FUNCTIONS ===

// (removido) debugGraficoPizza: função de debug não utilizada

function mostrarTooltip(e, htmlContent) {
    // 1. Criar tooltip global se não existir
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'custom-tooltip-premium';
        document.body.appendChild(tooltipElement);
    }
    
    // 2. Garantir que temos o card correto
    let card = e.currentTarget;
    if (!card || !card.classList.contains('rota-status-card')) {
        card = e.target.closest('.rota-status-card');
    }
    
    // Se ainda não encontrou o card, tentar o próprio target
    if (!card) {
        card = e.target;
        while (card && !card.classList.contains('rota-status-card')) {
            card = card.parentElement;
        }
    }
    
    // Se ainda não encontrou, abortar
    if (!card) {
        console.warn('Card não encontrado para tooltip');
        return;
    }

    // 3. Atualizar conteúdo apenas se for diferente - evita re-render desnecessário
    if (lastTooltipContent !== htmlContent) {
        tooltipElement.innerHTML = htmlContent;
        lastTooltipContent = htmlContent;
    }

    // 4. Esconder temporariamente para medição precisa
    tooltipElement.style.visibility = 'hidden';
    tooltipElement.style.opacity = '0';
    tooltipElement.classList.remove('show');

    // 5. Usar requestAnimationFrame para posicionamento suave
    requestAnimationFrame(() => {
        // Tornar visível para medição correta
        tooltipElement.style.visibility = 'visible';
        
        // Obter dimensões do card e tooltip APÓS renderização
        const cardRect = card.getBoundingClientRect();
        const tipRect = tooltipElement.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset;
        const scrollX = window.scrollX || window.pageXOffset;
        const margin = 8;
        
        // 6. Calcular posição vertical (acima ou abaixo do card)
        let top, arrowClass;
        const spaceBelow = window.innerHeight - cardRect.bottom;
        const spaceAbove = cardRect.top;
        
        if (spaceBelow >= tipRect.height + margin) {
            // Posicionar abaixo do card
            top = cardRect.bottom + scrollY + margin;
            arrowClass = 'arrow-top';
        } else if (spaceAbove >= tipRect.height + margin) {
            // Posicionar acima do card
            top = cardRect.top + scrollY - tipRect.height - margin;
            arrowClass = 'arrow-bottom';
        } else {
            // Fallback: posicionar abaixo mesmo que não caiba perfeitamente
            top = cardRect.bottom + scrollY + margin;
            arrowClass = 'arrow-top';
        }
        
        // 7. Calcular posição horizontal (centralizado)
        let left = cardRect.left + scrollX + (cardRect.width - tipRect.width) / 2;
        
        // Garantir que não saia da tela
        const minLeft = margin + scrollX;
        const maxLeft = window.innerWidth + scrollX - tipRect.width - margin;
        left = Math.max(minLeft, Math.min(left, maxLeft));

        // 8. Aplicar posicionamento
        tooltipElement.style.position = 'absolute';
        tooltipElement.style.top = `${top}px`;
        tooltipElement.style.left = `${left}px`;

        // 9. Limpar classes de seta e aplicar a correta
        tooltipElement.classList.remove(
            'arrow-top','arrow-bottom','arrow-left','arrow-right',
            'arrow-top-left','arrow-top-right','arrow-bottom-left','arrow-bottom-right'
        );
        tooltipElement.classList.add(arrowClass);

        // 10. Mostrar tooltip com animação
        tooltipElement.classList.add('show');
        tooltipElement.style.opacity = ''; // Remover override de opacity
        tooltipElement.style.visibility = ''; // Remover override de visibility

        // 11. Salvar referências
        isTooltipVisible = true;
        currentTooltipTarget = card;
    });
}

function esconderTooltipComDelay() {
    // Limpar timer anterior se existir
    if (hideTooltipTimer) {
        clearTimeout(hideTooltipTimer);
        hideTooltipTimer = null;
    }
    
    // Criar novo timer para esconder tooltip
    hideTooltipTimer = setTimeout(() => {
        if (tooltipElement && isTooltipVisible) {
            // 1. Remover classe 'show' para iniciar animação de saída
            tooltipElement.classList.remove('show');
            
            // 2. Apenas esconder visualmente, mantendo elemento no DOM para reutilização
            setTimeout(() => {
                if (tooltipElement) {
                    tooltipElement.style.visibility = 'hidden';
                    tooltipElement.style.opacity = '0';
                    isTooltipVisible = false;
                    currentTooltipTarget = null;
                }
                // Limpar timer
                hideTooltipTimer = null;
            }, 300); // Aguardar animação CSS
        }
    }, 150);
}

function esconderTooltipImediato() {
    if (tooltipElement) {
        // Esconder imediatamente sem animação, mas manter no DOM para reutilização
        tooltipElement.classList.remove('show');
        tooltipElement.style.visibility = 'hidden';
        tooltipElement.style.opacity = '0';
    }
    
    // Resetar estados
    isTooltipVisible = false;
    currentTooltipTarget = null;
    mouseOverTooltip = false;
    lastTooltipContent = ''; // Limpar cache de conteúdo
    
    // Limpar todos os timeouts
    clearAllTooltipTimers();
}

// Eventos globais para melhor controle de tooltips
document.addEventListener('DOMContentLoaded', function() {
    // Esconder tooltip ao clicar em qualquer lugar
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.custom-tooltip-premium') && !e.target.closest('.rota-status-card')) {
            esconderTooltipImediato();
        }
    });
    
    // Controle de movimento do mouse para esconder tooltip quando necessário
    document.addEventListener('mousemove', function(e) {
        // Se o mouse não está sobre um card de rota ou tooltip, iniciar countdown para esconder
        const isOverCard = e.target.closest('.rota-status-card');
        const isOverTooltip = e.target.closest('.custom-tooltip-premium');
        
        if (!isOverCard && !isOverTooltip && isTooltipVisible) {
            // Usar timeout mais curto para movimento rápido
            if (!tooltipTransitionTimeout) {
                tooltipTransitionTimeout = setTimeout(() => {
                    esconderTooltipImediato();
                }, 200);
            }
        } else if ((isOverCard || isOverTooltip) && tooltipTransitionTimeout) {
            // Cancelar timeout se voltou para área do tooltip
            clearTimeout(tooltipTransitionTimeout);
            tooltipTransitionTimeout = null;
        }
    });
    
    // Esconder tooltip ao rolar a página (mais rápido)
    window.addEventListener('scroll', function() {
        if (isTooltipVisible) {
            esconderTooltipImediato();
        }
    }, { passive: true });
    
    // Esconder tooltip ao redimensionar janela
    window.addEventListener('resize', function() {
        if (isTooltipVisible) {
            esconderTooltipImediato();
        }
    });
    
    // Tecla ESC para esconder tooltip
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isTooltipVisible) {
            esconderTooltipImediato();
        }
    });
});

// Função para carregar dados de performance por turno melhorada
async function carregarPerformanceTurnosEnhanced() {
    try {
        
        // Primeiro, limpar dados fictícios
        limparDadosFicticios();
        
        const response = await fetch('/api/percursos');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        // A API retorna diretamente um array de percursos
        if (Array.isArray(data) && data.length > 0) {
            const dadosTurnos = processarDadosTurnos(data);
            
            if (dadosTurnos && Object.keys(dadosTurnos).length > 0) {
                atualizarPerformanceTurnosEnhanced(dadosTurnos);
            } else {
                console.error('❌ Nenhum dado válido processado');
                mostrarErroInterface();
            }
        } else {
            console.error('❌ Dados inválidos recebidos da API:', typeof data, data);
            mostrarErroInterface();
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados de turnos:', error);
        mostrarErroInterface();
    }
}

// Função para limpar dados fictícios da interface
function limparDadosFicticios() {
    
    // Elementos por ID direto - todos os possíveis IDs que podem ter dados fictícios
    const elementos = [
        // IDs do formato manha-*, tarde-*, noite-*
        'manha-jornadas', 'manha-pontualidade', 'manha-atraso-medio', 'manha-dias-atraso', 'manha-horario-top', 'manha-rota-critica',
        'tarde-jornadas', 'tarde-pontualidade', 'tarde-atraso-medio', 'tarde-dias-atraso', 'tarde-horario-top', 'tarde-rota-critica',
        'noite-jornadas', 'noite-pontualidade', 'noite-atraso-medio', 'noite-dias-atraso', 'noite-horario-top', 'noite-rota-critica',
        
        // IDs do formato *-turno1, *-turno2 
        'pontualidade-turno1', 'jornadas-turno1', 'atraso-turno1', 'horario-top-turno1', 'dias-atraso-turno1', 'rota-critica-turno1',
        'pontualidade-turno2', 'jornadas-turno2', 'atraso-turno2', 'horario-top-turno2', 'dias-atraso-turno2', 'rota-critica-turno2'
    ];
    
    let elementosLimpos = 0;
    elementos.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = '...';
            elementosLimpos++;
        }
    });

}

// Função para mostrar erro na interface
function mostrarErroInterface() {
    
    const elementos = [
        'manha-jornadas', 'manha-pontualidade', 'manha-atraso-medio', 'manha-dias-atraso', 'manha-horario-top', 'manha-rota-critica',
        'tarde-jornadas', 'tarde-pontualidade', 'tarde-atraso-medio', 'tarde-dias-atraso', 'tarde-horario-top', 'tarde-rota-critica',
        'noite-jornadas', 'noite-pontualidade', 'noite-atraso-medio', 'noite-dias-atraso', 'noite-horario-top', 'noite-rota-critica',
        'pontualidade-turno1', 'jornadas-turno1', 'atraso-turno1', 'horario-top-turno1', 'dias-atraso-turno1', 'rota-critica-turno1',
        'pontualidade-turno2', 'jornadas-turno2', 'atraso-turno2', 'horario-top-turno2', 'dias-atraso-turno2', 'rota-critica-turno2'
    ];
    
    elementos.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = 'Erro';
        }
    });
}

// Função para processar dados dos turnos melhorada com cálculos reais
function processarDadosTurnos(percursos) {
    const turnos = {
        matutino: {
            nome: 'Matutino',
            periodo: '05:00 - 18:00',
            jornadas: 0,
            atrasos: 0,
            pontualidade: 0,
            atrasoMedio: 0,
            horarioTop: '',
            horarioTopPercentual: 0,
            diasComAtraso: 0,
            rotaCritica: '',
            rotaCriticaCount: 0,
            totalDias: 0,
            historico: [],
            atrasosSaida: 0,
            atrasosChegada: 0,
            somaAtrasos: 0
        },
        noturno: {
            nome: 'Noturno',
            periodo: '21:00 - 05:00',
            jornadas: 0,
            atrasos: 0,
            pontualidade: 0,
            atrasoMedio: 0,
            horarioTop: '',
            horarioTopPercentual: 0,
            diasComAtraso: 0,
            rotaCritica: '',
            rotaCriticaCount: 0,
            totalDias: 0,
            historico: [],
            atrasosSaida: 0,
            atrasosChegada: 0,
            somaAtrasos: 0
        }
    };

    const rotasAtraso = { matutino: {}, noturno: {} };
    const horariosFrequencia = { matutino: {}, noturno: {} };
    const horariosPerformance = { matutino: {}, noturno: {} };
    const diasUnicosPorTurno = { matutino: new Set(), noturno: new Set() };
    const diasComAtrasoPorTurno = { matutino: new Set(), noturno: new Set() };
    const historicoPorDia = { matutino: {}, noturno: {} };

    percursos.forEach(percurso => {
        
        // Determinar turno baseado no horário de saída programado
        let horarioSaidaProgramada;
        
        // Usar o horário de saída programado para determinar o turno
        if (percurso.horario_saida_programado) {
            const dataPercurso = percurso.data || new Date().toISOString().split('T')[0];
            horarioSaidaProgramada = new Date(`${dataPercurso}T${percurso.horario_saida_programado}:00`);
        } else {
            console.warn('Percurso sem horário de saída programado:', percurso);
            return; // Pular este percurso
        }
        
        const hora = horarioSaidaProgramada.getHours();
        
        let turno;
        if (hora >= 5 && hora < 21) {
            turno = 'matutino'; // 05:00 às 20:59
        } else {
            turno = 'noturno'; // 21:00 às 04:59
        }

        const dadosTurno = turnos[turno];
        dadosTurno.jornadas++;
        
        // Marcar dia único
        const dia = horarioSaidaProgramada.toDateString();
        const diaFormatado = horarioSaidaProgramada.toLocaleDateString('pt-BR');
        diasUnicosPorTurno[turno].add(dia);

        // Usar os campos de atraso diretos dos dados
        let atrasoSaida = 0;
        let atrasoChegada = 0;
        
        if (percurso.atraso_saida !== undefined && percurso.atraso_saida !== null) {
            atrasoSaida = Math.max(0, percurso.atraso_saida); // Garantir que não seja negativo
        }
        
        if (percurso.atraso_chegada !== undefined && percurso.atraso_chegada !== null) {
            atrasoChegada = Math.max(0, percurso.atraso_chegada); // Garantir que não seja negativo
        }

        // Considerar percurso com atraso se saída ou chegada atrasaram mais de 5 minutos
        const temAtraso = atrasoSaida > 5 || atrasoChegada > 5;
        const atrasoTotal = Math.max(atrasoSaida, atrasoChegada);

        if (temAtraso) {
            dadosTurno.atrasos++;
            dadosTurno.somaAtrasos += atrasoTotal;
            diasComAtrasoPorTurno[turno].add(dia);
            
            if (atrasoSaida > 5) dadosTurno.atrasosSaida++;
            if (atrasoChegada > 5) dadosTurno.atrasosChegada++;
            
            // Usar nome da rota real dos dados
            const rota = percurso.nome_rota || 'Rota Desconhecida';
            rotasAtraso[turno][rota] = (rotasAtraso[turno][rota] || 0) + 1;
            
        }

        // Contabilizar frequência e performance de horários
        const horaMinuto = `${String(hora).padStart(2, '0')}:${String(horarioSaidaProgramada.getMinutes()).padStart(2, '0')}`;
        horariosFrequencia[turno][horaMinuto] = (horariosFrequencia[turno][horaMinuto] || 0) + 1;
        
        if (!horariosPerformance[turno][horaMinuto]) {
            horariosPerformance[turno][horaMinuto] = { total: 0, pontuais: 0 };
        }
        horariosPerformance[turno][horaMinuto].total++;
        if (!temAtraso) {
            horariosPerformance[turno][horaMinuto].pontuais++;
        }

        // Dados para histórico diário
        if (!historicoPorDia[turno][diaFormatado]) {
            historicoPorDia[turno][diaFormatado] = { total: 0, pontuais: 0, atrasos: 0, somaAtrasos: 0 };
        }
        historicoPorDia[turno][diaFormatado].total++;
        if (temAtraso) {
            historicoPorDia[turno][diaFormatado].atrasos++;
            historicoPorDia[turno][diaFormatado].somaAtrasos += atrasoTotal;
        } else {
            historicoPorDia[turno][diaFormatado].pontuais++;
        }
    });

    // Calcular métricas finais para cada turno
    Object.keys(turnos).forEach(turnoKey => {
        const dados = turnos[turnoKey];
        
        // Total de dias únicos
        dados.totalDias = diasUnicosPorTurno[turnoKey].size;
        
        // Dias com atraso (contagem real)
        dados.diasComAtraso = diasComAtrasoPorTurno[turnoKey].size;
        
        // Pontualidade (percentual de jornadas sem atraso)
        if (dados.jornadas > 0) {
            dados.pontualidade = parseFloat(((dados.jornadas - dados.atrasos) / dados.jornadas * 100).toFixed(2));
        }
        // Atraso médio (apenas dos percursos que tiveram atraso)
        if (dados.atrasos > 0) {
            dados.atrasoMedio = parseFloat((dados.somaAtrasos / dados.atrasos).toFixed(2));
        }

        // Encontrar horário com melhor performance (maior % de pontualidade)
        let melhorHorario = '';
        let melhorPercentual = 0;
        Object.entries(horariosPerformance[turnoKey]).forEach(([horario, stats]) => {
            const percentual = stats.total > 0 ? (stats.pontuais / stats.total) * 100 : 0;
            if (percentual > melhorPercentual && stats.total >= 3) { // Mínimo 3 jornadas para considerar
                melhorPercentual = percentual;
                melhorHorario = horario;
            }
        });
        dados.horarioTop = melhorHorario || 'N/A';
        dados.horarioTopPercentual = melhorPercentual;

        // Encontrar rota com mais atrasos
        const rotas = Object.entries(rotasAtraso[turnoKey]);
        if (rotas.length > 0) {
            const [rotaCritica, count] = rotas.reduce((a, b) => a[1] > b[1] ? a : b);
            dados.rotaCritica = rotaCritica;
            dados.rotaCriticaCount = count;
        } else {
            dados.rotaCritica = 'Nenhuma';
            dados.rotaCriticaCount = 0;
        }

        // Gerar histórico dos últimos 7 dias para tendência
        const diasOrdenados = Object.keys(historicoPorDia[turnoKey])
            .sort((a, b) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')))
            .slice(-7);

        dados.historico = diasOrdenados.map(dia => {
            const stats = historicoPorDia[turnoKey][dia];
            const pontualidade = stats.total > 0 ? (stats.pontuais / stats.total) * 100 : 100;
            const atrasoMedio = stats.atrasos > 0 ? stats.somaAtrasos / stats.atrasos : 0;
            
            return {
                data: dia,
                pontualidade: parseFloat(pontualidade.toFixed(2)),
                atraso: parseFloat(atrasoMedio.toFixed(2)),
                jornadas: stats.total
            };
        });
    });

    return turnos;
}

// Função para atualizar a interface da performance dos turnos melhorada com dados reais
function atualizarPerformanceTurnosEnhanced(dadosTurnos) {
    
    // Atualizar sumário geral
    const totalJornadas = dadosTurnos.matutino.jornadas + dadosTurnos.noturno.jornadas;
    const totalAtrasos = dadosTurnos.matutino.atrasos + dadosTurnos.noturno.atrasos;
    const pontualidadeGeral = totalJornadas > 0 ? ((totalJornadas - totalAtrasos) / totalJornadas * 100).toFixed(1) : 0;

    // Atualizar eficiência global
    const eficienciaElement = document.getElementById('eficiencia-global');
    if (eficienciaElement) {
        eficienciaElement.textContent = `${pontualidadeGeral}%`;
    }

    // Atualizar última atualização
    const ultimaAtualizacaoElement = document.getElementById('ultima-atualizacao');
    if (ultimaAtualizacaoElement) {
        const agora = new Date();
        ultimaAtualizacaoElement.textContent = `${agora.toLocaleDateString('pt-BR')}, ${agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`;
    }

    // Atualizar cada turno
    Object.keys(dadosTurnos).forEach(turnoKey => {
        const dados = dadosTurnos[turnoKey];
        const turnoCard = document.querySelector(`.turno-card-premium.turno-${turnoKey}`);
        
        if (turnoCard) {
            // Atualizar turno
            // Atualizar período do turno
            const periodoElement = turnoCard.querySelector('.turno-periodo');
            if (periodoElement) {
                periodoElement.textContent = dados.periodo;
            }

            // Status do turno baseado na pontualidade real
            const statusElement = turnoCard.querySelector('.turno-status span:last-child');
            const statusDot = turnoCard.querySelector('.status-dot');
            
            if (dados.pontualidade >= 90) {
                if (statusElement) statusElement.textContent = 'Performance Excelente';
                if (statusDot) statusDot.style.background = '#27ae60';
                turnoCard.querySelector('.turno-status').style.color = '#27ae60';
            } else if (dados.pontualidade >= 75) {
                if (statusElement) statusElement.textContent = 'Performance Boa';
                if (statusDot) statusDot.style.background = '#f39c12';
                turnoCard.querySelector('.turno-status').style.color = '#f39c12';
            } else if (dados.pontualidade >= 60) {
                if (statusElement) statusElement.textContent = 'Performance Regular';
                if (statusDot) statusDot.style.background = '#e67e22';
                turnoCard.querySelector('.turno-status').style.color = '#e67e22';
            } else {
                if (statusElement) statusElement.textContent = 'Precisa Melhorar';
                if (statusDot) statusDot.style.background = '#e74c3c';
                turnoCard.querySelector('.turno-status').style.color = '#e74c3c';
            }

            // Performance indicator baseado na pontualidade real
            const performanceIndicator = turnoCard.querySelector('.performance-indicator');
            const performanceLevel = turnoCard.querySelector('.performance-level');
            
            if (performanceIndicator && performanceLevel) {
                const pontualidade = dados.pontualidade;
                if (pontualidade >= 95) {
                    performanceIndicator.className = 'performance-indicator excellent';
                    performanceIndicator.innerHTML = '<i class="fas fa-trophy"></i>';
                    performanceLevel.textContent = 'Excelente';
                } else if (pontualidade >= 85) {
                    performanceIndicator.className = 'performance-indicator good';
                    performanceIndicator.innerHTML = '<i class="fas fa-thumbs-up"></i>';
                    performanceLevel.textContent = 'Bom';
                } else if (pontualidade >= 70) {
                    performanceIndicator.className = 'performance-indicator average';
                    performanceIndicator.innerHTML = '<i class="fas fa-minus-circle"></i>';
                    performanceLevel.textContent = 'Regular';
                } else {
                    performanceIndicator.className = 'performance-indicator poor';
                    performanceIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                    performanceLevel.textContent = 'Ruim';
                }
            }

            // Atualizar estatísticas específicas com IDs corretos
            let turnoPrefix = '';
            if (turnoKey === 'matutino') {
                turnoPrefix = 'manha';
            } else if (turnoKey === 'vespertino') {
                turnoPrefix = 'tarde';
            } else if (turnoKey === 'noturno') {
                turnoPrefix = 'noite';
            }
            
            // Atualizar elementos com ID padrão (ex: manha-pontualidade)
            if (turnoPrefix) {
                
                const jornadasEl = document.getElementById(`${turnoPrefix}-jornadas`);
                if (jornadasEl) {
                    jornadasEl.textContent = dados.jornadas.toString();
                }
                
                const pontualidadeEl = document.getElementById(`${turnoPrefix}-pontualidade`);
                if (pontualidadeEl) {
                    pontualidadeEl.textContent = `${dados.pontualidade}%`;
                }
                
                const atrasoMedioEl = document.getElementById(`${turnoPrefix}-atraso-medio`);
                if (atrasoMedioEl) {
                    atrasoMedioEl.textContent = `${dados.atrasoMedio}min`;
                }
                
                const diasAtrasoEl = document.getElementById(`${turnoPrefix}-dias-atraso`);
                if (diasAtrasoEl) {
                    diasAtrasoEl.textContent = dados.diasComAtraso.toString();
                }
                
                const horarioTopEl = document.getElementById(`${turnoPrefix}-horario-top`);
                if (horarioTopEl) {
                    horarioTopEl.textContent = dados.horarioTop;
                }
                
                const rotaCriticaEl = document.getElementById(`${turnoPrefix}-rota-critica`);
                if (rotaCriticaEl) {
                    rotaCriticaEl.textContent = dados.rotaCritica;
                }
            }
            
            // Manter também os IDs antigos para compatibilidade
            const pontualidadeElement = document.getElementById(`pontualidade-turno${turnoKey === 'matutino' ? '1' : '2'}`);
            if (pontualidadeElement) {
                pontualidadeElement.textContent = `${dados.pontualidade}%`;
            }
            
            const jornadasElement = document.getElementById(`jornadas-turno${turnoKey === 'matutino' ? '1' : '2'}`);
            if (jornadasElement) {
                jornadasElement.textContent = dados.jornadas.toString();
            }
            
            const atrasoElement = document.getElementById(`atraso-turno${turnoKey === 'matutino' ? '1' : '2'}`);
            if (atrasoElement) {
                atrasoElement.textContent = `${dados.atrasoMedio}min`;
            }
            
            // Atualizar trends também
            const trendPontualidadeElement = document.getElementById(`trend-pontualidade-turno${turnoKey === 'matutino' ? '1' : '2'}`);
            if (trendPontualidadeElement && dados.historico && dados.historico.length >= 2) {
                const ultimaDiff = dados.historico[dados.historico.length - 1].pontualidade - dados.historico[dados.historico.length - 2].pontualidade;
                trendPontualidadeElement.textContent = `${ultimaDiff >= 0 ? '+' : ''}${ultimaDiff.toFixed(1)}%`;
                trendPontualidadeElement.className = `stat-trend ${ultimaDiff >= 0 ? 'up' : 'down'}`;
            }
            
            const trendAtrasoElement = document.getElementById(`trend-atraso-turno${turnoKey === 'matutino' ? '1' : '2'}`);
            if (trendAtrasoElement && dados.historico && dados.historico.length >= 2) {
                const ultimaDiff = dados.historico[dados.historico.length - 1].atraso - dados.historico[dados.historico.length - 2].atraso;
                trendAtrasoElement.textContent = `${ultimaDiff >= 0 ? '+' : ''}${ultimaDiff.toFixed(1)}min`;
                trendAtrasoElement.className = `stat-trend ${ultimaDiff <= 0 ? 'down' : 'up'}`;
            }
            
            const horarioTopElement = document.getElementById(`horario-top-turno${turnoKey === 'matutino' ? '1' : '2'}`);
            if (horarioTopElement) {
                horarioTopElement.textContent = dados.horarioTop;
            }
            
            // Atualizar trend do horário top
            const trendHorarioElement = document.getElementById(`trend-horario-turno${turnoKey === 'matutino' ? '1' : '2'}`);
            if (trendHorarioElement && dados.horarioTopPercentual > 0) {
                trendHorarioElement.textContent = `${dados.horarioTopPercentual.toFixed(1)}% pontual`;
                trendHorarioElement.className = 'stat-trend';
            }
            
            const diasAtrasoElement = document.getElementById(`dias-atraso-turno${turnoKey === 'matutino' ? '1' : '2'}`);
            if (diasAtrasoElement) {
                diasAtrasoElement.textContent = dados.diasComAtraso.toString();
            }
            
            // Atualizar trend dos dias com atraso
            const trendDiasElement = document.getElementById(`trend-dias-turno${turnoKey === 'matutino' ? '1' : '2'}`);
            if (trendDiasElement) {
                trendDiasElement.textContent = `de ${dados.totalDias} dias`;
                trendDiasElement.className = 'stat-trend';
            }
            
            const rotaCriticaElement = document.getElementById(`rota-critica-turno${turnoKey === 'matutino' ? '1' : '2'}`);
            if (rotaCriticaElement) {
                rotaCriticaElement.textContent = dados.rotaCritica;
            }
            
            // Atualizar trend da rota crítica
            const trendRotaElement = document.getElementById(`trend-rota-turno${turnoKey === 'matutino' ? '1' : '2'}`);
            if (trendRotaElement && dados.rotaCriticaCount > 0) {
                trendRotaElement.textContent = `${dados.rotaCriticaCount} atrasos`;
                trendRotaElement.className = 'stat-trend';
            }
            
            // Atualizar valor do gráfico
            const chartValueElement = document.getElementById(`chart-value-turno${turnoKey === 'matutino' ? '1' : '2'}`);
            if (chartValueElement && dados.historico && dados.historico.length >= 2) {
                const ultimaDiff = dados.historico[dados.historico.length - 1].pontualidade - dados.historico[dados.historico.length - 2].pontualidade;
                const tendencia = ultimaDiff >= 0 ? '↗' : '↘';
                chartValueElement.textContent = `${tendencia} ${ultimaDiff >= 0 ? '+' : ''}${ultimaDiff.toFixed(1)}%`;
                chartValueElement.className = `chart-value ${ultimaDiff >= 0 ? 'positive' : 'negative'}`;
            }

            // Atualizar mini-gráfico com dados reais
            atualizarMiniGraficoReal(turnoCard, dados.historico, turnoKey);
        }
    });

    // Atualizar comparação com dados reais
    atualizarComparacaoTurnosReal(dadosTurnos);
}

// Função para atualizar mini-gráfico com dados reais
function atualizarMiniGraficoReal(turnoCard, historico, turnoKey) {
    const miniChart = turnoCard.querySelector('.mini-chart');
    if (!miniChart || !historico.length) return;

    miniChart.innerHTML = '';
    
    const maxValue = Math.max(...historico.map(h => h.pontualidade || 0), 100);
    
    historico.forEach((dia, index) => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        const height = maxValue > 0 ? (dia.pontualidade / maxValue) * 100 : 10;
        bar.style.height = `${Math.max(height, 5)}%`;
        
        // Cor baseada na performance
        if (dia.pontualidade >= 90) {
            bar.style.background = 'linear-gradient(180deg, #27ae60 0%, #2ecc71 100%)';
        } else if (dia.pontualidade >= 75) {
            bar.style.background = 'linear-gradient(180deg, #f39c12 0%, #e67e22 100%)';
        } else {
            bar.style.background = 'linear-gradient(180deg, #e74c3c 0%, #c0392b 100%)';
        }
        
        // Tooltip com informações detalhadas
        bar.title = `${dia.data}\n${dia.pontualidade}% pontualidade\n${dia.jornadas} jornadas\nAtraso médio: ${dia.atraso}min`;
        
        miniChart.appendChild(bar);
    });

    // Atualizar valor do gráfico com tendência real
    const chartValue = turnoCard.querySelector('.chart-value');
    if (chartValue && historico.length >= 2) {
        const ultimaDiff = historico[historico.length - 1].pontualidade - historico[historico.length - 2].pontualidade;
        const tendencia = ultimaDiff >= 0 ? '↗' : '↘';
        chartValue.textContent = `${tendencia} ${ultimaDiff >= 0 ? '+' : ''}${ultimaDiff.toFixed(1)}%`;
        chartValue.className = `chart-value ${ultimaDiff >= 0 ? 'positive' : 'negative'}`;
    }
}

// Função para atualizar mini-gráfico
// (removido) atualizarMiniGrafico: função antiga não utilizada; substituída por atualizarMiniGraficoReal

// Função para atualizar comparação entre turnos com dados reais
function atualizarComparacaoTurnosReal(dadosTurnos) {
    
    const matutino = dadosTurnos.matutino;
    const noturno = dadosTurnos.noturno;

    // Atualizar métricas de comparação individual
    atualizarMetricaComparacao('comparison-pontualidade', 'Pontualidade', 
        matutino.pontualidade, noturno.pontualidade, '%', true);
    
    atualizarMetricaComparacao('comparison-atraso', 'Atraso Médio', 
        matutino.atrasoMedio, noturno.atrasoMedio, 'min', false);
    
    atualizarMetricaComparacao('comparison-jornadas', 'Jornadas', 
        matutino.jornadas, noturno.jornadas, '', true);
    
    atualizarMetricaComparacao('comparison-dias-atraso', 'Dias com Atraso', 
        matutino.diasComAtraso, noturno.diasComAtraso, ' dias', false);

    // Atualizar insights com dados reais
    atualizarInsightsReais(dadosTurnos);
}

// Função auxiliar para atualizar uma métrica de comparação
function atualizarMetricaComparacao(elementId, label, valorMatutino, valorNoturno, unidade, maiorMelhor) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let vencedor, vencedorNome, vencedorClass, diferenca;
    
    if (maiorMelhor) {
        // Para métricas onde maior é melhor
        if (valorMatutino >= valorNoturno) {
            vencedor = 'matutino';
            vencedorNome = '1º Turno';
            vencedorClass = 'morning';
            diferenca = valorMatutino - valorNoturno;
        } else {
            vencedor = 'noturno';
            vencedorNome = '2º Turno';
            vencedorClass = 'night';
            diferenca = valorNoturno - valorMatutino;
        }
    } else {
        // Para métricas onde menor é melhor
        if (valorMatutino <= valorNoturno) {
            vencedor = 'matutino';
            vencedorNome = '1º Turno';
            vencedorClass = 'morning';
            diferenca = valorNoturno - valorMatutino;
        } else {
            vencedor = 'noturno';
            vencedorNome = '2º Turno';
            vencedorClass = 'night';
            diferenca = valorMatutino - valorNoturno;
        }
    }

    // Atualizar elementos
    const winnerBadge = element.querySelector('.winner-badge');
    const winnerValue = element.querySelector('.winner-value');
    const winnerDiff = element.querySelector('.winner-diff');

    if (winnerBadge) {
        winnerBadge.className = `winner-badge ${vencedorClass}`;
        winnerBadge.innerHTML = `<i class="fas fa-crown"></i><span>${vencedorNome}</span>`;
    }

    if (winnerValue) {
        winnerValue.textContent = `${valorMatutino}${unidade} vs ${valorNoturno}${unidade}`;
    }

    if (winnerDiff) {
        winnerDiff.textContent = `${diferenca > 0 ? '+' : ''}${diferenca.toFixed(1)}${unidade} ${maiorMelhor ? 'vantagem' : 'melhor'}`;
    }
}

// Função para atualizar insights com análise dos dados reais
function atualizarInsightsReais(dadosTurnos) {
    // Usar o novo ID do HTML
    const insightsContainer = document.getElementById('comparison-insights');
    if (!insightsContainer) return;

    const insights = [];
    
    const matutino = dadosTurnos.matutino;
    const noturno = dadosTurnos.noturno;

    // Insight de pontualidade
    const diffPontualidade = Math.abs(matutino.pontualidade - noturno.pontualidade);
    if (diffPontualidade > 5) { // Diferença significativa
        if (matutino.pontualidade > noturno.pontualidade) {
            insights.push({
                type: 'positive',
                icon: 'fas fa-thumbs-up',
                text: `1º Turno supera o 2º Turno em ${diffPontualidade.toFixed(1)}% na pontualidade (${matutino.pontualidade}% vs ${noturno.pontualidade}%)`
            });
        } else {
            insights.push({
                type: 'info',
                icon: 'fas fa-moon',
                text: `2º Turno supera o 1º Turno em ${diffPontualidade.toFixed(1)}% na pontualidade (${noturno.pontualidade}% vs ${matutino.pontualidade}%)`
            });
        }
    }

    // Insight de volume de jornadas
    const diffJornadas = Math.abs(matutino.jornadas - noturno.jornadas);
    if (diffJornadas > 0) {
        if (matutino.jornadas > noturno.jornadas) {
            insights.push({
                type: 'info',
                icon: 'fas fa-chart-bar',
                text: `1º Turno processa ${diffJornadas} jornadas a mais que o 2º Turno (${matutino.jornadas} vs ${noturno.jornadas})`
            });
        } else {
            insights.push({
                type: 'info',
                icon: 'fas fa-chart-bar',
                text: `2º Turno processa ${diffJornadas} jornadas a mais que o 1º Turno (${noturno.jornadas} vs ${matutino.jornadas})`
            });
        }
    }

    // Insight de atraso médio
    if (matutino.atrasoMedio > 0 && noturno.atrasoMedio > 0) {
        const diffAtraso = Math.abs(matutino.atrasoMedio - noturno.atrasoMedio);
        if (diffAtraso > 2) { // Diferença significativa de mais de 2 minutos
            if (matutino.atrasoMedio < noturno.atrasoMedio) {
                insights.push({
                    type: 'warning',
                    icon: 'fas fa-clock',
                    text: `2º Turno tem atrasos ${diffAtraso.toFixed(1)}min maiores em média (${noturno.atrasoMedio}min vs ${matutino.atrasoMedio}min)`
                });
            } else {
                insights.push({
                    type: 'warning',
                    icon: 'fas fa-clock',
                    text: `1º Turno tem atrasos ${diffAtraso.toFixed(1)}min maiores em média (${matutino.atrasoMedio}min vs ${noturno.atrasoMedio}min)`
                });
            }
        }
    }

    // Insight sobre dias com atraso
    const diffDiasAtraso = Math.abs(matutino.diasComAtraso - noturno.diasComAtraso);
    if (diffDiasAtraso > 0) {
        if (matutino.diasComAtraso < noturno.diasComAtraso) {
            insights.push({
                type: 'positive',
                icon: 'fas fa-calendar-check',
                text: `1º Turno teve atrasos em ${diffDiasAtraso} dias a menos que o 2º Turno`
            });
        } else {
            insights.push({
                type: 'warning',
                icon: 'fas fa-calendar-times',
                text: `2º Turno teve atrasos em ${diffDiasAtraso} dias a menos que o 1º Turno`
            });
        }
    }

    // Insight sobre rotas críticas
    if (matutino.rotaCritica !== 'Nenhuma' || noturno.rotaCritica !== 'Nenhuma') {
        if (matutino.rotaCriticaCount > noturno.rotaCriticaCount) {
            insights.push({
                type: 'info',
                icon: 'fas fa-exclamation-triangle',
                text: `Rota crítica: "${matutino.rotaCritica}" no 1º Turno com ${matutino.rotaCriticaCount} atrasos`
            });
        } else if (noturno.rotaCriticaCount > 0) {
            insights.push({
                type: 'info',
                icon: 'fas fa-exclamation-triangle',
                text: `Rota crítica: "${noturno.rotaCritica}" no 2º Turno com ${noturno.rotaCriticaCount} atrasos`
            });
        }
    }

    // Se não há insights específicos, adicionar um insight geral
    if (insights.length === 0) {
        insights.push({
            type: 'info',
            icon: 'fas fa-info-circle',
            text: 'Performance equilibrada entre os turnos - continue monitorando para otimizações'
        });
    }

    // Usar o container já definido no início da função
    insightsContainer.innerHTML = '';
    insights.forEach(insight => {
        const insightDiv = document.createElement('div');
        insightDiv.className = `insight-item ${insight.type}`;
        insightDiv.innerHTML = `
            <i class="${insight.icon}"></i>
            <span>${insight.text}</span>
        `;
        insightsContainer.appendChild(insightDiv);
    });
}

// Sistema de ordenação para tabelas premium
class PremiumTableSorter {
    constructor(tableId) {
        this.table = document.getElementById(tableId);
        this.tbody = this.table.querySelector('tbody');
        this.headers = this.table.querySelectorAll('th.sortable');
        this.currentSort = { column: null, direction: 'asc' };
        this.initSorting();
    }
    
    initSorting() {
        this.headers.forEach((header, index) => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                this.sortTable(column, index);
            });
        });
    }
    
    sortTable(column, columnIndex) {
        const rows = Array.from(this.tbody.rows);
        
        // Determinar direção da ordenação
        if (this.currentSort.column === column) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.direction = 'asc';
        }
        
        this.currentSort.column = column;
        
        // Atualizar ícones de ordenação
        this.updateSortIcons(columnIndex);
        
        // Ordenar rows
        rows.sort((a, b) => {
            const aValue = this.getCellValue(a, columnIndex);
            const bValue = this.getCellValue(b, columnIndex);
            
            const result = this.compareValues(aValue, bValue);
            return this.currentSort.direction === 'asc' ? result : -result;
        });
        
        // Reordenar tabela
        rows.forEach(row => this.tbody.appendChild(row));
        
        // Adicionar animação
        this.tbody.style.opacity = '0.7';
        setTimeout(() => {
            this.tbody.style.opacity = '1';
        }, 150);
    }
    
    getCellValue(row, columnIndex) {
        const cell = row.cells[columnIndex];
        if (!cell) return '';
        
        const text = cell.textContent.trim();
        
        // Detectar tipo de dados
        if (text.includes('%')) {
            return parseFloat(text.replace('%', '')) || 0;
        }
        if (text.includes('min')) {
            return parseFloat(text.replace('min', '')) || 0;
        }
        if (!isNaN(text) && text !== '') {
            return parseFloat(text);
        }
        if (text.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            return new Date(text.split('/').reverse().join('-'));
        }
        
        return text.toLowerCase();
    }
    
    compareValues(a, b) {
        if (typeof a === 'number' && typeof b === 'number') {
            return a - b;
        }
        if (a instanceof Date && b instanceof Date) {
            return a - b;
        }
        return a.toString().localeCompare(b.toString());
    }
    
    updateSortIcons(activeIndex) {
        this.headers.forEach((header, index) => {
            const icon = header.querySelector('.sort-icon');
            if (index === activeIndex) {
                icon.className = `fas fa-sort-${this.currentSort.direction === 'asc' ? 'up' : 'down'} sort-icon`;
                icon.style.color = '#667eea';
            } else {
                icon.className = 'fas fa-sort sort-icon';
                icon.style.color = '#cbd5e1';
            }
        });
    }
}

// Sistema de paginação premium
class PremiumPagination {
    constructor(tableId, data, itemsPerPage = 25) {
        this.tableId = tableId;
        this.data = data;
        this.itemsPerPage = itemsPerPage;
        this.currentPage = 1;
        this.filteredData = [...data];
        this.initPagination();
    }
    
    initPagination() {
        this.setupEventListeners();
        this.updateDisplay();
    }
    
    setupEventListeners() {
        // Controles de navegação
        document.getElementById('btn-first')?.addEventListener('click', () => this.goToPage(1));
        document.getElementById('btn-prev')?.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        document.getElementById('btn-next')?.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        document.getElementById('btn-last')?.addEventListener('click', () => this.goToPage(this.totalPages));
        
        // Mudança de itens por página
        document.getElementById('page-size')?.addEventListener('change', (e) => {
            this.itemsPerPage = parseInt(e.target.value);
            this.currentPage = 1;
            this.updateDisplay();
        });
        
        // Filtro de busca
        document.getElementById('filtro-percursos')?.addEventListener('input', (e) => {
            this.filterData(e.target.value);
        });
    }
    
    get totalPages() {
        return Math.ceil(this.filteredData.length / this.itemsPerPage);
    }
    
    goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.updateDisplay();
        }
    }
    
    filterData(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredData = [...this.data];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredData = this.data.filter(item => 
                Object.values(item).some(value => 
                    value.toString().toLowerCase().includes(term)
                )
            );
        }
        this.currentPage = 1;
        this.updateDisplay();
    }
    
    updateDisplay() {
        this.renderTable();
        this.renderPaginationControls();
        this.updateInfo();
    }
    
    renderTable() {
        const tbody = document.querySelector(`#${this.tableId} tbody`);
        if (!tbody) return;
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredData.slice(startIndex, endIndex);
        
        tbody.innerHTML = '';
        
        pageData.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = this.createRowHTML(item);
            tbody.appendChild(row);
        });
    }
    
    createRowHTML(item) {
        // Esta função deve ser sobrescrita para cada tipo de tabela
        return '';
    }
    
    renderPaginationControls() {
        const numbersContainer = document.getElementById('pagination-numbers');
        if (!numbersContainer) return;
        
        numbersContainer.innerHTML = '';
        
        // Calcular range de páginas a mostrar
        const maxVisible = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const button = document.createElement('button');
            button.className = `pagination-btn ${i === this.currentPage ? 'active' : ''}`;
            button.textContent = i;
            button.addEventListener('click', () => this.goToPage(i));
            numbersContainer.appendChild(button);
        }
        
        // Atualizar estado dos botões de navegação
        document.getElementById('btn-first').disabled = this.currentPage === 1;
        document.getElementById('btn-prev').disabled = this.currentPage === 1;
        document.getElementById('btn-next').disabled = this.currentPage === this.totalPages;
        document.getElementById('btn-last').disabled = this.currentPage === this.totalPages;
    }
    
    updateInfo() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.itemsPerPage, this.filteredData.length);
        
        const showingElement = document.getElementById('items-showing');
        const totalElement = document.getElementById('items-total');
        const paginationInfo = document.getElementById('pagination-info');
        
        if (showingElement) showingElement.textContent = `${startIndex}-${endIndex}`;
        if (totalElement) totalElement.textContent = this.filteredData.length;
        if (paginationInfo) paginationInfo.textContent = `Página ${this.currentPage} de ${this.totalPages}`;
    }
    
    // Método para atualizar dados
    updateData(newData) {
        this.data = newData;
        this.filteredData = [...newData];
        this.currentPage = 1;
        this.updateDisplay();
    }
}

// Instância específica para tabela de detalhes
class RelatorioDetalhesPagination extends PremiumPagination {
    createRowHTML(item) {
        // Formatar turno
        const turnoText = item.turno === 'primeiro_turno' ? '1º Turno' : '2º Turno';
        
        // Detectar tipo de movimento para usar a mesma lógica das exportações
        const movimento = detectarTipoMovimento(item);
        
        // Usar a mesma lógica de detecção das funções de exportação
        const horarioProgramado = (item[movimento.campo_martins] && item[movimento.campo_martins] !== '') ? item[movimento.campo_martins] : '--:--';
        const horarioReal = (item[movimento.campo_real] && item[movimento.campo_real] !== '') ? item[movimento.campo_real] : '--:--';
        
        // Tolerância baseada na estrutura detectada
        const toleranciaMin = (item[movimento.campo_minima] && item[movimento.campo_minima] !== '') ? item[movimento.campo_minima] : '--:--';
        const toleranciaMax = (item[movimento.campo_maxima] && item[movimento.campo_maxima] !== '') ? item[movimento.campo_maxima] : '--:--';
        const toleranciaInfo = (toleranciaMin !== '--:--' && toleranciaMax !== '--:--') 
            ? `${toleranciaMin} - ${toleranciaMax}` 
            : '--:--';
        
        // Tipo de movimento baseado na detecção
        const tipoMovimento = movimento.tipo;
        
        // Atraso usando a mesma lógica das exportações
        let atraso = item.atraso;
        if (atraso === undefined || atraso === null) {
            if (movimento.tipo === 'Chegada' && item.atraso_chegada !== undefined) {
                atraso = item.atraso_chegada;
            } else if (movimento.tipo === 'Saída' && item.atraso_saida !== undefined) {
                atraso = item.atraso_saida;
            } else {
                atraso = 0;
            }
        }
        
        const observacoes = item.observacoes || '';
        
        return `
            <td>${item.data || '--/--/----'}</td>
            <td><span class="rota-badge">${item.rota || 'N/A'}</span></td>
            <td><span class="turno-badge ${item.turno || 'primeiro_turno'}">${turnoText}</span></td>
            <td>
                <div class="horario-group">
                    <span class="horario-tipo">${tipoMovimento}</span>
                    <span class="horario-programado">Programado: ${horarioProgramado}</span>
                    <span class="horario-real">Real: ${horarioReal}</span>
                </div>
            </td>
            <td>
                <div class="tolerancia-group">
                    <span class="tolerancia-label">Tolerância:</span>
                    <span class="tolerancia-range">${toleranciaInfo}</span>
                </div>
            </td>
            <td><span class="atraso-badge ${this.getAtrasoClass(atraso)}">${atraso} min</span></td>
            <td><span class="observacoes">${observacoes}</span></td>
        `;
    }
    
    getAtrasoClass(atraso) {
        const atrasoNum = parseInt(atraso);
        if (atrasoNum <= 0) return 'no-atraso';
        if (atrasoNum <= 5) return 'atraso-leve';
        if (atrasoNum <= 15) return 'atraso-moderado';
        return 'atraso-grave';
    }
}

// Sistema de filtros toggle para relatórios
class RelatorioFilters {
    constructor() {
        this.activeFilter = 'pontualidade';
        this.initFilters();
    }
    
    initFilters() {
        const toggles = document.querySelectorAll('.filter-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const filterType = toggle.dataset.sort;
                this.setActiveFilter(filterType);
                this.applyFilter(filterType);
            });
        });
    }
    
    setActiveFilter(filterType) {
        // Remover classe active de todos
        document.querySelectorAll('.filter-toggle').forEach(t => t.classList.remove('active'));
        
        // Adicionar classe active ao selecionado
        document.querySelector(`[data-sort="${filterType}"]`).classList.add('active');
        
        this.activeFilter = filterType;
    }
    
    applyFilter(filterType) {
        const table = document.getElementById('relatorio-rotas-table');
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.rows);
        
        // Aplicar ordenação baseada no filtro
        switch (filterType) {
            case 'pontualidade':
                rows.sort((a, b) => {
                    const pontA = parseFloat(a.cells[4].textContent.replace('%', ''));
                    const pontB = parseFloat(b.cells[4].textContent.replace('%', ''));
                    return pontB - pontA; // Decrescente
                });
                break;
            case 'atrasos':
                rows.sort((a, b) => {
                    const atrasoA = parseFloat(a.cells[2].textContent.replace(' min', ''));
                    const atrasoB = parseFloat(b.cells[2].textContent.replace(' min', ''));
                    return atrasoB - atrasoA; // Decrescente
                });
                break;
            case 'volume':
                rows.sort((a, b) => {
                    const volA = parseInt(a.cells[1].textContent);
                    const volB = parseInt(b.cells[1].textContent);
                    return volB - volA; // Decrescente
                });
                break;
        }
        
        // Reordenar tabela
        tbody.innerHTML = '';
        rows.forEach(row => tbody.appendChild(row));
        
        // Animação
        tbody.style.opacity = '0.7';
        setTimeout(() => {
            tbody.style.opacity = '1';
        }, 200);
    }
}

// Inicializar recursos premium dos relatórios
function initRelatoriosPremium() {
    // Inicializar ordenação de tabelas
    if (document.getElementById('relatorio-rotas-table')) {
        new PremiumTableSorter('relatorio-rotas-table');
    }
    
    if (document.getElementById('relatorio-detalhes-table')) {
        new PremiumTableSorter('relatorio-detalhes-table');
    }
    
    // Inicializar filtros
    new RelatorioFilters();
    
}

// Adicionar estilos CSS dinâmicos para badges e elementos
function addRelatorioStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .rota-badge {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .turno-badge {
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .turno-badge.primeiro_turno {
            background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
            color: white;
        }
        
        .turno-badge.segundo_turno {
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            color: white;
        }
        
        .horario-group {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .horario-tipo {
            font-size: 0.7rem;
            color: #8b5cf6;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .horario-programado {
            font-size: 0.75rem;
            color: #64748b;
        }
        
        .horario-real {
            font-size: 0.875rem;
            font-weight: 600;
            color: #1e293b;
        }
        
        .tolerancia-group {
            display: flex;
            flex-direction: column;
            gap: 2px;
            text-align: center;
        }
        
        .tolerancia-label {
            font-size: 0.7rem;
            color: #64748b;
            font-weight: 500;
        }
        
        .tolerancia-range {
            font-size: 0.75rem;
            color: #059669;
            font-weight: 600;
            background: rgba(16, 185, 129, 0.1);
            padding: 2px 6px;
            border-radius: 4px;
        }
        
        .atraso-badge {
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .atraso-badge.no-atraso {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
        }
        
        .atraso-badge.atraso-leve {
            background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
            color: white;
        }
        
        .atraso-badge.atraso-moderado {
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            color: white;
        }
        
        .atraso-badge.atraso-grave {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
        }
        
        .observacoes {
            font-size: 0.8rem;
            color: #64748b;
            font-style: italic;
        }
        
        .pagination-btn.active {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-color: #667eea;
        }
    `;
    document.head.appendChild(style);
}

// Funções auxiliares para ações dos relatórios
function filtrarPorRota(nomeRota) {
    // Implementar filtro específico por rota
    const filtroRota = document.getElementById('filtro-rota-relatorio');
    if (filtroRota) {
        // Encontrar a rota pelo nome
        const rotas = Array.from(filtroRota.options);
        const rotaOption = rotas.find(option => option.textContent === nomeRota);
        if (rotaOption) {
            filtroRota.value = rotaOption.value;
            gerarRelatorio(); // Regenerar relatório com filtro
        }
    }
}

function exportarRotaEspecifica(nomeRota) {
    // Implementar exportação específica da rota
    if (window.relatorioDetailsPagination && window.relatorioDetailsPagination.data) {
        const dadosRota = window.relatorioDetailsPagination.data.filter(item => 
            item.rota === nomeRota
        );
        
        if (dadosRota.length > 0) {
            exportarDadosCSV(dadosRota, `relatorio_${nomeRota.toLowerCase()}_${new Date().toISOString().split('T')[0]}`);
        } else {
            mostrarNotificacao(`Nenhum dado encontrado para a rota ${nomeRota}`, 'warning');
        }
    }
}

function exportarDadosCSV(dados, nomeArquivo) {
    const csvContent = [
        // Cabeçalho atualizado para nova estrutura
        ['Data', 'Rota', 'Turno', 'Tipo Movimento', 'Horário Programado', 'Horário Retorno/Destino', 'Tolerância Mín', 'Tolerância Máx', 'Status', 'Observações'].join(','),
        // Dados adaptados à nova estrutura usando a mesma lógica de detecção
        ...dados.map(item => {
            const movimento = detectarTipoMovimento(item);
            const horarioProgramado = (item[movimento.campo_martins] && item[movimento.campo_martins] !== '') ? item[movimento.campo_martins] : '--:--';
            const horarioReal = (item[movimento.campo_real] && item[movimento.campo_real] !== '') ? item[movimento.campo_real] : '--:--';
            const toleranciaMin = (item[movimento.campo_minima] && item[movimento.campo_minima] !== '') ? item[movimento.campo_minima] : '--:--';
            const toleranciaMax = (item[movimento.campo_maxima] && item[movimento.campo_maxima] !== '') ? item[movimento.campo_maxima] : '--:--';
            
            let atraso = item.atraso;
            if (atraso === undefined || atraso === null) {
                if (movimento.tipo === 'Chegada' && item.atraso_chegada !== undefined) {
                    atraso = item.atraso_chegada;
                } else if (movimento.tipo === 'Saída' && item.atraso_saida !== undefined) {
                    atraso = item.atraso_saida;
                } else {
                    atraso = 0;
                }
            }
            
            return [
                item.data,
                `"${item.rota}"`,
                item.turno === 'primeiro_turno' ? '1º Turno' : '2º Turno',
                movimento.tipo,
                horarioProgramado,
                horarioReal,
                toleranciaMin,
                toleranciaMax,
                atraso,
                `"${item.observacoes || ''}"`
            ].join(',');
        })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${nomeArquivo}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// === FUNÇÕES DE CONTROLE GLOBAL ===

/**
 * Atualiza todos os dados do sistema
 */
async function atualizarTodosOsDados() {
    
    const btnRefresh = document.getElementById('btn-refresh-all');
    const icon = btnRefresh.querySelector('i');
    const text = btnRefresh.querySelector('.refresh-text');
    
    // Mostrar estado de carregamento
    btnRefresh.disabled = true;
    icon.classList.add('fa-spin');
    if (text) text.textContent = 'Atualizando...';
    
    try {
        // Mostrar notificação de início
        mostrarNotificacao('Atualizando dados do sistema...', 'info');
        
        // Atualizar dados base
        await Promise.all([
            carregarRotas(),
            carregarJornadas(),
            carregarDashboard()
        ]);
        
        // Atualizar interface baseada na aba atual
        
        switch(currentTab) {
            case 'dashboard':
                atualizarStatusRotas();
                break;
                
            case 'jornadas':
                renderizarJornadas();
                break;
                
            case 'rotas':
                renderizarRotasConfig();
                break;
                
            case 'relatorios':
                atualizarSelectRotasRelatorio();
                break;
        }
        
        // Atualizar informações do sidebar
        const rotasAtivas = rotas.filter(r => r.ativa !== false).length;
        const sidebarElement = document.getElementById('sidebar-online-routes');
        if (sidebarElement) {
            sidebarElement.textContent = rotasAtivas;
        }
        
        // Sucesso
        mostrarNotificacao('Dados atualizados com sucesso!', 'success');
        
    } catch (error) {
        console.error('❌ Erro durante atualização:', error);
        mostrarNotificacao('Erro ao atualizar dados do sistema', 'error');
    } finally {
        // Restaurar estado normal do botão
        setTimeout(() => {
            btnRefresh.disabled = false;
            icon.classList.remove('fa-spin');
            if (text) text.textContent = 'Atualizar';
        }, 1000); // Pequeno delay para melhor UX
    }
}

/**
 * Alterna modo tela cheia
 */
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        // Entrar em tela cheia
        document.documentElement.requestFullscreen().then(() => {
            mostrarNotificacao('Modo tela cheia ativado. Pressione ESC para sair.', 'info');
            
            // Atualizar ícone do botão
            const btn = document.querySelector('[title="Tela Cheia"]');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-compress"></i>';
                btn.title = 'Sair da Tela Cheia';
            }
        }).catch(err => {
            console.error('❌ Erro ao ativar tela cheia:', err);
            mostrarNotificacao('Erro ao ativar modo tela cheia', 'error');
        });
    } else {
        // Sair da tela cheia
        document.exitFullscreen().then(() => {
            
            // Restaurar ícone do botão
            const btn = document.querySelector('[title="Sair da Tela Cheia"]');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-expand"></i>';
                btn.title = 'Tela Cheia';
            }
        }).catch(err => {
            console.error('❌ Erro ao sair da tela cheia:', err);
        });
    }
}

// Detectar mudanças no modo tela cheia
document.addEventListener('fullscreenchange', function() {
    const btn = document.querySelector('.quick-actions button[onclick="toggleFullscreen()"]');
    if (btn) {
        if (document.fullscreenElement) {
            btn.innerHTML = '<i class="fas fa-compress"></i>';
            btn.title = 'Sair da Tela Cheia';
        } else {
            btn.innerHTML = '<i class="fas fa-expand"></i>';
            btn.title = 'Tela Cheia';
        }
    }
});

// === FUNÇÕES DE TESTE (DESENVOLVIMENTO) ===
// Para testes de desenvolvimento, descomente as funções conforme necessário

// Controle de métricas secundárias (expand/colapse)
function toggleMetricasSecundarias() {
    try {
        const container = document.getElementById('metricas-secundarias');
        const btn = document.querySelector('.resumo-expand-btn');
        if (!container || !btn) return;

        const icon = btn.querySelector('i');
        const isHidden = container.style.display === 'none' || container.style.display === '';

        if (isHidden) {
            container.style.display = 'block';
            btn.classList.add('active');
            if (icon) icon.style.transform = 'rotate(180deg)';
        } else {
            container.style.display = 'none';
            btn.classList.remove('active');
            if (icon) icon.style.transform = 'rotate(0deg)';
        }
    } catch (e) {
        console.error('Erro ao alternar métricas secundárias:', e);
    }
}

// Expor no escopo global para o onclick do HTML
window.toggleMetricasSecundarias = toggleMetricasSecundarias;

/**
 * Detecta o tipo de movimento baseado nos campos disponíveis
 * @param {Object} item - Item de dados
 * @returns {Object} Objeto com tipo e campos correspondentes
 */
function detectarTipoMovimento(item) {
    // Verificar se tem campos de chegada na nova estrutura
    if (item.chegada_martins !== undefined && item.chegada_martins !== null && item.chegada_martins !== '') {
        return {
            tipo: 'Chegada',
            campo_martins: 'chegada_martins',
            campo_real: 'chegada_real',
            campo_minima: 'chegada_minima',
            campo_maxima: 'chegada_maxima'
        };
    } 
    // Verificar se tem campos de saída na nova estrutura
    else if (item.saida_martins !== undefined && item.saida_martins !== null && item.saida_martins !== '') {
        return {
            tipo: 'Saída',
            campo_martins: 'saida_martins',
            campo_real: 'saida_real',
            campo_minima: 'chegada_minima',
            campo_maxima: 'chegada_maxima'
        };
    } 
    // Estrutura antiga - detectar se é movimento de chegada ou saída baseado nos dados
    else if (item.chegada_programada !== undefined || item.chegada_real !== undefined) {
        return {
            tipo: 'Chegada',
            campo_martins: 'chegada_programada',  // Usar chegada_programada como base
            campo_real: 'chegada_real',
            campo_minima: 'chegada_programada',   // Usar o mesmo campo como tolerância
            campo_maxima: 'chegada_programada'
        };
    }
    else if (item.saida_programada !== undefined || item.saida_real !== undefined) {
        return {
            tipo: 'Saída',
            campo_martins: 'saida_programada',    // Usar saida_programada como base
            campo_real: 'saida_real',
            campo_minima: 'saida_programada',     // Usar o mesmo campo como tolerância
            campo_maxima: 'saida_programada'
        };
    }
    // Fallback final
    else {
        return {
            tipo: 'Movimento',
            campo_martins: 'saida_programada',
            campo_real: 'saida_real',
            campo_minima: 'chegada_programada',
            campo_maxima: 'chegada_programada'
        };
    }
}

// === HEADER FLUTUANTE DINÂMICO ===

let isFloatingHeaderVisible = false;
let lastScrollY = 0;
let floatingHeaderElement = null;
let headerScrollThreshold = 100; // Pixels para ativar o header flutuante
let scrollDirection = 'up';

// Inicializar header flutuante
function initFloatingHeader() {
    floatingHeaderElement = document.getElementById('floating-header');
    if (!floatingHeaderElement) {
        console.warn('Elemento floating-header não encontrado');
        return;
    }

    // Listener para scroll
    window.addEventListener('scroll', handleHeaderScroll, { passive: true });
    
    // Sincronizar dados iniciais
    syncFloatingHeaderData();
    
    // Atualizar relógio no header flutuante
    setInterval(updateFloatingHeaderTime, 1000);
    
    console.log('📱 Header flutuante inicializado');
}

// Controlar visibilidade do header baseado no scroll
function handleHeaderScroll() {
    const currentScrollY = window.scrollY;
    const scrollDelta = currentScrollY - lastScrollY;
    
    // Determinar direção do scroll
    if (scrollDelta > 0) {
        scrollDirection = 'down';
    } else if (scrollDelta < 0) {
        scrollDirection = 'up';
    }
    
    // Mostrar header flutuante quando rolar para baixo além do threshold
    if (currentScrollY > headerScrollThreshold && scrollDirection === 'down' && !isFloatingHeaderVisible) {
        showFloatingHeader();
    }
    // Esconder quando rolar para cima ou voltar ao topo
    else if ((currentScrollY <= headerScrollThreshold || scrollDirection === 'up') && isFloatingHeaderVisible) {
        // Adicionar pequeno delay para evitar flickering
        setTimeout(() => {
            if (window.scrollY <= headerScrollThreshold || scrollDirection === 'up') {
                hideFloatingHeader();
            }
        }, 150);
    }
    
    lastScrollY = currentScrollY;
}

// Mostrar header flutuante com animação
function showFloatingHeader() {
    if (!floatingHeaderElement || isFloatingHeaderVisible) return;
    
    isFloatingHeaderVisible = true;
    
    // Sincronizar dados antes de mostrar
    syncFloatingHeaderData();
    
    // Aplicar classes de animação
    floatingHeaderElement.classList.remove('sliding-up');
    floatingHeaderElement.classList.add('visible', 'sliding-down');
    
    // Trigger para animações dos elementos internos
    requestAnimationFrame(() => {
        floatingHeaderElement.style.visibility = 'visible';
    });
    
    console.log('📱 Header flutuante exibido');
}

// Esconder header flutuante com animação
function hideFloatingHeader() {
    if (!floatingHeaderElement || !isFloatingHeaderVisible) return;
    
    isFloatingHeaderVisible = false;
    
    // Aplicar classes de animação
    floatingHeaderElement.classList.remove('sliding-down');
    floatingHeaderElement.classList.add('sliding-up');
    
    // Remover visibilidade após animação
    setTimeout(() => {
        if (!isFloatingHeaderVisible) {
            floatingHeaderElement.classList.remove('visible', 'sliding-up');
            floatingHeaderElement.style.visibility = 'hidden';
        }
    }, 400);
    
    console.log('📱 Header flutuante ocultado');
}

// Sincronizar dados do header principal para o flutuante
function syncFloatingHeaderData() {
    if (!floatingHeaderElement) return;
    
    try {
        // Sincronizar título da página
        const pageTitle = document.getElementById('page-title');
        const floatingTitle = document.getElementById('floating-title-text');
        if (pageTitle && floatingTitle) {
            const titleText = pageTitle.textContent.trim();
            floatingTitle.textContent = titleText;
        }
        
        // Sincronizar horário (já é atualizado pelo updateFloatingHeaderTime)
        updateFloatingHeaderTime();
        
        // Sincronizar contagem de notificações
        const mainNotificationCount = document.querySelector('.main-header .notification-count');
        const floatingNotificationCount = document.querySelector('.floating-header .notification-count');
        if (mainNotificationCount && floatingNotificationCount) {
            floatingNotificationCount.textContent = mainNotificationCount.textContent;
            
            // Sincronizar visibilidade
            if (mainNotificationCount.style.display === 'none') {
                floatingNotificationCount.style.display = 'none';
            } else {
                floatingNotificationCount.style.display = 'flex';
            }
        }
        
        // Sincronizar status do usuário
        const mainUserName = document.querySelector('.main-header .user-name');
        const floatingUserName = document.querySelector('.floating-header .floating-user-name');
        if (mainUserName && floatingUserName) {
            floatingUserName.textContent = mainUserName.textContent;
        }
        
        const mainUserRole = document.querySelector('.main-header .user-role');
        const floatingUserRole = document.querySelector('.floating-header .floating-user-role');
        if (mainUserRole && floatingUserRole) {
            floatingUserRole.textContent = mainUserRole.textContent;
        }
        
        // Sincronizar status online
        const mainAvatarStatus = document.querySelector('.main-header .avatar-status');
        const floatingAvatarStatus = document.querySelector('.floating-header .avatar-status');
        if (mainAvatarStatus && floatingAvatarStatus) {
            floatingAvatarStatus.className = mainAvatarStatus.className;
        }
        
    } catch (error) {
        console.warn('Erro ao sincronizar dados do header flutuante:', error);
    }
}

// Atualizar horário no header flutuante
function updateFloatingHeaderTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('pt-BR');
    const dateString = now.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    
    const floatingTimeElement = document.getElementById('floating-current-time');
    const floatingDateElement = document.getElementById('floating-current-date');
    
    if (floatingTimeElement) {
        floatingTimeElement.textContent = timeString;
    }
    
    if (floatingDateElement) {
        floatingDateElement.textContent = dateString;
    }
}

// Função para sincronizar estado dos botões de refresh
// (removido) syncRefreshButtonState: não utilizada; controle de loading já feito em atualizarTodosOsDados

// Função para atualizar contagem de notificações em ambos os headers
// (removido) updateNotificationCount: não utilizada

// Função para alterar título em ambos os headers
// (removido) updatePageTitle: não utilizada

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Aguardar um pouco para garantir que todos os elementos estejam renderizados
    setTimeout(() => {
        initFloatingHeader();
        inicializarHorariosDinamicos();
    }, 1000);
});

// === GERENCIAMENTO DINÂMICO DE HORÁRIOS ===

// Inicializar sistema de horários dinâmicos
function inicializarHorariosDinamicos() {
    console.log('🔧 Inicializando sistema de horários dinâmicos...');
    
    // Carregar horários padrão para nova rota
    if (!document.getElementById('rota-id').value) {
        carregarHorariosPadrao();
    }
}

// Carregar horários padrão para nova rota
function carregarHorariosPadrao() {
    console.log('📅 Carregando horários padrão...');
    
    // Horários padrão do primeiro turno
    const primeiroTurnoPadrao = [
        { tipo: 'chegada', horario: '05:20', min: '04:50', max: '05:20' },
        { tipo: 'chegada', horario: '06:55', min: '06:25', max: '07:00' },
        { tipo: 'saida', horario: '13:40', min: '13:30', max: '13:40' },
        { tipo: 'saida', horario: '15:30', min: '15:20', max: '15:30' },
        { tipo: 'saida', horario: '17:00', min: '17:20', max: '17:30' }
    ];
    
    // Horários padrão do segundo turno
    const segundoTurnoPadrao = [
        { tipo: 'saida', horario: '23:00', min: '23:10', max: '23:40' },
        { tipo: 'saida', horario: '01:00', min: '01:10', max: '01:20' },
        { tipo: 'saida', horario: '02:55', min: '02:50', max: '03:20' },
        { tipo: 'saida', horario: '05:00', min: '05:10', max: '05:20' },
        { tipo: 'saida', horario: '07:00', min: '07:10', max: '07:20' },
        { tipo: 'chegada', horario: '15:00', min: '15:00', max: '15:20' },
        { tipo: 'chegada', horario: '17:00', min: '17:00', max: '17:20' },
        { tipo: 'chegada', horario: '21:00', min: '21:00', max: '21:20' }
    ];
    
    // Renderizar horários
    renderizarHorarios('primeiro_turno', primeiroTurnoPadrao);
    renderizarHorarios('segundo_turno', segundoTurnoPadrao);
    
    // Adicionar contadores
    atualizarContadores();
}

// Renderizar horários para um turno específico
function renderizarHorarios(turno, horarios) {
    const container = document.getElementById(`horarios-${turno.replace('_', '-')}`);
    if (!container) {
        console.warn(`Container para ${turno} não encontrado`);
        return;
    }
    
    container.innerHTML = '';
    
    horarios.forEach((horario, index) => {
        const horarioElement = criarElementoHorario(turno, horario, index);
        container.appendChild(horarioElement);
    });
    
    console.log(`✅ ${horarios.length} horários renderizados para ${turno}`);
}

// Criar elemento HTML para um horário
function criarElementoHorario(turno, horario, index) {
    const turnoNumero = turno.includes('primeiro') ? '1' : '2';
    const prefixoClasse = `turno${turnoNumero}`;
    
    const horarioItem = document.createElement('div');
    horarioItem.className = 'horario-item adding';
    
    // Remover classe de animação após a animação
    setTimeout(() => {
        horarioItem.classList.remove('adding');
    }, 300);
    
    horarioItem.innerHTML = `
        <div class="horario-grid">
            <div class="form-group">
                <label>Tipo:</label>
                <select class="${prefixoClasse}-tipo">
                    <option value="chegada" ${horario.tipo === 'chegada' ? 'selected' : ''}>Chegada</option>
                    <option value="saida" ${horario.tipo === 'saida' ? 'selected' : ''}>Saída</option>
                </select>
            </div>
            <div class="form-group">
                <label>Horário Martins:</label>
                <input type="time" class="${prefixoClasse}-saida" value="${horario.horario}">
            </div>
            <div class="form-group">
                <label>Tolerância Mín:</label>
                <input type="time" class="${prefixoClasse}-chegada-min" value="${horario.min}">
            </div>
            <div class="form-group">
                <label>Tolerância Máx:</label>
                <input type="time" class="${prefixoClasse}-chegada-max" value="${horario.max}">
            </div>
            <div class="form-group">
                <button type="button" class="btn-control remove" onclick="removerHorario(this)" title="Remover Horário">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    return horarioItem;
}

// Adicionar novo horário
function adicionarHorario(turno) {
    console.log(`➕ Adicionando horário ao ${turno}`);
    
    const container = document.getElementById(`horarios-${turno.replace('_', '-')}`);
    if (!container) {
        console.warn(`Container para ${turno} não encontrado`);
        return;
    }
    
    // Horário padrão para novo item
    const novoHorario = {
        tipo: 'saida',
        horario: '12:00',
        min: '12:00',
        max: '12:30'
    };
    
    const horarioElement = criarElementoHorario(turno, novoHorario);
    container.appendChild(horarioElement);
    
    // Atualizar contador
    atualizarContadores();
    
    // Focar no primeiro campo do novo horário
    const primeiroInput = horarioElement.querySelector('input[type="time"]');
    if (primeiroInput) {
        primeiroInput.focus();
        primeiroInput.select();
    }
    
    console.log(`✅ Horário adicionado ao ${turno}`);
}

// Remover horário
function removerHorario(botao) {
    const horarioItem = botao.closest('.horario-item');
    const container = horarioItem.closest('.horarios-container');
    
    if (!horarioItem || !container) {
        console.warn('Elemento de horário não encontrado');
        return;
    }
    
    // Verificar se é o último horário
    const totalHorarios = container.querySelectorAll('.horario-item').length;
    if (totalHorarios <= 1) {
        alert('Não é possível remover o último horário. Cada turno deve ter pelo menos um horário.');
        return;
    }
    
    // Confirmar remoção
    if (!confirm('Tem certeza que deseja remover este horário?')) {
        return;
    }
    
    console.log('🗑️ Removendo horário...');
    
    // Animação de remoção
    horarioItem.classList.add('removing');
    
    setTimeout(() => {
        horarioItem.remove();
        atualizarContadores();
        console.log('✅ Horário removido');
    }, 300);
}

// Atualizar contadores de horários
function atualizarContadores() {
    const turnosInfo = [
        { nome: 'primeiro_turno', elemento: 'primeiro-turno' },
        { nome: 'segundo_turno', elemento: 'segundo-turno' }
    ];
    
    turnosInfo.forEach(turno => {
        const container = document.getElementById(`horarios-${turno.elemento}`);
        const header = container?.closest('.turno-section')?.querySelector('.turno-header h4');
        
        if (container && header) {
            const totalHorarios = container.querySelectorAll('.horario-item').length;
            
            // Remover contador existente se houver
            const contadorExistente = header.querySelector('.turno-counter');
            if (contadorExistente) {
                contadorExistente.remove();
            }
            
            // Adicionar novo contador
            const contador = document.createElement('span');
            contador.className = 'turno-counter';
            contador.textContent = `${totalHorarios} horários`;
            header.appendChild(contador);
        }
    });
}

// Atualizar função editarRota para usar sistema dinâmico
function editarRotaDinamica(id) {
    const rota = rotas.find(r => r.id === id);
    if (!rota) {
        mostrarNotificacao('Rota não encontrada', 'error');
        return;
    }
    
    console.log('✏️ Editando rota com sistema dinâmico:', rota.nome);
    
    // Limpar o formulário primeiro
    document.getElementById('form-rota').reset();
    
    // Preencher dados básicos
    document.getElementById('rota-id').value = rota.id;
    document.getElementById('rota-nome').value = rota.nome;
    
    // Converter dados da rota para formato dinâmico
    if (rota.horarios) {
        if (rota.horarios.primeiro_turno && Array.isArray(rota.horarios.primeiro_turno)) {
            const horariosPrimeiro = rota.horarios.primeiro_turno.map(h => ({
                tipo: h.chegada_martins ? 'chegada' : 'saida',
                horario: h.chegada_martins || h.saida_martins || h.saida || '',
                min: h.chegada_minima || '',
                max: h.chegada_maxima || ''
            }));
            renderizarHorarios('primeiro_turno', horariosPrimeiro);
        }
        
        if (rota.horarios.segundo_turno && Array.isArray(rota.horarios.segundo_turno)) {
            const horariosSegundo = rota.horarios.segundo_turno.map(h => ({
                tipo: h.chegada_martins ? 'chegada' : 'saida',
                horario: h.chegada_martins || h.saida_martins || h.saida || '',
                min: h.chegada_minima || '',
                max: h.chegada_maxima || ''
            }));
            renderizarHorarios('segundo_turno', horariosSegundo);
        }
    }
    
    // Atualizar contadores
    atualizarContadores();
    
    // Abrir modal
    const modal = document.getElementById('modal-rota');
    if (modal) modal.style.display = 'flex';
    
    console.log('✅ Modal de edição aberto com horários dinâmicos');
}

// Sobrescrever função original editarRota
window.editarRota = editarRotaDinamica;

// Função para limpar modal de rota
function limparModalRota() {
    document.getElementById('form-rota').reset();
    document.getElementById('rota-id').value = '';
    carregarHorariosPadrao();
}

// Sobrescrever função abrirModalRota
function abrirModalRotaDinamica() {
    limparModalRota();
    const modal = document.getElementById('modal-rota');
    if (modal) modal.style.display = 'flex';
}

window.abrirModalRota = abrirModalRotaDinamica;
