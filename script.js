const links = document.querySelectorAll(".nav-links a");
const sections = document.querySelectorAll("main section");

const clientesConteudo = document.getElementById("clientesConteudo");
const menu = document.getElementById("clientes-menu");

const btnPesquisarCliente = document.getElementById("btnPesquisarCliente");

const btnAbrirModal = document.getElementById("btnAbrirModalCliente");
const modalContainer = document.getElementById("modal-container");

const formNovoCliente = document.getElementById("formNovoCliente");
const btnSubmitCliente = document.getElementById("btnSubmitCliente");
const btnSubmitNota = document.getElementById("btnSubmitNota")
const btnFecharModal = document.getElementById("btn-fechar-modal");

const btnAbrirModalNota = document.getElementById("btnNovaNota");
const modalContainerNota = document.getElementById("modal-containerNota");
const btnFecharModalNota = document.getElementById("btn-fechar-modal-nota");

const formNota = document.getElementById("formNota");

const inputClienteNota = document.getElementById("clienteNota");
const inputIdCliente = document.getElementById("idCliente");
const inputEmailNota = document.getElementById("email");
const inputNumeroNota = document.getElementById("numeroNota");
const inputDataEmissao = document.getElementById("dataEmissao");

const listaClientes = document.getElementById("listaClientes");

let todosClientes = [];

async function gerarID() {
    try {
        const resposta = await fetch("https://sos-alimentos-servidor.onrender.com/api/clientes");
        const clientes = await resposta.json();
        return (clientes.length + 1).toString();
    } catch {
        return Date.now().toString();
    }
}

document.addEventListener("DOMContentLoaded", () => {


    if (btnAbrirModalNota) {
        btnAbrirModalNota.addEventListener("click", () => {

            modalContainerNota.style.display = "flex";
            document.body.style.overflow = "hidden";

            formNota.reset();

            inputIdCliente.value = "";
            inputNumeroNota.value = "";
            inputEmailNota.value = "";

            inputDataEmissao.value = new Date().toISOString().split("T")[0];

            preencherListaClientes();

            inputClienteNota.focus();

        });
    }

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

        if (formNovoCliente) {
            formNovoCliente.reset();
        }
    }

    if (btnFecharModal) {
        btnFecharModal.addEventListener("click", fecharModal);
    }


    // Fechar modal nota
    function fecharModalNota() {

        modalContainerNota.style.display = "none";

        document.body.style.overflow = "";

        formNota.reset();

        inputIdCliente.value = "";
        inputNumeroNota.value = "";

    }

    btnFecharModalNota.addEventListener("click", fecharModalNota);

    window.addEventListener("mousedown", (e) => {
        if (e.target === modalContainer) {
            fecharModal();
            fecharModalNota();
        }
    });

    // Formulário
    if (formNovoCliente) {
        formNovoCliente.addEventListener("submit", async (e) => {
            e.preventDefault();

            btnSubmitCliente.disabled = true;
            btnSubmitCliente.innerText = "Enviando...";

            try {

                const formData = new FormData(formNovoCliente);
                const dados = Object.fromEntries(formData);
                dados.id = await gerarID();

                const resposta = await fetch("https://sos-alimentos-servidor.onrender.com/api/clientes", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                });

                const respostaData = await resposta.json();

                if (resposta.ok) {
                    alert("Cliente cadastrado com sucesso!");
                    fecharModal();
                    carregarClientes();
                } else {
                    alert(respostaData.erro || "Erro ao cadastrar.");
                }

            } catch (erro) {
                console.error(erro);
                alert("Erro ao conectar ao servidor.");
            }

            btnSubmitCliente.disabled = false;
            btnSubmitCliente.innerText = "Cadastrar";
        });
    }

    if (formNota) {
        formNota.addEventListener("submit", async (e) => {
            e.preventDefault();

            const btnSubmitNota = document.getElementById("btnSubmitNota");

            btnSubmitNota.disabled = true;
            btnSubmitNota.innerText = "Enviando...";

            try {

                const formData = new FormData(formNota);
                const dados = Object.fromEntries(formData);

                const payload = {
                    cliente: dados.cliente,
                    email: dados.email || null,
                    valor: dados.valor
                };

                const resposta = await fetch("https://sos-alimentos-servidor.onrender.com/api/notas", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });

                const respostaData = await resposta.json();

                if (resposta.ok) {
                    alert("Nota registrada com sucesso!");
                    formNota.reset();
                    document.getElementById("modal-containerNota").style.display = "none";
                } else {
                    alert(respostaData.error || "Erro ao cadastrar nota.");
                }

            } catch (erro) {
                console.error(erro);
                alert("Erro ao conectar ao servidor.");
            }

            btnSubmitNota.disabled = false;
            btnSubmitNota.innerText = "Registrar Nota";
        });
    }


    //carregar clientes pra exibiccao
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

    //autocompletando cliente

    inputClienteNota.addEventListener("input", () => {
        if (inputClienteNota.value.trim()) {
            preencherListaClientes();
        } else {
            listaClientes.classList.remove("active");
            listaClientes.innerHTML = "";
        }
    });

    inputClienteNota.addEventListener("change", buscarClienteSelecionado);

    async function buscarClienteSelecionado() {

        const nomeCliente = inputClienteNota.value.trim();

        if (!nomeCliente) return;

        const cliente = todosClientes.find(c =>
            c.cliente.toLowerCase() === nomeCliente.toLowerCase()
        );

        if (!cliente) {

            inputIdCliente.value = "";
            inputEmailNota.value = "";
            inputNumeroNota.value = 1;
            inputEmailNota.removeAttribute("readonly");

            return;

        }
        else {
            inputEmailNota.value = cliente.email || "";
            inputEmailNota.setAttribute("readonly", true);
        }

        inputIdCliente.value = cliente.id;
        inputEmailNota.value = cliente.email || "";
        inputEmailNota.setAttribute("readonly", true);

        await buscarNumeroNota(cliente.id);

    }

    function mostrarSugestoes(texto) {

        listaClientes.innerHTML = "";

        if (texto.length === 0) {

            listaClientes.style.display = "none";

            return;

        }

        const encontrados = todosClientes.filter(cliente =>

            cliente.cliente
                .toLowerCase()
                .includes(texto.toLowerCase())

        );

        if (encontrados.length === 0) {

            listaClientes.style.display = "none";

            return;

        }

        encontrados.forEach(cliente => {

            const item = document.createElement("div");

            item.className = "autocomplete-item";

            item.textContent = cliente.cliente;

            item.addEventListener("click", () => {

                inputClienteNota.value = cliente.cliente;

                listaClientes.style.display = "none";

                buscarClienteSelecionado();

            });

            listaClientes.appendChild(item);

        });

        listaClientes.style.display = "block";

    }

    inputClienteNota.addEventListener("input", (e) => {

        mostrarSugestoes(e.target.value);

    });

    // Fechar lista de autocomplete quando clicar fora
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".autocomplete")) {
            listaClientes.classList.remove("active");
        }
    });

    async function buscarNumeroNota(idCliente) {

        try {

            const resposta = await fetch("https://sos-alimentos-servidor.onrender.com/api/notas");

            const notas = await resposta.json();

            const notasCliente = notas.filter(n => n.idCliente === idCliente);

            inputNumeroNota.value = notasCliente.length + 1;

        } catch (erro) {

            console.error(erro);

            inputNumeroNota.value = 1;

        }

    }

    //exibicao dos clientes
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
