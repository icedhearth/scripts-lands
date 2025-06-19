// ==UserScript==
// @name         Sunflowerland Bot Integrado (Frutas e Mel)
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  Versão completa e funcional com os módulos de Fruta e Mel.
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
        intervaloVerificacao: 10000,
        aleatoriedadeTempo: 1500,
        debug: true,
        maxAcoesPorCiclo: 5,
        mostrarPainel: true,
        modosAtivos: {
            frutas: true,
            mel: true
        },
        sementesDisponiveis: [
            { tipo: 'lemon', src: 'data:image/webp;base64,UklGRlQAAABXRUJQVlA4TEcAAAAvBUABECdAkG0zf6JRDOQS1yDMNpo/4gwmcN8jyLaZv8DABnGMz38A/jdltoGCRlLcNM0AOGgGCAb4EtH/+AGlVOplvTHwBQA=' },
            { tipo: 'apple', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJAgMAAACd/+6DAAAACVBMVEUAAADpQUqyKDcAKEvxAAAAAXRSTlMAQObYZgAAACtJREFUCNdj4GpgYFBNYGCYGcHAMC2MgWHq1AYG1dQGBs7IBgamUKDkKgYAiqUIBE1ZIjIAAAAASUVORK5CYII=' },
            { tipo: 'blueberry', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJAgMAAACd/+6DAAAADFBMVEUAAAAaYc0RTYkDl92BEBmNAAAAAXRSTlMAQObYZgAAAB9JREFUCNdjYFrAwMD9g4FBN46BYWt4AwwD+WBxkDwAo38JBSnOMAkAAAAASUVORK5CYII=' },
        ]
    };

    // ==========================================
    // ESTADO DO BOT
    // ==========================================
    let botAtivo = false;
    let intervaloBot = null;
    let statusAtual = "Parado";
    let frutasColhidasSessao = 0;
    let melColetadoSessao = 0;
    let plotsSummary = { prontos: 0, crescendo: 0, madeira: 0, vazios: 0, mel: 0, totalFrutas: 0 };
    let posicaoPainel = { x: 10, y: 10 };
    let painelMinimizado = false;
    let maiorTempoCrescimento = 0;
    let contadorCrescimento = null;
    let botPausadoPorCrescimento = false;

    // ==========================================
    // UTILITÁRIOS
    // ==========================================
    function log(mensagem, tipo = 'info') {
        if (!CONFIG.debug) return;
        const timestamp = new Date().toLocaleTimeString();
        const estilos = { info: 'color: #3498db', erro: 'color: #e74c3c', sucesso: 'color: #2ecc71', aviso: 'color: #f39c12' };
        console.log(`%c[IntegradoBot ${timestamp}] ${mensagem}`, estilos[tipo] || estilos.info);
        const logPainel = document.getElementById('bot-log');
        if (logPainel) {
            const novaLinha = document.createElement('div');
            novaLinha.textContent = `[${timestamp}] ${mensagem}`;
            novaLinha.style.color = estilos[tipo] ? estilos[tipo].split(': ')[1] : estilos.info.split(': ')[1];
            logPainel.appendChild(novaLinha);
            logPainel.scrollTop = logPainel.scrollHeight;
        }
    }

    async function simularClique(coordenadas) {
        if (!coordenadas) return false;
        try {
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * CONFIG.aleatoriedadeTempo)));
            const elementoNoClique = document.elementFromPoint(coordenadas.x, coordenadas.y);
            if (!elementoNoClique) return false;
            ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(tipo => {
                elementoNoClique.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, view: window, clientX: coordenadas.x, clientY: coordenadas.y, button: 0 }));
            });
            return true;
        } catch { return false; }
    }

    function converterTempoParaSegundos(tempoTexto) {
        if (!tempoTexto || tempoTexto === 'Pronto') return 0;
        let totalSegundos = 0;
        const horasMatch = tempoTexto.match(/(\d+)\s*hr/);
        if (horasMatch) totalSegundos += parseInt(horasMatch[1]) * 3600;
        const minutosMatch = tempoTexto.match(/(\d+)\s*min/);
        if (minutosMatch) totalSegundos += parseInt(minutosMatch[1]) * 60;
        const segundosMatch = tempoTexto.match(/(\d+)\s*sec/);
        if (segundosMatch) totalSegundos += parseInt(segundosMatch[1]);
        return totalSegundos > 0 ? totalSegundos + 5 : 0;
    }

    // ==========================================
    // MÓDULO DE FRUTAS - LÓGICA (v3.5.2 RESTAURADA)
    // ==========================================
    function ff_listarPlotsFrutas() {
        const fruitPatches = document.querySelectorAll('img[src*="fruit_patch.webp"], img[src*="fruit_patch.png"]');
        const plotsFrutas = [];
        fruitPatches.forEach((img, index) => {
            const container = img.closest('.absolute');
            if (container) {
                const rect = container.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                const contadorTempo = container.querySelector('.text-white.text-center.font-pixel, .font-secondary');
                const tempoRestante = contadorTempo ? contadorTempo.textContent.replace(/\s+/g, '') : 'Pronto';
                plotsFrutas.push({
                    id: index + 1,
                    tempo: tempoRestante,
                    posicao: { x: Math.round(x), y: Math.round(y) }
                });
            }
        });
        return plotsFrutas;
    }

    function ff_verificarEstadoPlot(coordenadas) {
        try {
            const elemento = document.elementFromPoint(coordenadas.x, coordenadas.y);
            if (!elemento) return { estado: 'desconhecido' };
            const container = elemento.closest('.absolute');
            if (!container) return { estado: 'desconhecido' };
            const frutasProntasSeletores = [
                { nome: 'Limão', seletor: 'img[src^="data:image/webp;base64,UklGRi4BAABXRUJQVlA4TCIBAAAvEUAHEF9gJAASXkAk2bzgawe4gEneMBTZxv"]' },
                { nome: 'Maçã', seletor: 'img[src*="apple_tree.png"]' },
                { nome: 'Tomate', seletor: 'img[src*="data:image/webp;base64,UklGRi4BAABXRUJQVlA4TCIBAAAvEUAHEF9gJJKUV5/g5zUKh0NTi86UoIaaSLaan9pExgAVHtBKhSIEKW0kBTpehcOhUfRfFiWcEAgkgW2/WADAbUuZQ13NNCtsvNv0l/Ra/8JzAMfZ/vTNZwXH/y9JO/Nu6efAWMn+FVbDRYJlhgMwTOgrRL2fDxHRfwFBEWsAcA1FOvUBQLOOrqYZNrFbDIPUbJTJ55EYaBZ+PDA1rC04GTt5wOH/0EqUk/bh+x7bZFx7bSGToTOpdulleRSs6x++u9cjezPaPHznwwczfti8XLhba9NRG0E2g8RZWycTxnvOAJZlebRdA3Qwr0c1ANCbhw8AgLV83y7s5NwsaJdXFYCK2K2SAogy94hQEeXcJVIV0VdeLdEXESlQGVAVFMoVAA=="]' },
                { nome: 'Laranja', seletor: 'img[src*="https://sunflower-land.com/game-assets/fruit/orange/orange_tree.png"]' },
                { nome: 'Banana', seletor: 'img[src*="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAjCAYAAABsFtHvAAAAAXNSR0IArs4c6QAAA2dJREFUWIWtlkFLG1EQx/8r0aWQQlpIFSFqpHoytPWSFpoUhFbxVHr20K/QS3vxC1gPXj1LPoM0HgImhSQ9BMJ6CElxg7mkXVpDFUpUmh7WeTv79u1uog4Esu/tzO8/82ZeosHHsltrA/5c/PRF83v3phbxgy5kxwEAaSzbG1sYBImQxZIFiXZtZLfWBgTtmedifTWZBQBUUUOreOkJuLixMkitDxBLRoXYKmoAgFbx0leEJgewOjriiT5iySgAO/O8WcRqMou8WQQAWB1dBFvcWBlMpSaEDxcNQKxxHxfcD8yNApB1jQsAwFRqAgAQT/RhdXQsZMdd2ZMf7XMBY6Tc2NcQT/Q9JVc9cygZAQhKVYslo2I9nui7eiPCg1kdiJdkoCpruQJWR4fVsc+4hSrz1kVcbqLsQVmRo9XRBeysfSX27s9FXH4EkY9PblblGNBRbGTTYi1vFgWcg7kAajwCU/X8pmVMBU6tD8Sc582iAMuZqp75e7Fk1DUlVBU6d995VammNWPfWzCetd+4ymPnmXNypszJmQug8nMgz5aPFz/3VvHSJdBzvZJTz3QcedaA3eG2UAfMIfZ3uhccv3jCPZIRytruVHcWqnHjYyZDe+a5c0zJGhNAcCd+17hwNxy/aGQogevTbdSn2+LcSWAay57mIogsngR5up1A/ENBGtuz0J8/BAA03v1xCaiihipqiCWjgQK4ueDy5dI1LsSnsT0LlA30K7+hf3gFAMoKUAL8uZkraPwm7BoXaOYK2pi8yaHNXEFr5gpafboNAA6YRFxXgarTM8+VvwOcQXEBdrc3cwUN19csbbqsbHgjvkihXjnEE2MOgO7pF1uUk5Qc1zVqSiiAe5+Ptb8fMVBl7YXRGeuefdk8DTeK9XcOsVmZxOnBSUbVVLzEKhvqT2H80eOXAHDy/l+Jr/96+hYAsLNbxl7Dyjx4M1Oipg0DA4o/kCoo2WZlEq+fTToL1WPX+6cHJxlgpnTV6+Ps249MSE7+cBk8rNkCnBjWz+9f/d5VnnkQeCk9P5KYoFiezMMyPqoeewQspeeB3XJpr2GFljoQPowdSWcdZn7lv9Wo3dZGggeVddSSA4o5v2mXh5mq7MpL4K4F+I2b7w10VwKC5jzw+rutgCBwKPymIsKgI8GHFTEslOw/cNcyyfgTT8gAAAAASUVORK5CYII="]' },
            ];
            for (const fruta of frutasProntasSeletores) {
                if (container.querySelector(fruta.seletor)) return { estado: 'pronto' };
            }
            if (container.querySelector('img[src*="soil2.png"]')) return { estado: 'vazio' };
            const imagemArvoreMorta = container.querySelector("img[src*='bush_shrub.png'],img[src*='dead_tree.webp']");
            if (imagemArvoreMorta) return { estado: 'madeira' };
            const contadorTempo = container.querySelector('.text-white.text-center.font-pixel');
            if (contadorTempo) return { estado: 'crescendo' };
            return { estado: 'desconhecido' };
        } catch { return { estado: 'erro' }; }
    }

    async function ff_colherFrutas(plots) {
        let colhidas = 0;
        for (const plot of plots) {
            if (!botAtivo) break;
            if (await simularClique(plot.posicao)) {
                colhidas++;
                frutasColhidasSessao++;
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        return colhidas;
    }

    async function ff_removerMadeira(plots) {
        let removidas = 0;
        for (const plot of plots) {
            if (!botAtivo) break;
            if (await simularClique(plot.posicao)) {
                removidas++;
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        return removidas;
    }

    async function ff_plantarFrutas(plots) {
        let plantadas = 0;
        for (const plot of plots) {
            if (!botAtivo) break;
            await simularClique(plot.posicao);
            await new Promise(r => setTimeout(r, 1000));
            const painelLateral = document.querySelector('.flex.flex-col.items-center[style*="margin-right"]');
            let sementeEncontrada = false;
            if (painelLateral) {
                for (const semente of CONFIG.sementesDisponiveis) {
                    const imgSemente = painelLateral.querySelector(`img[src="${semente.src}"]`);
                    if (imgSemente) {
                        await simularClique(imgSemente.getBoundingClientRect());
                        sementeEncontrada = true;
                        break;
                    }
                }
            }
            if (sementeEncontrada) {
                const botaoPlantar = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('plant'));
                if (botaoPlantar) {
                    await simularClique(botaoPlantar.getBoundingClientRect());
                    plantadas++;
                }
            } else {
                const anyDiv = document.querySelector('div');
                if (anyDiv) await simularClique(anyDiv.getBoundingClientRect());
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        return plantadas;
    }

    async function executarCicloFrutas() {
        log("Executando sub-ciclo de Frutas...");
        let acoesRealizadas = 0;
        const plotsEscaneados = ff_listarPlotsFrutas();
        if (plotsEscaneados.length === 0) {
            plotsSummary.totalFrutas = 0;
            return 0;
        }

        const plotsProntos = [], plotsVazios = [], plotsMadeira = [], plotsCrescendo = [];
        for (const plot of plotsEscaneados) {
            if (!botAtivo) break;
            const estadoInfo = ff_verificarEstadoPlot(plot.posicao);
            switch (estadoInfo.estado) {
                case 'pronto': plotsProntos.push(plot); break;
                case 'vazio': plotsVazios.push(plot); break;
                case 'madeira': plotsMadeira.push(plot); break;
                case 'crescendo': plotsCrescendo.push(plot); break;
            }
        }

        plotsSummary.prontos = plotsProntos.length;
        plotsSummary.crescendo = plotsCrescendo.length;
        plotsSummary.madeira = plotsMadeira.length;
        plotsSummary.vazios = plotsVazios.length;
        plotsSummary.totalFrutas = plotsEscaneados.length;
        plotsSummary.crescendoPlots = plotsCrescendo;

        const acoesMax = CONFIG.maxAcoesPorCiclo;
        if (plotsProntos.length > 0) acoesRealizadas += await ff_colherFrutas(plotsProntos.slice(0, acoesMax - acoesRealizadas));
        if (plotsMadeira.length > 0 && acoesRealizadas < acoesMax) acoesRealizadas += await ff_removerMadeira(plotsMadeira.slice(0, acoesMax - acoesRealizadas));
        if (plotsVazios.length > 0 && acoesRealizadas < acoesMax) acoesRealizadas += await ff_plantarFrutas(plotsVazios.slice(0, acoesMax - acoesRealizadas));
        return acoesRealizadas;
    }

    // ==========================================
    // MÓDULO DE MEL
    // ==========================================
    function escanearPlotsDeMel() {
        const plots = [];
        document.querySelectorAll('img[alt="Beehive"]').forEach(beehive => {
            const container = beehive.closest('.relative');
            if(!container) return;
            const plotData = {};
            const honeyDrop = container.querySelector('img[alt="Honey Drop"]');
            if (honeyDrop) {
                const rect = honeyDrop.getBoundingClientRect();
                if (rect.width > 0) {
                     plotData.posicaoColeta = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                }
            }
            plots.push(plotData);
        });
        return plots;
    }

    async function colherMel(plotsDeMel) {
        let colhidas = 0;
        const plotsProntos = plotsDeMel.filter(p => p.posicaoColeta);
        for (const plot of plotsProntos) {
            if (!botAtivo) break;
            if (await simularClique(plot.posicaoColeta)) {
                colhidas++;
                melColetadoSessao++;
                await new Promise(r => setTimeout(r, 1500));
            }
        }
        return colhidas;
    }

    // ==========================================
    // CICLO PRINCIPAL INTEGRADO
    // ==========================================
    async function executarCiclo() {
        if (!botAtivo) return;
        statusAtual = "Iniciando ciclo...";
        atualizarPainel();
        let acoesRealizadas = 0;

        if (CONFIG.modosAtivos.frutas) {
            statusAtual = "Módulo Frutas...";
            atualizarPainel();
            acoesRealizadas += await executarCicloFrutas();
        }

        if (CONFIG.modosAtivos.mel && botAtivo) {
            statusAtual = "Módulo Mel...";
            atualizarPainel();
            const plotsDeMel = escanearPlotsDeMel();
            plotsSummary.mel = plotsDeMel.filter(p => p.posicaoColeta).length;
            if (plotsSummary.mel > 0) {
                 statusAtual = `Coletando ${plotsSummary.mel} mel...`;
                 atualizarPainel();
                 acoesRealizadas += await colherMel(plotsDeMel);
            }
        }

        log(`Ciclo integrado concluído. Total de ${acoesRealizadas} ações realizadas.`);
        statusAtual = "Aguardando...";
        atualizarPainel();
    }

    // ==========================================
    // PAINEL DE MONITORAMENTO
    // ==========================================
    function criarPainel() {
        if (document.getElementById('bot-painel')) return;
        const painel = document.createElement('div');
        painel.id = 'bot-painel';
        painel.style.cssText = `position: fixed; top: ${posicaoPainel.y}px; left: ${posicaoPainel.x}px; width: 320px; background: rgba(0, 0, 0, 0.9); color: white; border: 2px solid #f1c40f; border-radius: 10px; padding: 15px; font-family: Arial, sans-serif; font-size: 12px; z-index: 10000; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);`;

        painel.innerHTML = `
            <div id="bot-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; cursor: move;">
                <h3 style="margin: 0; color: #f1c40f;">🐝 IntegradoBot v4.2</h3>
                <button id="bot-minimizar" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">−</button>
            </div>
            <div id="bot-conteudo">
                <button id="bot-toggle" style="background: #27ae60; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; width: 100%; margin-bottom: 10px; font-weight: bold;">Iniciar Bot</button>
                <div style="font-weight: bold; margin-bottom: 5px; border-top: 1px solid #444; padding-top: 8px;">Módulos Ativos:</div>
                <div id="bot-modos" style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 10px;">
                    <label style="display:flex; align-items:center;"><input type="checkbox" name="modo" value="frutas"> <span style="margin-left:5px;">🍓 Frutas</span></label>
                    <label style="display:flex; align-items:center;"><input type="checkbox" name="modo" value="mel"> <span style="margin-left:5px;">🍯 Mel</span></label>
                </div>
                <div id="bot-status-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; border-top: 1px solid #444; padding-top: 8px;"></div>
                <div style="margin-top: 10px;"><strong>Log:</strong><div id="bot-log" style="background: #222; padding: 5px; border-radius: 3px; height: 120px; overflow-y: auto; font-size: 10px; margin-top: 5px;"></div></div>
            </div>`;

        document.body.appendChild(painel);
        document.getElementById('bot-toggle').addEventListener('click', toggleBot);
        document.getElementById('bot-minimizar').addEventListener('click', toggleMinimizar);
        tornarPainelArrastavel(painel);

        document.querySelectorAll('input[name="modo"]').forEach(checkbox => {
            checkbox.checked = CONFIG.modosAtivos[checkbox.value];
            checkbox.addEventListener('change', (e) => {
                CONFIG.modosAtivos[e.target.value] = e.target.checked;
            });
        });
    }

    function tornarPainelArrastavel(painel) {
        const header = document.getElementById('bot-header');
        let isDragging = false, offsetX, offsetY;
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - painel.getBoundingClientRect().left;
            offsetY = e.clientY - painel.getBoundingClientRect().top;
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            posicaoPainel.x = e.clientX - offsetX;
            posicaoPainel.y = e.clientY - offsetY;
            painel.style.left = `${posicaoPainel.x}px`;
            painel.style.top = `${posicaoPainel.y}px`;
        });
        document.addEventListener('mouseup', () => { isDragging = false; });
    }

    function atualizarPainel() {
        if (!document.getElementById('bot-painel')) return;
        const statusGrid = document.getElementById('bot-status-grid');
        if (statusGrid) {
            statusGrid.innerHTML = `
                <div><strong>Status:</strong><br>${statusAtual}</div>
                <div><strong>Bot:</strong><br>${botAtivo ? '🟢 Ativo' : '🔴 Parado'}</div>
                <div><strong>Frutas Colhidas:</strong><br>${frutasColhidasSessao}</div>
                <div><strong>Mel Coletado:</strong><br>${melColetadoSessao}</div>
                <div style="grid-column: span 2; border-top: 1px solid #555; padding-top: 5px; margin-top: 5px;">
                    Frutas (T/P/C/L): ${plotsSummary.totalFrutas || 0} /
                    <strong style="color: #2ecc71;">${plotsSummary.prontos || 0}</strong> /
                    <strong style="color: #3498db;">${plotsSummary.crescendo || 0}</strong> /
                    <strong style="color: #e74c3c;">${plotsSummary.madeira || 0}</strong>
                </div>
                 <div style="grid-column: span 2;">
                    Mel Pronto: <strong style="color: #f1c40f;">${plotsSummary.mel || 0}</strong>
                </div>
            `;
        }
    }

    function toggleMinimizar() {
        painelMinimizado = !painelMinimizado;
        const conteudo = document.getElementById('bot-conteudo');
        const botao = document.getElementById('bot-minimizar');
        conteudo.style.display = painelMinimizado ? 'none' : 'block';
        botao.textContent = painelMinimizado ? '＋' : '−';
    }

    function toggleBot() {
        botAtivo = !botAtivo;
        const botao = document.getElementById('bot-toggle');
        if (botao) {
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
    }

    function iniciarBot() {
        statusAtual = "Iniciando...";
        botAtivo = true;
        if (intervaloBot) clearInterval(intervaloBot);
        executarCiclo();
        intervaloBot = setInterval(executarCiclo, CONFIG.intervaloVerificacao);
        atualizarPainel();
    }

    function pararBot() {
        botAtivo = false;
        clearInterval(intervaloBot);
        clearInterval(contadorCrescimento);
        intervaloBot = contadorCrescimento = null;
        botPausadoPorCrescimento = false;
        statusAtual = "Parado";
        plotsSummary = {};
        atualizarPainel();
    }

    function inicializar() {
        setTimeout(() => {
            if (CONFIG.mostrarPainel) {
                criarPainel();
                atualizarPainel();
            }
            log("IntegradoBot v4.2 pronto. Use o painel para iniciar.");
        }, 2000);
    }

    window.addEventListener('load', inicializar);

})();