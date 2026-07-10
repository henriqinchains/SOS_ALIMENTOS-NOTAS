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
            const resposta = await fetch("https://sos-alimentos-servidor.onrender.com/api/clientes");
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
            const resposta = await fetch(`https://sos-alimentos-servidor.onrender.com/api/notas?_=${Date.now()}`);
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

        const respostaNotas = await fetch(`https://sos-alimentos-servidor.onrender.com/api/notas?_=${Date.now()}`);
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
                            <span class="quantidade-notas" id="quantidade-notas">${cliente.quantidadeNotas > 0 ? `${cliente.quantidadeNotas} nota(s)` : "Cliente sem notas no momento."}</span>
                        </div>
                        <div class="cliente-info-grid">
                        <span>${cliente.endereco ? `${cliente.endereco}` : 'Endereço não cadastrado'}</span>
                        <span>${cliente.bairro ? cliente.bairro : 'Bairro não cadastrado'}</span>
                            <span>${cliente.email ? `${cliente.email}` : 'E-mail não informado'}</span>
                            
                        </div>
                    </div>
                    <span class="seta-status">▼</span>
                `;

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

    //agrupamento
    let modoSelecao = false;
    const notasSelecionadas = new Set();

    async function carregarNotasDoCliente(clienteAlvo, containerAlvo) {
        try {
            const resposta = await fetch(`https://sos-alimentos-servidor.onrender.com/api/notas?_=${Date.now()}`);
            const notas = await resposta.json();

            console.log("--- DEBUG DE NOTAS ---");
            console.log("Buscando notas para:", clienteAlvo.cliente, "| ID:", clienteAlvo._id);
            console.log("Notas retornadas pelo servidor:", notas);

            const notasDoCliente = notas.filter(n => {

                const bateuPorNome = n.cliente && n.cliente.toLowerCase().trim() === clienteAlvo.cliente.toLowerCase().trim();

                return bateuPorNome;
            });

            containerAlvo.innerHTML = "";

            if (notasDoCliente.length === 0) {
                containerAlvo.innerHTML = "<p class='sem-notas-txt'>Nenhuma nota fiscal registrada para este cliente.</p>";
                return;
            }

            notasDoCliente.forEach((nota, index) => {
                const cardNotaItem = document.createElement("div");
                cardNotaItem.classList.add("cliente-card", "nota-fiscal-card-ajuste");

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
                        <img src="${nota.img}" alt="Foto da nota" onclick="window.open('${nota.img}', '_blank')">
                    </div>
                    <button class="btn-marcar-pago" onclick="marcarComoPago('${nota._id}', ${nota.pago})">${nota.pago ? "Desmarcar como Pago" : "Marcar como Pago"}</button>
                `;

                const btnPago = cardNotaItem.querySelector(".btn-marcar-pago");
                btnPago.addEventListener("click", (e) => {
                    e.stopPropagation();
                    marcarComoPago(nota._id, nota.pago);
                });

                cardNotaItem.addEventListener("click", () => {
                    if (!modoSelecao) return;

                    if (notasSelecionadas.has(nota._id)) {
                        notasSelecionadas.delete(nota._id);
                        cardNotaItem.classList.remove("selecionada");
                    } else {
                        notasSelecionadas.add(nota._id);
                        cardNotaItem.classList.add("selecionada");
                    }

                    atualizarBarra();
                });

                containerAlvo.appendChild(cardNotaItem);
            });

        } catch (erro) {
            console.error(erro);
            containerAlvo.innerHTML = "<p class='erro-txt'>Erro ao carregar notas fiscais do servidor.</p>";
        }



        containerAlvo.appendChild(cardNotaItem);
    }

    function marcarComoPago(idNota, pago) {

        if (pago) {
            if (!confirm("Esta nota já está marcada como PAGA. Deseja desmarcá-la?")) {
                return;
            }
        } else {
            if (!confirm("Tem certeza que deseja marcar esta nota como PAGA?")) {
                return;
            }
        }

        fetch(`https://sos-alimentos-servidor.onrender.com/api/notas/${idNota}/pago`, {
            method: "PATCH"
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error("Erro ao atualizar nota");
                }
                return response.json();
            })
            .then(() => {
                alert(pago ? "Nota desmarcada como paga!" : "Nota marcada como paga!");
                location.reload();
            })
            .catch(err => {
                console.error(err);
                alert("Erro ao atualizar nota.");
            });
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