// ==UserScript==
// @name         Sunflowerland Bot de Mineração - Detecção Imagem-Primeiro
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  Bot para minerar pedras com detecção de respawn "Imagem-Primeiro" para máxima precisão, conforme DOM.
// @author       Manus (Modificado por Gemini)
// @match        https://sunflower-land.com/play/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // CONFIGURAÇÕES DO BOT
    // ==========================================
    const CONFIG = {
        intervaloVerificacao: 5000,
        clicksNecessarios: 1,
        aleatoriedadeTempo: 500,
        intervaloEntreCliques: 300,
        debug: true,
        mostrarPainel: true,
        imagemPedra: 'https://sunflower-land.com/game-assets/resources/stone_small.png'
    };

    // ==========================================
    // ESTADO DO BOT
    // ==========================================
    let botAtivo = false;
    let intervaloBot = null;
    let statusAtual = "Parado";
    let picaretas = 0;
    let painelMinimizado = false;
    let maiorTempoRespawn = 0;
    let contadorRespawn = null;
    let botPausadoPorRespawn = false;
    let totalPedrasColetadasSessao = 0;
    let posicaoPainel = { x: 10, y: 10 };
    let cliqueExploratorioRealizado = false;
    let cicloAtualInfo = "0 / 0";

    // ==========================================
    // UTILITÁRIOS E DETECÇÃO
    // ==========================================
    function log(mensagem, tipo = 'info') {
        if (!CONFIG.debug) return;
        const timestamp = new Date().toLocaleTimeString();
        const estilos = { info: 'color: #3498db', erro: 'color: #e74c3c', sucesso: 'color: #2ecc71', aviso: 'color: #f39c12' };
        console.log(`%c[StoneBot ${timestamp}] ${mensagem}`, estilos[tipo] || estilos.info);
        const logPainel = document.getElementById('stonebot-log');
        if (logPainel) {
            const novaLinha = document.createElement('div');
            novaLinha.textContent = `[${timestamp}] ${mensagem}`;
            novaLinha.style.color = estilos[tipo] ? estilos[tipo].split(': ')[1] : estilos.info.split(': ')[1];
            logPainel.appendChild(novaLinha);
            while (logPainel.children.length > 50) { logPainel.removeChild(logPainel.firstChild); }
            logPainel.scrollTop = logPainel.scrollHeight;
        }
    }

    async function simularClique(coordenadas) {
        if (!coordenadas) return false;
        try {
            await new Promise(resolve => setTimeout(resolve, Math.random() * CONFIG.aleatoriedadeTempo));
            const x = coordenadas.x;
            const y = coordenadas.y;
            const elementoNoClique = document.elementFromPoint(x, y);
            if (!elementoNoClique) return false;
            ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(tipo => {
                elementoNoClique.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 }));
            });
            return true;
        } catch { return false; }
    }

    function verificarPicaretas() {
        try {
            const painelLateral = document.querySelector('.flex.flex-col.items-center[style*="margin-right"]');
            if (!painelLateral) return 0;
            for (const slot of painelLateral.querySelectorAll('.relative')) {
                if (slot.querySelector('img[src*="wood_pickaxe.png"]')) {
                    const quantidadeElemento = slot.querySelector('.text-xs');
                    return parseInt(quantidadeElemento?.textContent) || 0;
                }
            }
            return 0;
        } catch { return 0; }
    }

    function listarPedrasProntas() {
        const pedrasProntas = [];
        document.querySelectorAll(`img[src="${CONFIG.imagemPedra}"]`).forEach((img, index) => {
            // Uma pedra pronta não deve ter a classe de opacidade 50%
            if (!img.classList.contains('opacity-50')) {
                const container = img.closest('.relative.w-full.h-full');
                if (container) {
                    const rect = container.getBoundingClientRect();
                    pedrasProntas.push({
                        id: index + 1,
                        posicao: { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
                    });
                }
            }
        });
        return pedrasProntas;
    }

    function converterTempoParaSegundos(tempoTexto) {
        if (!tempoTexto || tempoTexto === 'Desconhecido') return 0;
        let totalSegundos = 0;
        const horasMatch = tempoTexto.match(/(\d+)hr/);
        if (horasMatch) totalSegundos += parseInt(horasMatch[1]) * 3600;
        const minutosMatch = tempoTexto.match(/(\d+)mins?/);
        if (minutosMatch) totalSegundos += parseInt(minutosMatch[1]) * 60;
        const segundosMatch = tempoTexto.match(/(\d+)s/);
        if (segundosMatch) totalSegundos += parseInt(segundosMatch[1]);
        return totalSegundos;
    }

    // ==========================================
    // FUNÇÃO DE RESPAWN CORRIGIDA (IMAGEM-PRIMEIRO)
    // ==========================================
    function encontrarMaiorTempoRespawnPedra() {
        log("Verificando tempo de respawn (Estratégia Imagem-Primeiro)...", 'info');
        let maiorTempo = 0;

        // ETAPA 1: Encontra todas as imagens de PEDRA que estão com opacidade 50 (em recarga).
        const imagensDePedraEmRecarga = document.querySelectorAll(`img[src*="stone_small.png"].opacity-50`);

        if (imagensDePedraEmRecarga.length === 0) {
            log("Nenhuma imagem de pedra em recarga (.opacity-50) foi encontrada.", 'aviso');
            return 0;
        }

        log(`Encontradas ${imagensDePedraEmRecarga.length} imagens de pedra em recarga. Verificando o texto 'Recovers in:'...`, 'info');

        // ETAPA 2: Para cada imagem encontrada, verifica se seu container pai tem o texto de respawn.
        imagensDePedraEmRecarga.forEach(imagem => {
            const plotContainer = imagem.closest('.relative.w-full.h-full');

            if (plotContainer && plotContainer.textContent?.includes('Recovers in:')) {
                // Se encontrou o texto no container da imagem, é uma correspondência confirmada.
                const matchTempo = plotContainer.textContent.match(/Recovers in:\s*([^\n]*)/);
                const tempoTexto = matchTempo ? matchTempo[1].trim() : '0';
                const tempoSeg = converterTempoParaSegundos(tempoTexto);

                if (tempoSeg > maiorTempo) {
                    maiorTempo = tempoSeg;
                    log(`Respawn de PEDRA confirmado: ${tempoTexto} (${tempoSeg}s)`, 'sucesso');
                }
            }
        });

        if (maiorTempo === 0) {
            log("Nenhuma correspondência de 'Recovers in:' encontrada para as pedras em recarga.", 'aviso');
        }
        return maiorTempo;
    }

    function iniciarContadorRespawn() {
        maiorTempoRespawn = encontrarMaiorTempoRespawnPedra();

        if (maiorTempoRespawn > 0) {
            botPausadoPorRespawn = true;
            statusAtual = "Aguardando respawn";
            log(`Bot pausado por ${Math.floor(maiorTempoRespawn / 60)}min ${maiorTempoRespawn % 60}s (respawn de pedra)`, 'aviso');
            if (contadorRespawn) clearInterval(contadorRespawn);
            contadorRespawn = setInterval(() => {
                maiorTempoRespawn--;
                atualizarPainel();
                if (maiorTempoRespawn <= 0) {
                    clearInterval(contadorRespawn);
                    contadorRespawn = null;
                    botPausadoPorRespawn = false;
                    statusAtual = "Respawn concluído";
                    log('Tempo de respawn de pedra concluído! Reiniciando ciclo.', 'sucesso');
                }
            }, 1000);
        }
    }


    // ==========================================
    // AÇÕES DE MINERAÇÃO E CICLO
    // ==========================================
    async function realizarCliqueExploratorio() {
        if (cliqueExploratorioRealizado) return true;
        log('Ativando picareta com clique exploratório...', 'info');
        const painelLateral = document.querySelector('.flex.flex-col.items-center[style*="margin-right"]');
        if (painelLateral) {
            for (const slot of painelLateral.querySelectorAll('.relative')) {
                const picaretaImg = slot.querySelector('img[src*="wood_pickaxe.png"]');
                if (picaretaImg) {
                    const rect = slot.getBoundingClientRect();
                    cliqueExploratorioRealizado = await simularClique({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                    return cliqueExploratorioRealizado;
                }
            }
        }
        log('Picareta não encontrada para clique exploratório.', 'erro');
        return false;
    }

    async function minerarPedra(pedra) {
        log(`AÇÃO: Iniciando mineração da pedra ID: ${pedra.id}.`, 'info');
        for (let i = 0; i < CONFIG.clicksNecessarios; i++) {
            if (!botAtivo) return false;
            const sucessoClique = await simularClique(pedra.posicao);
            if (!sucessoClique) {
                log(`FALHA: O clique ${i+1} na pedra ID: ${pedra.id} falhou.`, 'erro');
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, CONFIG.intervaloEntreCliques));
        }
        log(`PEDRA COLETADA: ${CONFIG.clicksNecessarios} cliques enviados com sucesso para a pedra ID: ${pedra.id}`, 'sucesso');
        return true;
    }

    async function executarCicloDeCorte(listaDePedras, totalNoCiclo, jaColetadas) {
        let pedrasColetadas = jaColetadas;

        for (const pedra of listaDePedras) {
            if (!botAtivo) break;
            const sucesso = await minerarPedra(pedra);

            if (sucesso) {
                pedrasColetadas++;
                totalPedrasColetadasSessao++;
                cicloAtualInfo = `${pedrasColetadas} / ${totalNoCiclo}`;
                atualizarPainel();

                picaretas = verificarPicaretas();
                if (picaretas <= 0) {
                    log("FIM: Detectado que as picaretas acabaram. Interrompendo.", 'aviso');
                    pararBot();
                    break;
                }
            }
        }
        return pedrasColetadas;
    }

    async function executarCicloBot() {
        if (!botAtivo || botPausadoPorRespawn) return;

        try {
            statusAtual = "Procurando pedras...";
            atualizarPainel();

            if (!cliqueExploratorioRealizado) await realizarCliqueExploratorio();

            const pedrasIniciais = listarPedrasProntas();
            const totalPedrasNoCiclo = pedrasIniciais.length;

            if (totalPedrasNoCiclo === 0) {
                statusAtual = "Nenhuma pedra pronta";
                cicloAtualInfo = "0 / 0";
                log(statusAtual);
                iniciarContadorRespawn();
                return;
            }

            picaretas = verificarPicaretas();
            if (picaretas === 0) {
                statusAtual = "Sem picaretas!";
                pararBot();
                return;
            }

            log(`Encontradas ${totalPedrasNoCiclo} pedras. Iniciando com ${picaretas} picaretas.`, 'sucesso');
            statusAtual = "Minerando...";
            cicloAtualInfo = `0 / ${totalPedrasNoCiclo}`;
            atualizarPainel();

            let pedrasColetadas = await executarCicloDeCorte(pedrasIniciais, totalPedrasNoCiclo, 0);

            if (botAtivo && pedrasColetadas < totalPedrasNoCiclo) {
                log(`Verificação de sobras: ${pedrasColetadas}/${totalPedrasNoCiclo}. Fazendo novo scan...`, 'aviso');
                await new Promise(resolve => setTimeout(resolve, 2000));

                const pedrasRestantes = listarPedrasProntas();
                if (pedrasRestantes.length > 0) {
                    log(`Encontradas ${pedrasRestantes.length} pedras restantes. Tentando coletar...`, 'info');
                    statusAtual = "Coletando sobras...";
                    atualizarPainel();
                    pedrasColetadas = await executarCicloDeCorte(pedrasRestantes, totalPedrasNoCiclo, pedrasColetadas);
                }
            }

            if (botAtivo) {
                 log("Ciclo concluído.");
                 statusAtual = "Aguardando";
                 iniciarContadorRespawn();
            }

        } catch (erro) {
            log(`Erro fatal no ciclo do bot: ${erro.message}`, 'erro');
            statusAtual = "Erro no ciclo";
        } finally {
            atualizarPainel();
        }
    }


    // ==========================================
    // INTERFACE DO USUÁRIO
    // ==========================================
    function criarPainel() {
        if (document.getElementById('stonebot-painel')) return;
        const painel = document.createElement('div');
        painel.id = 'stonebot-painel';
        painel.style.cssText = `position: fixed; top: ${posicaoPainel.y}px; left: ${posicaoPainel.x}px; width: 320px; background: rgba(0, 0, 0, 0.9); color: white; border: 2px solid #8e44ad; border-radius: 10px; padding: 15px; font-family: Arial, sans-serif; font-size: 12px; z-index: 10000; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);`;
        painel.innerHTML = `
            <div id="stonebot-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; cursor: move;">
                <h3 style="margin: 0; color: #9b59b6;">⛏️ StoneBot v3.4</h3>
                <button id="stonebot-minimizar" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">−</button>
            </div>
            <div id="stonebot-conteudo">
                <button id="stonebot-toggle" style="background: #27ae60; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; width: 100%; margin-bottom: 10px; font-weight: bold;">Iniciar Bot</button>
                <div id="stonebot-status-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;"></div>
                <div style="margin-top: 10px;"><strong>Log:</strong><div id="stonebot-log" style="background: #222; padding: 5px; border-radius: 3px; height: 100px; overflow-y: auto; font-size: 10px; margin-top: 5px;"></div></div>
            </div>`;
        document.body.appendChild(painel);
        document.getElementById('stonebot-toggle').addEventListener('click', toggleBot);
        document.getElementById('stonebot-minimizar').addEventListener('click', toggleMinimizar);
        tornarPainelArrastavel(painel);
        log('Painel de controle criado', 'sucesso');
        atualizarPainel();
    }

    function tornarPainelArrastavel(painel) {
        const header = document.getElementById('stonebot-header');
        let isDragging = false, offsetX, offsetY;
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - painel.getBoundingClientRect().left;
            offsetY = e.clientY - painel.getBoundingClientRect().top;
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            painel.style.left = `${e.clientX - offsetX}px`;
            painel.style.top = `${e.clientY - offsetY}px`;
        });
        document.addEventListener('mouseup', () => { isDragging = false; });
    }

    function atualizarPainel() {
        const grid = document.getElementById('stonebot-status-grid');
        if (!grid) return;

        const tempoRespawnTexto = maiorTempoRespawn > 0 ? `${Math.floor(maiorTempoRespawn / 60)}:${(maiorTempoRespawn % 60).toString().padStart(2, '0')}` : 'N/A';

        grid.innerHTML = `
            <div><strong>Status:</strong><br>${statusAtual}</div>
            <div><strong>Picaretas:</strong><br>${picaretas}</div>
            <div><strong>Pedras (Sessão):</strong><br>${totalPedrasColetadasSessao}</div>
            <div><strong>Pedras (Ciclo):</strong><br>${cicloAtualInfo}</div>
            <div><strong>Respawn:</strong><br>${tempoRespawnTexto}</div>
            <div><strong>Bot:</strong><br>${botAtivo ? '🟢 Ativo' : '🔴 Parado'}</div>
        `;
    }

    function toggleMinimizar() {
        painelMinimizado = !painelMinimizado;
        const conteudo = document.getElementById('stonebot-conteudo');
        const botao = document.getElementById('stonebot-minimizar');
        conteudo.style.display = painelMinimizado ? 'none' : 'block';
        botao.textContent = painelMinimizado ? '＋' : '−';
    }

    function toggleBot() {
        botAtivo = !botAtivo;
        const botao = document.getElementById('stonebot-toggle');
        if (botAtivo) {
            iniciarBot();
            botao.textContent = 'Parar Bot';
            botao.style.background = '#e74c3c';
        } else {
            pararBot();
            botao.textContent = 'Iniciar Bot';
            botao.style.background = '#27ae60';
        }
    }

    function iniciarBot() {
        statusAtual = "Iniciando";
        log('Bot iniciado.', 'sucesso');
        cliqueExploratorioRealizado = false;
        if (intervaloBot) clearInterval(intervaloBot);
        executarCicloBot();
        intervaloBot = setInterval(executarCicloBot, CONFIG.intervaloVerificacao);
    }

    function pararBot() {
        statusAtual = "Parado";
        if (intervaloBot) clearInterval(intervaloBot);
        if (contadorRespawn) clearInterval(contadorRespawn);
        intervaloBot = contadorRespawn = null;
        botPausadoPorRespawn = false;
        maiorTempoRespawn = 0;
        log('Bot parado.', 'aviso');
        atualizarPainel();
    }

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================
    function inicializar() {
        setTimeout(() => {
            if (CONFIG.mostrarPainel) criarPainel();
            log('StoneBot v3.4 pronto para uso!', 'sucesso');
        }, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();