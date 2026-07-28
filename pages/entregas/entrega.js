const API_URL = "https://sos-alimentos-servidor.onrender.com/api";

const formEntrega = document.getElementById("form-entrega");
const inputCliente = document.getElementById("cliente");
const inputValor = document.getElementById("valorNota");
const inputImagem = document.getElementById("imagemNota");
const nomeArquivo = document.getElementById("nomeArquivo");

inputImagem.addEventListener("change", () => {
    nomeArquivo.textContent = inputImagem.files.length
        ? inputImagem.files[0].name
        : "Nenhum arquivo selecionado";
});
const listaClientes = document.getElementById("lista-clientes");

let todosClientes = [];
let clienteSelecionado = null;
let numeroNota = 1;

// =========================
// Sessão / controle de acesso
// =========================
// Esta página é exclusiva do entregador. Admin e financeiro não podem
// acessá-la, e usuário sem sessão válida é mandado de volta pro login.
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
        alert("Erro ao carregar clientes.");
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

// Fecha a lista ao clicar fora do campo de autocomplete
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

        // Mesmo critério usado no painel admin: casa por nome do cliente, não
        // por idCliente — várias notas no banco têm idCliente vazio/inconsistente,
        // o que fazia a contagem vir errada e toda nota nova sair como "1".
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
// Enviar nota
// =========================
formEntrega.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!clienteSelecionado) {
        alert("Selecione um cliente válido.");
        return;
    }

    if (!inputImagem.files.length) {
        alert("Selecione uma imagem.");
        return;
    }

    const formData = new FormData();

    formData.append("idCliente", clienteSelecionado._id);
    formData.append("cliente", clienteSelecionado.cliente);
    formData.append("numeroNota", numeroNota);
    formData.append("valor", inputValor.value);
    formData.append("dataEmissao", new Date().toISOString());
    formData.append("pago", false);
    formData.append("enviado", false);
    formData.append("img", inputImagem.files[0]);

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

        alert("Nota cadastrada com sucesso!");

        formEntrega.reset();
        nomeArquivo.textContent = "Nenhum arquivo selecionado";
        clienteSelecionado = null;
        numeroNota = 1;

    } catch (erro) {
        console.error(erro);
        alert(erro.message);
    }
});

// =========================
// Inicialização
// =========================
(async function iniciar() {
    const sessaoValida = await verificarSessaoEntregador();
    if (!sessaoValida) return; // já redirecionou, não carrega mais nada

    carregarClientes();
})();