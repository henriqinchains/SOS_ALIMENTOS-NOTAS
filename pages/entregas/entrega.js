const API_URL = "https://sos-alimentos-servidor.onrender.com/api";

const formEntrega = document.getElementById("form-entrega");
const inputCliente = document.getElementById("cliente");
const inputValor = document.getElementById("valorNota");
const inputImagem = document.getElementById("imagemNota");
const listaClientes = document.getElementById("lista-clientes");

let todosClientes = [];
let clienteSelecionado = null;
let numeroNota = 1;

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

        listaClientes.innerHTML = "";

        todosClientes.forEach(cliente => {
            const option = document.createElement("option");
            option.value = cliente.cliente;
            listaClientes.appendChild(option);
        });

    } catch (erro) {
        console.error(erro);
        alert("Erro ao carregar clientes.");
    }
}

// =========================
// Buscar cliente selecionado
// =========================
inputCliente.addEventListener("change", buscarClienteSelecionado);

async function buscarClienteSelecionado() {
    const nome = inputCliente.value.trim();

    clienteSelecionado = todosClientes.find(c =>
        c.cliente.toLowerCase() === nome.toLowerCase()
    );

    if (!clienteSelecionado) {
        numeroNota = 1;
        return;
    }

    await buscarNumeroNota(clienteSelecionado._id);
}

// =========================
// Buscar próximo número da nota
// =========================
async function buscarNumeroNota(idCliente) {
    try {
        const resposta = await fetch(`${API_URL}/notas?_=${Date.now()}`, {
            credentials: "include"
        });

        if (!resposta.ok) {
            throw new Error("Erro ao buscar notas.");
        }

        const notas = await resposta.json();

        const notasCliente = notas.filter(n =>
            String(n.idCliente) === String(idCliente)
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
carregarClientes();