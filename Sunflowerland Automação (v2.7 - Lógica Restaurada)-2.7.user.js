// ==UserScript==
// @name         Sunflowerland Automação (v2.7 - Lógica Restaurada)
// @namespace    http://tampermonkey.net/
// @version      2.7
// @description  Lógica da v2.4 totalmente restaurada para corrigir erros, com UI moderna.
// @author       Manus (UI Modificada por Gemini)
// @match        https://sunflower-land.com/play/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- Configurações ---
    const CONFIG = {
        EMPTY_PLOT_SRC: "https://sunflower-land.com/game-assets/crops/soil2.png",
        PLANTED_CROP_REGEX: /https:\/\/sunflower-land\.com\/game-assets\/crops\/([a-zA-Z0-9_]+)\/(seedling|almost|halfway|plant)\.png$/,
        VEGETABLE_SEED_REGEX: /https:\/\/sunflower-land\.com\/game-assets\/crops\/(potato|wheat|kale|carrot|cabbage|beetroot|cauliflower|parsnip|eggplant|corn|radish|onion|tomato|pumpkin|sunflower)\/seed\.png$/,
        SIDE_PANEL_SELECTOR: ".flex.flex-col.items-center[style*='margin-right']",
        TIME_SELECTOR: "span.flex-1.text-center.font-secondary",
        ACTION_DELAY_MS: 500,
        cycleWaitMs: 2000,
        SUMMARY_UPDATE_INTERVAL_MS: 60000
    };

    // --- Variáveis de Estado ---
    let botAtivo = false;
    let currentCycleTimeoutId = null;
    let currentActionTimeoutId = null;
    let summaryUpdateIntervalId = null;
    let actionLog = [];
    let statusAtual = "Parado";
    let painelMinimizado = false;
    let posicaoPainel = JSON.parse(localStorage.getItem('plotsBotPanelPosition')) || { x: 10, y: 10 };

    // --- Funções Auxiliares (LÓGICA RESTAURADA) ---
    function sleep(ms) {
        return new Promise((resolve, reject) => {
            // Lógica original que permite o sleep de 500ms da seleção de semente mesmo com o bot parando.
            if (!botAtivo && ms !== 500) return reject(new Error("Automation stopped"));
            clearTimeout(currentActionTimeoutId);
            currentActionTimeoutId = setTimeout(() => {
                resolve();
            }, ms);
        });
    }

    function logAction(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const estilos = { info: 'color: #3498db', erro: 'color: #e74c3c', sucesso: 'color: #2ecc71', aviso: 'color: #f39c12', debug: 'color: #9b59b6' };
        console.log(`%c[PlotsBot ${timestamp}] ${message}`, estilos[level] || estilos.info);
        const logDiv = document.getElementById('plotsbot-log');
        if (logDiv) {
            const novaLinha = document.createElement('div');
            novaLinha.innerHTML = `[${timestamp}] ${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;
            logDiv.appendChild(novaLinha);
            if (logDiv.children.length > 100) logDiv.removeChild(logDiv.firstChild);
            logDiv.scrollTop = logDiv.scrollHeight;
        }
    }

    function simulateClick(elementOrX, y) {
        let element;
        let clickX, clickY;
        if (typeof elementOrX === 'number' && typeof y === 'number') {
            element = document.elementFromPoint(elementOrX, y);
            clickX = elementOrX;
            clickY = y;
        } else if (elementOrX instanceof Element) {
            element = elementOrX;
            const rect = element.getBoundingClientRect();
            clickX = rect.left + rect.width / 2;
            clickY = rect.top + rect.height / 2;
        } else { return false; }

        if (element) {
            const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
            events.forEach(eventType => {
                element.dispatchEvent(new PointerEvent(eventType, { bubbles: true, cancelable: true, view: window, clientX: clickX, clientY: clickY }));
            });
            return true;
        }
        return false;
    }

    // --- Lógica de Seleção de Semente (FUNÇÃO RESTAURADA) ---
    async function selecionarSementeVerdura() {
        logAction("==> Iniciando selecionarSementeVerdura()", 'debug');
        try {
            const painelLateral = document.querySelector(CONFIG.SIDE_PANEL_SELECTOR);
            if (!painelLateral) {
                logAction("selecionarSementeVerdura: Painel lateral não encontrado.", 'error');
                return false;
            }
            const slotsItens = painelLateral.querySelectorAll('.relative img');
            if (!slotsItens || slotsItens.length === 0) {
                logAction("selecionarSementeVerdura: Nenhum item encontrado no painel lateral.", 'error');
                return false;
            }
            for (let i = 0; i < slotsItens.length; i++) {
                const img = slotsItens[i];
                const srcImagem = img.getAttribute('src');
                if (srcImagem && CONFIG.VEGETABLE_SEED_REGEX.test(srcImagem)) {
                    const match = CONFIG.VEGETABLE_SEED_REGEX.exec(srcImagem);
                    const seedName = match[1] ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : 'Verdura';
                    logAction(`selecionarSementeVerdura: Semente de ${seedName} encontrada! Tentando clicar...`, 'info');
                    if (simulateClick(img)) {
                        await sleep(500);
                        return true;
                    }
                }
            }
            logAction("selecionarSementeVerdura: Nenhuma semente de verdura compatível encontrada.", 'warn');
            return false;
        } catch (erro) {
            logAction(`Erro DENTRO de selecionarSementeVerdura: ${erro.message}`, 'error');
            return false;
        }
    }

    // --- Criação do Painel (UI RENOVADA) ---
    function criarPainel() {
        if (document.getElementById('plotsbot-painel')) return;
        const painel = document.createElement('div');
        painel.id = 'plotsbot-painel';
        painel.style.cssText = `position: fixed; top: ${posicaoPainel.y}px; left: ${posicaoPainel.x}px; width: 350px; background: rgba(0, 0, 0, 0.9); color: white; border: 2px solid #27ae60; border-radius: 10px; padding: 15px; font-family: Arial, sans-serif; font-size: 12px; z-index: 10000; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3); display: flex; flex-direction: column;`;
        painel.innerHTML = `
            <div id="plotsbot-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; cursor: move;">
                <h3 style="margin: 0; color: #2ecc71;">🥕 PlotsBot v2.7</h3>
                <button id="plotsbot-minimizar" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">−</button>
            </div>
            <div id="plotsbot-conteudo" style="display: flex; flex-direction: column; flex-grow: 1; min-height: 0;">
                <button id="plotsbot-toggle" style="background: #27ae60; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; width: 100%; margin-bottom: 10px; font-weight: bold;">Iniciar Bot</button>
                <div id="plotsbot-status-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                     <div><strong>Status:</strong><br><span id="plotsbot-status">Parado</span></div>
                     <div><strong>Bot:</strong><br><span id="plotsbot-ativo">🔴 Parado</span></div>
                </div>
                <div id="plots-config" style="background: #2c3e50; border-radius: 5px; padding: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <label for="cycle-time">Intervalo Ações (ms):</label>
                    <input type="number" id="cycle-time" value="${CONFIG.cycleWaitMs}" min="100" step="100" style="width: 80px; text-align: center; background: #ecf0f1; border: 1px solid #95a5a6; border-radius: 3px; color: #000;">
                </div>
                <div style="font-weight: bold; margin-bottom: 5px; border-top: 1px solid #444; padding-top: 8px;">Resumo dos Plots:</div>
                <div id="plotsbot-summary" style="font-size: 11px; background: #2c3e50; padding: 8px; border-radius: 3px; margin-bottom: 10px; min-height: 50px;">Aguardando...</div>
                <div style="margin-top: auto; display: flex; flex-direction: column; min-height: 0;">
                     <button id="plotsbot-atualizar" style="padding: 4px 8px; background: #3498db; border: none; border-radius: 3px; color: white; cursor: pointer; font-size: 12px; margin-bottom: 5px;">Atualizar Resumo Agora</button>
                    <strong style="margin-bottom: 5px;">Log de Ações:</strong>
                    <div id="plotsbot-log" style="background-color: #233140; border-radius: 5px; padding: 8px; flex-grow: 1; overflow-y: auto; font-size: 11px; border: 1px solid #4a627a; min-height: 100px;"></div>
                </div>
            </div>`;
        document.body.appendChild(painel);
        document.getElementById('plotsbot-toggle').addEventListener('click', toggleBot);
        document.getElementById('plotsbot-atualizar').addEventListener('click', () => { logAction('Atualização manual do resumo solicitada.'); atualizarPainelResumo(); });
        document.getElementById('plotsbot-minimizar').addEventListener('click', toggleMinimizar);
        document.getElementById('cycle-time').addEventListener('change', (e) => {
            const novoTempo = parseInt(e.target.value);
            if (!isNaN(novoTempo) && novoTempo >= 100) {
                CONFIG.cycleWaitMs = novoTempo;
                localStorage.setItem('plotsBotCycleWait', CONFIG.cycleWaitMs);
            } else { e.target.value = CONFIG.cycleWaitMs; }
        });
        tornarPainelArrastavel(painel);
    }

    function tornarPainelArrastavel(painel) {
        const header = document.getElementById('plotsbot-header');
        let isDragging = false, offsetX, offsetY;
        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            offsetX = e.clientX - painel.offsetLeft;
            offsetY = e.clientY - painel.offsetTop;
        });
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                posicaoPainel = { x: e.clientX - offsetX, y: e.clientY - offsetY };
                painel.style.left = `${posicaoPainel.x}px`;
                painel.style.top = `${posicaoPainel.y}px`;
            }
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                localStorage.setItem('plotsBotPanelPosition', JSON.stringify(posicaoPainel));
            }
        });
    }

    function toggleMinimizar() {
        painelMinimizado = !painelMinimizado;
        const conteudo = document.getElementById('plotsbot-conteudo');
        const botao = document.getElementById('plotsbot-minimizar');
        conteudo.style.display = painelMinimizado ? 'none' : 'flex';
        botao.textContent = painelMinimizado ? '＋' : '—';
    }

    // --- Controle e Lógica Principal (LÓGICA INTACTA) ---
    function pararBot() {
        botAtivo = false;
        clearTimeout(currentCycleTimeoutId);
        clearInterval(summaryUpdateIntervalId);
        statusAtual = "Parado";
        logAction('Automação interrompida.');
        atualizarPainel();
    }

    function iniciarBot() {
        botAtivo = true;
        statusAtual = "Rodando";
        logAction('Automação iniciada.');
        executarCiclo();
        clearInterval(summaryUpdateIntervalId);
        summaryUpdateIntervalId = setInterval(atualizarPainelResumo, CONFIG.SUMMARY_UPDATE_INTERVAL_MS);
        atualizarPainel();
    }

    function toggleBot() {
        const toggleButton = document.getElementById('plotsbot-toggle');
        botAtivo = !botAtivo;
        if (botAtivo) {
            iniciarBot();
            toggleButton.textContent = 'Parar Bot';
            toggleButton.style.background = '#d9534f';
        } else {
            pararBot();
            toggleButton.textContent = 'Iniciar Bot';
            toggleButton.style.background = '#27ae60';
        }
    }

    async function executarCiclo() {
        if (!botAtivo) return;
        try {
            const { plotsVazios, plotsPlantados } = encontrarEListarPlots(false);
            if (!botAtivo) return;
            const plotsParaColher = plotsPlantados.filter(p => p.estagio === 'Pronto');
            let colheitaRealizada = false;
            if (plotsParaColher.length > 0) {
                statusAtual = `Colhendo ${plotsParaColher.length}...`;
                atualizarPainel();
                for (const plot of plotsParaColher) {
                    if (!botAtivo) throw new Error("Stop requested");
                    simulateClick(plot.posicao.x, plot.posicao.y);
                    colheitaRealizada = true;
                    await sleep(CONFIG.ACTION_DELAY_MS);
                }
            }
            if (!botAtivo) return;
            let plotsParaPlantar = colheitaRealizada ? encontrarEListarPlots(false).plotsVazios : plotsVazios;
            if (!botAtivo) return;
            if (plotsParaPlantar.length > 0) {
                statusAtual = `Plantando ${plotsParaPlantar.length}...`;
                atualizarPainel();
                for (const plot of plotsParaPlantar) {
                    if (!botAtivo) throw new Error("Stop requested");
                    simulateClick(plot.posicao.x, plot.posicao.y);
                    await sleep(CONFIG.ACTION_DELAY_MS);
                    const { plotsVazios: vaziosAposPlantio } = encontrarEListarPlots(false);
                    if (vaziosAposPlantio.some(p => p.id === plot.id)) {
                        const sementeSelecionada = await selecionarSementeVerdura();
                        if (sementeSelecionada) {
                            simulateClick(plot.posicao.x, plot.posicao.y);
                            await sleep(CONFIG.ACTION_DELAY_MS);
                        } else {
                            logAction(`Não foi possível selecionar semente. Interrompendo plantio.`, 'error');
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            if (error.message !== "Stop requested") {
                logAction(`Erro no ciclo: ${error.message}`, 'error');
                pararBot(); return;
            }
        }
        if (botAtivo) {
            statusAtual = "Aguardando...";
            atualizarPainel();
            currentCycleTimeoutId = setTimeout(executarCiclo, CONFIG.cycleWaitMs);
        }
    }

    function encontrarEListarPlots(buscarTempo = false) {
        const plotsVazios = [], plotsPlantados = [];
        let plotIndex = 0;
        document.querySelectorAll('.absolute').forEach(container => {
            const emptyImg = container.querySelector(`img[src="${CONFIG.EMPTY_PLOT_SRC}"]`);
            const plantedImg = container.querySelector('img[src*="/crops/"]');
            let coords = null;
            try {
                 const rect = container.getBoundingClientRect();
                 if (rect.width > 10 && rect.height > 10) { // Pequeno filtro para evitar divs aleatórias
                    coords = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                 }
            } catch (e) { /* Ignora */ }
            if (!coords) { return; }

            const currentId = `plot-${plotIndex + 1}`;
            if (emptyImg) {
                plotsVazios.push({ id: currentId, posicao: coords });
                plotIndex++;
            } else if (plantedImg && CONFIG.PLANTED_CROP_REGEX.test(plantedImg.src)) {
                const match = CONFIG.PLANTED_CROP_REGEX.exec(plantedImg.src);
                if (match && match[1].toLowerCase() !== 'sunflower') {
                    const cropName = match[1].charAt(0).toUpperCase() + match[1].slice(1).replace(/_/g, ' ');
                    const stage = match[2];
                    let stageName = 'Crescendo', tempoRestante = null;
                    if (stage === 'plant') stageName = 'Pronto';
                    else if (buscarTempo) {
                         const timeElement = container.querySelector(CONFIG.TIME_SELECTOR);
                         if (timeElement) tempoRestante = timeElement.textContent.trim();
                    }
                    plotsPlantados.push({ id: currentId, tipo: cropName, estagio: stageName, posicao: coords, tempo: tempoRestante });
                    plotIndex++;
                }
            }
        });
        return { plotsVazios, plotsPlantados };
    }

    // --- Atualização do Painel ---
    function updateActionLogPanel() {
        const logDiv = document.getElementById('plotsbot-log');
        if (logDiv) logDiv.innerHTML = actionLog.map(entry => `<div>${entry}</div>`).join('');
    }

    function atualizarPainelResumo() {
        const summaryDiv = document.getElementById('plotsbot-summary');
        if (!summaryDiv) return;
        const { plotsVazios, plotsPlantados } = encontrarEListarPlots(true);
        let summaryHTML = `Vazios: <strong>${plotsVazios.length}</strong> | Plantados: <strong>${plotsPlantados.length}</strong><br/>`;
        const countByType = plotsPlantados.reduce((acc, plot) => {
            const key = `${plot.tipo} (${plot.estagio}${plot.tempo ? ` - ${plot.tempo}` : ''})`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        if (Object.keys(countByType).length > 0) {
             summaryHTML += `<ul style="margin: 5px 0 0 15px; padding: 0; list-style-type: disc; font-size: 10px;">`;
             Object.keys(countByType).sort().forEach(key => {
                 summaryHTML += `<li>${key}: <strong>${countByType[key]}</strong></li>`;
             });
             summaryHTML += `</ul>`;
        }
        summaryDiv.innerHTML = summaryHTML;
    }

    function atualizarPainel() {
        if (!document.getElementById('plotsbot-painel')) return;
        document.getElementById('plotsbot-status').textContent = statusAtual;
        document.getElementById('plotsbot-ativo').innerHTML = botAtivo ? '🟢 Ativo' : '🔴 Parado';
    }

    // --- Inicialização ---
    function inicializar() {
        CONFIG.cycleWaitMs = parseInt(localStorage.getItem('plotsBotCycleWait')) || CONFIG.cycleWaitMs;
        posicaoPainel = JSON.parse(localStorage.getItem('plotsBotPanelPosition')) || { x: 10, y: 10 };
        criarPainel();
        logAction('Painel de Automação (v2.7) carregado.');
        atualizarPainel();
        atualizarPainelResumo();
    }
    setTimeout(inicializar, 2000);

})();