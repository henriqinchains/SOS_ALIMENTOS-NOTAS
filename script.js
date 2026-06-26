const links = document.querySelectorAll(".nav-links a");
const sections = document.querySelectorAll("main section");
const clientesCadastrados = document.getElementById("clientesCadastrados");

const clientesConteudo = document.getElementById("clientesConteudo")
const menu = document.getElementById("clientes-menu");

const btnPesquisarCliente = document.getElementById("btnPesquisarCliente");


let todosClientes = [];

document.addEventListener("DOMContentLoaded", () => {
    atualizarRelogio();

    setInterval(atualizarRelogio, 1000);

    carregarClientes();
});

links.forEach(link => {
    link.addEventListener("click", (e) => {
        e.preventDefault();

        links.forEach(l => l.classList.remove("active"));
        link.classList.add("active");

        sections.forEach(section => section.hidden = true);

        const page = link.dataset.page;
        const section = document.getElementById(page);

        if (section) {
            section.hidden = false;
        }
    });
});

async function carregarClientes() {
    try {
        clientesConteudo.innerHTML = "Carregando...";

        const resposta = await fetch("https://sos-alimentos-servidor.onrender.com/api/clientes");
        const clientes = await resposta.json();

        todosClientes = clientes;
        renderClientes(clientes);

    } catch (err) {
        clientesConteudo.innerHTML = "Erro ao carregar clientes";
    }
}


//pesquisar clientes
btnPesquisarCliente.addEventListener("click", async () => {
    menu.style.display = "none";

    clientesConteudo.innerHTML = "<p>Carregando clientes...</p>";

    const res = await fetch("https://sos-alimentos-servidor.onrender.com/api/clientes");
    const clientes = await res.json();

    renderClientes(clientes);
    todosClientes = clientes;
});

function renderClientes(clientes) {
    clientesConteudo.innerHTML = "";

    // TOPO
    const toolbar = document.createElement("div");
    toolbar.classList.add("clientes-toolbar");

    toolbar.innerHTML = `
        <select id="ordenarClientes">
            <option value="">Ordenar</option>
            <option value="nome">Nome (A-Z)</option>
            <option value="cidade">Cidade (A-Z)</option>
        </select>
        <select id="filtrarClientes">
            <option value="">Filtrar</option>
            <option value="comEmail">Com email</option>
            <option value="semEmail">Sem email</option>
        </select>

    `;

    clientesConteudo.appendChild(toolbar);

    if (!clientes.length) {
        clientesConteudo.innerHTML += "<p>Nenhum cliente encontrado.</p>";
        return;
    }

    clientes.forEach(c => {
        const card = document.createElement("div");
        card.classList.add("cliente-card");

        card.innerHTML = `
            <div class="cliente-topo">
                <h3>${c.cliente}</h3>
                <span class="cliente-id">id: ${c.id || "-"}</span>
            </div>

            <p class="cliente-rua">${c.rua || "Rua não cadastrada"}</p>
            <p class="cliente-bairro">${c.bairro || "Bairro não cadastrado"}</p>

            <div class="cliente-acoes">
                <button class="btn-ver">Ver</button>
                <button class="btn-editar">Editar</button>
            </div>
        `;

        clientesConteudo.appendChild(card);
    });

    setTimeout(() => {
        const ordenar = document.getElementById("ordenarClientes");
        const filtrar = document.getElementById("filtrarClientes");

        ordenar.addEventListener("change", (e) => {
            let lista = [...clientes];

            if (e.target.value === "nome") {
                lista.sort((a, b) => a.cliente.localeCompare(b.cliente));
            }

            if (e.target.value === "cidade") {
                lista.sort((a, b) => (a.cidade || "").localeCompare(b.cidade || ""));
            }

            renderClientes(lista);
        });

        filtrar.addEventListener("change", (e) => {
            let lista = [...clientes];

            if (e.target.value === "comEmail") {
                lista = lista.filter(c => c.email);
            }

            if (e.target.value === "semEmail") {
                lista = lista.filter(c => !c.email);
            }

            renderClientes(lista);
        });
    }, 0);

}
//pagina inicial
function atualizarRelogio() {
    const agora = new Date();

    const hora = agora.toLocaleTimeString("pt-BR");
    const data = agora.toLocaleDateString("pt-BR");

    const dias = [
        "domingo",
        "segunda-feira",
        "terça-feira",
        "quarta-feira",
        "quinta-feira",
        "sexta-feira",
        "sábado"
    ];

    const diaSemana = dias[agora.getDay()];

    document.getElementById("horaAtual").textContent = hora;
    document.getElementById("dataAtual").textContent = `${diaSemana}, ${data}`;
}

setInterval(atualizarRelogio, 1000);
atualizarRelogio();