const links = document.querySelectorAll(".nav-links a");
const sections = document.querySelectorAll("main section");

const clientesConteudo = document.getElementById("clientesConteudo");
const menu = document.getElementById("clientes-menu");

const btnPesquisarCliente = document.getElementById("btnPesquisarCliente");

const btnAbrirModal = document.getElementById("btnAbrirModalCliente");
const modalContainer = document.getElementById("modal-container");
const formAvaliacao = document.getElementById("formAvaliacao");
const btnSubmit = document.getElementById("btnSubmit");
const btnFecharModal = document.getElementById("btn-fechar-modal");

let todosClientes = [];

document.addEventListener("DOMContentLoaded", () => {

    atualizarRelogio();
    setInterval(atualizarRelogio, 1000);

    carregarClientes();

    // Navegação
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

    // Abrir modal
    if (btnAbrirModal) {
        btnAbrirModal.addEventListener("click", (e) => {
            e.preventDefault();
            modalContainer.style.display = "flex";
            document.body.style.overflow = "hidden";
        });
    }

    // Fechar modal
    function fecharModal() {
        modalContainer.style.display = "none";
        document.body.style.overflow = "";

        if (formAvaliacao) {
            formAvaliacao.reset();
        }
    }

    if (btnFecharModal) {
        btnFecharModal.addEventListener("click", fecharModal);
    }

    window.addEventListener("mousedown", (e) => {
        if (e.target === modalContainer) {
            fecharModal();
        }
    });

    // Formulário
    if (formAvaliacao) {
        formAvaliacao.addEventListener("submit", async (e) => {
            e.preventDefault();

            btnSubmit.disabled = true;
            btnSubmit.innerText = "Enviando...";

            try {

                const formData = new FormData(formAvaliacao);

                const resposta = await fetch("https://sos-alimentos-servidor.onrender.com/api/clientes", {
                    method: "POST",
                    body: formData
                });

                const dados = await resposta.json();

                if (resposta.ok) {
                    alert("Cliente cadastrado com sucesso!");
                    fecharModal();
                    carregarClientes();
                } else {
                    alert(dados.erro || "Erro ao cadastrar.");
                }

            } catch (erro) {
                console.error(erro);
                alert("Erro ao conectar ao servidor.");
            }

            btnSubmit.disabled = false;
            btnSubmit.innerText = "Cadastrar";
        });
    }

    async function carregarClientes() {

        try {

            clientesConteudo.innerHTML = "Carregando...";

            const resposta = await fetch("https://sos-alimentos-servidor.onrender.com/api/clientes");

            const clientes = await resposta.json();

            todosClientes = clientes;

            renderClientes(clientes);

        } catch {

            clientesConteudo.innerHTML = "Erro ao carregar clientes.";

        }

    }

    btnPesquisarCliente.addEventListener("click", carregarClientes);

    function renderClientes(clientes) {

        clientesConteudo.innerHTML = "";

        // Toolbar
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

            <button id="carregarClientes">
                🔄 Atualizar
            </button>
        `;

        clientesConteudo.appendChild(toolbar);

        // Eventos da toolbar
        const ordenar = toolbar.querySelector("#ordenarClientes");
        const filtrar = toolbar.querySelector("#filtrarClientes");
        const btnCarregarClientes = toolbar.querySelector("#carregarClientes");

        btnCarregarClientes.addEventListener("click", carregarClientes);

        ordenar.addEventListener("change", (e) => {

            let lista = [...todosClientes];

            switch (e.target.value) {

                case "nome":
                    lista.sort((a, b) => a.cliente.localeCompare(b.cliente));
                    break;

                case "cidade":
                    lista.sort((a, b) =>
                        (a.cidade || "").localeCompare(b.cidade || "")
                    );
                    break;
            }

            renderClientes(lista);

        });

        filtrar.addEventListener("change", (e) => {

            let lista = [...todosClientes];

            switch (e.target.value) {

                case "comEmail":
                    lista = lista.filter(c => c.email);
                    break;

                case "semEmail":
                    lista = lista.filter(c => !c.email);
                    break;
            }

            renderClientes(lista);

        });

        if (clientes.length === 0) {

            const aviso = document.createElement("p");
            aviso.textContent = "Nenhum cliente encontrado.";
            clientesConteudo.appendChild(aviso);
            return;

        }

        clientes.forEach(c => {

            const card = document.createElement("div");
            card.classList.add("cliente-card");

            card.innerHTML = `
                <div class="cliente-topo">
                    <h3>${c.cliente}</h3>
                    <span class="cliente-id">ID: ${c.id ?? "-"}</span>
                </div>

                <p class="cliente-rua">
                    ${c.rua || "Rua não cadastrada"}
                </p>

                <p class="cliente-bairro">
                    ${c.bairro || "Bairro não cadastrado"}
                </p>

                <div class="cliente-acoes">
                    <button class="btn-ver">Ver</button>
                    <button class="btn-editar">Editar</button>
                </div>
            `;

            clientesConteudo.appendChild(card);

        });

    }

    // Relógio da página inicial
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

        document.getElementById("horaAtual").textContent = hora;
        document.getElementById("dataAtual").textContent =
            `${dias[agora.getDay()]}, ${data}`;

    }

    atualizarRelogio();

    setInterval(atualizarRelogio, 1000);

});