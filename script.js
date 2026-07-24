const links = document.querySelectorAll(".nav-links a");
const sections = document.querySelectorAll("main section");

const notasConteudo = document.getElementById("notasConteudo")
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
let contadorNotasPorCliente = new Map(); // clienteId -> elemento <span> da contagem na aba Notas

// AGRUPAMENTO / SELEÇÃO DE NOTAS
// (declarado uma única vez, fora de carregarNotasDoCliente)
let modoSelecao = false;
const notasSelecionadas = new Map(); // nota._id -> { nota, elemento }
let containerSelecaoAtivo = null;
let clienteSelecaoAtivo = null;
let gruposSelecaoAtivo = []; // grupos existentes do cliente que está com seleção ativa
let origemSelecao = null; // 'solta' (notas soltas) ou 'grupo' (notas dentro de um grupo já existente)
let grupoOrigemSelecaoId = null; // qual grupo, quando origemSelecao === 'grupo'
let barraSelecao = null;

let loggedUser = sessionStorage.getItem("cache_usuario") || "";
let userRole = sessionStorage.getItem("cache_cargo") || "user";


async function verificarSessao() {
    try {
        const resposta = await fetch("https://sos-alimentos-servidor.onrender.com/api/auth/me",
            {
                method: "GET",
                credentials: "include",
            },
        );

        if (!resposta.ok) {
            sessionStorage.clear();
            window.location.href = "./pages/login/login.html";
            return false;
        }

        const dadosUsuario = await resposta.json();

        loggedUser = dadosUsuario.nome;
        userRole = dadosUsuario.cargo || "user";

        sessionStorage.setItem("cache_usuario", loggedUser);
        sessionStorage.setItem("cache_cargo", userRole);

        inicializarInterface(dadosUsuario);
        return true;
    } catch (erro) {
        console.error("Erro ao verificar sessão segura:", erro);
        sessionStorage.clear();
        window.location.href = "./pages/login/login.html";
        return false;
    }
}

async function inicializarInterface(usuario) {
    const loggedUserEl = document.getElementById("loggedUser");
    const inputUsuario = document.getElementById("nome");

    if (loggedUserEl) loggedUserEl.textContent = usuario.nome;
    if (inputUsuario) inputUsuario.value = usuario.nome;
}

document.addEventListener("DOMContentLoaded", async () => {

    // CORREÇÃO: sem esta chamada, a sessão nunca era checada e o usuário
    // nunca era redirecionado pro login mesmo sem estar autenticado.
    const sessaoValida = await verificarSessao();
    if (!sessaoValida) return; // já redirecionou pro login, não continua montando a página

    if (btnAbrirModalNota) {
        btnAbrirModalNota.addEventListener("click", () => {
            modalContainerNota.style.display = "flex";
            document.body.style.overflow = "hidden";

            formNota.reset();

            inputIdCliente.value = "";
            inputNumeroNota.value = "";
            inputEmailNota.value = "";
            inputDataEmissao.value = new Date().toISOString().split("T")[0];

            mostrarSugestoes("");
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

            // Força a atualização da lista ao clicar na aba
            if (page === "notas") {
                renderAbasNotas();
            }

            if (page === "lixeira") {
                renderLixeira();
            }
        });
    });

    // Abrir modal Cliente
    if (btnAbrirModal) {
        btnAbrirModal.addEventListener("click", (e) => {
            e.preventDefault();
            modalContainer.style.display = "flex";
            document.body.style.overflow = "hidden";
        });
    }

    // Fechar modal Cliente
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
        }
        if (e.target === modalContainerNota) {
            fecharModalNota();
        }
    });



    // Formulário Cliente
    if (formNovoCliente) {
        formNovoCliente.addEventListener("submit", async (e) => {
            e.preventDefault();

            btnSubmitCliente.disabled = true;
            btnSubmitCliente.innerText = "Enviando...";

            try {
                const formData = new FormData(formNovoCliente);
                const dados = Object.fromEntries(formData);

                const resposta = await fetch("https://sos-alimentos-servidor.onrender.com/api/clientes", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
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

    // Formulário de Nota
    if (formNota) {
        formNota.addEventListener("submit", async (e) => {
            e.preventDefault();

            const btnSubmitNota = document.getElementById("btnSubmitNota");
            const formData = new FormData(formNota);
            const dados = Object.fromEntries(formData);

            // CORREÇÃO 1: Evitar cadastro de notas "órfãs"
            if (!dados.idCliente) {
                alert("⚠️ Por favor, selecione um cliente da lista sugerida para vincular a nota!");
                inputClienteNota.focus();
                return;
            }

            btnSubmitNota.disabled = true;
            btnSubmitNota.innerText = "Enviando...";

            try {

                const resposta = await fetch("https://sos-alimentos-servidor.onrender.com/api/notas", {
                    method: "POST",
                    credentials: "include",
                    body: formData
                });

                const respostaData = await resposta.json();

                if (resposta.ok) {
                    alert("Nota registrada com sucesso!");
                    fecharModalNota();

                    // Atualiza a listagem dinamicamente
                    renderAbasNotas();
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

    // Carregar clientes pra exibição
    async function carregarClientes() {
        try {
            clientesConteudo.innerHTML = "Carregando...";
            const resposta = await fetch("https://sos-alimentos-servidor.onrender.com/api/clientes", { credentials: "include" });
            const clientes = await resposta.json();
            todosClientes = clientes;
            renderClientes(clientes);
        } catch {
            clientesConteudo.innerHTML = "Erro ao carregar clientes.";
        }
    }

    // Autocompletando cliente
    inputClienteNota.addEventListener("input", () => {
        if (inputClienteNota.value.trim()) {
            mostrarSugestoes(inputClienteNota.value);
        } else {
            listaClientes.classList.remove("active");
            listaClientes.innerHTML = "";
            inputIdCliente.value = "";
        }
    });

    inputClienteNota.addEventListener("change", buscarClienteSelecionado);

    async function buscarClienteSelecionado() {
        const nomeCliente = inputClienteNota.value.trim();
        if (!nomeCliente) return;

        const cliente = todosClientes.find(c => c.cliente.toLowerCase() === nomeCliente.toLowerCase());

        if (!cliente) {
            inputIdCliente.value = "";
            inputEmailNota.value = "";
            inputNumeroNota.value = 1;
            inputEmailNota.removeAttribute("readonly");
            return;
        } else {
            inputEmailNota.value = cliente.email || "";
            inputEmailNota.setAttribute("readonly", true);
        }

        inputIdCliente.value = cliente._id;
        await buscarNumeroNota(cliente._id);
    }

    function mostrarSugestoes(texto) {
        listaClientes.innerHTML = "";
        if (texto.length === 0) {
            listaClientes.style.display = "none";
            return;
        }

        const encontrados = todosClientes.filter(cliente =>
            cliente.cliente.toLowerCase().includes(texto.toLowerCase())
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

    // Fechar lista de autocomplete quando clicar fora
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".autocomplete")) {
            listaClientes.classList.remove("active");
            listaClientes.style.display = "none";
        }
    });

    async function buscarNumeroNota(idCliente) {
        try {
            const resposta = await fetch(`https://sos-alimentos-servidor.onrender.com/api/notas?_=${Date.now()}`, { credentials: "include" });
            const notas = await resposta.json();

            // Tratamento rígido garantindo que compare strings
            const notasCliente = notas.filter(n => String(n.idCliente) === String(idCliente));
            inputNumeroNota.value = notasCliente.length + 1;
        } catch (erro) {
            console.error(erro);
            inputNumeroNota.value = 1;
        }
    }

    // Exibicao dos clientes
    btnPesquisarCliente.addEventListener("click", carregarClientes);

    function renderClientes(clientes) {
        clientesConteudo.innerHTML = "";

        const toolbar = document.createElement("div");
        toolbar.classList.add("clientes-toolbar");
        toolbar.innerHTML = `
            <select id="ordenarClientes">
                <option value="">Ordenar</option>
                <option value="nomeCre">Nome (A-Z)</option>
                <option value="nomeDec">Nome (Z-A)</option>
                <option value="id">ID</option>
            </select>
            <select id="filtrarClientes">
                <option value="">Filtrar</option>
                <option value="comEmail">Com email</option>
                <option value="semEmail">Sem email</option>
            </select>
            
            <button id="carregarClientes">🔄 Atualizar</button>
        `;
        clientesConteudo.appendChild(toolbar);

        const ordenarClientes = toolbar.querySelector("#ordenarClientes");
        const filtrarClientes = toolbar.querySelector("#filtrarClientes");
        const btnCarregarClientes = toolbar.querySelector("#carregarClientes");

        btnCarregarClientes.addEventListener("click", carregarClientes);

        ordenarClientes.addEventListener("change", (e) => {
            let lista = [...todosClientes];
            switch (e.target.value) {
                case "nomeCre": lista.sort((a, b) => a.cliente.localeCompare(b.cliente)); break;
                case "nomeDec": lista.sort((a, b) => b.cliente.localeCompare(a.cliente)); break;
                case "id": lista.sort((a, b) => (a.id || "").localeCompare(b.id || "")); break;
            }
            renderClientes(lista);
        });

        filtrarClientes.addEventListener("change", (e) => {
            let lista = [...todosClientes];
            if (e.target.value === "comEmail") lista = lista.filter(c => c.email);
            if (e.target.value === "semEmail") lista = lista.filter(c => !c.email);
            renderClientes(lista);
        });

        if (clientes.length === 0) {
            const aviso = document.createElement("p");
            aviso.textContent = "Nenhum cliente encontrado.";
            aviso.style.color = "#9ca3af";
            aviso.style.padding = "20px";
            clientesConteudo.appendChild(aviso);
            return;
        }

        clientes.forEach(c => {
            const cardCliente = document.createElement("div");
            cardCliente.classList.add("cliente-card");
            cardCliente.innerHTML = `
            <div class="cliente-topo">
            <h3>${c.cliente}</h3>
            <span class="cliente-id">ID: ${c.id ?? "-"}</span>
                </div>
                <p class="cliente-rua">${c.endereco || "Rua não cadastrada"}</p>
                <p class="cliente-bairro">${c.bairro || "Bairro não cadastrado"}</p>
                <div class="cliente-acoes">
                    <button class="btn-ver">Ver</button>
                    <button class="btn-editar">Editar</button>
                </div>
            `;
            clientesConteudo.appendChild(cardCliente);
        });

        renderAbasNotas();
    }

    // ==========================================
    // SEÇÃO DE NOTAS FISCAIS
    // ==========================================
    async function renderAbasNotas() {
        const notasConteudo = document.getElementById("notasConteudo");
        const notasToolbar = document.getElementById("notasToolbar");
        if (!notasConteudo) return;

        contadorNotasPorCliente = new Map();

        const respostaNotas = await fetch(`https://sos-alimentos-servidor.onrender.com/api/notas?_=${Date.now()}`, { credentials: "include" });
        const notas = await respostaNotas.json();

        const quantidadeNotas = {};

        notas.forEach(nota => {
            const id = String(nota.idCliente || nota.clienteId || nota.cliente);

            if (!quantidadeNotas[id]) {
                quantidadeNotas[id] = 0;
            }

            quantidadeNotas[id]++;
        });

        notasConteudo.innerHTML = "<p style='color:#9ca3af; padding:20px;'>Selecione um cliente para ver as notas.</p>";
        notasToolbar.innerHTML = "";

        const toolbarNotas = document.createElement("div");
        toolbarNotas.classList.add("clientes-toolbar");
        toolbarNotas.innerHTML = `<h2 style="color: white; font-size: 20px; padding: 10px 0;">Notas por Cliente (Ordem Alfabética)</h2>`;
        notasToolbar.appendChild(toolbarNotas);

        const clientesOrdenados = [...todosClientes].sort((a, b) => a.cliente.localeCompare(b.cliente));


        clientesOrdenados.forEach(cliente => {
            cliente.quantidadeNotas = quantidadeNotas[String(cliente._id)] || 0;
        });

        const gruposAlfabeticos = {};
        clientesOrdenados.forEach(c => {
            const primeiraLetra = c.cliente.charAt(0).toUpperCase();
            if (!gruposAlfabeticos[primeiraLetra]) {
                gruposAlfabeticos[primeiraLetra] = [];
            }
            gruposAlfabeticos[primeiraLetra].push(c);
        });

        const containerGeral = document.createElement("div");
        containerGeral.classList.add("notas-alfabetico-container");

        for (const letra in gruposAlfabeticos) {
            const secaoLetra = document.createElement("div");
            secaoLetra.classList.add("secao-letra-bloco");

            const tituloLetra = document.createElement("h3");
            tituloLetra.textContent = letra;
            tituloLetra.classList.add("letra-divisor-titulo");
            secaoLetra.appendChild(tituloLetra);

            const gridClientesLetra = document.createElement("div");
            gridClientesLetra.classList.add("grid-clientes-nota");
            gruposAlfabeticos[letra].forEach(cliente => {
                const cardLinkCliente = document.createElement("div");
                cardLinkCliente.classList.add("cliente-nota-gatilho");
                cardLinkCliente.innerHTML = `
                    <div class="cliente-nota-card-content">
                        <div class="indicador-info">
                            <strong>${cliente.cliente}</strong>
                            <span class="quantidade-notas">${cliente.quantidadeNotas > 0 ? `${cliente.quantidadeNotas} nota(s)` : "Cliente sem notas no momento."}</span>
                        </div>
                        <div class="cliente-info-grid">
                        <span>${cliente.endereco ? `${cliente.endereco}` : 'Endereço não cadastrado'}</span>
                        <span>${cliente.bairro ? cliente.bairro : 'Bairro não cadastrado'}</span>
                            <span>${cliente.email ? `${cliente.email}` : 'E-mail não informado'}</span>
                            
                        </div>
                    </div>
                    <span class="seta-status">▼</span>
                `;

                contadorNotasPorCliente.set(String(cliente._id), cardLinkCliente.querySelector(".quantidade-notas"));

                const containerNotasCliente = document.createElement("div");
                containerNotasCliente.classList.add("sub-container-notas-listagem");
                containerNotasCliente.style.display = "none";

                cardLinkCliente.addEventListener("click", async () => {
                    const estaAtivo = containerNotasCliente.style.display === "grid";

                    if (!estaAtivo) {
                        containerNotasCliente.style.display = "grid";
                        cardLinkCliente.querySelector(".seta-status").textContent = "▲";
                        cardLinkCliente.classList.add("aberto");

                        containerNotasCliente.innerHTML = "<p class='loading-txt'>Buscando notas...</p>";
                        await carregarNotasDoCliente(cliente, containerNotasCliente);
                    } else {
                        containerNotasCliente.style.display = "none";
                        cardLinkCliente.querySelector(".seta-status").textContent = "▼";
                        cardLinkCliente.classList.remove("aberto");

                        // Se o modo de seleção estava ativo neste container, cancela também,
                        // senão a barra e a seleção continuam "vivas" mesmo com o container escondido
                        if (containerSelecaoAtivo === containerNotasCliente) {
                            cancelarModoSelecao();
                        }
                    }
                });

                const wrapperCliente = document.createElement("div");
                wrapperCliente.classList.add("cliente-nota-wrapper");
                wrapperCliente.appendChild(cardLinkCliente);
                wrapperCliente.appendChild(containerNotasCliente);
                gridClientesLetra.appendChild(wrapperCliente);
            });

            secaoLetra.appendChild(gridClientesLetra);
            containerGeral.appendChild(secaoLetra);
        }

        notasConteudo.innerHTML = "";
        notasConteudo.appendChild(containerGeral);
    }


    // ==========================================
    // SEÇÃO LIXEIRA
    // ==========================================
    async function renderLixeira() {
        const lixeiraConteudo = document.getElementById("lixeiraConteudo");
        const lixeiraToolbar = document.getElementById("lixeiraToolbar");
        if (!lixeiraConteudo) return;

        lixeiraConteudo.innerHTML = "<p style='color:#9ca3af; padding:20px;'>Carregando...</p>";
        if (lixeiraToolbar) lixeiraToolbar.innerHTML = "";

        try {
            const resposta = await fetch(`https://sos-alimentos-servidor.onrender.com/api/notas/lixeira?_=${Date.now()}`, { credentials: "include" });
            const notas = await resposta.json();

            if (lixeiraToolbar) {
                const toolbar = document.createElement("div");
                toolbar.classList.add("clientes-toolbar");
                toolbar.innerHTML = `<h2 style="color: white; font-size: 20px; padding: 10px 0;">Notas Excluídas (${notas.length})</h2>`;
                lixeiraToolbar.appendChild(toolbar);
            }

            lixeiraConteudo.innerHTML = "";

            if (notas.length === 0) {
                lixeiraConteudo.innerHTML = "<p class='sem-notas-txt'>A lixeira está vazia.</p>";
                return;
            }

            const grid = document.createElement("div");
            grid.classList.add("sub-container-notas-listagem");

            notas.forEach(nota => {
                grid.appendChild(criarCardNotaLixeira(nota));
            });

            lixeiraConteudo.appendChild(grid);

        } catch (erro) {
            console.error(erro);
            lixeiraConteudo.innerHTML = "<p class='erro-txt'>Erro ao carregar a lixeira.</p>";
        }
    }

    // Cria o card de uma nota dentro da Lixeira, com botões de restaurar e excluir definitivamente
    function criarCardNotaLixeira(nota) {
        const card = document.createElement("div");
        card.classList.add("cliente-card", "nota-fiscal-card-ajuste", "nota-lixeira-card");

        const valorFormatado = parseFloat(nota.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        let dataFormatada = 'Não informada';
        if (nota.dataEmissao) {
            const apenasData = nota.dataEmissao.split('T')[0];
            const partes = apenasData.split('-');
            if (partes.length === 3) {
                dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
        }

        let deletadoFormatado = 'Não informada';
        if (nota.deletadoEm) {
            const d = new Date(nota.deletadoEm);
            if (!isNaN(d)) deletadoFormatado = d.toLocaleDateString('pt-BR');
        }

        card.innerHTML = `
            <div class="cliente-topo">
                <h3>${nota.cliente || "Cliente"} — Nota Nº ${nota.numeroNota || "-"}</h3>
                <span class="nota-tag-valor">${valorFormatado}</span>
            </div>
            <p class="cliente-rua"><strong>Emissão:</strong> ${dataFormatada}</p>
            <p class="cliente-bairro"><strong>Excluída em:</strong> ${deletadoFormatado}</p>
            <div class="nota-image">
                <img src="${nota.img}" alt="Foto da nota">
            </div>
            <div class="lixeira-card-acoes">
                <button class="btn-restaurar-nota" type="button">♻️ Restaurar</button>
                <button class="btn-excluir-permanente" type="button">🗑️ Excluir Definitivamente</button>
            </div>
        `;

        const imgNota = card.querySelector(".nota-image img");
        imgNota.addEventListener("click", () => window.open(nota.img, "_blank"));

        card.querySelector(".btn-restaurar-nota").addEventListener("click", async () => {
            const confirmar = confirm("Restaurar esta nota? Ela volta a aparecer normalmente.");
            if (!confirmar) return;

            try {
                const resposta = await fetch(`https://sos-alimentos-servidor.onrender.com/api/notas/${nota._id}/restaurar`, {
                    method: "PUT",
                    credentials: "include"
                });

                if (!resposta.ok) throw new Error();

                await renderLixeira();

            } catch (erro) {
                console.error(erro);
                alert("Erro ao restaurar nota.");
            }
        });

        card.querySelector(".btn-excluir-permanente").addEventListener("click", async () => {
            const confirmar = confirm("Excluir esta nota DEFINITIVAMENTE? Essa ação não pode ser desfeita.");
            if (!confirmar) return;

            try {
                const resposta = await fetch(`https://sos-alimentos-servidor.onrender.com/api/notas/${nota._id}/permanente`, {
                    method: "DELETE",
                    credentials: "include"
                });

                if (!resposta.ok) throw new Error();

                await renderLixeira();

            } catch (erro) {
                console.error(erro);
                alert("Erro ao excluir nota permanentemente.");
            }
        });

        return card;
    }


    // ==========================================
    // BARRA DE SELEÇÃO (modo agrupar)
    // ==========================================
    function criarBarraSelecao(containerAlvo) {
        if (barraSelecao) barraSelecao.remove();

        barraSelecao = document.createElement("div");
        barraSelecao.classList.add("barra-selecao-notas");

        if (origemSelecao === "grupo") {
            // Notas selecionadas já pertencem a um grupo: só faz sentido
            // desagrupar (soltar do grupo) ou excluir as notas de verdade
            barraSelecao.innerHTML = `
                <div class="barra-selecao-linha-principal">
                    <span class="contador-selecao">1 nota selecionada</span>
                    <div class="acoes-selecao">
                        <button class="btn-cancelar-selecao btn-ghost">Cancelar</button>
                        <button class="btn-desagrupar btn-secundario">Desagrupar</button>
                        <button class="btn-excluir-notas-grupo btn-perigo">Excluir Notas</button>
                    </div>
                </div>
            `;

            containerAlvo.parentElement.insertBefore(barraSelecao, containerAlvo);

            barraSelecao.querySelector(".btn-desagrupar").addEventListener("click", () => {
                desagruparNotasSelecionadas(containerAlvo);
            });

            barraSelecao.querySelector(".btn-excluir-notas-grupo").addEventListener("click", () => {
                excluirNotasSelecionadasDoGrupo(containerAlvo);
            });

        } else {
            // Notas soltas: pode formar um grupo novo ou adicionar a um já existente
            barraSelecao.innerHTML = `
                <div class="barra-selecao-linha-principal">
                    <span class="contador-selecao">1 nota selecionada</span>
                    <div class="acoes-selecao">
                        <button class="btn-cancelar-selecao btn-ghost">Cancelar</button>
                        ${gruposSelecaoAtivo.length > 0 ? `<button class="btn-adicionar-grupo btn-secundario">Adicionar a Grupo</button>` : ""}
                        <button class="btn-agrupar btn-primario">Agrupar Notas</button>
                    </div>
                </div>
                ${gruposSelecaoAtivo.length > 0 ? `
                <div class="barra-selecao-grupo-existente" style="display: none;">
                    <select class="select-grupo-existente">
                        ${gruposSelecaoAtivo.map(g => `<option value="${g._id}">${g.nomeTexto} (${g.periodoTexto})${g.observacao ? " — " + g.observacao : ""}</option>`).join("")}
                    </select>
                    <button class="btn-confirmar-adicionar-grupo btn-primario">Confirmar</button>
                </div>
                ` : ""}
            `;

            containerAlvo.parentElement.insertBefore(barraSelecao, containerAlvo);

            barraSelecao.querySelector(".btn-agrupar").addEventListener("click", () => {
                criarGrupoDeNotas(containerAlvo);
            });

            const btnAdicionarGrupo = barraSelecao.querySelector(".btn-adicionar-grupo");
            const linhaGrupoExistente = barraSelecao.querySelector(".barra-selecao-grupo-existente");

            if (btnAdicionarGrupo && linhaGrupoExistente) {
                btnAdicionarGrupo.addEventListener("click", () => {
                    const estaVisivel = linhaGrupoExistente.style.display !== "none";
                    linhaGrupoExistente.style.display = estaVisivel ? "none" : "flex";
                });

                barraSelecao.querySelector(".btn-confirmar-adicionar-grupo").addEventListener("click", () => {
                    const select = barraSelecao.querySelector(".select-grupo-existente");
                    adicionarNotasAGrupoExistente(containerAlvo, select.value);
                });
            }
        }

        barraSelecao.querySelector(".btn-cancelar-selecao").addEventListener("click", () => {
            cancelarModoSelecao();
        });
    }

    function atualizarBarra() {
        if (!barraSelecao) return;
        const contador = barraSelecao.querySelector(".contador-selecao");
        contador.textContent = `${notasSelecionadas.size} nota(s) selecionada(s)`;
    }

    function cancelarModoSelecao() {
        modoSelecao = false;

        notasSelecionadas.forEach(({ elemento }) => {
            elemento.classList.remove("selecionada");
        });
        notasSelecionadas.clear();

        if (barraSelecao) {
            barraSelecao.remove();
            barraSelecao = null;
        }
        containerSelecaoAtivo = null;
        clienteSelecaoAtivo = null;
        gruposSelecaoAtivo = [];
        origemSelecao = null;
        grupoOrigemSelecaoId = null;
    }

    // Remove as notas selecionadas de um grupo (elas voltam a ficar soltas).
    // Se o grupo ficar sem nenhuma nota, o grupo em si é excluído (evita grupo vazio órfão).
    async function desagruparNotasSelecionadas(containerAlvo) {
        if (notasSelecionadas.size === 0) return;
        if (!clienteSelecaoAtivo || !grupoOrigemSelecaoId) return;

        const clienteAlvo = clienteSelecaoAtivo;
        const grupoId = grupoOrigemSelecaoId;
        const notasIdRemover = new Set(notasSelecionadas.keys());

        const confirmar = confirm(`Remover ${notasIdRemover.size} nota(s) deste grupo? As notas voltam a ficar soltas.`);
        if (!confirmar) return;

        try {
            const respostaGrupos = await fetch(`https://sos-alimentos-servidor.onrender.com/api/grupos?idCliente=${clienteAlvo._id}&_=${Date.now()}`, { credentials: "include" });
            const gruposAtuais = respostaGrupos.ok ? await respostaGrupos.json() : [];
            const grupoAtual = gruposAtuais.find(g => String(g._id) === String(grupoId));

            if (!grupoAtual) {
                cancelarModoSelecao();
                await carregarNotasDoCliente(clienteAlvo, containerAlvo);
                return;
            }

            const notasIdRestantes = (grupoAtual.notasId || [])
                .map(id => String(id))
                .filter(id => !notasIdRemover.has(id));

            if (notasIdRestantes.length === 0) {
                // Grupo ficaria vazio: exclui o grupo em vez de deixar um card sem notas
                const resposta = await fetch(`https://sos-alimentos-servidor.onrender.com/api/grupos/${grupoAtual._id}`, {
                    method: "DELETE",
                    credentials: "include"
                });
                if (!resposta.ok) throw new Error();
            } else {
                const resposta = await fetch(`https://sos-alimentos-servidor.onrender.com/api/grupos/${grupoAtual._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ notasId: notasIdRestantes })
                });
                if (!resposta.ok) throw new Error();
            }

            cancelarModoSelecao();
            await carregarNotasDoCliente(clienteAlvo, containerAlvo);

        } catch (erro) {
            console.error(erro);
            alert("Erro ao desagrupar notas.");
        }
    }

    // Exclui de fato as notas selecionadas (soft delete), estejam elas dentro de um grupo ou não
    async function excluirNotasSelecionadasDoGrupo(containerAlvo) {
        if (notasSelecionadas.size === 0) return;
        if (!clienteSelecaoAtivo) return;

        const clienteAlvo = clienteSelecaoAtivo;
        const notasIdExcluir = Array.from(notasSelecionadas.keys());

        const confirmar = confirm(`Excluir ${notasIdExcluir.length} nota(s)? Essa ação não pode ser desfeita.`);
        if (!confirmar) return;

        try {
            await Promise.all(
                notasIdExcluir.map(id =>
                    fetch(`https://sos-alimentos-servidor.onrender.com/api/notas/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ deletado: true }) })
                )
            );

            cancelarModoSelecao();
            await carregarNotasDoCliente(clienteAlvo, containerAlvo);

        } catch (erro) {
            console.error(erro);
            alert("Erro ao excluir notas.");
        }
    }

    // Adiciona as notas selecionadas a um grupo já existente do cliente
    // (busca o grupo atualizado direto do backend antes de mesclar, pra
    // garantir que o card mostre corretamente a nota recém-adicionada)
    async function adicionarNotasAGrupoExistente(containerAlvo, grupoId) {
        if (notasSelecionadas.size === 0) return;
        if (!clienteSelecaoAtivo) return;
        if (!grupoId) return;

        const clienteAlvo = clienteSelecaoAtivo;
        const notasIdNovas = Array.from(notasSelecionadas.keys());

        const confirmar = confirm(`Adicionar ${notasIdNovas.length} nota(s) ao grupo selecionado?`);
        if (!confirmar) return;

        try {
            // Busca o grupo direto do backend (evita mesclar com uma versão desatualizada)
            const respostaGrupos = await fetch(`https://sos-alimentos-servidor.onrender.com/api/grupos?idCliente=${clienteAlvo._id}&_=${Date.now()}`, { credentials: "include" });
            const gruposAtuais = respostaGrupos.ok ? await respostaGrupos.json() : [];
            const grupoAtual = gruposAtuais.find(g => String(g._id) === String(grupoId));

            if (!grupoAtual) {
                alert("Este grupo não existe mais.");
                cancelarModoSelecao();
                await carregarNotasDoCliente(clienteAlvo, containerAlvo);
                return;
            }

            const notasIdExistentes = (grupoAtual.notasId || []).map(id => String(id));
            const notasIdFinal = Array.from(new Set([...notasIdExistentes, ...notasIdNovas]));

            const resposta = await fetch(`https://sos-alimentos-servidor.onrender.com/api/grupos/${grupoAtual._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ notasId: notasIdFinal })
            });

            if (!resposta.ok) throw new Error();

            cancelarModoSelecao();

            await carregarNotasDoCliente(clienteAlvo, containerAlvo);

        } catch (erro) {
            console.error(erro);
            alert("Erro ao adicionar notas ao grupo.");
        }
    }

    // Cria o grupo de fato no backend (persistido) e recarrega a listagem do cliente
    async function criarGrupoDeNotas(containerAlvo) {
        if (notasSelecionadas.size === 0) return;
        if (!clienteSelecaoAtivo) return;

        const observacao = prompt("Observação do grupo (opcional):", "");
        if (observacao === null) return; // usuário cancelou o prompt

        const notasId = Array.from(notasSelecionadas.keys());
        const clienteAlvo = clienteSelecaoAtivo;

        try {
            const resposta = await fetch("https://sos-alimentos-servidor.onrender.com/api/grupos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    observacao,
                    idCliente: clienteAlvo._id,
                    notasId
                })
            });

            if (!resposta.ok) throw new Error();

            cancelarModoSelecao();

            // Recarrega as notas do cliente já com o grupo novo aplicado
            await carregarNotasDoCliente(clienteAlvo, containerAlvo);

        } catch (erro) {
            console.error(erro);
            alert("Erro ao criar grupo de notas.");
        }
    }

    // Calcula data mais antiga, mais recente, valor total e valor não pago de um conjunto de notas
    function calcularInfoGrupo(notasDoGrupo) {
        let dataMaisAntiga = null;
        let dataMaisRecente = null;
        let totalNaoPago = 0;
        let totalGrupo = 0;

        notasDoGrupo.forEach(nota => {
            if (nota.dataEmissao) {
                const data = new Date(nota.dataEmissao);
                if (!isNaN(data)) {
                    if (!dataMaisAntiga || data < dataMaisAntiga) dataMaisAntiga = data;
                    if (!dataMaisRecente || data > dataMaisRecente) dataMaisRecente = data;
                }
            }
            totalGrupo += parseFloat(nota.valor || 0);
            if (!nota.pago) {
                totalNaoPago += parseFloat(nota.valor || 0);
            }
        });

        return { dataMaisAntiga, dataMaisRecente, totalNaoPago, totalGrupo };
    }

    function formatarDataCurta(data) {
        return data ? data.toLocaleDateString('pt-BR') : "—";
    }

    // Monta o card visual de um grupo já existente (vindo do backend)
    // Começa do tamanho de um card normal (colapsado); ao clicar, expande
    // ocupando a linha inteira e mostra a grade de notas dentro.
    // notasDoGrupo: array com os objetos de nota (não só os ids), usado pra calcular os totais
    // Retorna { cardGrupo, corpoGrupo } para o chamador poder inserir os cards de nota dentro
    function criarCardGrupo(grupo, containerAlvo, clienteAlvo, notasDoGrupo) {
        const cardGrupo = document.createElement("div");
        cardGrupo.classList.add("grupo-notas-card");
        cardGrupo.dataset.grupoId = grupo._id;

        const { dataMaisAntiga, dataMaisRecente, totalNaoPago, totalGrupo } = calcularInfoGrupo(notasDoGrupo);
        const totalFormatado = totalNaoPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const totalGrupoFormatado = totalGrupo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const todasPagas = notasDoGrupo.length > 0 && totalNaoPago === 0;

        // Nome do grupo = data em que ele foi criado (agrupado), não o período das notas
        const dataCriacao = grupo.dataCriacao ? new Date(grupo.dataCriacao) : null;
        const nomeGrupo = dataCriacao ? `Grupo de ${formatarDataCurta(dataCriacao)}` : "Grupo de Notas";

        // Função compartilhada de exclusão (usada tanto pelo botão do rodapé
        // quanto pelo aviso que aparece quando todas as notas já estão pagas)
        async function excluirGrupo() {
            const confirmar = confirm("Excluir este grupo? As notas dentro dele também serão marcadas como excluídas.");
            if (!confirmar) return;

            try {
                const resposta = await fetch(`https://sos-alimentos-servidor.onrender.com/api/grupos/${grupo._id}`, {
                    method: "DELETE",
                    credentials: "include"
                });

                if (!resposta.ok) throw new Error();

                // Recarrega a listagem: o grupo some e as notas dele também,
                // já que ambos foram marcados como excluídos no backend
                await carregarNotasDoCliente(clienteAlvo, containerAlvo);

            } catch (erro) {
                console.error(erro);
                alert("Erro ao excluir grupo.");
            }
        }

        cardGrupo.innerHTML = `
            <div class="grupo-notas-topo">
                <span class="grupo-notas-icone">📦</span>
                <h3 class="grupo-notas-titulo-texto">${nomeGrupo}</h3>
            </div>
            <div class="grupo-notas-info">
                <div class="grupo-notas-info-linha">
                    <span class="grupo-notas-info-label">Período das notas</span>
                    <span class="grupo-notas-info-valor">${formatarDataCurta(dataMaisAntiga)} – ${formatarDataCurta(dataMaisRecente)}</span>
                </div>
                <div class="grupo-notas-info-linha">
                    <span class="grupo-notas-info-label">Total do período</span>
                    <span class="grupo-notas-info-valor grupo-notas-valor-total-destaque">${totalGrupoFormatado}</span>
                    <span class="grupo-notas-info-label">Em aberto</span>
                    <span class="grupo-notas-info-valor grupo-notas-valor-destaque">${totalFormatado}</span>
                </div>
                <div class="grupo-notas-info-linha">
                    <span class="grupo-notas-info-label">Notas</span>
                    <span class="grupo-notas-info-valor">${notasDoGrupo.length}</span>
                </div>
                <div class="grupo-notas-info-linha">
                    <span class="grupo-notas-info-label">Observação</span>
                    <span class="grupo-notas-info-valor">${grupo.observacao || "Nenhuma observação"}</span>
                </div>
                ${todasPagas ? `
                <div class="grupo-notas-aviso-pago">
                    <span>✅ Todas as notas deste grupo estão pagas.</span>
                    <button class="btn-excluir-grupo-pago" type="button">Excluir grupo e notas</button>
                </div>
                ` : ""}
            </div>
            <div class="grupo-notas-rodape">
                <span class="seta-status-grupo">▼</span>
                <div class="grupo-notas-rodape-acoes">
                    <button class="btn-editar-grupo" title="Editar observação">✏️ Editar</button>
                    <button class="btn-excluir-grupo" title="Excluir grupo">🗑️ Excluir</button>
                </div>
            </div>
        `;

        const corpoGrupo = document.createElement("div");
        corpoGrupo.classList.add("grupo-notas-corpo");
        corpoGrupo.style.display = "none";

        cardGrupo.addEventListener("click", (e) => {
            if (e.target.closest(".btn-excluir-grupo") || e.target.closest(".btn-editar-grupo") || e.target.closest(".btn-excluir-grupo-pago")) return;
            if (e.target.closest(".grupo-notas-corpo")) return; // clique numa nota dentro do grupo não deve fechar o grupo
            alternarGrupo();
        });

        function alternarGrupo() {
            const estaAberto = cardGrupo.classList.toggle("aberto");
            corpoGrupo.style.display = estaAberto ? "grid" : "none";
            cardGrupo.querySelector(".seta-status-grupo").textContent = estaAberto ? "▲" : "▼";
        }

        cardGrupo.querySelector(".btn-editar-grupo").addEventListener("click", async (e) => {
            e.stopPropagation();

            const novaObservacao = prompt("Editar observação do grupo:", grupo.observacao || "");
            if (novaObservacao === null) return; // cancelou

            try {
                const resposta = await fetch(`https://sos-alimentos-servidor.onrender.com/api/grupos/${grupo._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ observacao: novaObservacao })
                });

                if (!resposta.ok) throw new Error();

                await carregarNotasDoCliente(clienteAlvo, containerAlvo);

            } catch (erro) {
                console.error(erro);
                alert("Erro ao editar grupo.");
            }
        });

        cardGrupo.querySelector(".btn-excluir-grupo").addEventListener("click", async (e) => {
            e.stopPropagation();
            await excluirGrupo();
        });

        // Botão que só existe quando todas as notas do grupo já estão pagas
        const btnExcluirPago = cardGrupo.querySelector(".btn-excluir-grupo-pago");
        if (btnExcluirPago) {
            btnExcluirPago.addEventListener("click", async (e) => {
                e.stopPropagation();
                await excluirGrupo();
            });
        }

        cardGrupo.appendChild(corpoGrupo);

        return { cardGrupo, corpoGrupo };
    }

    async function carregarNotasDoCliente(clienteAlvo, containerAlvo) {
        try {

            function marcarComoPago(nota, cardNotaItem, btnPago) {

                const mensagem = nota.pago
                    ? "Esta nota já está paga. Deseja desmarcá-la?"
                    : "Tem certeza que deseja marcar esta nota como paga?";

                if (!confirm(mensagem)) return;

                btnPago.disabled = true;

                fetch(`https://sos-alimentos-servidor.onrender.com/api/notas/${nota._id}/pago`, {
                    method: "PUT",
                    credentials: "include"
                })
                    .then(r => {
                        if (!r.ok) throw new Error();
                        return r.json();
                    })
                    .then((notaAtualizada) => {
                        nota.pago = notaAtualizada.pago;

                        btnPago.textContent = nota.pago ? "Desmarcar como Pago" : "Marcar como Pago";
                        cardNotaItem.classList.toggle("nota-paga", nota.pago);

                        // Recarrega a listagem pra recalcular os totais/avisos do grupo,
                        // caso esta nota pertença a algum grupo
                        return carregarNotasDoCliente(clienteAlvo, containerAlvo);
                    })
                    .catch((erro) => {
                        console.error(erro);
                        alert("Erro ao atualizar status da nota.");
                    })
                    .finally(() => {
                        btnPago.disabled = false;
                    });
            }

            // Cria o card individual de uma nota (com todos os listeners já ligados)
            function criarCardNotaItem(nota, index) {
                const cardNotaItem = document.createElement("div");
                cardNotaItem.classList.add("cliente-card", "nota-fiscal-card-ajuste");
                cardNotaItem.classList.toggle("nota-paga", nota.pago);

                const valorFormatado = parseFloat(nota.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                let dataFormatada = 'Não informada';
                if (nota.dataEmissao) {
                    // Pega a string "2026-06-28T20:18:35.523Z", corta no "T" e usa só o lado esquerdo
                    const apenasData = nota.dataEmissao.split('T')[0];

                    const partes = apenasData.split('-'); // Divide ano, mês e dia
                    if (partes.length === 3) {
                        dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`; // Monta DD/MM/YYYY
                    }
                }

                cardNotaItem.innerHTML = `
                
                    <div class="cliente-topo">
                        <h3>Nota Nº ${nota.numeroNota || index + 1}</h3>
                        <span class="nota-tag-valor">${valorFormatado}</span>
                    </div>
                    <p class="cliente-rua"><strong>Emissão:</strong> ${dataFormatada}</p>
                    <p class="cliente-bairro"><strong>E-mail:</strong> ${nota.email || 'Não informado'}</p>
                    <p class="cliente-rua"><strong>Entrega:</strong> ${nota.entregador || 'Não informado'}</p>
                    <div class="nota-image">
                        <img src="${nota.img}" alt="Foto da nota">
                    </div>
                    <div class="nota-card-acoes">
                        <button class="btn-marcar-pago">${nota.pago ? "Desmarcar como Pago" : "Marcar como Pago"}</button>
                        <button class="btn-excluir-nota" type="button" title="Excluir nota">🗑️</button>
                    </div>
                `;

                const imgNota = cardNotaItem.querySelector(".nota-image img");
                imgNota.addEventListener("click", (e) => {
                    e.stopPropagation();
                    window.open(nota.img, "_blank");
                });

                const btnPago = cardNotaItem.querySelector(".btn-marcar-pago");

                btnPago.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    marcarComoPago(nota, cardNotaItem, btnPago);
                });

                const btnExcluirNota = cardNotaItem.querySelector(".btn-excluir-nota");

                btnExcluirNota.addEventListener("click", async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const confirmar = confirm("Excluir esta nota? Ela vai para a Lixeira e pode ser restaurada de lá.");
                    if (!confirmar) return;

                    btnExcluirNota.disabled = true;

                    try {
                        const resposta = await fetch(`https://sos-alimentos-servidor.onrender.com/api/notas/${nota._id}`, {
                            method: "DELETE",
                            credentials: "include"
                        });

                        if (!resposta.ok) throw new Error();

                        await carregarNotasDoCliente(clienteAlvo, containerAlvo);

                    } catch (erro) {
                        console.error(erro);
                        alert("Erro ao excluir nota.");
                        btnExcluirNota.disabled = false;
                    }
                });

                cardNotaItem.addEventListener("click", (e) => {
                    // O clique nunca deve borbulhar pro card do grupo (senão ele fecha/abre sem querer)
                    e.stopPropagation();

                    const grupoAncestralEl = cardNotaItem.closest(".grupo-notas-card");
                    const grupoIdAncestral = grupoAncestralEl ? grupoAncestralEl.dataset.grupoId : null;

                    if (!modoSelecao) {
                        modoSelecao = true;
                        containerSelecaoAtivo = containerAlvo;
                        clienteSelecaoAtivo = clienteAlvo;

                        if (grupoIdAncestral) {
                            // Selecionando notas DENTRO de um grupo: só faz sentido desagrupar ou excluir
                            origemSelecao = "grupo";
                            grupoOrigemSelecaoId = grupoIdAncestral;
                            gruposSelecaoAtivo = [];
                        } else {
                            // Selecionando notas SOLTAS: pode criar grupo novo ou adicionar a um existente
                            origemSelecao = "solta";
                            grupoOrigemSelecaoId = null;

                            // Calcula o nome (data de criação) e o período das notas de cada grupo,
                            // pra exibir no dropdown de "Adicionar a Grupo"
                            gruposSelecaoAtivo = grupos.map(g => {
                                const notasDoGrupo = (g.notasId || [])
                                    .map(id => notaPorId.get(String(id)))
                                    .filter(Boolean);
                                const { dataMaisAntiga, dataMaisRecente } = calcularInfoGrupo(notasDoGrupo);
                                const dataCriacao = g.dataCriacao ? new Date(g.dataCriacao) : null;
                                const nomeTexto = dataCriacao ? `Grupo de ${formatarDataCurta(dataCriacao)}` : "Grupo de Notas";
                                const periodoTexto = `${formatarDataCurta(dataMaisAntiga)} – ${formatarDataCurta(dataMaisRecente)}`;
                                return { ...g, nomeTexto, periodoTexto };
                            });
                        }

                        criarBarraSelecao(containerAlvo);
                    }

                    if (containerSelecaoAtivo !== containerAlvo) return; // bloqueia seleção cruzada entre clientes

                    // Bloqueia misturar nota solta com nota de grupo, ou notas de grupos diferentes
                    const origemDestaNota = grupoIdAncestral ? "grupo" : "solta";
                    if (origemDestaNota !== origemSelecao) return;
                    if (origemSelecao === "grupo" && grupoIdAncestral !== grupoOrigemSelecaoId) return;

                    if (notasSelecionadas.has(nota._id)) {
                        notasSelecionadas.delete(nota._id);
                        cardNotaItem.classList.remove("selecionada");
                    } else {
                        notasSelecionadas.set(nota._id, { nota, elemento: cardNotaItem });
                        cardNotaItem.classList.add("selecionada");
                    }

                    atualizarBarra();

                    if (notasSelecionadas.size === 0) {
                        cancelarModoSelecao();
                    }
                });

                return cardNotaItem;
            }

            const [respostaNotas, respostaGrupos] = await Promise.all([
                fetch(`https://sos-alimentos-servidor.onrender.com/api/notas?_=${Date.now()}`, { credentials: "include" }),
                fetch(`https://sos-alimentos-servidor.onrender.com/api/grupos?idCliente=${clienteAlvo._id}&_=${Date.now()}`, { credentials: "include" })
            ]);

            const notas = await respostaNotas.json();
            const grupos = respostaGrupos.ok ? await respostaGrupos.json() : [];

            const notasDoCliente = notas.filter(n => {

                const bateuPorNome = n.cliente && n.cliente.toLowerCase().trim() === clienteAlvo.cliente.toLowerCase().trim();

                return bateuPorNome;
            });

            // Mantém o "X nota(s)" do card do cliente (na listagem de fora) sempre em dia,
            // sem precisar recarregar a aba inteira
            const spanContador = contadorNotasPorCliente.get(String(clienteAlvo._id));
            if (spanContador) {
                spanContador.textContent = notasDoCliente.length > 0
                    ? `${notasDoCliente.length} nota(s)`
                    : "Cliente sem notas no momento.";
            }

            containerAlvo.innerHTML = "";

            if (notasDoCliente.length === 0) {
                containerAlvo.innerHTML = "<p class='sem-notas-txt'>Nenhuma nota fiscal registrada para este cliente.</p>";
                return;
            }

            // Cria todos os cards de nota primeiro, indexados por id
            const notaCardMap = new Map();
            const notaPorId = new Map();
            notasDoCliente.forEach((nota, index) => {
                const cardNotaItem = criarCardNotaItem(nota, index);
                notaCardMap.set(String(nota._id), cardNotaItem);
                notaPorId.set(String(nota._id), nota);
            });

            // Marca quais notas já pertencem a algum grupo
            const notasAgrupadasIds = new Set();
            grupos.forEach(grupo => {
                (grupo.notasId || []).forEach(id => notasAgrupadasIds.add(String(id)));
            });

            // Renderiza os grupos primeiro, movendo os cards de nota correspondentes pra dentro
            grupos.forEach(grupo => {
                const notasDoGrupo = (grupo.notasId || [])
                    .map(id => notaPorId.get(String(id)))
                    .filter(Boolean);

                const { cardGrupo, corpoGrupo } = criarCardGrupo(grupo, containerAlvo, clienteAlvo, notasDoGrupo);

                (grupo.notasId || []).forEach(id => {
                    const card = notaCardMap.get(String(id));
                    if (card) corpoGrupo.appendChild(card);
                });

                containerAlvo.appendChild(cardGrupo);
            });

            // Renderiza as notas que não pertencem a nenhum grupo, soltas
            notasDoCliente.forEach(nota => {
                const idStr = String(nota._id);
                if (!notasAgrupadasIds.has(idStr)) {
                    const card = notaCardMap.get(idStr);
                    if (card) containerAlvo.appendChild(card);
                }
            });

        } catch (erro) {
            console.error(erro);
            containerAlvo.innerHTML = "<p class='erro-txt'>Erro ao carregar notas fiscais do servidor.</p>";
        }

    }

    // Relógio da página inicial
    function atualizarRelogio() {
        const agora = new Date();
        const hora = agora.toLocaleTimeString("pt-BR");
        const data = agora.toLocaleDateString("pt-BR");
        const dias = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

        const elHora = document.getElementById("horaAtual");
        const elData = document.getElementById("dataAtual");

        if (elHora) elHora.textContent = hora;
        if (elData) elData.textContent = `${dias[agora.getDay()]} - ${data}`;
    }

    atualizarRelogio();
    setInterval(atualizarRelogio, 1000);
});
