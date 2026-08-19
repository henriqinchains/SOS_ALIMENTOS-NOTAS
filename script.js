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
const btnCancelarEdicaoCliente = document.getElementById("btnCancelarEdicaoCliente");
const btnSubmitNota = document.getElementById("btnSubmitNota")
const btnFecharModal = document.getElementById("btn-fechar-modal");

const btnAbrirModalNota = document.getElementById("btnNovaNota");
const modalContainerNota = document.getElementById("modal-containerNota");
const btnFecharModalNota = document.getElementById("btn-fechar-modal-nota");

const modalImagemNota = document.getElementById("modal-imagem-nota");
const imagemNotaAmpliada = document.getElementById("imagemNotaAmpliada");
const btnFecharModalImagem = document.getElementById("btn-fechar-modal-imagem");
const btnPagoModalImagem = document.getElementById("btnPagoModalImagem");
const btnBaixarModalImagem = document.getElementById("btnBaixarModalImagem");
const btnExcluirModalImagem = document.getElementById("btnExcluirModalImagem");

const modalPlanejarRotas = document.getElementById("modal-planejar-rotas");
const btnFecharModalRotas = document.getElementById("btn-fechar-modal-rotas");
const dataPlanejamentoRotas = document.getElementById("dataPlanejamentoRotas");
const blocosEntregadoresRotas = document.getElementById("blocosEntregadoresRotas");
const btnAdicionarEntregadorRota = document.getElementById("btnAdicionarEntregadorRota");
const btnSalvarRotas = document.getElementById("btnSalvarRotas");

const btnSair = document.getElementById("btnSair");

const formNota = document.getElementById("formNota");

const inputClienteNota = document.getElementById("clienteNota");
const inputIdCliente = document.getElementById("idCliente");
const inputEmailNota = document.getElementById("email");
const inputNumeroNota = document.getElementById("numeroNota");
const inputDataEmissao = document.getElementById("dataEmissao");
const inputNotaJaPaga = document.getElementById("notaJaPaga");
const btnNotaJaPaga = document.getElementById("btnNotaJaPaga");

const listaClientes = document.getElementById("listaClientes");

let todosClientes = [];
let todosEntregadores = [];

// Retorna o nome legível do entregador com compatibilidade para notas antigas
function obterNomeEntregador(nota) {
    if (!nota) return "Não informado";

    // 1. PRIMEIRO: tenta resolver pelo ID.
    // O ID é a identificação real do entregador.
    const id = nota.entregadorId || nota.entregador_id || null;

    if (id && Array.isArray(todosEntregadores)) {
        const encontrado = todosEntregadores.find(
            e => String(e._id || e.id) === String(id)
        );

        if (encontrado) {
            return (
                encontrado.nome ||
                encontrado.name ||
                encontrado.usuario ||
                "Não informado"
            );
        }
    }

    // 2. Se o backend já mandou o objeto populado
    if (
        typeof nota.entregador === "object" &&
        nota.entregador !== null
    ) {
        return (
            nota.entregador.nome ||
            nota.entregador.name ||
            nota.entregador.usuario ||
            "Não informado"
        );
    }

    // 3. Compatibilidade com notas antigas
    if (
        typeof nota.entregador === "string" &&
        nota.entregador.trim()
    ) {
        return nota.entregador.trim();
    }

    return "Não informado";
}

let contadorNotasPorCliente = new Map(); // clienteId -> elemento <span> da contagem na aba Notas
let notasLixeiraSelecionadas = new Set();

// FATURAMENTO: filtro de período (default = dia atual, conforme pedido)
let notasFaturamentoCache = [];
let filtroFaturamentoInicio = null; // "YYYY-MM-DD"
let filtroFaturamentoFim = null;    // "YYYY-MM-DD"

// MODAL DE CLIENTE: reaproveitado tanto pra criar quanto pra visualizar/editar
let estadoModalCliente = "criar"; // "criar" | "visualizar" | "editando"
let clienteEmEdicao = null; // dados do cliente carregado no modal (null quando "criar")
let valoresOriginaisCliente = null; // snapshot dos campos ao entrar em "editando", pra detectar mudança real

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

const inputCnpj = document.getElementById('cnpj');
const btnBuscarCnpj = document.getElementById('btnBuscarCnpj');
const inputTelefoneCliente = document.getElementById('telefone');
const inputRazaoSocial = document.getElementById('razao_social');

let loggedUser = sessionStorage.getItem("cache_usuario") || "";
let userRole = sessionStorage.getItem("cache_cargo") || "user";

function mostrarFeedbackNota(msg, tipo) {
    const fb = document.getElementById("feedbackNota");
    fb.textContent = msg;
    fb.className = "feedback feedback--" + tipo;
}

// Limpa o feedback da nota (usado ao abrir o modal de novo e depois de fechá-lo,
// pra não deixar uma mensagem antiga "vazando" pra próxima nota)
function limparFeedbackNota() {
    const fb = document.getElementById("feedbackNota");
    fb.textContent = "";
    fb.className = "feedback";
}

// Mesmo padrão, só que pro modal de cliente (cadastro, edição e importação de CSV)
function mostrarFeedbackCliente(msg, tipo) {
    const fb = document.getElementById("feedbackCliente");
    if (!fb) return;
    fb.textContent = msg;
    fb.className = "feedback feedback--" + tipo;
}

function limparFeedbackCliente() {
    const fb = document.getElementById("feedbackCliente");
    if (!fb) return;
    fb.textContent = "";
    fb.className = "feedback";
}


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

// Wrapper central de fetch: usa em toda chamada à API feita DEPOIS do carregamento
// inicial da página. Se a sessão expirar (401) enquanto o usuário já está usando
// a página, redireciona pro login na hora — sem isso, a página ficava "viva" na
// tela mas com a sessão morta, e toda ação simplesmente parava de funcionar.
async function fetchAutenticado(url, options = {}) {
    const resposta = await fetch(url, options);

    if (resposta.status === 401) {
        sessionStorage.clear();
        window.location.href = "./pages/login/login.html";
        throw new Error("Sessão expirada. Redirecionando para o login...");
    }

    return resposta;
}

// ==================== DOWNLOAD DE IMAGENS DE NOTA ====================

// Deixa um texto seguro pra usar em nome de arquivo (sem acento, espaço, etc.)
function slugify(texto) {
    return (texto || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "arquivo";
}

// Pega a extensão real do arquivo a partir da URL do Cloudinary (cai pra
// "jpg" se por algum motivo não conseguir identificar).
function obterExtensaoImagem(url) {
    try {
        const semQuery = url.split("?")[0];
        const partes = semQuery.split(".");
        return partes.length > 1 ? partes.pop().toLowerCase() : "jpg";
    } catch {
        return "jpg";
    }
}

// Baixa uma única imagem de nota. Usa fetch + blob (em vez de só um <a
// download>) porque a imagem vem de outro domínio (Cloudinary) — um link
// direto cross-origin com "download" é ignorado por vários navegadores e
// só abre a imagem numa aba nova em vez de baixar.
// Abre a imagem da nota em modo só-leitura (sem "Marcar como Pago"/"Excluir"),
// pra lugares como a tabela de Faturamento, que não têm o contexto de
// cliente/container necessário pra essas ações funcionarem.
function abrirImagemSomenteVisualizacao(nota) {
    if (!nota.img) {
        alert("Esta nota não tem foto anexada.");
        return;
    }

    imagemNotaAmpliada.src = nota.img;
    modalImagemNota.classList.add("modo-somente-visualizacao");
    modalImagemNota.style.display = "flex";
    document.body.style.overflow = "hidden";
}

async function baixarImagemNota(nota, clienteNome, botao) {
    if (!nota.img) {
        alert("Esta nota não tem foto anexada.");
        return;
    }

    const textoOriginal = botao ? botao.textContent : null;
    if (botao) {
        botao.disabled = true;
        botao.textContent = "⏳";
    }

    try {
        const resposta = await fetch(nota.img);
        if (!resposta.ok) throw new Error();

        const blob = await resposta.blob();
        const extensao = obterExtensaoImagem(nota.img);
        const nomeArquivo = `nota-${nota.numeroNota || "sem-numero"}-${slugify(clienteNome)}.${extensao}`;

        const urlBlob = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = urlBlob;
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(urlBlob);

    } catch (erro) {
        console.error(erro);
        alert("Não foi possível baixar a imagem. Tente novamente.");
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.textContent = textoOriginal;
        }
    }
}

// Baixa todas as fotos de um conjunto de notas (usado pelo grupo) juntas
// num único .zip, já que baixar uma por uma seria bem mais trabalhoso pro
// usuário.
async function baixarImagensAgrupadas(notas, clienteNome, nomeArquivoZip, botao) {
    if (typeof JSZip === "undefined") {
        alert("Não foi possível carregar a biblioteca de zip. Verifique sua conexão e tente novamente.");
        return;
    }

    const notasComFoto = notas.filter(n => n.img);
    if (notasComFoto.length === 0) {
        alert("Nenhuma nota deste grupo tem foto anexada.");
        return;
    }

    const textoOriginal = botao ? botao.textContent : null;
    if (botao) {
        botao.disabled = true;
        botao.textContent = "Baixando...";
    }

    try {
        const zip = new JSZip();

        const resultados = await Promise.allSettled(
            notasComFoto.map(async (nota, indice) => {
                const resposta = await fetch(nota.img);
                if (!resposta.ok) throw new Error(`Falha ao baixar imagem da nota ${nota.numeroNota || indice + 1}`);

                const blob = await resposta.blob();
                const extensao = obterExtensaoImagem(nota.img);
                const nomeArquivo = `nota-${nota.numeroNota || indice + 1}.${extensao}`;
                zip.file(nomeArquivo, blob);
            })
        );

        const falhas = resultados.filter(r => r.status === "rejected");
        if (falhas.length > 0) {
            console.error("Algumas imagens não puderam ser baixadas:", falhas);
        }

        if (falhas.length === notasComFoto.length) {
            throw new Error("Nenhuma imagem pôde ser baixada.");
        }

        const conteudoZip = await zip.generateAsync({ type: "blob" });
        const urlBlob = URL.createObjectURL(conteudoZip);
        const link = document.createElement("a");
        link.href = urlBlob;
        link.download = nomeArquivoZip;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(urlBlob);

        if (falhas.length > 0) {
            alert(`${falhas.length} de ${notasComFoto.length} foto(s) não puderam ser baixadas, mas o restante está no zip.`);
        }

    } catch (erro) {
        console.error(erro);
        alert("Erro ao baixar as fotos do grupo.");
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.textContent = textoOriginal;
        }
    }
}

// ==================== IMPORTAR CLIENTES VIA CSV ====================

const btnImportarCsv = document.getElementById("btnImportarCsv");
const inputImportarCsv = document.getElementById("inputImportarCsv");
const importarCsvArea = document.getElementById("importarCsvArea");
const previaImportacaoCsv = document.getElementById("previaImportacaoCsv");

let clientesParaImportar = [];

if (btnImportarCsv && inputImportarCsv) {
    btnImportarCsv.addEventListener("click", () => inputImportarCsv.click());

    inputImportarCsv.addEventListener("change", async (e) => {
        const arquivo = e.target.files[0];
        if (!arquivo) return;

        await processarCsvClientes(arquivo);

        // Permite selecionar o mesmo arquivo de novo depois (senão o "change"
        // não dispara de novo pro mesmo arquivo)
        inputImportarCsv.value = "";
    });
}

async function processarCsvClientes(arquivo) {
    limparFeedbackCliente();

    if (typeof Papa === "undefined") {
        mostrarFeedbackCliente("Não foi possível carregar a biblioteca de CSV. Verifique sua conexão e tente novamente.", "erro");
        return;
    }

    try {
        const buffer = await arquivo.arrayBuffer();

        // O relatório é exportado em Windows-1252/Latin-1, não UTF-8 — ler
        // como UTF-8 aqui bagunçaria os acentos ("Ó", "Ç", "Ã" etc.)
        const texto = new TextDecoder("windows-1252").decode(buffer);

        const resultado = Papa.parse(texto, {
            delimiter: ";",
            skipEmptyLines: true,
        });

        const linhas = resultado.data;

        // O arquivo tem linhas de cabeçalho do relatório antes da linha real
        // de colunas ("Cliente;Loja;Nome;..."), então procura ela em vez de
        // assumir que é sempre a primeira linha.
        const indiceCabecalho = linhas.findIndex(l => l[0] === "Cliente" && l.includes("Nome"));

        if (indiceCabecalho === -1) {
            mostrarFeedbackCliente("Não reconheci o formato deste CSV. Confira se é o relatório de clientes exportado do sistema antigo.", "erro");
            return;
        }

        const colunas = linhas[indiceCabecalho];
        const idxNome = colunas.indexOf("Nome");
        const idxCpf = colunas.indexOf("CPF"); // na prática guarda o CNPJ, apesar do nome da coluna
        const idxFone = colunas.indexOf("Fone");
        const idxCelular = colunas.indexOf("Celular");
        const idxEmail = colunas.indexOf("Email");
        const idxEndereco = colunas.indexOf("Endereco");
        const idxNumero = colunas.indexOf("Numero");
        const idxCidade = colunas.indexOf("Cidade");

        // Alguns campos numéricos/CNPJ vêm com um apóstrofo na frente
        // (truque do Excel pra não perder zero à esquerda) — tira daqui.
        const limpar = (valor) => (valor || "").replace(/^'/, "").trim();

        clientesParaImportar = linhas
            .slice(indiceCabecalho + 1)
            .filter(linha => linha[idxNome] && linha[idxNome].trim())
            .map(linha => {
                const enderecoBase = limpar(linha[idxEndereco]);
                const numero = limpar(linha[idxNumero]);
                const cidade = limpar(linha[idxCidade]);

                return {
                    cliente: limpar(linha[idxNome]),
                    cnpj: limpar(linha[idxCpf]),
                    telefone: limpar(linha[idxCelular]) || limpar(linha[idxFone]),
                    email: limpar(linha[idxEmail]),
                    endereco: [enderecoBase, numero].filter(Boolean).join(", "),
                    // O relatório não tem coluna de Bairro — uso a Cidade como
                    // aproximação provisória. Isso é só a prévia; dá pra
                    // corrigir campo a campo depois que a importação de
                    // verdade existir no backend.
                    bairro: cidade,
                    complemento: "",
                };
            });

        exibirPreviaImportacaoCsv();

    } catch (erro) {
        console.error(erro);
        mostrarFeedbackCliente("Erro ao ler o arquivo CSV.", "erro");
    }
}

function exibirPreviaImportacaoCsv() {
    if (!previaImportacaoCsv) return;

    if (clientesParaImportar.length === 0) {
        previaImportacaoCsv.hidden = true;
        previaImportacaoCsv.innerHTML = "";
        mostrarFeedbackCliente("Nenhum cliente válido encontrado nesse CSV.", "erro");
        return;
    }

    const semCnpj = clientesParaImportar.filter(c => !c.cnpj).length;
    const semTelefone = clientesParaImportar.filter(c => !c.telefone).length;

    previaImportacaoCsv.hidden = false;
    previaImportacaoCsv.innerHTML = `
        <p class="previa-importacao-resumo">
            <strong>${clientesParaImportar.length}</strong> cliente(s) encontrados no CSV.
        </p>
        <ul class="previa-importacao-avisos">
            <li>⚠️ O campo <strong>Bairro</strong> foi preenchido com a Cidade do relatório (o CSV não tem essa coluna) — revise antes de importar de verdade.</li>
            ${semCnpj ? `<li>${semCnpj} cliente(s) sem CNPJ no relatório.</li>` : ""}
            ${semTelefone ? `<li>${semTelefone} cliente(s) sem telefone no relatório.</li>` : ""}
        </ul>
        <ul class="previa-importacao-lista">
            ${clientesParaImportar.slice(0, 8).map(c => `<li>${c.cliente}${c.cnpj ? ` — ${c.cnpj}` : ""}</li>`).join("")}
            ${clientesParaImportar.length > 8 ? `<li>e mais ${clientesParaImportar.length - 8}...</li>` : ""}
        </ul>
        <div class="previa-importacao-acoes">
            <button type="button" id="btnCancelarImportacaoCsv" class="button button-secundario">Cancelar</button>
            <button type="button" id="btnConfirmarImportacaoCsv" class="button">Confirmar Importação (${clientesParaImportar.length})</button>
        </div>
    `;

    previaImportacaoCsv.querySelector("#btnCancelarImportacaoCsv").addEventListener("click", () => {
        clientesParaImportar = [];
        previaImportacaoCsv.hidden = true;
        previaImportacaoCsv.innerHTML = "";
        limparFeedbackCliente();
    });

    previaImportacaoCsv.querySelector("#btnConfirmarImportacaoCsv").addEventListener("click", confirmarImportacaoCsv);
}

// A rota de importação em lote ainda não existe no backend — combinado que
// ela vem depois. Isso já está pronto pra chamar assim que ela existir; até
// lá, o clique vai só mostrar o erro de rota não encontrada.
async function confirmarImportacaoCsv() {
    const btnConfirmar = document.getElementById("btnConfirmarImportacaoCsv");
    const textoOriginal = btnConfirmar ? btnConfirmar.textContent : null;

    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = "Importando...";
    }

    try {
        const resposta = await fetchAutenticado("https://sos-alimentos-servidor.onrender.com/api/clientes/importar-lote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ clientes: clientesParaImportar })
        });

        const respostaData = await resposta.json().catch(() => ({}));

        if (resposta.ok) {
            const importados = respostaData.importados ?? clientesParaImportar.length;
            const ignorados = respostaData.ignorados || [];

            if (ignorados.length > 0) {
                console.warn("Clientes ignorados na importação:", ignorados);
                mostrarFeedbackCliente(
                    `✅ ${importados} cliente(s) importado(s). ⚠️ ${ignorados.length} ignorado(s) (nome duplicado ou dado inválido) — veja o console para detalhes.`,
                    "aviso"
                );
            } else {
                mostrarFeedbackCliente(`✅ ${importados} cliente(s) importado(s) com sucesso!`, "sucesso");
            }

            clientesParaImportar = [];
            previaImportacaoCsv.hidden = true;
            previaImportacaoCsv.innerHTML = "";
            carregarClientes();
        } else {
            mostrarFeedbackCliente(respostaData.erro || "Erro ao importar clientes.", "erro");
        }

    } catch (erro) {
        console.error(erro);
        mostrarFeedbackCliente("Não foi possível importar o CSV. Verifique sua conexão e tente novamente.", "erro");
    } finally {
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = textoOriginal;
        }
    }
}

// ==================== BUSCA DE CNPJ (BrasilAPI) ====================

// Valida o CNPJ pelo algoritmo oficial de dígitos verificadores
// (não só o formato/tamanho — CNPJs com dígitos errados são rejeitados aqui).
function validarCNPJ(cnpjBruto) {
    const cnpj = String(cnpjBruto).replace(/[^\d]+/g, '');

    if (cnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false; // ex: 00000000000000

    const calcularDigito = (base) => {
        let soma = 0;
        let pos = base.length - 7;

        for (let i = base.length; i >= 1; i--) {
            soma += Number(base.charAt(base.length - i)) * pos--;
            if (pos < 2) pos = 9;
        }

        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };

    const digito1 = calcularDigito(cnpj.substring(0, 12));
    if (digito1 !== Number(cnpj.charAt(12))) return false;

    const digito2 = calcularDigito(cnpj.substring(0, 13));
    if (digito2 !== Number(cnpj.charAt(13))) return false;

    return true;
}

// Mesmo regex usado no cadastro de usuário (rota /api/auth/cadastro no backend),
// pra manter a mesma definição de "telefone válido" em todo o sistema.
const TELEFONE_REGEX = /^\s*(\d{2})?[-. ]?(\d{4,5})[-. ]?(\d{4})\s*$/;

function validarTelefone(telefone) {
    return TELEFONE_REGEX.test(telefone);
}

// Formata o telefone vindo da BrasilAPI (ex: "11987654321") como "(11) 98765-4321",
// já deixando num formato reconhecível pelo TELEFONE_REGEX acima.
function formatarTelefoneCnpj(telefoneBruto) {
    const digitos = String(telefoneBruto || "").replace(/\D+/g, "");
    if (!digitos) return "";

    const ddd = digitos.slice(0, 2);
    const numero = digitos.slice(2);

    if (!ddd || !numero) return digitos;

    if (numero.length === 5) {
        return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
    }

    if (numero.length === 4) {
        return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
    }

    return `(${ddd}) ${numero}`;
}

async function buscarDadosCnpj() {
    const cnpjLimpo = inputCnpj.value.replace(/[^\d]+/g, '');

    if (!validarCNPJ(cnpjLimpo)) {
        alert("CNPJ inválido. Confira os números digitados.");
        inputCnpj.focus();
        return;
    }

    const textoOriginalBotao = btnBuscarCnpj.textContent;
    btnBuscarCnpj.disabled = true;
    btnBuscarCnpj.textContent = "⏳";

    try {
        const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);

        if (resposta.status === 404) {
            alert("CNPJ não encontrado na Receita Federal.");
            return;
        }

        if (!resposta.ok) {
            throw new Error(`Erro ${resposta.status} ao consultar o CNPJ.`);
        }

        const dados = await resposta.json();
        preencherFormularioComCnpj(dados);
        verificarAlteracoesCliente(); // .value programático não dispara "input" sozinho

    } catch (erro) {
        console.error(erro);
        alert("Não foi possível buscar os dados desse CNPJ agora. Tente novamente em instantes.");
    } finally {
        btnBuscarCnpj.disabled = false;
        btnBuscarCnpj.textContent = textoOriginalBotao;
    }
}

// Preenche o formulário de cliente com os dados retornados pela BrasilAPI.
// Todos os campos continuam editáveis normalmente depois de preenchidos.
function preencherFormularioComCnpj(dados) {
    const campoCliente = formNovoCliente.querySelector("#cliente");
    const campoEmail = formNovoCliente.querySelector("[name='email']");
    const campoTelefone = formNovoCliente.querySelector("#telefone");
    const campoEndereco = formNovoCliente.querySelector("#endereco");
    const campoComplemento = formNovoCliente.querySelector("#complemento");
    const campoBairro = formNovoCliente.querySelector("#bairro");

    if (campoCliente) {
        campoCliente.value = dados.nome_fantasia || dados.razao_social || campoCliente.value;
    }

    const emailCnpj = (dados.email || "").trim();
    if (campoEmail && emailCnpj) {
        campoEmail.value = emailCnpj;
    } else if (!emailCnpj) {
        // A Receita Federal só tem e-mail quando a empresa optou por informar —
        // boa parte dos CNPJs simplesmente não tem esse dado, então não é um bug
        // se esse campo às vezes ficar em branco.
        console.info("BrasilAPI não retornou e-mail para este CNPJ.");
    }

    if (campoTelefone) {
        const telefoneFormatado = formatarTelefoneCnpj(dados.ddd_telefone_1);
        if (telefoneFormatado) {
            campoTelefone.value = telefoneFormatado;
        }
    }

    if (campoEndereco) {
        const tipoLogradouro = dados.descricao_tipo_de_logradouro || "";
        const partesEndereco = [
            [tipoLogradouro, dados.logradouro].filter(Boolean).join(" "),
            dados.numero
        ].filter(Boolean);

        if (partesEndereco.length) {
            campoEndereco.value = partesEndereco.join(", ");
        }
    }

    if (campoComplemento && dados.complemento) {
        campoComplemento.value = dados.complemento;
    }

    if (campoBairro && dados.bairro) {
        campoBairro.value = dados.bairro;
    }
}

// ==================== MODO VISUALIZAR/EDITAR CLIENTE ====================

// Campos do form de cliente que participam da edição (fora o CNPJ, que também
// entra aqui pois pode ser alterado manualmente mesmo depois de buscado).
function camposClienteEditaveis() {
    return [
        formNovoCliente.querySelector("#cliente"),
        formNovoCliente.querySelector("[name='email']"),
        formNovoCliente.querySelector("#cnpj"),
        formNovoCliente.querySelector("#telefone"),
        formNovoCliente.querySelector("#endereco"),
        formNovoCliente.querySelector("#complemento"),
        formNovoCliente.querySelector("#bairro"),
    ].filter(Boolean);
}

// Espaços no início/fim não contam como alteração real — por isso o trim().
function capturarValoresAtuaisCliente() {
    const valores = {};
    camposClienteEditaveis().forEach(campo => {
        valores[campo.name] = campo.value.trim();
    });
    return valores;
}

function houveAlteracaoPendenteCliente() {
    if (estadoModalCliente !== "editando" || !valoresOriginaisCliente) return false;

    const atuais = capturarValoresAtuaisCliente();
    return Object.keys(atuais).some(
        chave => atuais[chave] !== (valoresOriginaisCliente[chave] || "")
    );
}

function verificarAlteracoesCliente() {
    if (estadoModalCliente !== "editando") return;
    btnSubmitCliente.disabled = !houveAlteracaoPendenteCliente();
}

// Aplica visualmente o estado atual (título, textos dos botões, campos
// travados/liberados) — chamada sempre que estadoModalCliente muda.
function aplicarEstadoModalCliente() {
    const tituloEl = document.getElementById("tituloModalCliente");
    const bloquearCampos = estadoModalCliente === "visualizar";

    camposClienteEditaveis().forEach(campo => {
        campo.disabled = bloquearCampos;
    });
    if (btnBuscarCnpj) btnBuscarCnpj.disabled = bloquearCampos;

    btnSubmitCliente.classList.remove("sem-alteracoes");

    // Importação em lote só faz sentido no cadastro de clientes novos
    if (importarCsvArea) importarCsvArea.hidden = estadoModalCliente !== "criar";
    if (estadoModalCliente !== "criar" && previaImportacaoCsv) {
        previaImportacaoCsv.hidden = true;
        previaImportacaoCsv.innerHTML = "";
        clientesParaImportar = [];
    }

    if (estadoModalCliente === "criar") {
        if (tituloEl) tituloEl.innerHTML = `Registrar Novo Cliente <span>SOS</span>`;
        btnSubmitCliente.textContent = "ENVIAR";
        btnSubmitCliente.disabled = false;
        btnCancelarEdicaoCliente.hidden = true;

    } else if (estadoModalCliente === "visualizar") {
        if (tituloEl) tituloEl.innerHTML = `Detalhes do Cliente <span>SOS</span>`;
        btnSubmitCliente.textContent = "Editar";
        btnSubmitCliente.disabled = false;
        btnCancelarEdicaoCliente.hidden = true;

    } else if (estadoModalCliente === "editando") {
        if (tituloEl) tituloEl.innerHTML = `Editar Cliente <span>SOS</span>`;
        btnSubmitCliente.textContent = "Salvar";
        btnSubmitCliente.classList.add("sem-alteracoes");
        btnSubmitCliente.disabled = true; // só libera quando algo realmente mudar
        btnCancelarEdicaoCliente.hidden = false;
    }
}

// Abre o modal já preenchido com os dados do cliente, em modo de visualização
// (campos travados) — chamado pelo botão "Editar" do card do cliente.
function abrirModalClienteParaEdicao(cliente) {
    clienteEmEdicao = cliente;
    estadoModalCliente = "visualizar";
    valoresOriginaisCliente = null;

    formNovoCliente.reset();
    formNovoCliente.querySelector("#cliente").value = cliente.cliente || "";
    formNovoCliente.querySelector("[name='email']").value = cliente.email || "";
    formNovoCliente.querySelector("#cnpj").value = cliente.cnpj || "";
    if (formNovoCliente.querySelector("#telefone")) {
        formNovoCliente.querySelector("#telefone").value = cliente.telefone || "";
    }
    formNovoCliente.querySelector("#endereco").value = cliente.endereco || "";
    formNovoCliente.querySelector("#complemento").value = cliente.complemento || "";
    formNovoCliente.querySelector("#bairro").value = cliente.bairro || "";

    aplicarEstadoModalCliente();

    modalContainer.style.display = "flex";
    document.body.style.overflow = "hidden";
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
            if (inputNotaJaPaga && btnNotaJaPaga) {
                inputNotaJaPaga.value = "false";
                btnNotaJaPaga.setAttribute("aria-pressed", "false");
                btnNotaJaPaga.classList.remove("ativo");
                btnNotaJaPaga.textContent = "💰 Registrar como já paga";
            }
            limparFeedbackNota();

            inputIdCliente.value = "";
            inputNumeroNota.value = "";
            inputEmailNota.value = "";
            inputDataEmissao.value = obterDataLocalISO(new Date());

            const campoEntregadorNota = document.getElementById("campoEntregadorNota");
            const inputEntregadorNota = document.getElementById("entregadorNota");
            if (campoEntregadorNota) {
                const podeEscolherEntregador = userRole === "admin" || userRole === "financeiro";
                campoEntregadorNota.hidden = !podeEscolherEntregador;
                if (podeEscolherEntregador) {
                    if (inputEntregadorNota) inputEntregadorNota.value = "";
                    if (todosEntregadores.length === 0) carregarEntregadores();
                }
            }

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

            if (page === "faturamento") {
                renderFaturamento();
            }
        });
    });

    if (btnSair) {
        btnSair.addEventListener("click", (e) => {
            e.preventDefault();

        })
    }

    // Abrir modal Cliente (sempre em modo de criação)
    if (btnAbrirModal) {
        btnAbrirModal.addEventListener("click", (e) => {
            e.preventDefault();

            estadoModalCliente = "criar";
            clienteEmEdicao = null;
            valoresOriginaisCliente = null;

            formNovoCliente.reset();
            aplicarEstadoModalCliente();
            limparFeedbackCliente();

            modalContainer.style.display = "flex";
            document.body.style.overflow = "hidden";
        });
    }

    // Fechar modal Cliente — se houver alteração pendente no modo de edição,
    // confirma antes de descartar (clique fora, X, ou ESC eventualmente).
    function fecharModal() {
        if (houveAlteracaoPendenteCliente()) {
            const confirmarSaida = confirm("Você tem alterações não salvas. Deseja sair sem salvar?");
            if (!confirmarSaida) return; // usuário desistiu de fechar, mantém o modal aberto
        }

        modalContainer.style.display = "none";
        document.body.style.overflow = "";

        estadoModalCliente = "criar";
        clienteEmEdicao = null;
        valoresOriginaisCliente = null;
        clientesParaImportar = [];

        if (previaImportacaoCsv) {
            previaImportacaoCsv.hidden = true;
            previaImportacaoCsv.innerHTML = "";
        }
        limparFeedbackCliente();

        if (formNovoCliente) {
            formNovoCliente.reset();
        }
    }

    if (btnFecharModal) {
        btnFecharModal.addEventListener("click", fecharModal);
    }

    if (btnBuscarCnpj) {
        btnBuscarCnpj.addEventListener("click", buscarDadosCnpj);
    }

    // "Cancelar" edição: descarta as mudanças e volta pro modo de visualização
    // com os valores originais do cliente, sem fechar o modal.
    if (btnCancelarEdicaoCliente) {
        btnCancelarEdicaoCliente.addEventListener("click", () => {
            if (!clienteEmEdicao) return;

            estadoModalCliente = "visualizar";
            formNovoCliente.querySelector("#cliente").value = clienteEmEdicao.cliente || "";
            formNovoCliente.querySelector("[name='email']").value = clienteEmEdicao.email || "";
            formNovoCliente.querySelector("#cnpj").value = clienteEmEdicao.cnpj || "";
            if (formNovoCliente.querySelector("#telefone")) {
                formNovoCliente.querySelector("#telefone").value = clienteEmEdicao.telefone || "";
            }
            formNovoCliente.querySelector("#endereco").value = clienteEmEdicao.endereco || "";
            formNovoCliente.querySelector("#complemento").value = clienteEmEdicao.complemento || "";
            formNovoCliente.querySelector("#bairro").value = clienteEmEdicao.bairro || "";

            valoresOriginaisCliente = null;
            aplicarEstadoModalCliente();
        });
    }

    // Reavalia se há alteração real (ignorando espaços extras) a cada
    // digitação, só importa enquanto estiver no modo de edição.
    if (formNovoCliente) {
        formNovoCliente.addEventListener("input", verificarAlteracoesCliente);
    }

    // Fechar modal nota
    function fecharModalNota() {
        modalContainerNota.style.display = "none";
        document.body.style.overflow = "";
        formNota.reset();
        inputIdCliente.value = "";
        inputNumeroNota.value = "";
        if (inputNotaJaPaga && btnNotaJaPaga) {
            inputNotaJaPaga.value = "false";
            btnNotaJaPaga.setAttribute("aria-pressed", "false");
            btnNotaJaPaga.classList.remove("ativo");
            btnNotaJaPaga.textContent = "💰 Registrar como já paga";
        }
        // Garantir limpeza explícita dos campos de entregador (visível + hidden id)
        const inputEntregadorNota = document.getElementById('entregadorNota');
        const inputEntregadorNotaId = document.getElementById('entregadorSelecionadoId');
        if (inputEntregadorNota) inputEntregadorNota.value = "";
        if (inputEntregadorNotaId) inputEntregadorNotaId.value = "";
        limparFeedbackNota();
    }

    btnFecharModalNota.addEventListener("click", fecharModalNota);

    // Fechar modal de imagem ampliada da nota
    function fecharModalImagemNota() {
        modalImagemNota.style.display = "none";
        modalImagemNota.classList.remove("modo-somente-visualizacao");
        document.body.style.overflow = "";
        imagemNotaAmpliada.src = "";
    }

    btnFecharModalImagem.addEventListener("click", fecharModalImagemNota);

    window.addEventListener("mousedown", (e) => {
        if (e.target === modalContainer) {
            fecharModal();
        }
        if (e.target === modalContainerNota) {
            fecharModalNota();
        }
        if (e.target === modalImagemNota) {
            fecharModalImagemNota();
        }
        if (e.target === modalPlanejarRotas) {
            fecharModalPlanejarRotas();
        }
    });



    // Botão de pagamento no cadastro de nota
    if (btnNotaJaPaga && inputNotaJaPaga) {
        btnNotaJaPaga.addEventListener("click", () => {
            const ativo = inputNotaJaPaga.value === "true";
            inputNotaJaPaga.value = ativo ? "false" : "true";
            btnNotaJaPaga.setAttribute("aria-pressed", String(!ativo));
            btnNotaJaPaga.classList.toggle("ativo", !ativo);
            btnNotaJaPaga.textContent = !ativo ? "✅ Nota será registrada como paga" : "💰 Registrar como já paga";
        });
    }

    // Formulário Cliente
    if (formNovoCliente) {
        formNovoCliente.addEventListener("submit", async (e) => {
            e.preventDefault();

            // No modo de visualização, o botão "Editar" só destrava os campos —
            // não envia nada ainda.
            if (estadoModalCliente === "visualizar") {
                valoresOriginaisCliente = capturarValoresAtuaisCliente();
                estadoModalCliente = "editando";
                aplicarEstadoModalCliente();
                formNovoCliente.querySelector("#cliente")?.focus();
                return;
            }

            const telefoneDigitado = formNovoCliente.querySelector("#telefone")?.value.trim();

            if (telefoneDigitado && !validarTelefone(telefoneDigitado)) {
                alert("Telefone inválido. Confira o número digitado.");
                formNovoCliente.querySelector("#telefone")?.focus();
                return;
            }

            const editando = estadoModalCliente === "editando";

            btnSubmitCliente.disabled = true;
            btnSubmitCliente.innerText = editando ? "Salvando..." : "Enviando...";

            try {
                const formData = new FormData(formNovoCliente);
                const dados = Object.fromEntries(formData);

                // Mesma normalização usada no cadastro de usuário: só dígitos.
                if (dados.telefone) {
                    dados.telefone = dados.telefone.replace(/\D+/g, "");
                }

                const url = editando
                    ? `https://sos-alimentos-servidor.onrender.com/api/clientes/${clienteEmEdicao._id}`
                    : "https://sos-alimentos-servidor.onrender.com/api/clientes";

                const resposta = await fetchAutenticado(url, {
                    method: editando ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify(dados)
                });

                const respostaData = await resposta.json();

                if (resposta.ok) {
                    alert(editando ? "Cliente atualizado com sucesso!" : "Cliente cadastrado com sucesso!");

                    // Já foi salvo — zera o estado antes de fechar pra fecharModal()
                    // não perguntar "sair sem salvar?" à toa.
                    estadoModalCliente = "criar";
                    clienteEmEdicao = null;
                    valoresOriginaisCliente = null;

                    fecharModal();
                    carregarClientes();
                } else {
                    alert(respostaData.erro || (editando ? "Erro ao atualizar cliente." : "Erro ao cadastrar."));
                }
            } catch (erro) {
                console.error(erro);
                alert("Erro ao conectar ao servidor.");
            }

            btnSubmitCliente.disabled = false;
            btnSubmitCliente.innerText = editando ? "Salvar" : "Cadastrar";
        });
    }

    // Formulário de Nota
    if (formNota) {
        formNota.addEventListener("submit", async (e) => {
            e.preventDefault();

            const btnSubmitNota = document.getElementById("btnSubmitNota");
            const formData = new FormData(formNota);
            const dados = Object.fromEntries(formData);

            // Prioriza o id do entregador selecionado (mais confiável).
            // Mantém também o nome para exibição quando necessário.
            const entregadorIdSelecionado = document.getElementById('entregadorSelecionadoId')?.value || "";
            const entregadorNomeSelecionado = (dados.entregadorSelecionado || "").trim();

            if (entregadorIdSelecionado) {
                formData.set('entregadorId', entregadorIdSelecionado);
                if (entregadorNomeSelecionado) formData.set('entregador', entregadorNomeSelecionado);
            } else if (entregadorNomeSelecionado) {
                // fallback: enviar apenas o nome se o admin digitou manualmente
                formData.set('entregador', entregadorNomeSelecionado);
            } else {
                // nada selecionado: não enviar campos (backend usa o usuário autenticado)
                formData.delete('entregador');
                formData.delete('entregadorId');
            }

            if (!dados.idCliente) {
                mostrarFeedbackNota("⚠️ Por favor, selecione um cliente da lista sugerida para vincular a nota!", "erro");
                inputClienteNota.focus();
                return;
            }

            btnSubmitNota.disabled = true;
            btnSubmitNota.innerText = "Enviando...";

            try {
                const resposta = await fetchAutenticado("https://sos-alimentos-servidor.onrender.com/api/notas", {
                    method: "POST",
                    credentials: "include",
                    body: formData
                });

                const respostaData = await resposta.json();

                if (resposta.ok) {
                    mostrarFeedbackNota("✅ Nota registrada com sucesso!", "sucesso");

                    // Atualiza a listagem dinamicamente
                    renderAbasNotas();

                    // Garantir que o campo visível e o hidden id do entregador sejam limpos
                    const inputEntregadorNota = document.getElementById('entregadorNota');
                    const inputEntregadorNotaId = document.getElementById('entregadorSelecionadoId');
                    if (inputEntregadorNota) inputEntregadorNota.value = "";
                    if (inputEntregadorNotaId) inputEntregadorNotaId.value = "";

                    // Comportamento padrão: fechar após breve confirmação
                    btnSubmitNota.innerText = "Registrado!";
                    setTimeout(() => {
                        fecharModalNota();
                        btnSubmitNota.disabled = false;
                        btnSubmitNota.innerText = "Registrar Nota";
                    }, 1400);
                    return;
                } else {
                    mostrarFeedbackNota(respostaData.error || "Erro ao cadastrar nota.", "erro");
                }

            } catch (erro) {
                console.error(erro);
                mostrarFeedbackNota("Erro ao conectar ao servidor.", "erro");
            }

            btnSubmitNota.disabled = false;
            btnSubmitNota.innerText = "Registrar Nota";
        });
    }
    // Carregar entregadores para exibição
    async function carregarEntregadores() {
        try {
            const resposta = await fetchAutenticado(
                "https://sos-alimentos-servidor.onrender.com/api/usuarios/entregadores",
                {
                    credentials: "include"
                }
            );

            if (!resposta.ok) {
                throw new Error("Erro ao buscar entregadores");
            }

            todosEntregadores = await resposta.json();

        } catch (erro) {
            console.error("Erro ao carregar entregadores:", erro);
            todosEntregadores = [];
        }
    }

    // Autocomplete do campo "registrar em nome de" (admin/financeiro), na nota
    const inputEntregadorNota = document.getElementById("entregadorNota");
    const listaEntregadoresNota = document.getElementById("listaEntregadoresNota");

    if (inputEntregadorNota && listaEntregadoresNota) {
        const inputEntregadorNotaId = document.getElementById('entregadorSelecionadoId');
        inputEntregadorNota.addEventListener("input", () => {
            // limpeza do id quando o usuário altera o texto manualmente
            if (inputEntregadorNotaId) inputEntregadorNotaId.value = "";

            const texto = inputEntregadorNota.value.trim().toLowerCase();
            listaEntregadoresNota.innerHTML = "";
            listaEntregadoresNota.classList.remove("active");

            if (!texto) return;

            const encontrados = todosEntregadores
                .filter(en => en.nome && en.nome.toLowerCase().includes(texto))
                .slice(0, 8);

            encontrados.forEach(entregador => {
                const item = document.createElement("div");
                item.className = "autocomplete-item";
                item.textContent = entregador.nome;
                item.addEventListener("click", () => {
                    inputEntregadorNota.value = entregador.nome;
                    if (inputEntregadorNotaId) inputEntregadorNotaId.value = entregador._id || entregador.id || "";
                    listaEntregadoresNota.innerHTML = "";
                    listaEntregadoresNota.classList.remove("active");
                });
                listaEntregadoresNota.appendChild(item);
            });

            if (encontrados.length > 0) listaEntregadoresNota.classList.add("active");
        });

        document.addEventListener("click", (e) => {
            if (!e.target.closest("#campoEntregadorNota")) {
                listaEntregadoresNota.innerHTML = "";
                listaEntregadoresNota.classList.remove("active");
            }
        });
    }

    // Carregar clientes pra exibição
    async function carregarClientes() {
        try {
            clientesConteudo.innerHTML = "Carregando...";
            const resposta = await fetchAutenticado("https://sos-alimentos-servidor.onrender.com/api/clientes", { credentials: "include" });
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
        await buscarNumeroNota(cliente);
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

    async function buscarNumeroNota(cliente) {
        try {
            const resposta = await fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/notas?_=${Date.now()}`, { credentials: "include" });
            const notas = await resposta.json();

            // Mesmo critério usado em carregarNotasDoCliente/renderAbasNotas:
            // casa por nome do cliente, não por idCliente — várias notas no
            // banco têm idCliente vazio/inconsistente, o que fazia a contagem
            // vir menor que a real e todo nota nova sair numerada como "1".
            const chaveAlvo = cliente.cliente.toLowerCase().trim();
            const notasCliente = notas.filter(n => (n.cliente || "").toLowerCase().trim() === chaveAlvo);
            inputNumeroNota.value = notasCliente.length + 1;
        } catch (erro) {
            console.error(erro);
            inputNumeroNota.value = 1;
        }
    }

    // Exibicao dos clientes
    if (btnPesquisarCliente) {
        btnPesquisarCliente.addEventListener("click", carregarClientes);
    }

    function renderClientes(clientes) {
        clientesConteudo.innerHTML = "";

        const listaBase = [...clientes];

        const normalizarTexto = (valor) =>
            String(valor || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase();

        // ==========================
        // BARRA DE FERRAMENTAS
        // ==========================

        const toolbar = document.createElement("div");
        toolbar.classList.add("clientes-toolbar");

        toolbar.innerHTML = `
        <h2>Clientes</h2>

        <input
            type="text"
            id="buscaCliente"
            class="busca-cliente-notas"
            placeholder="🔍 Buscar cliente..."
            autocomplete="off"
        >

        <select id="ordenarClientes">
            <option value="nomeCre">Nome (A-Z)</option>
            <option value="nomeDec">Nome (Z-A)</option>
            <option value="id">ID</option>
        </select>

        <select id="filtrarClientes">
            <option value="">Todos</option>
            <option value="comCnpj">Com CNPJ</option>
            <option value="semCnpj">Sem CNPJ</option>
        </select>

        <button id="carregarClientes">
            🔄 Atualizar
        </button>
    `;

        clientesConteudo.appendChild(toolbar);

        // ==========================
        // LAYOUT
        // ==========================

        const area = document.createElement("div");
        area.className = "clientes-listagem-layout";

        clientesConteudo.appendChild(area);

        const indiceAZ = document.createElement("nav");
        indiceAZ.className = "notas-az-index clientes-az-index";

        area.appendChild(indiceAZ);

        const coluna = document.createElement("div");
        coluna.className = "clientes-coluna-alfabetica";

        area.appendChild(coluna);

        // ==========================
        // ELEMENTOS
        // ==========================

        const inputBusca = toolbar.querySelector("#buscaCliente");
        const ordenar = toolbar.querySelector("#ordenarClientes");
        const filtrar = toolbar.querySelector("#filtrarClientes");
        const btnAtualizar = toolbar.querySelector("#carregarClientes");

        // ==========================
        // FILTRAR / ORDENAR
        // ==========================

        function obterListaFiltrada() {

            let lista = [...listaBase];

            const termo = normalizarTexto(
                inputBusca.value.trim()
            );

            if (termo) {
                lista = lista.filter(cliente =>
                    normalizarTexto(cliente.cliente)
                        .includes(termo)
                );
            }

            if (filtrar.value === "comCnpj") {
                lista = lista.filter(cliente => cliente.cnpj);
            }

            if (filtrar.value === "semCnpj") {
                lista = lista.filter(cliente => !cliente.cnpj);
            }

            if (ordenar.value === "nomeDec") {

                lista.sort((a, b) =>
                    String(b.cliente || "").localeCompare(
                        String(a.cliente || ""),
                        "pt-BR"
                    )
                );

            } else if (ordenar.value === "id") {

                lista.sort((a, b) =>
                    String(a.id ?? "").localeCompare(
                        String(b.id ?? ""),
                        "pt-BR",
                        { numeric: true }
                    )
                );

            } else {

                lista.sort((a, b) =>
                    String(a.cliente || "").localeCompare(
                        String(b.cliente || ""),
                        "pt-BR"
                    )
                );
            }

            return lista;
        }

        // ==========================
        // RENDERIZAR
        // ==========================

        function renderLista() {

            const lista = obterListaFiltrada();

            coluna.innerHTML = "";
            indiceAZ.innerHTML = "";

            if (lista.length === 0) {

                coluna.innerHTML = `
                <p class="sem-notas-txt">
                    Nenhum cliente encontrado.
                </p>
            `;

                return;
            }

            // ==========================
            // AGRUPAR POR LETRA
            // ==========================

            const grupos = {};

            lista.forEach(cliente => {

                const nome = String(
                    cliente.cliente || ""
                ).trim();

                const letra =
                    normalizarTexto(nome)
                        .charAt(0)
                        .toUpperCase() || "#";

                if (!grupos[letra]) {
                    grupos[letra] = [];
                }

                grupos[letra].push(cliente);
            });

            // ==========================
            // ORDEM DOS GRUPOS
            // ==========================

            const letrasOrdenadas =
                Object.keys(grupos).sort((a, b) => {

                    if (ordenar.value === "nomeDec") {
                        return b.localeCompare(
                            a,
                            "pt-BR"
                        );
                    }

                    return a.localeCompare(
                        b,
                        "pt-BR"
                    );
                });

            // ==========================
            // BARRA A-Z / Z-A
            // ==========================

            let letrasIndice =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

            if (ordenar.value === "nomeDec") {
                letrasIndice.reverse();
            }

            letrasIndice.forEach(letra => {

                const existe =
                    Boolean(grupos[letra]);

                const elemento =
                    document.createElement(
                        existe ? "button" : "span"
                    );

                elemento.textContent = letra;

                elemento.className =
                    "notas-az-index-letra" +
                    (
                        existe
                            ? ""
                            : " notas-az-index-letra--vazia"
                    );

                if (existe) {

                    elemento.type = "button";

                    elemento.addEventListener(
                        "click",
                        () => {

                            const alvo =
                                document.getElementById(
                                    `clientes-letra-${letra}`
                                );

                            if (alvo) {

                                alvo.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start"
                                });
                            }
                        }
                    );
                }

                indiceAZ.appendChild(elemento);
            });

            // ==========================
            // CARDS
            // ==========================

            letrasOrdenadas.forEach(letra => {

                const secao =
                    document.createElement("section");

                secao.className =
                    "secao-letra-bloco clientes-secao-letra";

                secao.id =
                    `clientes-letra-${letra}`;

                const titulo =
                    document.createElement("h3");

                titulo.className =
                    "letra-divisor-titulo";

                titulo.textContent = letra;

                secao.appendChild(titulo);

                // ESSENCIAL:
                // os cards ficam dentro do GRID
                const grid =
                    document.createElement("div");

                grid.className =
                    "grid-clientes-nota";

                grupos[letra].forEach(cliente => {

                    const card =
                        document.createElement("div");

                    card.className =
                        "cliente-card";

                    card.innerHTML = `
                    <div class="cliente-topo">

                        <h3>
                            ${cliente.cliente || "Cliente"}
                        </h3>

                        <span class="cliente-id">
                            ID: ${cliente.id ?? "-"}
                        </span>

                    </div>

                    <p class="cliente-rua">
                        ${cliente.endereco || "Rua não cadastrada"}
                    </p>

                    <p class="cliente-bairro">
                        ${cliente.bairro || "Bairro não cadastrado"}
                    </p>

                    <div class="cliente-acoes">

                        <button
                            class="btn-editar"
                            type="button"
                        >
                            Editar
                        </button>

                        <button
                            class="btn-excluir-cliente"
                            type="button"
                        >
                            🗑️ Excluir
                        </button>

                    </div>
                `;

                    // EDITAR

                    const btnEditar =
                        card.querySelector(
                            ".btn-editar"
                        );

                    btnEditar.addEventListener(
                        "click",
                        () => {
                            abrirModalClienteParaEdicao(
                                cliente
                            );
                        }
                    );

                    // EXCLUIR

                    const btnExcluir =
                        card.querySelector(
                            ".btn-excluir-cliente"
                        );

                    btnExcluir.addEventListener(
                        "click",
                        async () => {

                            const confirmar =
                                confirm(
                                    `Excluir o cliente "${cliente.cliente}"? Essa ação não pode ser desfeita.`
                                );

                            if (!confirmar) return;

                            try {

                                const resposta =
                                    await fetchAutenticado(
                                        `https://sos-alimentos-servidor.onrender.com/api/clientes/${cliente._id}`,
                                        {
                                            method: "DELETE",
                                            credentials: "include"
                                        }
                                    );

                                const dados =
                                    await resposta
                                        .json()
                                        .catch(() => ({}));

                                if (!resposta.ok) {

                                    throw new Error(
                                        dados.erro ||
                                        dados.error ||
                                        "O servidor recusou a exclusão."
                                    );
                                }

                                await carregarClientes();

                            } catch (erro) {

                                console.error(
                                    "Erro ao excluir cliente:",
                                    erro
                                );

                                alert(
                                    erro.message ||
                                    "Erro ao excluir cliente."
                                );
                            }
                        }
                    );

                    // COLOCA O CARD NO GRID
                    grid.appendChild(card);
                });

                secao.appendChild(grid);
                coluna.appendChild(secao);
            });
        }

        // ==========================
        // EVENTOS
        // ==========================

        inputBusca.addEventListener(
            "input",
            renderLista
        );

        ordenar.addEventListener(
            "change",
            renderLista
        );

        filtrar.addEventListener(
            "change",
            renderLista
        );

        btnAtualizar.addEventListener(
            "click",
            carregarClientes
        );

        // PRIMEIRA RENDERIZAÇÃO
        renderLista();
    }



    // ==========================================
    // SEÇÃO DE NOTAS FISCAIS
    // ==========================================
    async function renderAbasNotas() {
        const notasConteudo = document.getElementById("notasConteudo");
        const notasToolbar = document.getElementById("notasToolbar");
        if (!notasConteudo) return;

        contadorNotasPorCliente = new Map();

        const respostaNotas = await fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/notas?_=${Date.now()}`, { credentials: "include" });
        const notas = await respostaNotas.json();

        const quantidadeNotas = {};
        const valorDevidoPorCliente = {};

        notas.forEach(nota => {
            // Mesmo critério usado em carregarNotasDoCliente: casa por nome do
            // cliente, não por idCliente. Algumas notas (em geral as mais antigas,
            // que coincidem com as que já estão em grupo) não têm idCliente
            // preenchido de forma confiável, então contar por id fazia elas
            // sumirem da contagem até a aba do cliente ser aberta.
            const chave = (nota.cliente || "").toLowerCase().trim();
            if (!chave) return;

            quantidadeNotas[chave] = (quantidadeNotas[chave] || 0) + 1;

            // O valor mostrado no card é somente o que ainda está pendente.
            if (!nota.pago) {
                valorDevidoPorCliente[chave] =
                    (valorDevidoPorCliente[chave] || 0) + (parseFloat(nota.valor) || 0);
            }
        });

        notasConteudo.innerHTML = "<p style='color:#9ca3af; padding:20px;'>Selecione um cliente para ver as notas.</p>";
        notasToolbar.innerHTML = "";

        const toolbarNotas = document.createElement("div");
        toolbarNotas.classList.add("clientes-toolbar");
        toolbarNotas.innerHTML = `
            <h2 style="color: white; font-size: 20px; padding: 10px 0;">Notas por Cliente (Ordem Alfabética)</h2>
            <input type="text" id="buscaClienteNotas" class="busca-cliente-notas" placeholder="🔍 Buscar cliente...">
        `;
        notasToolbar.appendChild(toolbarNotas);

        const clientesOrdenados = [...todosClientes].sort((a, b) => a.cliente.localeCompare(b.cliente));


        clientesOrdenados.forEach(cliente => {
            const chave = cliente.cliente.toLowerCase().trim();
            cliente.quantidadeNotas = quantidadeNotas[chave] || 0;
            cliente.valorDevido = valorDevidoPorCliente[chave] || 0;
        });

        const gruposAlfabeticos = {};
        clientesOrdenados.forEach(c => {
            const primeiraLetra = c.cliente.charAt(0).toUpperCase();
            if (!gruposAlfabeticos[primeiraLetra]) {
                gruposAlfabeticos[primeiraLetra] = [];
            }
            gruposAlfabeticos[primeiraLetra].push(c);
        });

        const layout = document.createElement("div");
        layout.classList.add("notas-layout");

        const indiceAZ = document.createElement("nav");
        indiceAZ.classList.add("notas-az-index");

        const containerGeral = document.createElement("div");
        containerGeral.classList.add("notas-alfabetico-container");

        "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(letra => {
            const temClientes = Boolean(gruposAlfabeticos[letra]);
            const botaoLetra = document.createElement(temClientes ? "button" : "span");
            botaoLetra.textContent = letra;
            botaoLetra.classList.add("notas-az-index-letra");
            if (!temClientes) botaoLetra.classList.add("notas-az-index-letra--vazia");

            if (temClientes) {
                botaoLetra.type = "button";
                botaoLetra.addEventListener("click", () => {
                    const alvo = document.getElementById(`secao-letra-${letra}`);
                    if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
                });
            }

            indiceAZ.appendChild(botaoLetra);
        });

        for (const letra in gruposAlfabeticos) {
            const secaoLetra = document.createElement("div");
            secaoLetra.classList.add("secao-letra-bloco");
            secaoLetra.id = `secao-letra-${letra}`;

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
                        <span class="cliente-valor-devido"><strong>Deve:</strong> ${cliente.valorDevido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
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
                wrapperCliente.dataset.nomeCliente = cliente.cliente.toLowerCase();
                wrapperCliente.appendChild(cardLinkCliente);
                wrapperCliente.appendChild(containerNotasCliente);
                gridClientesLetra.appendChild(wrapperCliente);
            });

            secaoLetra.appendChild(gridClientesLetra);
            containerGeral.appendChild(secaoLetra);
        }

        const colunaConteudo = document.createElement("div");
        colunaConteudo.classList.add("notas-coluna-conteudo");
        colunaConteudo.appendChild(containerGeral);

        layout.appendChild(indiceAZ);
        layout.appendChild(colunaConteudo);

        notasConteudo.innerHTML = "";
        notasConteudo.appendChild(layout);

        // Busca: filtra os cards de cliente pelo nome, e esconde seções de
        // letra que ficarem sem nenhum cliente visível
        const inputBuscaCliente = document.getElementById("buscaClienteNotas");
        if (inputBuscaCliente) {
            inputBuscaCliente.addEventListener("input", () => {
                const termo = inputBuscaCliente.value.trim().toLowerCase();

                containerGeral.querySelectorAll(".secao-letra-bloco").forEach(secao => {
                    let algumVisivel = false;

                    secao.querySelectorAll(".cliente-nota-wrapper").forEach(wrapper => {
                        const visivel = !termo || wrapper.dataset.nomeCliente.includes(termo);
                        wrapper.style.display = visivel ? "" : "none";
                        if (visivel) algumVisivel = true;
                    });

                    secao.style.display = algumVisivel ? "" : "none";
                });
            });
        }
    }


    // ==========================================
    // SEÇÃO LIXEIRA
    // ==========================================
    async function renderLixeira() {
        const lixeiraConteudo = document.getElementById("lixeiraConteudo");
        const lixeiraToolbar = document.getElementById("lixeiraToolbar");
        if (!lixeiraConteudo) return;

        notasLixeiraSelecionadas.clear();
        lixeiraConteudo.innerHTML = "<p class='loading-txt'>Carregando...</p>";
        if (lixeiraToolbar) lixeiraToolbar.innerHTML = "";

        try {
            const resposta = await fetchAutenticado(
                `https://sos-alimentos-servidor.onrender.com/api/notas/lixeira?_=${Date.now()}`,
                { credentials: "include" }
            );
            if (!resposta.ok) throw new Error("Não foi possível carregar a lixeira.");
            const notas = await resposta.json();

            if (lixeiraToolbar) {
                const toolbar = document.createElement("div");
                toolbar.classList.add("clientes-toolbar", "lixeira-toolbar");
                toolbar.innerHTML = `
                    <h2>Notas Excluídas (${notas.length})</h2>
                    <button type="button" id="btnExcluirLixeiraSelecionadas" class="btn-perigo" disabled>
                        🗑️ Excluir selecionadas (0)
                    </button>
                    <button type="button" id="btnSelecionarTodasLixeira" class="button-secundario">
                        Selecionar todas
                    </button>
                `;
                lixeiraToolbar.appendChild(toolbar);

                const atualizarToolbar = () => {
                    const total = notasLixeiraSelecionadas.size;
                    const btn = toolbar.querySelector("#btnExcluirLixeiraSelecionadas");
                    btn.disabled = total === 0;
                    btn.textContent = `🗑️ Excluir selecionadas (${total})`;
                };

                toolbar.querySelector("#btnSelecionarTodasLixeira").addEventListener("click", () => {
                    const todasSelecionadas = notasLixeiraSelecionadas.size === notas.length;
                    notasLixeiraSelecionadas = todasSelecionadas
                        ? new Set()
                        : new Set(notas.map(n => String(n._id)));

                    lixeiraConteudo.querySelectorAll(".check-lixeira-nota").forEach(check => {
                        check.checked = notasLixeiraSelecionadas.has(check.dataset.id);
                    });

                    atualizarToolbar();
                });

                toolbar.querySelector("#btnExcluirLixeiraSelecionadas").addEventListener("click", async () => {
                    const ids = [...notasLixeiraSelecionadas];
                    if (!ids.length) return;

                    if (!confirm(`Excluir definitivamente ${ids.length} nota(s) selecionada(s)? Essa ação não pode ser desfeita.`)) {
                        return;
                    }

                    const btn = toolbar.querySelector("#btnExcluirLixeiraSelecionadas");
                    btn.disabled = true;
                    btn.textContent = "Excluindo...";

                    try {
                        const respostas = await Promise.all(
                            ids.map(id => fetchAutenticado(
                                `https://sos-alimentos-servidor.onrender.com/api/notas/${id}/permanente`,
                                { method: "DELETE", credentials: "include" }
                            ))
                        );

                        const falhas = respostas.filter(r => !r.ok);
                        if (falhas.length) {
                            throw new Error(`${falhas.length} nota(s) não puderam ser excluídas.`);
                        }

                        await renderLixeira();
                    } catch (erro) {
                        console.error(erro);
                        alert(erro.message || "Erro ao excluir notas.");
                        atualizarToolbar();
                    }
                });
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

            const atualizarToolbar = () => {
                const btn = document.getElementById("btnExcluirLixeiraSelecionadas");
                if (!btn) return;
                const total = notasLixeiraSelecionadas.size;
                btn.disabled = total === 0;
                btn.textContent = `🗑️ Excluir selecionadas (${total})`;
            };

            lixeiraConteudo.querySelectorAll(".check-lixeira-nota").forEach(check => {
                check.addEventListener("change", () => {
                    const id = String(check.dataset.id);
                    if (check.checked) notasLixeiraSelecionadas.add(id);
                    else notasLixeiraSelecionadas.delete(id);
                    check.closest(".nota-lixeira-card")?.classList.toggle("selecionada", check.checked);
                    atualizarToolbar();
                });
            });
        } catch (erro) {
            console.error(erro);
            lixeiraConteudo.innerHTML = `<p class='erro-txt'>${erro.message || "Erro ao carregar a lixeira."}</p>`;
        }
    }

    function criarCardNotaLixeira(nota) {
        const card = document.createElement("div");
        card.classList.add("cliente-card", "nota-fiscal-card-ajuste", "nota-lixeira-card");

        const valorFormatado = parseFloat(nota.valor || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });

        let dataFormatada = "Não informada";
        if (nota.dataEmissao) {
            const partes = nota.dataEmissao.split("T")[0].split("-");
            if (partes.length === 3) dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }

        let deletadoFormatado = "Não informada";
        if (nota.deletadoEm) {
            const d = new Date(nota.deletadoEm);
            if (!isNaN(d)) deletadoFormatado = d.toLocaleDateString("pt-BR");
        }

        card.innerHTML = `
            <label class="lixeira-selecao">
                <input type="checkbox" class="check-lixeira-nota" data-id="${nota._id}">
                <span>Selecionar</span>
            </label>
            <div class="cliente-topo">
                <h3>${nota.cliente || "Cliente"} — Nota Nº ${nota.numeroNota || "-"}</h3>
                <span class="nota-tag-valor">${valorFormatado}</span>
            </div>
            <p class="cliente-data"><strong>Emissão:</strong> ${dataFormatada}</p>
            <p class="cliente-excluida"><strong>Excluída em:</strong> ${deletadoFormatado}</p>
            <div class="nota-image">
                <img src="${nota.img || ""}" alt="Foto da nota">
            </div>
            <div class="lixeira-card-acoes">
                <button class="btn-restaurar-nota" type="button">♻️ Restaurar</button>
                <button class="btn-excluir-permanente" type="button">🗑️ Excluir Definitivamente</button>
            </div>
        `;

        const imgNota = card.querySelector(".nota-image img");
        if (nota.img) imgNota.addEventListener("click", () => window.open(nota.img, "_blank"));

        card.querySelector(".btn-restaurar-nota").addEventListener("click", async () => {
            if (!confirm("Restaurar esta nota? Ela volta a aparecer normalmente.")) return;
            try {
                const resposta = await fetchAutenticado(
                    `https://sos-alimentos-servidor.onrender.com/api/notas/${nota._id}/restaurar`,
                    { method: "PUT", credentials: "include" }
                );
                if (!resposta.ok) throw new Error("Erro ao restaurar nota.");
                await renderLixeira();
            } catch (erro) {
                console.error(erro);
                alert(erro.message || "Erro ao restaurar nota.");
            }
        });

        card.querySelector(".btn-excluir-permanente").addEventListener("click", async () => {
            if (!confirm("Excluir esta nota DEFINITIVAMENTE? Essa ação não pode ser desfeita.")) return;
            try {
                const resposta = await fetchAutenticado(
                    `https://sos-alimentos-servidor.onrender.com/api/notas/${nota._id}/permanente`,
                    { method: "DELETE", credentials: "include" }
                );
                if (!resposta.ok) throw new Error("Erro ao excluir nota permanentemente.");
                await renderLixeira();
            } catch (erro) {
                console.error(erro);
                alert(erro.message || "Erro ao excluir nota permanentemente.");
            }
        });

        return card;
    }

    // ==========================================
    // SEÇÃO DE FATURAMENTO (valor de notas por período)
    // ==========================================

    // Formata uma data LOCAL (do navegador) como "YYYY-MM-DD" pro valor
    // default dos inputs type="date". Evita toISOString(), que converte pra
    // UTC e pode "voltar" a data um dia dependendo do horário/fuso.
    function obterDataLocalISO(data) {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        const dia = String(data.getDate()).padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
    }

    async function renderFaturamento() {
        const faturamentoConteudo = document.getElementById("faturamentoConteudo");
        const faturamentoToolbar = document.getElementById("faturamentoToolbar");
        if (!faturamentoConteudo) return;

        // Default pedido: dia atual. Só define na primeira vez que a aba é
        // aberta — trocas de data feitas pelo usuário depois disso persistem
        // enquanto ele navega entre as abas.
        if (!filtroFaturamentoInicio || !filtroFaturamentoFim) {
            const hojeISO = obterDataLocalISO(new Date());
            filtroFaturamentoInicio = hojeISO;
            filtroFaturamentoFim = hojeISO;
        }

        faturamentoConteudo.innerHTML = "<p style='color:#9ca3af; padding:20px;'>Carregando...</p>";
        if (faturamentoToolbar) faturamentoToolbar.innerHTML = "";

        try {
            const resposta = await fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/notas?_=${Date.now()}`, { credentials: "include" });
            notasFaturamentoCache = await resposta.json();

            if (faturamentoToolbar) montarToolbarFaturamento(faturamentoToolbar);
            montarResumoEListaFaturamento(faturamentoConteudo);

        } catch (erro) {
            console.error(erro);
            faturamentoConteudo.innerHTML = "<p class='erro-txt'>Erro ao carregar o faturamento.</p>";
        }
    }

    function montarToolbarFaturamento(container) {
        container.innerHTML = "";

        const toolbar = document.createElement("div");
        toolbar.classList.add("clientes-toolbar", "faturamento-toolbar");
        toolbar.innerHTML = `
            <h2 style="color: white; font-size: 20px; padding: 10px 0;">Faturamento</h2>

            <div class="faturamento-presets">
                <button type="button" data-preset="hoje">Hoje</button>
                <button type="button" data-preset="ontem">Ontem</button>
                <button type="button" data-preset="semana">Últimos 7 dias</button>
                <button type="button" data-preset="mes">Este mês</button>
            </div>

            <div class="faturamento-periodo">
                <label>De <input type="date" id="faturamentoDataInicio" value="${filtroFaturamentoInicio}"></label>
                <label>Até <input type="date" id="faturamentoDataFim" value="${filtroFaturamentoFim}"></label>
                <button type="button" id="btnExportarFaturamento" class="btn-exportar" title="Exportar como notinha">🧾 Exportar</button>
            </div>
        `;
        container.appendChild(toolbar);

        toolbar.querySelector("#btnExportarFaturamento").addEventListener("click", exportarFaturamentoComoNotinha);

        const inputInicio = toolbar.querySelector("#faturamentoDataInicio");
        const inputFim = toolbar.querySelector("#faturamentoDataFim");

        inputInicio.addEventListener("change", () => {
            filtroFaturamentoInicio = inputInicio.value;
            if (filtroFaturamentoInicio > filtroFaturamentoFim) {
                filtroFaturamentoFim = filtroFaturamentoInicio;
                inputFim.value = filtroFaturamentoFim;
            }
            montarResumoEListaFaturamento(document.getElementById("faturamentoConteudo"));
        });

        inputFim.addEventListener("change", () => {
            filtroFaturamentoFim = inputFim.value;
            if (filtroFaturamentoFim < filtroFaturamentoInicio) {
                filtroFaturamentoInicio = filtroFaturamentoFim;
                inputInicio.value = filtroFaturamentoInicio;
            }
            montarResumoEListaFaturamento(document.getElementById("faturamentoConteudo"));
        });

        toolbar.querySelectorAll("[data-preset]").forEach(botao => {
            botao.addEventListener("click", () => {
                aplicarPresetFaturamento(botao.dataset.preset);
                inputInicio.value = filtroFaturamentoInicio;
                inputFim.value = filtroFaturamentoFim;
                montarResumoEListaFaturamento(document.getElementById("faturamentoConteudo"));
            });
        });
    }

    function aplicarPresetFaturamento(preset) {
        const hoje = new Date();

        if (preset === "hoje") {
            const iso = obterDataLocalISO(hoje);
            filtroFaturamentoInicio = iso;
            filtroFaturamentoFim = iso;
        }

        if (preset === "ontem") {
            const ontem = new Date(hoje);
            ontem.setDate(ontem.getDate() - 1);
            const iso = obterDataLocalISO(ontem);
            filtroFaturamentoInicio = iso;
            filtroFaturamentoFim = iso;
        }

        if (preset === "semana") {
            const seteDiasAtras = new Date(hoje);
            seteDiasAtras.setDate(seteDiasAtras.getDate() - 6); // hoje + 6 pra trás = 7 dias
            filtroFaturamentoInicio = obterDataLocalISO(seteDiasAtras);
            filtroFaturamentoFim = obterDataLocalISO(hoje);
        }

        if (preset === "mes") {
            const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            filtroFaturamentoInicio = obterDataLocalISO(primeiroDiaMes);
            filtroFaturamentoFim = obterDataLocalISO(hoje);
        }
    }

    // Mesmo critério usado no resto do app pra extrair a data de uma nota:
    // compara a string "YYYY-MM-DD" direto de dataEmissao (sem passar por
    // new Date()), pra não deixar o fuso horário empurrar a nota pro dia errado.
    function filtrarNotasPorPeriodo(notas, inicio, fim) {
        return notas.filter(n => {
            if (!n.dataEmissao) return false;
            const dataNota = n.dataEmissao.split("T")[0];
            return dataNota >= inicio && dataNota <= fim;
        });
    }

    function montarResumoEListaFaturamento(container) {
        if (!container) return;
        container.innerHTML = "";

        const notasAtivas = notasFaturamentoCache.filter(n => !n.deletado);
        const notasNoPeriodo = filtrarNotasPorPeriodo(notasAtivas, filtroFaturamentoInicio, filtroFaturamentoFim)
            .sort((a, b) => (b.dataEmissao || "").localeCompare(a.dataEmissao || ""));

        const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const total = notasNoPeriodo.reduce((soma, n) => soma + (parseFloat(n.valor) || 0), 0);
        const totalPago = notasNoPeriodo.filter(n => n.pago).reduce((soma, n) => soma + (parseFloat(n.valor) || 0), 0);
        const totalPendente = total - totalPago;

        const resumo = document.createElement("div");
        resumo.classList.add("info-boxes", "faturamento-resumo");
        resumo.innerHTML = `
            <div class="info-box">
                <span>💰 Total no período</span>
                <strong>${formatarMoeda(total)}</strong>
            </div>
            <div class="info-box">
                <span>🧾 Notas no período</span>
                <strong>${notasNoPeriodo.length}</strong>
            </div>
            <div class="info-box">
                <span>✅ Recebido</span>
                <strong>${formatarMoeda(totalPago)}</strong>
            </div>
            <div class="info-box">
                <span>⏳ Pendente</span>
                <strong>${formatarMoeda(totalPendente)}</strong>
            </div>
        `;
        container.appendChild(resumo);

        montarTabelaEntregadores(container, notasNoPeriodo);
    }

    // Tabela com uma coluna por entregador, listando os clientes que ele
    // atendeu no período filtrado (nome + valor + horário). Se existir uma
    // pré-tabela planejada pra esse dia, os clientes planejados aparecem
    // também, marcados como pendentes até a nota correspondente ser lançada.
    async function montarTabelaEntregadores(container, notasNoPeriodo) {
        const secao = document.createElement("div");
        secao.classList.add("tabela-entregadores-secao");

        const cabecalhoSecao = document.createElement("div");
        cabecalhoSecao.classList.add("tabela-entregadores-cabecalho");
        cabecalhoSecao.innerHTML = `
            <h3 class="tabela-entregadores-titulo">Entregas por Entregador</h3>
            <div class="tabela-entregadores-acoes">
                <button type="button" id="btnRecarregarFaturamento" class="btn-exportar-secundario" title="Recarregar dados">🔄 Recarregar</button>
                ${userRole === "admin" ? `<button type="button" id="btnPlanejarRotas" class="btn-exportar-secundario" title="Planejar rotas dos entregadores">📋 Planejar Rotas</button>` : ""}
            </div>
        `;
        secao.appendChild(cabecalhoSecao);

        cabecalhoSecao.querySelector("#btnRecarregarFaturamento").addEventListener("click", () => {
            renderFaturamento();
        });

        const btnPlanejarRotas = cabecalhoSecao.querySelector("#btnPlanejarRotas");
        if (btnPlanejarRotas) {
            btnPlanejarRotas.addEventListener("click", () => abrirModalPlanejarRotas());
        }

        const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Agrupa por entregador de forma estável usando `entregadorId` quando disponível.
        // Chave: 'id:<id>' quando tiver id, ou 'name:<nome>' como fallback para notas antigas.
        const porEntregador = new Map(); // key -> { name, list }

        notasNoPeriodo.forEach(nota => {
    const nomeEntregador = obterNomeEntregador(nota);

    // O ID é a chave principal.
    // Só usamos o nome para notas antigas que não possuem ID.
    const entregadorId = nota.entregadorId || nota.entregador_id || null;

    const key = entregadorId
        ? `id:${String(entregadorId)}`
        : `name:${nomeEntregador.trim().toLowerCase()}`;

    let hora = "--:--";
    let timestamp = 0;
            
            if (nota.createdAt) {
                const data = new Date(nota.createdAt);
                if (!isNaN(data)) {
                    hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    timestamp = data.getTime();
                }
            }

            if (!porEntregador.has(key)) porEntregador.set(key, { name: nomeEntregador, list: [] });
            porEntregador.get(key).list.push({
                cliente: nota.cliente || "Cliente não identificado",
                valor: parseFloat(nota.valor) || 0,
                hora,
                timestamp,
                nota,
                confirmado: true
            });
        });

        // Pré-tabela planejada: só faz sentido pra um único dia (rota é por
        // data). Se o filtro for um período de vários dias, não busca.
        let rotasPlanejadas = [];
        if (filtroFaturamentoInicio === filtroFaturamentoFim) {
            rotasPlanejadas = await buscarRotasPlanejadas(filtroFaturamentoInicio);
        }

        rotasPlanejadas.forEach(rota => {

    const rotaId = rota.entregadorId
        ? String(rota.entregadorId)
        : "";

    const rotaNome = String(
        rota.entregador ||
        rota.entregadorNome ||
        "Não informado"
    ).trim();

    let rotaKey = rotaId
        ? `id:${rotaId}`
        : `name:${rotaNome.toLowerCase()}`;

    /*
     * Se a pré-tabela tem ID, mas as entregas antigas
     * foram salvas somente pelo nome, tenta encontrar
     * o entregador pelo nome antes de criar outro grupo.
     */
    if (!porEntregador.has(rotaKey) && rotaNome) {

        const nomeNormalizado = rotaNome
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();

        for (const [key, obj] of porEntregador.entries()) {

            const nomeExistente = String(obj.name || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .trim();

            if (nomeExistente === nomeNormalizado) {
                rotaKey = key;
                break;
            }
        }
    }

    if (!porEntregador.has(rotaKey)) {
        porEntregador.set(
            rotaKey,
            {
                name: rotaNome,
                list: []
            }
        );
    }

    const entregasReais = porEntregador.get(rotaKey).list;
    const usadas = new Set();

    const normalizarCliente = nome =>
        String(nome || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();

    const listaPlanejada = (rota.clientes || []).map(nomeCliente => {

        const chaveCliente = normalizarCliente(nomeCliente);

        const indiceCorrespondente = entregasReais.findIndex(
            (item, indice) =>
                !usadas.has(indice) &&
                item.confirmado &&
                normalizarCliente(item.cliente) === chaveCliente
        );

        if (indiceCorrespondente !== -1) {

            usadas.add(indice);

            return entregasReais[indice];
        }

        return {
            cliente: nomeCliente,
            valor: null,
            hora: null,
            timestamp: -1,
            nota: null,
            confirmado: false
        };
    });

    // Entregas feitas que não estavam na pré-tabela
    const extras = entregasReais.filter(
        (_, indice) => !usadas.has(indice)
    );

    porEntregador.set(
        rotaKey,
        {
            name: rotaNome,
            list: [
                ...listaPlanejada,
                ...extras
            ]
        }
    );
});

            // O que sobrou de entrega real (não estava na rota planejada) entra depois, como "extra"
            const extras = entregasReais.filter((_, i) => !usadas.has(i));

            porEntregador.set(rotaKey, { name: rotaNome, list: [...listaPlanejada, ...extras] });
        });

        if (porEntregador.size === 0) {
            const aviso = document.createElement("p");
            aviso.classList.add("sem-notas-txt");
            aviso.textContent = "Nenhuma entrega registrada nesse período.";
            secao.appendChild(aviso);
            container.appendChild(secao);
            return;
        }

        // Ordem da tabela: entregador com rota planejada SEMPRE mantém a
        // ordem em que os clientes foram adicionados na rota (nunca reordena
        // por horário, nem depois de todos confirmados). Só entregador SEM
        // rota nenhuma cai pra ordem cronológica de entrega.
const entregadoresComRota = new Set();

rotasPlanejadas.forEach(rota => {

    if (rota.entregadorId) {
        entregadoresComRota.add(
            `id:${String(rota.entregadorId)}`
        );
    }

    if (rota.entregador) {
        entregadoresComRota.add(
            `name:${String(rota.entregador)
                .trim()
                .toLowerCase()}`
        );
    }
});

porEntregador.forEach((obj, key) => {
            if (entregadoresComRota.has(key)) return; // mantém a ordem da rota
            obj.list.sort((a, b) => a.timestamp - b.timestamp);
        });

        // Ordena por nome de exibição
        const entregadores = [...porEntregador.entries()]
            .map(([key, obj]) => ({ key, name: obj.name, list: obj.list }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const maxLinhas = Math.max(...entregadores.map(e => e.list.length));

        const wrapper = document.createElement("div");
        wrapper.classList.add("tabela-entregadores-wrapper");

        const tabela = document.createElement("table");
        tabela.classList.add("tabela-entregadores");

        const thead = document.createElement("thead");
        const linhaCabecalho = document.createElement("tr");
        entregadores.forEach(ent => {
            const lista = ent.list;
            const confirmadas = lista.filter(item => item.confirmado).length;
            const th = document.createElement("th");
            th.innerHTML = `${ent.name}<span class="tabela-entregadores-contagem">${confirmadas}/${lista.length} entrega(s)</span>`;
            linhaCabecalho.appendChild(th);
        });
        thead.appendChild(linhaCabecalho);
        tabela.appendChild(thead);

        const tbody = document.createElement("tbody");
        for (let i = 0; i < maxLinhas; i++) {
            const linha = document.createElement("tr");

            entregadores.forEach(ent => {
                const item = ent.list[i];
                const td = document.createElement("td");

                if (item) {
                    if (item.confirmado) {
                        td.classList.add("entrega-confirmada");
                        td.innerHTML = `
                            <span class="entrega-status">✅</span>
                            <span class="entrega-cliente${item.nota && item.nota.img ? " entrega-cliente--clicavel" : ""}">${item.cliente}</span>
                            <span class="entrega-valor">${formatarMoeda(item.valor)}</span>
                            <span class="entrega-hora">${item.hora}</span>
                        `;

                        if (item.nota) {
                            const spanCliente = td.querySelector(".entrega-cliente");
                            spanCliente.addEventListener("click", () => abrirImagemSomenteVisualizacao(item.nota));
                        }
                    } else {
                        td.classList.add("entrega-pendente");
                        td.innerHTML = `
                            <span class="entrega-status">⏳</span>
                            <span class="entrega-cliente">${item.cliente}</span>
                            <span class="entrega-valor">Pendente</span>
                        `;
                    }
                }

                linha.appendChild(td);
            });

            tbody.appendChild(linha);
        }
        tabela.appendChild(tbody);

        wrapper.appendChild(tabela);
        secao.appendChild(wrapper);
        container.appendChild(secao);
    }

    // A rota de rotas planejadas ainda não existe no backend — combinado que
    // vem depois. Até lá, isso simplesmente retorna vazio (sem quebrar a tela).
    async function buscarRotasPlanejadas(data) {
        try {
            const resposta = await fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/rotas-planejadas?data=${data}`, { credentials: "include" });
            if (!resposta.ok) return [];
            return await resposta.json();
        } catch (erro) {
            console.error("Rotas planejadas indisponíveis:", erro);
            return [];
        }
    }

    // ==================== PLANEJAR ROTAS (admin) ====================

    function mostrarFeedbackRotas(msg, tipo) {
        const fb = document.getElementById("feedbackRotas");
        if (!fb) return;
        fb.textContent = msg;
        fb.className = "feedback feedback--" + tipo;
    }

    function limparFeedbackRotas() {
        const fb = document.getElementById("feedbackRotas");
        if (!fb) return;
        fb.textContent = "";
        fb.className = "feedback";
    }

    async function abrirModalPlanejarRotas() {
        await Promise.all([
            carregarClientes(),
            carregarEntregadores()
        ]);
        if (!modalPlanejarRotas) return;

        limparFeedbackRotas();
        dataPlanejamentoRotas.value = filtroFaturamentoInicio || obterDataLocalISO(new Date());
        blocosEntregadoresRotas.innerHTML = "";

        // Já carrega a rota existente pra esse dia, se houver, pra editar em cima
        const dataEscolhida = dataPlanejamentoRotas.value;
        const rotasExistentes = await buscarRotasPlanejadas(dataEscolhida);

        if (rotasExistentes.length > 0) {
            rotasExistentes.forEach(rota => {
                blocosEntregadoresRotas.appendChild(criarBlocoEntregadorRota(rota, rota.clientes));
            });
        } else {
            blocosEntregadoresRotas.appendChild(criarBlocoEntregadorRota());
        }

        modalPlanejarRotas.style.display = "flex";
        document.body.style.overflow = "hidden";
    }

    function fecharModalPlanejarRotas() {
        modalPlanejarRotas.style.display = "none";
        document.body.style.overflow = "";
        blocosEntregadoresRotas.innerHTML = "";
        limparFeedbackRotas();
    }

    if (btnFecharModalRotas) btnFecharModalRotas.addEventListener("click", fecharModalPlanejarRotas);

    // Recarrega o bloco pré-existente quando a data muda (evita misturar
    // planejamento de um dia com outro)
    if (dataPlanejamentoRotas) {
        dataPlanejamentoRotas.addEventListener("change", async () => {
            blocosEntregadoresRotas.innerHTML = "";
            const rotasExistentes = await buscarRotasPlanejadas(dataPlanejamentoRotas.value);

            if (rotasExistentes.length > 0) {
                rotasExistentes.forEach(rota => {
                    blocosEntregadoresRotas.appendChild(criarBlocoEntregadorRota(rota, rota.clientes));
                });
            } else {
                blocosEntregadoresRotas.appendChild(criarBlocoEntregadorRota());
            }
        });
    }

    if (btnAdicionarEntregadorRota) {
        btnAdicionarEntregadorRota.addEventListener("click", () => {
            blocosEntregadoresRotas.appendChild(criarBlocoEntregadorRota());
        });
    }

    // Monta um bloco: nome do entregador + autocomplete de cliente + chips
    // dos clientes já adicionados. Reaproveitado tanto pra rota nova quanto
    // pra editar uma já existente (passando entregador/clientes prontos).
    // `entregadorData` pode ser uma string (nome) ou um objeto { entregadorId, entregador }
    function criarBlocoEntregadorRota(entregadorData = "", clientesIniciais = []) {
        const bloco = document.createElement("div");

        const inicialNome = (typeof entregadorData === 'string') ? entregadorData : (entregadorData?.entregador || entregadorData?.nome || '');
        const inicialId = (typeof entregadorData === 'object' && entregadorData) ? (entregadorData.entregadorId || entregadorData._id || entregadorData.id || '') : '';
        bloco.classList.add("bloco-entregador-rota");

        bloco.innerHTML = `
        <div class="bloco-entregador-rota-topo">
            <div class="autocomplete bloco-entregador-rota-entregador">
                <input
                    type="text"
                    class="input-nome-entregador-rota"
                    placeholder="Buscar entregador..."
                    value="${inicialNome}"
                    autocomplete="off"
                >
                <div class="autocomplete-list lista-sugestoes-entregador-rota"></div>
            </div>

            <button
                type="button"
                class="btn-remover-bloco-rota"
                title="Remover este entregador"
            >
                🗑️
            </button>
        </div>

        <div class="autocomplete bloco-entregador-rota-busca">
            <input
                type="text"
                class="input-buscar-cliente-rota"
                placeholder="Buscar cliente para adicionar..."
                autocomplete="off"
            >
            <div class="autocomplete-list lista-sugestoes-rota"></div>
        </div>

        <div class="chips-clientes-rota"></div>
    `;

        // se houver id inicial, grava no dataset para uso posterior
        if (inicialId) bloco.dataset.entregadorId = inicialId;

        // =========================================================
        // ELEMENTOS DO BLOCO
        // =========================================================

        const inputEntregador = bloco.querySelector(
            ".input-nome-entregador-rota"
        );

        const listaEntregadores = bloco.querySelector(
            ".lista-sugestoes-entregador-rota"
        );

        const inputBusca = bloco.querySelector(
            ".input-buscar-cliente-rota"
        );

        const listaSugestoes = bloco.querySelector(
            ".lista-sugestoes-rota"
        );

        const listaChips = bloco.querySelector(
            ".chips-clientes-rota"
        );

        const clientesDoBloco = [...clientesIniciais]
            .map(c => typeof c === "string" ? c : (c?.cliente || c?.nome || ""))
            .filter(Boolean);


        // =========================================================
        // RENDERIZAR CHIPS DOS CLIENTES
        // =========================================================

        function renderizarChips() {
            listaChips.innerHTML = clientesDoBloco
                .map((nome, indice) => `
                <span class="chip-cliente-rota">
                    ${nome}
                    <button
                        type="button"
                        class="chip-cliente-rota-remover"
                        data-indice="${indice}"
                    >
                        &times;
                    </button>
                </span>
            `)
                .join("");

            listaChips
                .querySelectorAll(".chip-cliente-rota-remover")
                .forEach(btn => {
                    btn.addEventListener("click", () => {
                        clientesDoBloco.splice(
                            Number(btn.dataset.indice),
                            1
                        );

                        renderizarChips();
                    });
                });
        }

        renderizarChips();


        // =========================================================
        // AUTOCOMPLETE DE ENTREGADORES
        // =========================================================

        inputEntregador.addEventListener("input", () => {
            // limpeza do id caso o usuário altere o texto manualmente
            bloco.dataset.entregadorId = '';
            const texto = inputEntregador.value;

            listaEntregadores.innerHTML = "";
            listaEntregadores.classList.remove("active");

            if (!texto) {
                return;
            }

            const encontrados = todosEntregadores
                .filter(e =>
                    e.nome &&
                    e.nome.toLowerCase().includes(texto)
                )
                .slice(0, 8);

            encontrados.forEach(entregador => {
                const item = document.createElement("div");

                item.className = "autocomplete-item";
                item.textContent = entregador.nome;

                item.addEventListener("click", () => {
                    inputEntregador.value = entregador.nome;
                    // armazena id no bloco para uso estrutural (montagem por id)
                    bloco.dataset.entregadorId = entregador._id || entregador.id || "";
                    listaEntregadores.innerHTML = "";
                    listaEntregadores.classList.remove("active");
                });

                listaEntregadores.appendChild(item);
            });

            if (encontrados.length > 0) {
                listaEntregadores.classList.add("active");
            }
        });


        // =========================================================
        // AUTOCOMPLETE DE CLIENTES
        // =========================================================

        const normalizarBuscaRota = (valor) => String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();

        // Nomes de clientes digitados manualmente (não cadastrados ainda) —
        // persistidos localmente pra continuar aparecendo no autocomplete depois.
        function obterNomesExtrasClientesRota() {
            try {
                return JSON.parse(localStorage.getItem("extrasClientesRotas") || "[]");
            } catch {
                return [];
            }
        }

        function persistirNomeExtraClienteRota(nome) {
            const jaConhecido = todosClientes.some(c => normalizarBuscaRota(c.cliente) === normalizarBuscaRota(nome));
            if (jaConhecido) return;

            const extras = obterNomesExtrasClientesRota();
            if (!extras.some(n => normalizarBuscaRota(n) === normalizarBuscaRota(nome))) {
                extras.push(nome);
                localStorage.setItem("extrasClientesRotas", JSON.stringify(extras));
            }
        }

        function adicionarClienteAoBloco(nome) {
            const nomeLimpo = String(nome || "").trim();
            if (!nomeLimpo) return;
            if (clientesDoBloco.some(c => normalizarBuscaRota(c) === normalizarBuscaRota(nomeLimpo))) return;

            clientesDoBloco.push(nomeLimpo);
            persistirNomeExtraClienteRota(nomeLimpo);
            renderizarChips();
            inputBusca.value = "";
            listaSugestoes.innerHTML = "";
            listaSugestoes.style.display = "none";
            inputBusca.focus();
        }

        function atualizarSugestoesClientesRota() {
            const texto = normalizarBuscaRota(inputBusca.value);
            listaSugestoes.innerHTML = "";

            const jaAdicionados = new Set(clientesDoBloco.map(normalizarBuscaRota));

            const nomesConhecidos = [
                ...todosClientes.map(c => c.cliente),
                ...obterNomesExtrasClientesRota()
            ];
            const nomesUnicos = [...new Map(nomesConhecidos.map(n => [normalizarBuscaRota(n), n])).values()];

            const encontrados = nomesUnicos
                .filter(nomeCliente => {
                    const nome = normalizarBuscaRota(nomeCliente);
                    return nome &&
                        !jaAdicionados.has(nome) &&
                        (!texto || nome.includes(texto));
                })
                .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"))
                .slice(0, 12);

            encontrados.forEach(nomeCliente => {
                const item = document.createElement("button");
                item.type = "button";
                item.className = "autocomplete-item";
                item.textContent = nomeCliente;

                item.addEventListener("mousedown", (e) => e.preventDefault());
                item.addEventListener("click", () => adicionarClienteAoBloco(nomeCliente));

                listaSugestoes.appendChild(item);
            });

            // Nome digitado não bate com nenhum conhecido — oferece adicionar como novo
            const textoOriginal = inputBusca.value.trim();
            if (textoOriginal && !nomesUnicos.some(n => normalizarBuscaRota(n) === normalizarBuscaRota(textoOriginal))) {
                const itemNovo = document.createElement("button");
                itemNovo.type = "button";
                itemNovo.className = "autocomplete-item autocomplete-item--novo";
                itemNovo.textContent = `+ Adicionar "${textoOriginal}" como novo cliente`;

                itemNovo.addEventListener("mousedown", (e) => e.preventDefault());
                itemNovo.addEventListener("click", () => adicionarClienteAoBloco(textoOriginal));

                listaSugestoes.appendChild(itemNovo);
            }

            listaSugestoes.style.display = listaSugestoes.children.length ? "block" : "none";
        }

        inputBusca.addEventListener("input", atualizarSugestoesClientesRota);
        inputBusca.addEventListener("focus", atualizarSugestoesClientesRota);

        inputBusca.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                adicionarClienteAoBloco(inputBusca.value);
            }
        });


        // =========================================================
        // FECHAR SUGESTÕES AO CLICAR FORA DO BLOCO
        // =========================================================

        document.addEventListener("click", (e) => {
            if (!bloco.contains(e.target)) {
                listaSugestoes.innerHTML = "";
                listaSugestoes.style.display = "none";
                listaEntregadores.innerHTML = "";
                listaEntregadores.classList.remove("active");
            }
        });


        // =========================================================
        // REMOVER BLOCO
        // =========================================================

        bloco
            .querySelector(".btn-remover-bloco-rota")
            .addEventListener("click", () => {
                bloco.remove();
            });


        // =========================================================
        // EXPÕE OS CLIENTES ATUAIS PARA O SALVAMENTO
        // =========================================================

        bloco.obterClientes = () => clientesDoBloco;


        return bloco;
    }


    // =============================================================
    // SALVAR PRÉ-TABELA DE ROTAS
    // =============================================================

    if (btnSalvarRotas) {
        btnSalvarRotas.addEventListener("click", async () => {

            const data = dataPlanejamentoRotas.value;

            if (!data) {
                mostrarFeedbackRotas(
                    "Escolha a data da rota.",
                    "erro"
                );
                return;
            }


            // -----------------------------------------------------
            // PEGA TODOS OS BLOCOS
            // -----------------------------------------------------

            const blocos = [
                ...blocosEntregadoresRotas.querySelectorAll(
                    ".bloco-entregador-rota"
                )
            ];


            // -----------------------------------------------------
            // MONTA AS ROTAS
            // -----------------------------------------------------

            const rotas = blocos
                .map(bloco => {
                    const entregadorNome = bloco.querySelector(".input-nome-entregador-rota").value.trim();
                    const entregadorId = bloco.dataset.entregadorId || null;
                    return {
                        entregadorId,
                        entregador: entregadorNome,
                        clientes: bloco.obterClientes()
                    };
                })
                .filter(
                    rota =>
                        rota.entregador &&
                        rota.clientes.length > 0
                );


            // -----------------------------------------------------
            // VALIDAÇÃO
            // -----------------------------------------------------

            if (rotas.length === 0) {
                mostrarFeedbackRotas(
                    "Adicione pelo menos um entregador com clientes.",
                    "erro"
                );
                return;
            }


            // -----------------------------------------------------
            // DESABILITA BOTÃO
            // -----------------------------------------------------

            btnSalvarRotas.disabled = true;
            btnSalvarRotas.textContent = "Salvando...";


            try {

                // -------------------------------------------------
                // ENVIA PARA O SERVIDOR
                // -------------------------------------------------

                const resposta = await fetchAutenticado(
                    "https://sos-alimentos-servidor.onrender.com/api/rotas-planejadas",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        credentials: "include",

                        body: JSON.stringify({
                            data,
                            rotas
                        })
                    }
                );


                // -------------------------------------------------
                // LÊ RESPOSTA
                // -------------------------------------------------

                const respostaData =
                    await resposta
                        .json()
                        .catch(() => ({}));


                // -------------------------------------------------
                // SUCESSO
                // -------------------------------------------------

                if (resposta.ok) {

                    mostrarFeedbackRotas(
                        "✅ Pré-tabela salva com sucesso!",
                        "sucesso"
                    );


                    // Se a data planejada é a mesma que está sendo
                    // visualizada no faturamento, atualiza a tabela.

                    if (
                        data === filtroFaturamentoInicio &&
                        data === filtroFaturamentoFim
                    ) {
                        montarResumoEListaFaturamento(
                            document.getElementById(
                                "faturamentoConteudo"
                            )
                        );
                    }


                    setTimeout(
                        fecharModalPlanejarRotas,
                        1200
                    );

                } else {

                    mostrarFeedbackRotas(
                        respostaData.erro ||
                        "Erro ao salvar a pré-tabela.",
                        "erro"
                    );
                }


            } catch (erro) {

                console.error(erro);

                mostrarFeedbackRotas(
                    "Erro ao salvar a pré-tabela. Verifique se a rota do servidor está disponível.",
                    "erro"
                );

            } finally {

                btnSalvarRotas.disabled = false;
                btnSalvarRotas.textContent = "Salvar Pré-Tabela";
            }
        });
    }

    // Card só-leitura (sem ações) reaproveitando o mesmo visual das outras
    // listagens de nota do sistema.
    function criarCardNotaFaturamento(nota) {
        const card = document.createElement("div");
        card.classList.add("cliente-card", "nota-fiscal-card-ajuste");
        card.classList.toggle("nota-paga", nota.pago);

        const valorFormatado = parseFloat(nota.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        let dataFormatada = 'Não informada';
        if (nota.dataEmissao) {
            const apenasData = nota.dataEmissao.split('T')[0];
            const partes = apenasData.split('-');
            if (partes.length === 3) {
                dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
        }

        card.innerHTML = `
            <div class="cliente-topo">
                <h3>${nota.cliente || "Cliente"} — Nota Nº ${nota.numeroNota || "-"}</h3>
                <span class="nota-tag-valor">${valorFormatado}</span>
            </div>
            <p class="cliente-data"><strong>Emissão:</strong> ${dataFormatada}</p>
            <p class="cliente-status"><strong>Status:</strong> ${nota.pago ? "Pago" : "Pendente"}</p>
            <p class="cliente-entegador"><strong>Entregue:</strong> ${obterNomeEntregador(nota)}</p>
        `;

        return card;
    }

    // Converte "YYYY-MM-DD" pra "DD/MM/YYYY", sem passar por new Date()
    // (mesmo motivo de sempre: evitar que o fuso horário mude o dia).
    function formatarDataBR(isoStr) {
        const [ano, mes, dia] = isoStr.split("-");
        return `${dia}/${mes}/${ano}`;
    }

    // Gera a "notinha" de faturamento do período atual (agrupado por cliente)
    // numa aba nova, já pronta pra imprimir/salvar como PDF.
    function exportarFaturamentoComoNotinha() {
        const notasAtivas = notasFaturamentoCache.filter(n => !n.deletado);
        const notasNoPeriodo = filtrarNotasPorPeriodo(notasAtivas, filtroFaturamentoInicio, filtroFaturamentoFim);

        const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Agrupa por nome de cliente (mesmo critério usado em todo o resto do
        // faturamento — ver correção do número da nota nesta mesma conversa).
        const porCliente = new Map(); // nome -> { total, quantidade }
        notasNoPeriodo.forEach(nota => {
            const nome = nota.cliente || "Cliente não identificado";
            const atual = porCliente.get(nome) || { total: 0, quantidade: 0 };
            atual.total += parseFloat(nota.valor) || 0;
            atual.quantidade += 1;
            porCliente.set(nome, atual);
        });

        const linhasClientes = [...porCliente.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        const totalGeral = notasNoPeriodo.reduce((soma, n) => soma + (parseFloat(n.valor) || 0), 0);

        const periodoLabel = filtroFaturamentoInicio === filtroFaturamentoFim
            ? formatarDataBR(filtroFaturamentoInicio)
            : `${formatarDataBR(filtroFaturamentoInicio)} até ${formatarDataBR(filtroFaturamentoFim)}`;

        const emitidoEm = new Date().toLocaleString('pt-BR');

        const linhasHtml = linhasClientes.length
            ? linhasClientes.map(([nome, dados]) => `
                <div class="linha-cliente">
                    <span class="nome">${nome}<span class="qtd">${dados.quantidade} nota${dados.quantidade > 1 ? "s" : ""}</span></span>
                    <span class="valor">${formatarMoeda(dados.total)}</span>
                </div>
            `).join("")
            : `<p class="vazio">Nenhuma nota registrada nesse período.</p>`;

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Notinha de Faturamento — ${periodoLabel}</title>
<style>
    @import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Work+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap");

    * { box-sizing: border-box; }

    body {
        margin: 0;
        padding: 40px 16px;
        background: #EDE3C8;
        font-family: "Work Sans", sans-serif;
        color: #20291F;
        display: flex;
        justify-content: center;
    }

    .notinha {
        width: 100%;
        max-width: 340px;
        background: #FAF3E2;
        padding: 28px 22px;
        box-shadow: 0 12px 30px -10px rgba(6, 16, 10, 0.35);
    }

    .cabecalho {
        text-align: center;
        margin-bottom: 18px;
    }

    .cabecalho h1 {
        font-family: "Fraunces", serif;
        font-weight: 700;
        font-size: 20px;
        margin: 0 0 4px;
    }

    .cabecalho p {
        font-family: "Space Mono", monospace;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #5C6B58;
        margin: 2px 0;
    }

    .divisor {
        border: none;
        border-top: 2px dashed #C9BC98;
        margin: 16px 0;
    }

    .linha-cliente {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        padding: 7px 0;
        font-size: 13.5px;
    }

    .linha-cliente .nome {
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    .linha-cliente .qtd {
        font-family: "Space Mono", monospace;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #948C77;
        margin-top: 2px;
    }

    .linha-cliente .valor {
        font-family: "Space Mono", monospace;
        white-space: nowrap;
    }

    .vazio {
        text-align: center;
        font-size: 13px;
        color: #948C77;
        padding: 20px 0;
    }

    .total {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-family: "Fraunces", serif;
        font-weight: 700;
        font-size: 18px;
        margin-top: 6px;
    }

    .rodape {
        text-align: center;
        margin-top: 20px;
        font-family: "Space Mono", monospace;
        font-size: 10px;
        color: #948C77;
    }

    @media print {
        body { background: #fff; padding: 0; }
        .notinha { box-shadow: none; max-width: 100%; }
        @page { margin: 16mm; }
    }
</style>
</head>
<body>
    <div class="notinha">
        <div class="cabecalho">
            <h1>SOS Alimentos 🍎</h1>
            <p>Faturamento por cliente</p>
            <p>${periodoLabel}</p>
        </div>

        <hr class="divisor">

        ${linhasHtml}

        <hr class="divisor">

        <div class="total">
            <span>Total</span>
            <span>${formatarMoeda(totalGeral)}</span>
        </div>

        <p class="rodape">Emitido em ${emitidoEm}<br>${notasNoPeriodo.length} nota${notasNoPeriodo.length !== 1 ? "s" : ""} · ${linhasClientes.length} cliente${linhasClientes.length !== 1 ? "s" : ""}</p>
    </div>
    <script>
        window.onload = () => window.print();
    </script>
</body>
</html>`;

        const janela = window.open("", "_blank");
        if (!janela) {
            alert("O navegador bloqueou a abertura da notinha. Permita pop-ups para este site e tente novamente.");
            return;
        }
        janela.document.write(html);
        janela.document.close();
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
            const respostaGrupos = await fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/grupos?idCliente=${clienteAlvo._id}&_=${Date.now()}`, { credentials: "include" });
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
                const resposta = await fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/grupos/${grupoAtual._id}`, {
                    method: "DELETE",
                    credentials: "include"
                });
                if (!resposta.ok) throw new Error();
            } else {
                const resposta = await fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/grupos/${grupoAtual._id}`, {
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
                    fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/notas/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ deletado: true }) })
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
            const respostaGrupos = await fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/grupos?idCliente=${clienteAlvo._id}&_=${Date.now()}`, { credentials: "include" });
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

            const resposta = await fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/grupos/${grupoAtual._id}`, {
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
            const resposta = await fetchAutenticado("https://sos-alimentos-servidor.onrender.com/api/grupos", {
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
                const resposta = await fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/grupos/${grupo._id}`, {
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
                    <button class="btn-baixar-grupo" title="Baixar fotos do período">⬇️ Baixar Fotos</button>
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

        cardGrupo.querySelector(".btn-baixar-grupo").addEventListener("click", async (e) => {
            e.stopPropagation();

            const botao = e.currentTarget;
            const periodoArquivo = dataMaisAntiga && dataMaisRecente
                ? `${slugify(formatarDataCurta(dataMaisAntiga))}_a_${slugify(formatarDataCurta(dataMaisRecente))}`
                : slugify(nomeGrupo);

            const nomeArquivoZip = `fotos-${slugify(clienteAlvo.cliente)}-${periodoArquivo}.zip`;

            await baixarImagensAgrupadas(notasDoGrupo, clienteAlvo.cliente, nomeArquivoZip, botao);
        });

        cardGrupo.querySelector(".btn-editar-grupo").addEventListener("click", async (e) => {
            e.stopPropagation();

            const novaObservacao = prompt("Editar observação do grupo:", grupo.observacao || "");
            if (novaObservacao === null) return; // cancelou

            try {
                const resposta = await fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/grupos/${grupo._id}`, {
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

                fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/notas/${nota._id}/pago`, {
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

            // Exclui a nota (soft delete, vai pra Lixeira). Extraída à parte
            // pra ser reaproveitada tanto pelo botão 🗑️ do card quanto pelo
            // botão "Excluir" dentro do popup de imagem ampliada.
            async function excluirNota(nota, botaoDisparo) {
                const confirmar = confirm("Excluir esta nota? Ela vai para a Lixeira e pode ser restaurada de lá.");
                if (!confirmar) return false;

                if (botaoDisparo) botaoDisparo.disabled = true;

                try {
                    const resposta = await fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/notas/${nota._id}`, {
                        method: "DELETE",
                        credentials: "include"
                    });

                    if (!resposta.ok) throw new Error();

                    await carregarNotasDoCliente(clienteAlvo, containerAlvo);
                    return true;

                } catch (erro) {
                    console.error(erro);
                    alert("Erro ao excluir nota.");
                    if (botaoDisparo) botaoDisparo.disabled = false;
                    return false;
                }
            }

            // Abre a imagem da nota ampliada, com "Marcar como Pago" e
            // "Excluir" ali mesmo no popup (em vez de abrir em outra aba).
            function abrirModalImagemNota(nota, cardNotaItem, btnPago) {
                imagemNotaAmpliada.src = nota.img;
                btnPagoModalImagem.textContent = nota.pago ? "Desmarcar como Pago" : "Marcar como Pago";
                btnExcluirModalImagem.disabled = false;

                modalImagemNota.style.display = "flex";
                document.body.style.overflow = "hidden";

                // .onclick (em vez de addEventListener) porque o modal é reaproveitado
                // entre notas diferentes — assim não empilha listener de nota antiga.
                btnPagoModalImagem.onclick = () => {
                    fecharModalImagemNota();
                    marcarComoPago(nota, cardNotaItem, btnPago);
                };

                btnBaixarModalImagem.onclick = () => {
                    baixarImagemNota(nota, clienteAlvo.cliente, btnBaixarModalImagem);
                };

                btnExcluirModalImagem.onclick = async () => {
                    const excluiu = await excluirNota(nota, btnExcluirModalImagem);
                    if (excluiu) fecharModalImagemNota();
                };
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
                    <p class="cliente-data"><strong>Emissão:</strong> ${dataFormatada}</p>
                    <p class="cliente-email"><strong>E-mail:</strong> ${nota.email || 'Não informado'}</p>
                    <p class="cliente-entregador"><strong>Entregue:</strong> ${obterNomeEntregador(nota)}</p>
                    <div class="nota-image">
                        <img src="${nota.img}" alt="Foto da nota">
                    </div>
                    <div class="nota-card-acoes">
                        <button class="btn-marcar-pago">${nota.pago ? "Desmarcar como Pago" : "Marcar como Pago"}</button>
                        <button class="btn-baixar-nota" type="button" title="Baixar foto">⬇️</button>
                        <button class="btn-excluir-nota" type="button" title="Excluir nota">🗑️</button>
                    </div>
                `;

                const imgNota = cardNotaItem.querySelector(".nota-image img");
                const btnPago = cardNotaItem.querySelector(".btn-marcar-pago");

                imgNota.addEventListener("click", (e) => {
                    e.stopPropagation();
                    abrirModalImagemNota(nota, cardNotaItem, btnPago);
                });

                btnPago.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    marcarComoPago(nota, cardNotaItem, btnPago);
                });

                const btnExcluirNota = cardNotaItem.querySelector(".btn-excluir-nota");

                btnExcluirNota.addEventListener("click", async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await excluirNota(nota, btnExcluirNota);
                });

                const btnBaixarNota = cardNotaItem.querySelector(".btn-baixar-nota");

                if (!nota.img) {
                    btnBaixarNota.disabled = true;
                    btnBaixarNota.title = "Nenhuma foto anexada";
                } else {
                    btnBaixarNota.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        baixarImagemNota(nota, clienteAlvo.cliente, btnBaixarNota);
                    });
                }

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
                fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/notas?_=${Date.now()}`, { credentials: "include" }),
                fetchAutenticado(`https://sos-alimentos-servidor.onrender.com/api/grupos?idCliente=${clienteAlvo._id}&_=${Date.now()}`, { credentials: "include" })
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
