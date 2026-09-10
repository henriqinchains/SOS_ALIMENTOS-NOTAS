const API_URL = "https://sos-alimentos-servidor.onrender.com/api";
const CHAVE_FILA = "notasPendentes";

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
    if (!texto) {
        listaClientes.innerHTML = "";
        return;
    }

    mostrarSugestoes(texto);
});

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
// dentro do localStorage — um File/Blob "cru" não sobrevive ao JSON.stringify)
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
// Fila local (localStorage) — sobrevive a recarregar a página
// =========================
function obterFila() {
    try {
        return JSON.parse(localStorage.getItem(CHAVE_FILA)) || [];
    } catch (erro) {
        console.error("Fila local corrompida, reiniciando:", erro);
        return [];
    }
}

function salvarFila(notas) {
    try {
        localStorage.setItem(CHAVE_FILA, JSON.stringify(notas));
        return true;
    } catch (erro) {
        // Provavelmente estourou o limite de armazenamento do navegador
        // (fotos em base64 ocupam espaço). A nota ainda assim será tentada
        // agora mesmo, só não fica garantida a sobrevivência a um reload.
        console.error("Erro ao salvar fila local (armazenamento cheio?):", erro);
        return false;
    }
}

function salvarNotaLocal(nota) {
    const notas = obterFila();
    notas.push(nota);
    return salvarFila(notas);
}

function atualizarNotaFila(idLocal, alteracoes) {
    const notas = obterFila().map(n => n.idLocal === idLocal ? { ...n, ...alteracoes } : n);
    salvarFila(notas);
}

function removerNotaFila(idLocal) {
    const notas = obterFila().filter(n => n.idLocal !== idLocal);
    salvarFila(notas);
}

function proximoAtraso(tentativas) {
    const indice = Math.min(tentativas, ATRASOS_RETRY_MS.length - 1);
    return ATRASOS_RETRY_MS[indice];
}

// =========================
// Indicador visual da fila
// =========================
function atualizarIndicadorFila() {
    if (!filaPendentesEl) return;

    const notas = obterFila();

    if (notas.length === 0) {
        filaPendentesEl.textContent = "";
        filaPendentesEl.className = "fila-pendentes";
        return;
    }

    const enviandoAgora = notas.some(n => idsEmEnvio.has(n.idLocal));
    const plural = notas.length > 1 ? "s" : "";

    filaPendentesEl.textContent = enviandoAgora
        ? `Enviando nota pendente... (${notas.length} na fila)`
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
        throw new Error(dados.error || "Erro ao cadastrar nota.");
    }

    return dados;
}

// Tenta enviar UMA nota da fila. Em caso de falha, agenda a próxima
// tentativa (15s / 30s / 40s / 40s / 40s...) em vez de desistir.
async function tentarEnviarNota(nota) {
    if (idsEmEnvio.has(nota.idLocal)) return;

    idsEmEnvio.add(nota.idLocal);
    atualizarIndicadorFila();

    try {
        await enviarNotaServidor(nota);
        removerNotaFila(nota.idLocal);
        mostrarFeedback("Nota enviada com sucesso!", "sucesso");
    } catch (erro) {
        console.error("Falha ao enviar nota da fila:", erro);
        const tentativas = (nota.tentativas || 0) + 1;
        const atraso = proximoAtraso(tentativas);
        atualizarNotaFila(nota.idLocal, {
            status: "erro",
            tentativas,
            proximaTentativa: Date.now() + atraso
        });
    } finally {
        idsEmEnvio.delete(nota.idLocal);
        atualizarIndicadorFila();
    }
}

// Percorre a fila e envia (em sequência) todas as notas cuja hora de tentar
// de novo já chegou. Chamado pelo ticker periódico, ao recarregar a página,
// e quando a conexão volta.
async function processarFila() {
    const agora = Date.now();
    const notas = obterFila().filter(n =>
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
// Marcar nota como já paga
// =========================
if (btnNotaJaPaga && inputNotaJaPaga) {
    btnNotaJaPaga.addEventListener("click", () => {
        const ativo = inputNotaJaPaga.value === "true";
        inputNotaJaPaga.value = ativo ? "false" : "true";
        btnNotaJaPaga.setAttribute("aria-pressed", String(!ativo));
        btnNotaJaPaga.classList.toggle("ativo", !ativo);
        btnNotaJaPaga.textContent = !ativo ? "✅ Nota será registrada como paga" : "💰 Registrar como já paga";
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
        imgBase64 = await arquivoParaBase64(inputImagem.files[0]);
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
        imgNome: inputImagem.files[0].name || "nota.jpg",
        pago: inputNotaJaPaga?.value === "true",
        entregadorId: entregadorAtual ? entregadorAtual.id : null,
        entregador: entregadorAtual ? entregadorAtual.nome : "",
        status: "pendente",
        tentativas: 0,
        proximaTentativa: Date.now()
    };

    const guardouLocal = salvarNotaLocal(nota);
    atualizarIndicadorFila();

    mostrarFeedback(
        guardouLocal
            ? "Nota adicionada à fila de envio."
            : "Armazenamento local cheio — tentando enviar agora mesmo.",
        "info"
    );

    // Limpa o formulário na hora: a nota já está guardada de forma durável
    // (sobrevive a recarregar a página) e será enviada em segundo plano,
    // com novas tentativas automáticas em 15s, 30s e 40s caso o sinal falhe.
    // O entregador não precisa esperar nem preencher tudo de novo.
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

    carregarClientes();

    // Retoma qualquer nota que ficou pendente de uma sessão anterior
    // (ex: o entregador fechou o app ou perdeu sinal antes de terminar).
    atualizarIndicadorFila();
    processarFila();
})();
