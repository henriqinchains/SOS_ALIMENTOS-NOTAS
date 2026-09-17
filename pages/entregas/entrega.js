const API_URL = "https://sos-alimentos-servidor.onrender.com/api";

// Precisa bater com a constante VERSAO_APP do server.js. Toda vez que uma
// correção for publicada (front e/ou back), muda esse valor nos dois
// lugares — qualquer aba com entrega.html aberta detecta a diferença
// sozinha e recarrega automaticamente em até INTERVALO_VERSAO_MS.
const VERSAO_APP = "2026-09-17-1";
const INTERVALO_VERSAO_MS = 2 * 60 * 1000; // checa a cada 2 minutos

// Atrasos entre tentativas de reenvio: 15s, depois 30s, depois 40s.
// Se ainda falhar depois disso, continua tentando a cada 40s (não desiste).
const ATRASOS_RETRY_MS = [15000, 30000, 40000];
const INTERVALO_TICKER_MS = 5000;

const formEntrega = document.getElementById("form-entrega");
const inputCliente = document.getElementById("cliente");
const inputValor = document.getElementById("valorNota");
const inputImagem = document.getElementById("imagemNota");
const inputNotaJaPaga = document.getElementById("notaJaPagaEntrega");
const btnNotaJaPaga = document.getElementById("btnNotaJaPagaEntrega");
const nomeArquivo = document.getElementById("nomeArquivo");
const listaClientes = document.getElementById("lista-clientes");
const feedback = document.getElementById("feedback");
const btnEnviar = document.getElementById("btnEnviar");
const filaPendentesEl = document.getElementById("fila-pendentes");

let todosClientes = [];
let clienteSelecionado = null;
let numeroNota = 1;
let entregadorAtual = null;

// idLocal das notas que estão sendo enviadas agora mesmo, pra não tentar
// enviar a mesma nota duas vezes em paralelo (ex: ticker rodou enquanto um
// envio anterior ainda estava em andamento).
const idsEmEnvio = new Set();

// Formata a data LOCAL (do celular) como "YYYY-MM-DD". new Date().toISOString()
// converte pra UTC e "adianta" a data à noite (Brasil é UTC-3) — isso fazia
// notas registradas depois das ~21h entrarem com a data de amanhã, quebrando
// a Planejar Rota (que compara a data salva com a data local planejada).
function obterDataLocalISO(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

// Função para mostrar feedback inline
function mostrarFeedback(mensagem, tipo) {
    feedback.textContent = mensagem;
    feedback.className = "feedback feedback--" + tipo;
}

// =========================
// Rascunho do formulário (sessionStorage)
// Protege contra o navegador recarregar a página sozinho — o que acontece
// às vezes ao abrir a câmera (capture="environment") em celulares com pouca
// memória. O campo Cliente tem autocomplete="off" (pra não misturar com
// sugestão nativa do navegador), então ele NÃO se restaura sozinho nesse
// tipo de recarregamento, diferente do campo Valor — daí o cliente sumir
// "sozinho" enquanto o resto parece continuar preenchido.
// =========================
const CHAVE_RASCUNHO = "entrega_rascunho";

function salvarRascunho() {
    try {
        sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({
            textoCliente: inputCliente.value,
            idClienteSelecionado: clienteSelecionado ? clienteSelecionado._id : null,
            valor: inputValor.value,
            pago: inputNotaJaPaga ? inputNotaJaPaga.value : "false"
        }));
    } catch (erro) {
        console.error("Erro ao salvar rascunho do formulário:", erro);
    }
}

function limparRascunho() {
    try {
        sessionStorage.removeItem(CHAVE_RASCUNHO);
    } catch (erro) {
        console.error("Erro ao limpar rascunho do formulário:", erro);
    }
}

// Chamado depois que a lista de clientes já carregou, pra conseguir
// religar o clienteSelecionado (não só o texto) quando houver rascunho.
function restaurarRascunho() {
    let rascunho;
    try {
        rascunho = JSON.parse(sessionStorage.getItem(CHAVE_RASCUNHO));
    } catch (erro) {
        console.error("Rascunho corrompido, ignorando:", erro);
        return;
    }

    if (!rascunho || (!rascunho.textoCliente && !rascunho.valor)) return;

    if (rascunho.textoCliente) {
        inputCliente.value = rascunho.textoCliente;
    }

    if (rascunho.valor) {
        inputValor.value = rascunho.valor;
    }

    if (rascunho.pago === "true" && inputNotaJaPaga && btnNotaJaPaga) {
        inputNotaJaPaga.value = "true";
        btnNotaJaPaga.setAttribute("aria-pressed", "true");
        btnNotaJaPaga.classList.add("ativo");
        btnNotaJaPaga.textContent = "✅ Nota será registrada como paga";
    }

    if (rascunho.idClienteSelecionado) {
        const cliente = todosClientes.find(c => c._id === rascunho.idClienteSelecionado);
        if (cliente) {
            selecionarCliente(cliente);
        }
    }

    mostrarFeedback("Continuando o preenchimento de onde parou.", "info");
}

// =========================
// Sessão / controle de acesso
// =========================
async function verificarSessaoEntregador() {
    try {
        const resposta = await fetch(`${API_URL}/auth/me`, {
            method: "GET",
            credentials: "include",
        });

        if (!resposta.ok) {
            window.location.href = "../login/login.html";
            return false;
        }

        const dados = await resposta.json();

        if (dados.cargo === "admin" || dados.cargo === "financeiro") {
            window.location.href = "../../";
            return false;
        }

        // armazenar dados do entregador para enviar com a nota
        entregadorAtual = {
            id: dados._id || dados.id || null,
            nome: dados.nome || dados.name || dados.usuario || ""
        };

        return true;
    } catch (erro) {
        console.error("Erro ao verificar sessão:", erro);
        window.location.href = "../login/login.html";
        return false;
    }
}

// =========================
// Carregar clientes
// =========================
async function carregarClientes() {
    try {
        const resposta = await fetch(`${API_URL}/clientes`, {
            credentials: "include"
        });

        if (!resposta.ok) {
            throw new Error("Erro ao carregar clientes.");
        }

        todosClientes = await resposta.json();

    } catch (erro) {
        console.error(erro);
        mostrarFeedback("Erro ao carregar clientes.", "erro");
    }
}

// =========================
// Autocomplete de cliente
// =========================
inputCliente.addEventListener("input", () => {
    clienteSelecionado = null;

    const texto = inputCliente.value.trim();
    salvarRascunho();

    if (!texto) {
        listaClientes.innerHTML = "";
        return;
    }

    mostrarSugestoes(texto);
});

inputValor.addEventListener("input", salvarRascunho);

function mostrarSugestoes(texto) {
    listaClientes.innerHTML = "";

    const encontrados = todosClientes.filter(cliente =>
        cliente.cliente.toLowerCase().includes(texto.toLowerCase())
    );

    encontrados.forEach(cliente => {
        const item = document.createElement("div");
        item.className = "autocomplete-item";
        item.textContent = cliente.cliente;

        item.addEventListener("click", () => {
            inputCliente.value = cliente.cliente;
            listaClientes.innerHTML = "";
            selecionarCliente(cliente);
        });

        listaClientes.appendChild(item);
    });
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete")) {
        listaClientes.innerHTML = "";
    }
});

async function selecionarCliente(cliente) {
    clienteSelecionado = cliente;
    salvarRascunho();
    await buscarNumeroNota(cliente);
}

// =========================
// Buscar próximo número da nota
// =========================
async function buscarNumeroNota(cliente) {
    try {
        const resposta = await fetch(`${API_URL}/notas?_=${Date.now()}`, {
            credentials: "include"
        });

        if (!resposta.ok) {
            throw new Error("Erro ao buscar notas.");
        }

        const notas = await resposta.json();

        const chaveAlvo = cliente.cliente.toLowerCase().trim();
        const notasCliente = notas.filter(n =>
            (n.cliente || "").toLowerCase().trim() === chaveAlvo
        );

        numeroNota = notasCliente.length + 1;

    } catch (erro) {
        console.error(erro);
        numeroNota = 1;
    }
}

// =========================
// Imagem <-> base64
// (base64 é o que permite a nota sobreviver a um recarregamento de página
// dentro da fila local — um File/Blob "cru" não sobrevive ao JSON.stringify
// e, mesmo guardando o Blob original no IndexedDB, o backend espera um
// multipart/form-data montado a partir desses bytes na hora do envio)
// =========================
function arquivoParaBase64(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
        leitor.readAsDataURL(arquivo);
    });
}

function base64ParaBlob(dataUrl) {
    const [cabecalho, conteudo] = dataUrl.split(",");
    const tipo = (cabecalho.match(/data:(.*?);base64/) || [])[1] || "image/jpeg";
    const binario = atob(conteudo);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) {
        bytes[i] = binario.charCodeAt(i);
    }
    return new Blob([bytes], { type: tipo });
}

// =========================
// Compressão/redimensionamento da foto (canvas)
// Fotos de celular costumam vir enormes (4000px+ de lado, vários MB). Antes
// de guardar na fila, redesenha a imagem num canvas limitando o lado maior
// a IMAGEM_MAX_DIMENSAO e reexporta como JPEG com IMAGEM_QUALIDADE — isso
// reduz bastante o espaço ocupado na fila local e o consumo de dados móveis
// do entregador no envio, sem mudar nada visível na tela.
// =========================
const IMAGEM_MAX_DIMENSAO = 1600; // px, no lado maior da foto
const IMAGEM_QUALIDADE = 0.7;

function comprimirImagem(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();

        leitor.onload = () => {
            const img = new Image();

            img.onload = () => {
                try {
                    let { width, height } = img;

                    if (width > IMAGEM_MAX_DIMENSAO || height > IMAGEM_MAX_DIMENSAO) {
                        if (width >= height) {
                            height = Math.round(height * (IMAGEM_MAX_DIMENSAO / width));
                            width = IMAGEM_MAX_DIMENSAO;
                        } else {
                            width = Math.round(width * (IMAGEM_MAX_DIMENSAO / height));
                            height = IMAGEM_MAX_DIMENSAO;
                        }
                    }

                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        reject(new Error("Canvas não suportado neste navegador."));
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL("image/jpeg", IMAGEM_QUALIDADE);

                    // Alguns navegadores retornam "data:," quando a conversão
                    // falha silenciosamente (ex: canvas "tainted"). Trata como erro.
                    if (!dataUrl || !dataUrl.startsWith("data:image")) {
                        reject(new Error("Falha ao comprimir a imagem."));
                        return;
                    }

                    resolve(dataUrl);
                } catch (erro) {
                    reject(erro);
                }
            };

            img.onerror = () => reject(new Error("Não foi possível processar a imagem selecionada."));
            img.src = leitor.result;
        };

        leitor.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
        leitor.readAsDataURL(arquivo);
    });
}

// Tenta comprimir; se der qualquer problema (formato exótico, navegador sem
// suporte a canvas, etc.), cai pra base64 "cru" do arquivo original em vez
// de bloquear o entregador de mandar a nota.
async function prepararImagemParaFila(arquivo) {
    try {
        return await comprimirImagem(arquivo);
    } catch (erro) {
        console.error("Não foi possível comprimir a imagem, usando original:", erro);
        return arquivoParaBase64(arquivo);
    }
}

// =========================
// Fila local (IndexedDB) — sobrevive a recarregar a página
//
// Antes, a fila inteira (incluindo a foto em base64 de cada nota) era
// serializada com JSON.stringify e guardada como uma única string no
// localStorage. O localStorage tem um limite bem pequeno (tipicamente
// 5–10 MB no total, por origem) e uma foto em base64 já ocupa ~33% a mais
// que o arquivo original — bastavam poucas notas com foto pra estourar
// esse limite. Quando isso acontecia, salvarFila() falhava, a nota não
// era guardada de forma durável, e a tela ficava "presa" esperando o
// entregador liberar espaço manualmente.
//
// O IndexedDB guarda cada nota como um registro separado (não precisa
// serializar a fila inteira toda vez) e tem uma cota muito maior — em geral
// dezenas de MB até vários GB, dependendo do espaço livre do aparelho — o
// que é o que essa fila realmente precisa pra guardar fotos com segurança.
// =========================
const DB_NOME = "sos_alimentos_fila";
const DB_VERSAO = 1;
const STORE_NOME = "notasPendentes";

let _dbPromise = null;

function abrirDB() {
    if (_dbPromise) return _dbPromise;

    _dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error("IndexedDB não é suportado neste navegador."));
            return;
        }

        const req = indexedDB.open(DB_NOME, DB_VERSAO);

        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NOME)) {
                db.createObjectStore(STORE_NOME, { keyPath: "idLocal" });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error("Erro ao abrir o banco local (IndexedDB)."));
    });

    return _dbPromise;
}

// Lê a fila inteira. Único ponto onde ainda existe algo parecido com "ler
// tudo de uma vez" — mas via getAll() do IndexedDB, não via JSON.parse de
// uma string gigante, então não sofre do mesmo limite de tamanho.
async function obterFila() {
    try {
        const db = await abrirDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NOME, "readonly");
            const store = tx.objectStore(STORE_NOME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (erro) {
        console.error("Fila local corrompida ou indisponível, tratando como vazia:", erro);
        return [];
    }
}

// Substitui a fila inteira pelo array passado (usado só pela limpeza
// inicial, que já trabalha com a lista completa filtrada).
async function salvarFila(notas) {
    try {
        const db = await abrirDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NOME, "readwrite");
            const store = tx.objectStore(STORE_NOME);
            store.clear();
            notas.forEach(n => store.put(n));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        return true;
    } catch (erro) {
        console.error("Erro ao salvar fila local (IndexedDB):", erro);
        return false;
    }
}

async function salvarNotaLocal(nota) {
    try {
        const db = await abrirDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NOME, "readwrite");
            tx.objectStore(STORE_NOME).put(nota);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        return true;
    } catch (erro) {
        // Ainda pode acontecer em casos raros (modo privado do Safari com
        // IndexedDB bloqueado, cota realmente esgotada no aparelho, etc).
        // A nota ainda assim será tentada agora mesmo, só não fica
        // garantida a sobrevivência a um reload.
        console.error("Erro ao salvar nota na fila local (armazenamento indisponível?):", erro);
        return false;
    }
}

async function atualizarNotaFila(idLocal, alteracoes) {
    try {
        const db = await abrirDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NOME, "readwrite");
            const store = tx.objectStore(STORE_NOME);
            const getReq = store.get(idLocal);
            getReq.onsuccess = () => {
                const atual = getReq.result;
                if (atual) {
                    store.put({ ...atual, ...alteracoes });
                }
            };
            getReq.onerror = () => reject(getReq.error);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (erro) {
        console.error("Erro ao atualizar nota na fila local (IndexedDB):", erro);
    }
}

async function removerNotaFila(idLocal) {
    try {
        const db = await abrirDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NOME, "readwrite");
            tx.objectStore(STORE_NOME).delete(idLocal);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (erro) {
        console.error("Erro ao remover nota da fila local (IndexedDB):", erro);
    }
}

function proximoAtraso(tentativas) {
    const indice = Math.min(tentativas, ATRASOS_RETRY_MS.length - 1);
    return ATRASOS_RETRY_MS[indice];
}

// Uma nota só pode ser enviada se tiver uma imagem válida em base64.
// Notas de antes dessa correção (ou qualquer outra corrompida por algum
// motivo) guardaram a imagem de um jeito que não sobreviveu na fila local
// — pra essas, tentar de novo NUNCA vai dar certo.
function notaTemImagemValida(nota) {
    return typeof nota.imgBase64 === "string" && nota.imgBase64.startsWith("data:");
}

// Uma nota é "de hoje" se foi criada depois da meia-noite (hora local) de
// hoje. Roda toda vez que a página carrega — não só uma vez — como rede de
// segurança permanente.
function notaEDeHoje(nota) {
    const inicioDeHoje = new Date();
    inicioDeHoje.setHours(0, 0, 0, 0);
    return (nota.idLocal || 0) >= inicioDeHoje.getTime();
}

// Varre a fila ao carregar a página e descarta: (1) qualquer nota de antes
// de hoje — se ainda está pendente, o entregador já deve ter refeito essa
// entrega na mão, então reenviá-la geraria duplicata — e (2) qualquer nota
// sem imagem válida, que nunca vai conseguir ser enviada de jeito nenhum.
async function limparFilaAntigaOuIrrecuperavel() {
    const notas = await obterFila();
    const mantidas = notas.filter(n => notaEDeHoje(n) && notaTemImagemValida(n));
    const removidasPorSerAntiga = notas.filter(n => !notaEDeHoje(n)).length;
    const removidasPorImagem = notas.filter(n => notaEDeHoje(n) && !notaTemImagemValida(n)).length;
    const totalRemovidas = notas.length - mantidas.length;

    if (totalRemovidas > 0) {
        await salvarFila(mantidas);

        const partes = [];
        if (removidasPorSerAntiga > 0) {
            partes.push(`${removidasPorSerAntiga} de antes de hoje (evitando duplicata)`);
        }
        if (removidasPorImagem > 0) {
            partes.push(`${removidasPorImagem} sem imagem salva`);
        }

        mostrarFeedback(
            `${totalRemovidas} nota${totalRemovidas > 1 ? "s" : ""} removida${totalRemovidas > 1 ? "s" : ""} da fila: ${partes.join(" e ")}.`,
            "erro"
        );
    }

    return totalRemovidas;
}

// =========================
// Indicador visual da fila
// =========================
async function atualizarIndicadorFila() {
    if (!filaPendentesEl) return;

    const notas = await obterFila();

    if (notas.length === 0) {
        filaPendentesEl.textContent = "";
        filaPendentesEl.className = "fila-pendentes";
        return;
    }

    const enviandoAgora = notas.some(n => idsEmEnvio.has(n.idLocal));
    const plural = notas.length > 1 ? "s" : "";
    const notaComSessaoExpirada = notas.find(n => n.precisaLogin);

    if (notaComSessaoExpirada) {
        // Retentar não resolve sozinho quando o problema é a sessão — avisa
        // de forma bem visível em vez de deixar tentando pra sempre calado.
        filaPendentesEl.textContent = `⚠️ Sessão expirada — ${notas.length} nota${plural} não conseguiram ser enviadas. Saia e faça login de novo (as notas continuam guardadas e serão enviadas assim que você entrar de novo).`;
        filaPendentesEl.className = "fila-pendentes fila-pendentes--urgente";
        return;
    }

    if (enviandoAgora) {
        filaPendentesEl.textContent = `Enviando nota pendente... (${notas.length} na fila)`;
        filaPendentesEl.className = "fila-pendentes fila-pendentes--ativa";
        return;
    }

    const notaComErro = notas.find(n => n.ultimoErro);
    filaPendentesEl.textContent = notaComErro
        ? `${notas.length} nota${plural} aguardando envio (última falha: ${notaComErro.ultimoErro}). Tentando de novo automaticamente.`
        : `${notas.length} nota${plural} aguardando envio — tentando novamente automaticamente.`;
    filaPendentesEl.className = "fila-pendentes fila-pendentes--ativa";
}

// =========================
// Enviar nota ao servidor
// =========================
async function enviarNotaServidor(nota) {
    const formData = new FormData();
    formData.append("idCliente", nota.idCliente);
    formData.append("cliente", nota.cliente);
    formData.append("numeroNota", nota.numeroNota);
    formData.append("valor", nota.valor);
    formData.append("dataEmissao", nota.dataEmissao);
    formData.append("pago", Boolean(nota.pago));
    formData.append("enviado", false);
    formData.append("entregadorId", nota.entregadorId || "");
    formData.append("entregador", nota.entregador || "");
    formData.append("img", base64ParaBlob(nota.imgBase64), nota.imgNome || "nota.jpg");

    const resposta = await fetch(`${API_URL}/notas`, {
        method: "POST",
        body: formData,
        credentials: "include"
    });

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
        // O backend às vezes responde com a chave "erro" (a maioria das
        // rotas) e às vezes com "error" — sem checar as duas, a mensagem
        // real (ex: sessão expirada) era descartada e virava sempre um
        // "Erro ao cadastrar nota." genérico, impossível de diagnosticar.
        const mensagem = dados.erro || dados.error || "Erro ao cadastrar nota.";
        const erro = new Error(mensagem);
        erro.status = resposta.status;
        erro.precisaLogin = resposta.status === 401;
        throw erro;
    }

    return dados;
}

// Tenta enviar UMA nota da fila. Em caso de falha, agenda a próxima
// tentativa (15s / 30s / 40s / 40s / 40s...) em vez de desistir — exceto
// quando a falha é de sessão expirada (401): nesse caso, continuar
// tentando não resolve nada sozinho, então avisamos bem visível em vez de
// deixar o entregador achar que "está tudo enviando" silenciosamente.
async function tentarEnviarNota(nota) {
    if (idsEmEnvio.has(nota.idLocal)) return;

    if (!notaTemImagemValida(nota) || !notaEDeHoje(nota)) {
        // Trava de segurança: mesmo que essa nota tenha passado pela
        // varredura inicial, se ela não tem imagem válida OU já é de um
        // dia anterior (o entregador já deve ter refeito na mão — reenviar
        // geraria duplicata), não adianta tentar de novo — descarta.
        await removerNotaFila(nota.idLocal);
        await atualizarIndicadorFila();
        return;
    }

    idsEmEnvio.add(nota.idLocal);
    await atualizarIndicadorFila();

    try {
        await enviarNotaServidor(nota);
        await removerNotaFila(nota.idLocal);
        mostrarFeedback("Nota enviada com sucesso!", "sucesso");
    } catch (erro) {
        console.error("Falha ao enviar nota da fila:", erro);
        const tentativas = (nota.tentativas || 0) + 1;
        const atraso = proximoAtraso(tentativas);
        await atualizarNotaFila(nota.idLocal, {
            status: "erro",
            tentativas,
            proximaTentativa: Date.now() + atraso,
            ultimoErro: erro.message || "Erro desconhecido.",
            precisaLogin: Boolean(erro.precisaLogin)
        });
    } finally {
        idsEmEnvio.delete(nota.idLocal);
        await atualizarIndicadorFila();
    }
}

// Percorre a fila e envia (em sequência) todas as notas cuja hora de tentar
// de novo já chegou. Chamado pelo ticker periódico, ao recarregar a página,
// e quando a conexão volta.
async function processarFila() {
    const agora = Date.now();
    const todasNotas = await obterFila();
    const notas = todasNotas.filter(n =>
        !idsEmEnvio.has(n.idLocal) &&
        (n.proximaTentativa || 0) <= agora
    );

    for (const nota of notas) {
        await tentarEnviarNota(nota);
    }
}

setInterval(processarFila, INTERVALO_TICKER_MS);
window.addEventListener("online", processarFila);

// =========================
// Auto-atualização
// Fica checando de tempos em tempos se foi publicada uma versão nova do
// app. Se sim — e não tiver nenhum envio em andamento nesse instante, pra
// não interromper um upload — recarrega a página sozinha. O rascunho
// (sessionStorage) e a fila de notas (IndexedDB) sobrevivem ao reload,
// então isso é seguro mesmo no meio do preenchimento.
// =========================
async function verificarNovaVersao() {
    try {
        const resposta = await fetch(`${API_URL}/versao?_=${Date.now()}`, { cache: "no-store" });
        if (!resposta.ok) return;

        const dados = await resposta.json();
        if (!dados.versao || dados.versao === VERSAO_APP) return;

        if (idsEmEnvio.size > 0) return; // tenta de novo na próxima checagem

        // Cache-bust na própria URL da página, pra garantir que o
        // navegador busque o HTML (e não sirva uma cópia antiga do cache).
        const url = new URL(window.location.href);
        url.searchParams.set("_v", Date.now());
        window.location.replace(url.toString());
    } catch (erro) {
        console.error("Erro ao checar versão do app:", erro);
        // silencioso — só tenta de novo na próxima checagem
    }
}

setInterval(verificarNovaVersao, INTERVALO_VERSAO_MS);

// =========================
// Marcar nota como já paga
// =========================
if (btnNotaJaPaga && inputNotaJaPaga) {
    btnNotaJaPaga.addEventListener("click", () => {
        const ativo = inputNotaJaPaga.value === "true";
        inputNotaJaPaga.value = ativo ? "false" : "true";
        btnNotaJaPaga.setAttribute("aria-pressed", String(!ativo));
        btnNotaJaPaga.classList.toggle("ativo", !ativo);
        btnNotaJaPaga.textContent = !ativo ? "✅ Nota será registrada como paga" : "💰 Registrar como já paga";
        salvarRascunho();
    });
}

// =========================
// Submit do formulário
// =========================
formEntrega.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!clienteSelecionado) {
        mostrarFeedback("Selecione um cliente válido.", "erro");
        return;
    }

    if (!inputImagem.files.length) {
        mostrarFeedback("Selecione uma imagem.", "erro");
        return;
    }

    btnEnviar.disabled = true;
    btnEnviar.textContent = "Adicionando à fila...";

    let imgBase64;
    try {
        imgBase64 = await prepararImagemParaFila(inputImagem.files[0]);
    } catch (erro) {
        console.error(erro);
        mostrarFeedback("Não foi possível ler a imagem selecionada. Tente novamente.", "erro");
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Enviar";
        return;
    }

    const nota = {
        idLocal: Date.now(),
        idCliente: clienteSelecionado._id,
        cliente: clienteSelecionado.cliente.trim(),
        numeroNota,
        valor: inputValor.value.trim(),
        dataEmissao: obterDataLocalISO(new Date()),
        imgBase64,
        // A foto é reexportada como JPEG na compressão, então o nome do
        // arquivo original (que pode ser .png, .heic, etc.) não bate mais
        // com o conteúdo real — troca a extensão pra refletir isso.
        imgNome: (inputImagem.files[0].name || "nota").replace(/\.[^.]+$/, "") + ".jpg",
        pago: inputNotaJaPaga?.value === "true",
        entregadorId: entregadorAtual ? entregadorAtual.id : null,
        entregador: entregadorAtual ? entregadorAtual.nome : "",
        status: "pendente",
        tentativas: 0,
        proximaTentativa: Date.now()
    };

    const guardouLocal = await salvarNotaLocal(nota);
    await atualizarIndicadorFila();

    if (!guardouLocal) {
        // Não deu pra guardar a nota de forma durável (ex: modo privado do
        // navegador bloqueando o IndexedDB, ou cota realmente esgotada no
        // aparelho). Sem isso, NÃO dá pra confiar na fila: se limparmos o
        // formulário aqui, a nota se perde de vez caso o envio direto
        // também falhe. Então, nesse caso específico, voltamos ao
        // comportamento seguro — tenta enviar na hora e só limpa os campos
        // se der certo; se falhar, mantém tudo preenchido pro entregador
        // tentar de novo sem precisar redigitar nada.
        mostrarFeedback("Não foi possível guardar a nota localmente. Tentando enviar agora — aguarde a confirmação antes de sair da tela.", "erro");
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Enviar";

        try {
            await enviarNotaServidor(nota);
            mostrarFeedback("Nota enviada com sucesso!", "sucesso");
        } catch (erro) {
            console.error("Falha ao enviar nota sem backup local:", erro);
            mostrarFeedback("Não foi possível enviar e o armazenamento local está indisponível. Tente novamente em instantes, ou feche e reabra o app.", "erro");
            return; // mantém os campos preenchidos — nada foi perdido
        }
    } else {
        mostrarFeedback("Nota adicionada à fila de envio.", "info");
    }

    // Chegou aqui só quando a nota está garantida: ou guardada na fila
    // durável, ou já confirmada como enviada. Agora sim é seguro limpar o
    // formulário sem risco de perder o que o entregador preencheu.
    limparRascunho();
    formEntrega.reset();
    nomeArquivo.textContent = "Nenhum arquivo selecionado";
    if (inputNotaJaPaga && btnNotaJaPaga) {
        inputNotaJaPaga.value = "false";
        btnNotaJaPaga.setAttribute("aria-pressed", "false");
        btnNotaJaPaga.classList.remove("ativo");
        btnNotaJaPaga.textContent = "💰 Registrar como já paga";
    }
    clienteSelecionado = null;
    numeroNota = 1;

    btnEnviar.disabled = false;
    btnEnviar.textContent = "Enviar";

    // Tenta enviar imediatamente; se falhar, o ticker da fila cuida do
    // reenvio sozinho — não precisa esperar o resultado aqui.
    processarFila();
});

// =========================
// Inicialização
// =========================
(async function iniciar() {
    const sessaoValida = await verificarSessaoEntregador();
    if (!sessaoValida) return;

    await carregarClientes();
    restaurarRascunho();

    // Descarta de cara qualquer nota antiga que nunca vai conseguir ser
    // enviada (ex: de uma versão anterior onde a imagem não sobreviveu na
    // fila local), pra não ficar presa reprocessando pra sempre.
    await limparFilaAntigaOuIrrecuperavel();

    // Retoma qualquer nota que ficou pendente de uma sessão anterior
    // (ex: o entregador fechou o app ou perdeu sinal antes de terminar).
    await atualizarIndicadorFila();
    processarFila();
})();
