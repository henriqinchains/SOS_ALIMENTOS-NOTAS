const API_URL = "https://sos-alimentos-servidor.onrender.com/api";

const formEntrega = document.getElementById("form-entrega");
const inputCliente = document.getElementById("cliente");
const inputValor = document.getElementById("valorNota");
const inputImagem = document.getElementById("imagemNota");
const inputNotaJaPaga = document.getElementById("notaJaPagaEntrega");
const btnNotaJaPaga = document.getElementById("btnNotaJaPagaEntrega");
const nomeArquivo = document.getElementById("nomeArquivo");
const listaClientes = document.getElementById("lista-clientes");
const feedback = document.getElementById("feedback");

let todosClientes = [];
let clienteSelecionado = null;
let numeroNota = 1;

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
let entregadorAtual = null;

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
// LocalStorage helpers
// =========================
function salvarNotaLocal(nota) {
    let notas = JSON.parse(localStorage.getItem("notasPendentes")) || [];
    notas.push(nota);
    localStorage.setItem("notasPendentes", JSON.stringify(notas));
}

function atualizarStatusNota(idLocal, status) {
    let notas = JSON.parse(localStorage.getItem("notasPendentes")) || [];
    notas = notas.map(n => n.idLocal === idLocal ? { ...n, status } : n);
    localStorage.setItem("notasPendentes", JSON.stringify(notas));
}

// =========================
// Enviar nota ao servidor
// =========================
async function enviarNotaServidor(nota, idLocal) {
    const formData = new FormData();
    formData.append("idCliente", nota.idCliente);
    formData.append("cliente", nota.cliente);
    formData.append("numeroNota", nota.numeroNota);
    formData.append("valor", nota.valor);
    formData.append("dataEmissao", nota.dataEmissao);
    formData.append("pago", Boolean(nota.pago));
    formData.append("enviado", false);
    formData.append("img", nota.img);
    // incluir identificador e nome do entregador (compatibilidade com backend)
    formData.append("entregadorId", nota.entregadorId || "");
    formData.append("entregador", nota.entregador || "");

    try {
        const resposta = await fetch(`${API_URL}/notas`, {
            method: "POST",
            body: formData,
            credentials: "include"
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.error || "Erro ao cadastrar nota.");
        }

        atualizarStatusNota(idLocal, "enviado");
        mostrarFeedback("Nota enviada com sucesso!", "sucesso");

    } catch (erro) {
        console.error(erro);
        atualizarStatusNota(idLocal, "erro");
        mostrarFeedback("Erro ao enviar nota. Ela ficará salva localmente e será reenviada.", "erro");
    }
}

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

    const idLocal = Date.now();
    const nota = {
        idLocal,
        idCliente: clienteSelecionado._id,
        cliente: clienteSelecionado.cliente.trim(),
        numeroNota,
        valor: inputValor.value.trim(),
        dataEmissao: obterDataLocalISO(new Date()),
        img: inputImagem.files[0],
        pago: inputNotaJaPaga?.value === "true",
        entregadorId: entregadorAtual ? entregadorAtual.id : null,
        entregador: entregadorAtual ? entregadorAtual.nome : "",
        status: "pendente"
    };

    salvarNotaLocal(nota);
    mostrarFeedback("Nota registrada localmente. Realizando envio...", "info");

    enviarNotaServidor(nota, idLocal);

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
    // Limpar possível estado de entregador armazenado localmente para evitar
    // reuso indesejado em envios subsequentes.
    entregadorAtual = null;
});

// =========================
// Inicialização
// =========================
(async function iniciar() {
    const sessaoValida = await verificarSessaoEntregador();
    if (!sessaoValida) return;

    carregarClientes();

})();