// ==UserScript==
// @name         Sunflowerland Bot de Corte de Árvores - Ação Primeiro
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  Bot para cortar árvores com lógica de "ação primeiro": o clique é sempre a primeira instrução do ciclo de corte.
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
        aleatoriedadeTempo: 500,
        debug: true,
        mostrarPainel: true,

        imagensArvorePronta: {
            summer: 'https://sunflower-land.com/game-assets/resources/tree/Desert/summer_desert_tree.webp',
            autumn: 'https://sunflower-land.com/game-assets/resources/tree/Desert/autumn_desert_tree.webp',
            winter: 'https://sunflower-land.com/game-assets/resources/tree/Desert/winter_desert_tree.webp',
            spring: 'https://sunflower-land.com/game-assets/resources/tree/Desert/spring_desert_tree.webp'
        },
        imagensArvoreCortada: {
            summer: 'data:image/webp;base64,UklGRv4AAABXRUJQVlA4WAoAAAAQAAAADwAADQAAVlA4TIkAAAAvD0ADEDegqG0jNlcQ4yaWe5+SAAjQHI1mjQMoaiSFOXrTwBP/EhEIJDntbzBUAMBdr919wXA3qwEGkSQ5GU4B9xj4AAKygCiA4jCQ/Ht4RET0fwKAGMm9mWTHdjaAt2c3ycx+LrNX4Li/bxKYl2UcBMK8DLWD0M11cqBdl5KCtl2qFEpV1QLIAABQU0FJTgAAADhCSU0D7QAAAAAAEABIAAAAAQABAEgAAAABAAE4QklNBCgAAAAAAAwAAAACP/AAAAAAAAA4QklNBEMAAAAAAA1QYmVXARAABQEAAAAAAA==',
            autumn: 'data:image/webp;base64,UklGRpgAAABXRUJQVlA4TIwAAAAvD0ADEDegEAAaJoj8KeKI4YxgNkQCJMzw/zGjA2gmRW2kQHuCEvz74yUQSHLa32CoAMBcGn7jLP+lC4xq21Zy0DEfC6ABeARw5j72/iFeiYj+TwAwjuhWxFXN0AxAK0UvrhJRVy2S+1CVWbb6ME/Ttvtwz9P+pXCf8/enYM7z/w2Y5fwTA4ExxliAAg==',
            winter: 'PLACEHOLDER_INVERNO_BASE64',
            spring: 'PLACEHOLDER_PRIMAVERA_BASE64'
        }
    };

    // ==========================================
    // ESTADO DO BOT
    // ==========================================
    let botAtivo = false;
    let intervaloBot = null;
    let statusAtual = "Parado";
    let machados = 0;
    let painelMinimizado = false;
    let maiorTempoRespawn = 0;
    let contadorRespawn = null;
    let botPausadoPorRespawn = false;
    let contadorArvoresCortadas = 0;
    let posicaoPainel = { x: 10, y: 10 };

    // ==========================================
    // UTILITÁRIOS
    // ==========================================
    function log(mensagem, tipo = 'info') {
        if (!CONFIG.debug) return;
        const timestamp = new Date().toLocaleTimeString();
        const estilos = { info: 'color: #3498db', erro: 'color: #e74c3c', sucesso: 'color: #2ecc71', aviso: 'color: #f39c12' };
        console.log(`%c[TreeBot ${timestamp}] ${mensagem}`, estilos[tipo] || estilos.info);
        const logPainel = document.getElementById('treebot-log');
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
        } catch {
            return false;
        }
    }

    // ==========================================
    // FUNÇÕES DE DETECÇÃO
    // ==========================================
    function getEstacaoAtual() {
        const hoje = new Date();
        const dia = hoje.getDate();
        const mes = hoje.getMonth() + 1;
        if ((mes === 12 && dia >= 21) || mes === 1 || mes === 2 || (mes === 3 && dia < 21)) return 'summer';
        if ((mes === 3 && dia >= 21) || mes === 4 || mes === 5 || (mes === 6 && dia < 21)) return 'autumn';
        if ((mes === 6 && dia >= 21) || mes === 7 || mes === 8 || (mes === 9 && dia < 23)) return 'winter';
        return 'spring';
    }

    function verificarMachados() {
        try {
            const painelLateral = document.querySelector('.flex.flex-col.items-center[style*="margin-right"]');
            if (!painelLateral) return 0;
            for (const slot of painelLateral.querySelectorAll('.relative')) {
                if (slot.querySelector('img[src*="axe.png"]')) {
                    const quantidadeElemento = slot.querySelector('.text-xs');
                    return parseInt(quantidadeElemento?.textContent) || 0;
                }
            }
            return 0;
        } catch { return 0; }
    }

    function listarArvoresProntas() {
        const estacao = getEstacaoAtual();
        const imagemAtual = CONFIG.imagensArvorePronta[estacao];
        const arvoresProntas = [];
        document.querySelectorAll(`img[src="${imagemAtual}"]`).forEach((img, index) => {
            const container = img.closest('.absolute');
            if (container) {
                const rect = container.getBoundingClientRect();
                arvoresProntas.push({
                    id: index + 1,
                    posicao: { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
                });
            }
        });
        return arvoresProntas;
    }

    function listarArvoresCortadas() {
        const estacao = getEstacaoAtual();
        const imagemAtual = CONFIG.imagensArvoreCortada[estacao];
        if (!imagemAtual || imagemAtual.startsWith('PLACEHOLDER')) return [];
        const arvores = [];
        document.querySelectorAll(`img[src="${imagemAtual}"]`).forEach(img => {
            const containerPai = img.closest('div.absolute.w-full.h-full');
            if (containerPai?.textContent?.includes('Recovers in:')) {
                const matchTempo = containerPai.textContent.match(/Recovers in:\s*([^]*?)(?:\n|$)/);
                arvores.push({ tempo: matchTempo ? matchTempo[1].trim() : 'Desconhecido' });
            }
        });
        contadorArvoresCortadas = arvores.length;
        return arvores;
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

    function iniciarContadorRespawn() {
        maiorTempoRespawn = Math.max(0, ...listarArvoresCortadas().map(arvore => converterTempoParaSegundos(arvore.tempo)));
        if (maiorTempoRespawn > 0) {
            botPausadoPorRespawn = true;
            statusAtual = "Aguardando respawn";
            log(`Bot pausado por ${Math.floor(maiorTempoRespawn / 60)}min ${maiorTempoRespawn % 60}s`, 'aviso');
            if (contadorRespawn) clearInterval(contadorRespawn);
            contadorRespawn = setInterval(() => {
                maiorTempoRespawn--;
                atualizarPainel();
                if (maiorTempoRespawn <= 0) {
                    clearInterval(contadorRespawn);
                    contadorRespawn = null;
                    botPausadoPorRespawn = false;
                    statusAtual = "Respawn concluído";
                    log('Tempo de respawn concluído! Reiniciando ciclo.', 'sucesso');
                }
            }, 1000);
        }
    }

    // ==========================================
    // AÇÃO DE CORTE (SIMPLIFICADA)
    // ==========================================
    async function cortarArvore(arvore) {
        log(`AÇÃO: Clicando na árvore ID: ${arvore.id}.`, 'info');
        const sucessoClique = await simularClique(arvore.posicao);
        if (!sucessoClique) {
            log(`FALHA: O clique na árvore ID: ${arvore.id} falhou.`, 'erro');
            return false;
        }
        await new Promise(resolve => setTimeout(resolve, 1500)); // Espera o jogo processar
        return true;
    }

    // ==========================================
    // LÓGICA PRINCIPAL DO BOT (LÓGICA FORÇADA)
    // ==========================================
    async function executarCicloBot() {
        if (!botAtivo || botPausadoPorRespawn) {
            return;
        }

        try {
            statusAtual = "Procurando árvores...";
            atualizarPainel();

            const arvoresParaCortar = listarArvoresProntas();
            if (arvoresParaCortar.length === 0) {
                statusAtual = "Nenhuma árvore pronta";
                log(statusAtual);
                iniciarContadorRespawn();
                return;
            }

            log(`Encontradas ${arvoresParaCortar.length} árvores. Iniciando sequência de cortes...`, 'sucesso');
            statusAtual = "Cortando...";
            atualizarPainel();

            for (const arvore of arvoresParaCortar) {
                if (!botAtivo) break;

                // ETAPA 1: AÇÃO DE CORTE IMEDIATA
                const sucesso = await cortarArvore(arvore);

                // ETAPA 2: VERIFICAÇÃO PÓS-AÇÃO
                if (sucesso) {
                    log("CONSEQUÊNCIA: Ação de corte enviada. Verificando estado do inventário.", 'info');
                    machados = verificarMachados();
                    listarArvoresCortadas(); // Atualiza contador de tocos
                    atualizarPainel();

                    if (machados <= 0) {
                        log("FIM: Detectado que os machados acabaram. Interrompendo cortes.", 'aviso');
                        pararBot(); // Para completamente se não houver mais machados
                        break;
                    }
                } else {
                    log("PULANDO: O clique falhou, passando para a próxima árvore.", 'aviso');
                }
            }

            if (botAtivo) {
                 log("Ciclo de tentativas concluído.");
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
    // INTERFACE DO USUÁRIO (Painel)
    // ==========================================
    function criarPainel() {
        if (document.getElementById('treebot-painel')) return;
        const painel = document.createElement('div');
        painel.id = 'treebot-painel';
        painel.style.cssText = `position: fixed; top: ${posicaoPainel.y}px; left: ${posicaoPainel.x}px; width: 320px; background: rgba(0, 0, 0, 0.9); color: white; border: 2px solid #2ecc71; border-radius: 10px; padding: 15px; font-family: Arial, sans-serif; font-size: 12px; z-index: 10000; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);`;
        painel.innerHTML = `
            <div id="treebot-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; cursor: move;">
                <h3 style="margin: 0; color: #2ecc71;">🌳 TreeBot v3.4</h3>
                <button id="treebot-minimizar" style="background: #666; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">−</button>
            </div>
            <div id="treebot-conteudo">
                <button id="treebot-toggle" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; width: 100%; margin-bottom: 10px;">Iniciar Bot</button>
                <div style="margin-bottom: 8px;"><strong>Status:</strong> <span id="treebot-status">Parado</span></div>
                <div style="margin-bottom: 8px;"><strong>Machados:</strong> <span id="treebot-machados">0</span></div>
                <div style="margin-bottom: 8px;"><strong>Árvores Cortadas:</strong> <span id="treebot-contador" style="color: #f39c12; font-weight: bold;">0</span></div>
                <div style="margin-bottom: 8px;"><strong>Tempo Respawn:</strong> <span id="treebot-respawn">--</span></div>
                <button id="treebot-escanear" style="background: #2196F3; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; width: 100%; margin-top: 5px;">Executar Ciclo Agora</button>
                <div style="margin-top: 10px;"><strong>Log:</strong><div id="treebot-log" style="background: #222; padding: 5px; border-radius: 3px; height: 100px; overflow-y: auto; font-size: 10px; margin-top: 5px;"></div></div>
            </div>`;
        document.body.appendChild(painel);
        document.getElementById('treebot-toggle').addEventListener('click', toggleBot);
        document.getElementById('treebot-minimizar').addEventListener('click', toggleMinimizar);
        document.getElementById('treebot-escanear').addEventListener('click', () => { if(botAtivo) executarCicloBot(); else log("Inicie o bot primeiro.", "aviso"); });
        tornarPainelArrastavel(painel);
        log('Painel de controle criado', 'sucesso');
    }

    function tornarPainelArrastavel(painel) {
        const header = document.getElementById('treebot-header');
        let isDragging = false, offsetX, offsetY;
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - painel.getBoundingClientRect().left;
            offsetY = e.clientY - painel.getBoundingClientRect().top;
            painel.style.opacity = '0.8';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            const newX = Math.max(0, Math.min(x, window.innerWidth - painel.offsetWidth));
            const newY = Math.max(0, Math.min(y, window.innerHeight - painel.offsetHeight));
            painel.style.left = `${newX}px`;
            painel.style.top = `${newY}px`;
            posicaoPainel = { x: newX, y: newY };
        });
        document.addEventListener('mouseup', () => { if (isDragging) { isDragging = false; painel.style.opacity = '1'; } });
    }

    function atualizarPainel() {
        const statusEl = document.getElementById('treebot-status');
        const machadosEl = document.getElementById('treebot-machados');
        const contadorEl = document.getElementById('treebot-contador');
        const respawnEl = document.getElementById('treebot-respawn');
        if (statusEl) statusEl.textContent = statusAtual;
        if (machadosEl) machadosEl.textContent = machados;
        if (contadorEl) contadorEl.textContent = contadorArvoresCortadas;
        if (respawnEl) {
            if (maiorTempoRespawn > 0 && botPausadoPorRespawn) {
                const minutos = Math.floor(maiorTempoRespawn / 60);
                const segundos = maiorTempoRespawn % 60;
                respawnEl.textContent = `${minutos}:${segundos.toString().padStart(2, '0')}`;
                respawnEl.style.color = '#f39c12';
            } else {
                respawnEl.textContent = '--';
                respawnEl.style.color = 'white';
            }
        }
    }

    function toggleMinimizar() {
        const conteudo = document.getElementById('treebot-conteudo');
        const botao = document.getElementById('treebot-minimizar');
        painelMinimizado = !painelMinimizado;
        conteudo.style.display = painelMinimizado ? 'none' : 'block';
        botao.textContent = painelMinimizado ? '+' : '−';
        document.getElementById('treebot-painel').style.width = painelMinimizado ? '200px' : '320px';
    }

    function toggleBot() {
        botAtivo = !botAtivo;
        const botao = document.getElementById('treebot-toggle');
        if (botAtivo) {
            iniciarBot();
            botao.textContent = 'Parar Bot';
            botao.style.background = '#f44336';
        } else {
            pararBot();
            botao.textContent = 'Iniciar Bot';
            botao.style.background = '#4CAF50';
        }
    }

    function iniciarBot() {
        statusAtual = "Iniciando";
        log('Bot iniciado com lógica de Ação Primeiro.', 'sucesso');
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

    function inicializar() {
        log('Inicializando TreeBot v3.4...', 'info');
        setTimeout(() => {
            if (CONFIG.mostrarPainel) criarPainel();
            log('TreeBot v3.4 pronto para uso!', 'sucesso');
        }, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }

})();