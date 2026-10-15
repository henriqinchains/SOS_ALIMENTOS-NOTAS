// ==========================
// 1. ROTEAMENTO DO SPA
// ==========================
function router() {
    // Pega a hashtag da URL atual (ex: "#produtos"). Se não tiver, usa "#ofertas" como padrão.
    let hash = window.location.hash || '#ofertas';

    // Remove o "#" para pegar só o ID da seção (ex: "produtos")
    let pageId = hash.replace('#', '');

    // Esconde todas as páginas removendo a classe 'active'
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Tenta encontrar a seção correspondente e mostra ela
    const pageToShow = document.getElementById(pageId);
    if (pageToShow) {
        pageToShow.classList.add('active');
    }

    // Marca o link correspondente como ativo no menu
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.toggle('ativo', link.getAttribute('href') === hash);
    });

    // As setas do scroll só sabem se são necessárias quando a página está visível
    atualizarSetas();
}

// Escuta a mudança no link (quando o usuário clica no menu)
window.addEventListener('hashchange', router);

// Roda o router assim que a página carregar
window.addEventListener('load', router);


// ==========================
// 2. LÓGICA DO CARROSSEL
// ==========================
let slideIndex = 0;
let carrosselAutoplay;

// Sempre busca os slides/dots atuais na hora de usar, porque o carrossel
// dinâmico recria esses elementos depois que os produtos chegam da API.
function mostrarSlide(index) {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');

    if (!slides.length) return;

    // Esconde todos os slides
    slides.forEach(slide => slide.classList.remove('ativo'));

    // Se passar do último, volta pro primeiro
    if (index >= slides.length) { slideIndex = 0; }
    // Se voltar antes do primeiro, vai pro último
    if (index < 0) { slideIndex = slides.length - 1; }

    // Mostra o slide correto
    slides[slideIndex].classList.add('ativo');
    dots.forEach(dot => dot.classList.remove('ativo'));
    if (dots[slideIndex]) dots[slideIndex].classList.add('ativo');
}

function mudarSlide(step) {
    slideIndex += step;
    mostrarSlide(slideIndex);
}

function irParaSlide(index) {
    slideIndex = index;
    mostrarSlide(slideIndex);
}

function iniciarAutoplay() {
    carrosselAutoplay = setInterval(() => mudarSlide(1), 5000);
}

iniciarAutoplay();

// Pausa a troca automática enquanto o usuário está com o mouse em cima
const carrossel = document.getElementById('banner-carrossel');
if (carrossel) {
    carrossel.addEventListener('mouseenter', () => clearInterval(carrosselAutoplay));
    carrossel.addEventListener('mouseleave', iniciarAutoplay);
}


// ==========================
// 3. PRODUTOS (API + BUSCA)
// ==========================
const API_URL = 'https://sos-alimentos-webpage-servidor.onrender.com';

// Começa a acordar o servidor (Render gratuito dorme) assim que o script carrega,
// sem esperar a página inteira terminar de carregar. Principalmente útil no celular.
fetch(`${API_URL}/health`).catch(() => { });

// fetch que desiste depois de um tempo (no celular, uma requisição pode ficar pendurada para sempre)
async function fetchComTimeout(url, ms = 10000) {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), ms);
    try {
        return await fetch(url, { signal: controle.signal });
    } finally {
        clearTimeout(timer);
    }
}

let todosProdutos = [];
let todosDepartamentos = []; // já vem do servidor na ordem definida pelo admin

// minúsculas e sem acento: "feijao" encontra "Feijão"
function normalizar(texto) {
    return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function compararNomes(a, b) {
    return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' });
}

function ordenarPorNome(lista) {
    return [...lista].sort((a, b) => compararNomes(a.nomeProduto, b.nomeProduto));
}

// Formata número para moeda brasileira (R$)
function formatarPreco(valor) {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Cria o elemento HTML de um card de produto
function criarCardProduto(produto) {
    const card = document.createElement('div');
    card.className = 'produto-card';

    // A MÁGICA AQUI: O sistema só considera promoção se o preço promocional for menor que o original!
    const ehPromocaoDeVerdade = produto.emPromocao && (produto.valoremPromocao < produto.valorProduto);

    const precoHtml = ehPromocaoDeVerdade
        ? `<p class="preco-antigo">${formatarPreco(produto.valorProduto)}</p>
           <p class="preco preco-promo">${formatarPreco(produto.valoremPromocao)}</p>`
        : `<p class="preco">${formatarPreco(produto.valorProduto)}</p>`;

    const percentual = ehPromocaoDeVerdade
        ? Math.round(((produto.valorProduto - produto.valoremPromocao) / produto.valorProduto) * 100)
        : 0;

    const seloHtml = ehPromocaoDeVerdade
        ? `<span class="selo-promocao" title="Produto em promoção">
               <i class="fas fa-bolt selo-icone"></i>
               <span class="selo-texto">
                   <span class="selo-label">Promoção</span>
                   ${percentual > 0 ? `<strong class="selo-percentual">-${percentual}%</strong>` : ''}
               </span>
           </span>`
        : '';

    if (ehPromocaoDeVerdade) card.classList.add('produto-card-promo');

    card.innerHTML = `
        ${seloHtml}
        <div class="img-placeholder">
            ${produto.img ? `<img src="${produto.img}" alt="${produto.nomeProduto}">` : 'Foto'}
        </div>
        <h3>${produto.nomeProduto}</h3>
        <p class="unidade">${produto.unidade}</p>
        ${precoHtml}
    `;

    return card;
}

// 1. Calcula o percentual e pega os N produtos com maior desconto
function calcularMaioresDescontos(produtos, limite = 3) {
    // Filtra só quem é promoção de verdade
    const promocoes = produtos.filter(p => p.emPromocao && Number(p.valoremPromocao) < Number(p.valorProduto));

    // Calcula a porcentagem e salva temporariamente
    const comDesconto = promocoes.map(p => {
        const percentual = ((Number(p.valorProduto) - Number(p.valoremPromocao)) / Number(p.valorProduto)) * 100;
        return { ...p, percentualDesconto: percentual };
    });

    // Ordena do maior desconto (ex: 50%) para o menor (ex: 5%)
    comDesconto.sort((a, b) => b.percentualDesconto - a.percentualDesconto);

    // Retorna o Top 3 (ou o número que você quiser)
    return comDesconto.slice(0, limite);
}

// Espera uma imagem carregar de verdade antes de seguir em frente
// (resolve mesmo se der erro, pra um banner sem imagem não travar os outros)
function preCarregarImagem(url) {
    return new Promise((resolve) => {
        if (!url) return resolve();
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(resolve, 3000); // foto lenta não pode travar o carrossel
        img.src = url;
    });
}

// 2. Constrói o HTML dos Banners e injeta na tela
// Só mostra o carrossel depois que TODAS as imagens já baixaram — se não
// houver nenhuma promoção real, o carrossel fica escondido (nada de banner
// vazio ou provisório).
async function renderizarCarrosselDinâmico(produtosDestaque) {
    const carrossel = document.getElementById('banner-carrossel');
    const containerSlides = document.querySelector('.slides-container');
    const containerDots = document.querySelector('.carrossel-dots');

    if (!carrossel || !containerSlides || !containerDots) return;

    if (produtosDestaque.length === 0) {
        carrossel.classList.add('hidden');
        containerSlides.innerHTML = '';
        containerDots.innerHTML = '';
        return;
    }

    await Promise.all(produtosDestaque.map(produto => preCarregarImagem(produto.img)));

    containerSlides.innerHTML = '';
    containerDots.innerHTML = '';

    produtosDestaque.forEach((produto, index) => {
        const ativoClass = index === 0 ? 'ativo' : '';
        const imgPlaceholder = produto.img ? `<img src="${produto.img}" alt="${produto.nomeProduto}">` : '<div class="banner-no-img">📸 Imagem Indisponível</div>';

        // HTML do Banner Horizontal
        const slideHTML = `
            <div class="slide ${ativoClass}">
                <div class="banner-content">
                    <div class="banner-img-wrapper">
                        ${imgPlaceholder}
                        <div class="badge-desconto">
                            <span class="badge-pre">ECONOMIZE</span>
                            <span class="badge-valor">-${Math.round(produto.percentualDesconto)}%</span>
                            <span class="badge-off">OFF</span>
                        </div>
                    </div>
                    <div class="banner-info">
                        <span class="banner-tag">OFERTA IMPERDÍVEL</span>
                        <h2>${produto.nomeProduto}</h2>
                        <div class="banner-precos">
                            <span class="banner-preco-antigo">${formatarPreco(produto.valorProduto)}</span>
                            <span class="banner-preco-novo">${formatarPreco(produto.valoremPromocao)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        containerSlides.insertAdjacentHTML('beforeend', slideHTML);

        // HTML das Bolinhas (Dots)
        const dotHTML = `<span class="dot ${ativoClass}" onclick="irParaSlide(${index})"></span>`;
        containerDots.insertAdjacentHTML('beforeend', dotHTML);
    });

    // Reseta a lógica de animação e só então revela o carrossel
    slideIndex = 0;
    carrossel.classList.remove('hidden');
}

// Renderiza uma lista de produtos dentro de um container
function renderizarProdutos(lista, container, apenasPromocao) {
    if (!container) return;

    container.innerHTML = '';

    if (!lista || lista.length === 0) {
        const mensagem = apenasPromocao ? 'Nenhuma promoção encontrada.' : 'Nenhum produto encontrado.';
        container.innerHTML = `<p class="msg-estado">${mensagem}</p>`;
        return;
    }

    lista.forEach(produto => {
        container.appendChild(criarCardProduto(produto));
    });
}

// ==========================
// 3.1 DEPARTAMENTOS E SCROLL HORIZONTAL
// ==========================

// Separa os produtos por departamento, respeitando a ordem recebida em "departamentos".
// Itens sem departamento (ou de um departamento que não existe mais) vão para o fim.
function agruparPorDepartamento(produtos, departamentos) {
    const grupos = departamentos.map(depto => ({ id: depto._id, nome: depto.nome, itens: [] }));
    const porId = new Map(grupos.map(grupo => [grupo.id, grupo]));
    const outros = {
        id: '',
        nome: departamentos.length ? 'Outros produtos' : 'Todos os produtos',
        itens: []
    };

    produtos.forEach(produto => (porId.get(produto.departamentoId) || outros).itens.push(produto));
    if (outros.itens.length) grupos.push(outros);

    // Só mostra departamentos que têm item ativo, e cada um em ordem alfabética
    return grupos
        .filter(grupo => grupo.itens.length)
        .map(grupo => ({ ...grupo, itens: ordenarPorNome(grupo.itens) }));
}

// Cria um trilho com scroll horizontal (com setas para quem usa mouse)
function criarScrollHorizontal(produtos) {
    const wrapper = document.createElement('div');
    wrapper.className = 'scroll-wrapper';
    wrapper.innerHTML = `
        <button type="button" class="scroll-seta esq" aria-label="Rolar para a esquerda">&#10094;</button>
        <div class="scroll-horizontal"></div>
        <button type="button" class="scroll-seta dir" aria-label="Rolar para a direita">&#10095;</button>
    `;
    const trilho = wrapper.querySelector('.scroll-horizontal');
    produtos.forEach(produto => trilho.appendChild(criarCardProduto(produto)));
    return wrapper;
}

function criarSecaoDepartamento(grupo, comoScroll) {
    const secao = document.createElement('section');
    secao.className = 'departamento-secao';

    const titulo = document.createElement('div');
    titulo.className = 'titulo-departamento';
    const h3 = document.createElement('h3');
    h3.textContent = grupo.nome; // textContent: nome com < > não quebra a página
    titulo.appendChild(h3);
    secao.appendChild(titulo);

    if (comoScroll) {
        secao.appendChild(criarScrollHorizontal(grupo.itens));
    } else {
        const grid = document.createElement('div');
        grid.className = 'grid-produtos';
        grupo.itens.forEach(produto => grid.appendChild(criarCardProduto(produto)));
        secao.appendChild(grid);
    }
    return secao;
}

// Mostra/esconde as setas conforme o trilho realmente rola
function atualizarSetas() {
    document.querySelectorAll('.scroll-wrapper').forEach(wrapper => {
        const trilho = wrapper.querySelector('.scroll-horizontal');
        if (!trilho) return;
        wrapper.classList.toggle('sem-overflow', trilho.scrollWidth <= trilho.clientWidth + 2);
    });
}

document.addEventListener('click', (evento) => {
    const seta = evento.target.closest('.scroll-seta');
    if (!seta) return;
    const trilho = seta.parentElement.querySelector('.scroll-horizontal');
    const direcao = seta.classList.contains('esq') ? -1 : 1;
    trilho.scrollBy({ left: direcao * trilho.clientWidth * 0.8, behavior: 'smooth' });
});

window.addEventListener('resize', atualizarSetas);

// PÁGINA INICIAL: um scroll horizontal por departamento, na ordem escolhida na gestão
function renderizarDepartamentosHome() {
    const container = document.getElementById('grid-todos-ofertas');
    if (!container) return;

    container.className = 'departamentos-home';
    container.innerHTML = '';

    const grupos = agruparPorDepartamento(todosProdutos, todosDepartamentos);
    if (grupos.length === 0) {
        container.innerHTML = '<p class="msg-estado">Nenhum produto encontrado.</p>';
        return;
    }
    grupos.forEach(grupo => container.appendChild(criarSecaoDepartamento(grupo, true)));
    atualizarSetas();
}

// PÁGINA PRODUTOS: departamentos em ordem alfabética (itens também), com filtro e busca
function popularFiltroDepartamento() {
    const select = document.getElementById('filtro-departamento');
    if (!select) return;

    const valorAtual = select.value;
    const grupos = agruparPorDepartamento(todosProdutos, todosDepartamentos)
        .sort((a, b) => compararNomes(a.nome, b.nome));

    select.innerHTML = '<option value="">Todos os departamentos</option>';
    grupos.forEach(grupo => {
        const opcao = document.createElement('option');
        opcao.value = grupo.id || '__outros';
        opcao.textContent = grupo.nome;
        select.appendChild(opcao);
    });
    select.value = [...select.options].some(o => o.value === valorAtual) ? valorAtual : '';
}

function renderizarPaginaProdutos() {
    const container = document.getElementById('grid-produtos');
    const input = document.getElementById('search-input-produtos');
    const select = document.getElementById('filtro-departamento');
    if (!container) return;

    const termo = normalizar(input ? input.value : '');
    const filtro = select ? select.value : '';

    const filtrados = todosProdutos.filter(produto => !termo || normalizar(produto.nomeProduto).includes(termo));

    // Departamentos A-Z; "Outros produtos" / "Todos os produtos" sempre por último
    const todosGrupos = agruparPorDepartamento(filtrados, todosDepartamentos);
    const outros = todosGrupos.find(grupo => grupo.id === '');
    let grupos = todosGrupos
        .filter(grupo => grupo.id !== '')
        .sort((a, b) => compararNomes(a.nome, b.nome));
    if (outros) grupos.push(outros);

    if (filtro) grupos = grupos.filter(grupo => (grupo.id || '__outros') === filtro);

    container.className = 'produtos-agrupados';
    container.innerHTML = '';

    if (grupos.length === 0) {
        container.innerHTML = '<p class="msg-estado">Nenhum produto encontrado.</p>';
        return;
    }
    grupos.forEach(grupo => container.appendChild(criarSecaoDepartamento(grupo, false)));
}

function configurarPaginaProdutos() {
    const input = document.getElementById('search-input-produtos');
    const select = document.getElementById('filtro-departamento');
    if (!input || !select) return;

    input.addEventListener('input', renderizarPaginaProdutos);
    input.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter') renderizarPaginaProdutos();
    });
    select.addEventListener('change', renderizarPaginaProdutos);

    const botao = input.closest('.pesquisa-container').querySelector('.btn-pesquisar');
    if (botao) botao.addEventListener('click', renderizarPaginaProdutos);
}

// O Render gratuito pode levar de 30 a 90 segundos para acordar. Esperamos até ~2 minutos.
async function esperarServidorAcordar(tentativas = 30, intervaloMs = 3000) {
    for (let i = 0; i < tentativas; i++) {
        try {
            const resposta = await fetchComTimeout(`${API_URL}/health`, 8000);
            if (resposta.ok) return true;
        } catch (erro) {
            // servidor ainda dormindo, tenta de novo depois do intervalo
        }
        await new Promise(resolve => setTimeout(resolve, intervaloMs));
    }
    return false;
}

// Aviso amigável enquanto o servidor acorda
function mostrarAvisoServidorAcordando() {
    const aviso = `
        <p class="msg-estado">
            ⏳ Carregando os produtos...<br>
            O servidor estava descansando e pode levar até 1 minuto para acordar. Aguarde um instante!
        </p>
    `;
    ['grid-produtos', 'grid-promocoes', 'grid-todos-ofertas'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = aviso;
    });
}

function mostrarEsqueletoCarregando(container, quantidade) {
    if (!container) return;
    container.innerHTML = Array.from({ length: quantidade })
        .map(() => '<div class="skeleton-card"></div>')
        .join('');
}

function mostrarEstadoErro() {
    const mensagemErro = `
        <p class="msg-estado">
            Não foi possível carregar os produtos.<br>
            <button class="btn-tentar-novamente" onclick="carregarProdutos()">Tentar novamente</button>
        </p>
    `;
    const gridProdutos = document.getElementById('grid-produtos');
    const gridPromocoes = document.getElementById('grid-promocoes');
    const gridTodosOfertas = document.getElementById('grid-todos-ofertas');
    if (gridProdutos) gridProdutos.innerHTML = mensagemErro;
    if (gridPromocoes) gridPromocoes.innerHTML = mensagemErro;
    if (gridTodosOfertas) gridTodosOfertas.innerHTML = mensagemErro;
}

async function carregarProdutos() {
    const gridProdutos = document.getElementById('grid-produtos');
    const gridPromocoes = document.getElementById('grid-promocoes');
    const gridTodosOfertas = document.getElementById('grid-todos-ofertas');

    // Volta ao layout de "carregando" (as seções por departamento trocam essas classes)
    if (gridProdutos) gridProdutos.className = 'grid-produtos';
    if (gridTodosOfertas) gridTodosOfertas.className = 'grid-produtos';

    mostrarEsqueletoCarregando(gridProdutos, 4);
    mostrarEsqueletoCarregando(gridPromocoes, 3);
    mostrarEsqueletoCarregando(gridTodosOfertas, 4);

    const tentarBuscar = async () => {
        const resposta = await fetchComTimeout(`${API_URL}/api/produtos`, 15000);
        if (!resposta.ok) throw new Error('Falha ao buscar produtos.');
        return resposta.json();
    };

    // Se demorar, avisa o visitante que o servidor está acordando
    const timerAviso = setTimeout(mostrarAvisoServidorAcordando, 5000);

    try {
        let dadosBrutos = [];
        try {
            dadosBrutos = await tentarBuscar();
        } catch (primeiroErro) {
            await esperarServidorAcordar();
            try {
                dadosBrutos = await tentarBuscar();
            } catch (segundoErro) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                dadosBrutos = await tentarBuscar();
            }
        }
        clearTimeout(timerAviso);

        todosProdutos = dadosBrutos.filter(produto => produto.ativo === true);

        // Departamentos (já na ordem da gestão). Se falhar, o site funciona sem eles.
        try {
            const respostaDeptos = await fetchComTimeout(`${API_URL}/api/departamentos`, 15000);
            todosDepartamentos = respostaDeptos.ok ? await respostaDeptos.json() : [];
        } catch (erroDeptos) {
            console.error('Erro ao carregar departamentos:', erroDeptos);
            todosDepartamentos = [];
        }

        // Desenha os grids primeiro (não ficam esperando o carrossel)
        popularFiltroDepartamento();
        renderizarPaginaProdutos();
        renderizarDepartamentosHome();
        const emPromocao = todosProdutos.filter(produto => produto.emPromocao && produto.valoremPromocao < produto.valorProduto);
        renderizarProdutos(emPromocao, gridPromocoes, true);
        atualizarSetas();

        // Carrossel: se der qualquer problema aqui, o resto da página continua funcionando
        try {
            const maioresDescontos = calcularMaioresDescontos(todosProdutos, 3); // Pega o Top 3
            console.info('[Carrossel] produtos ativos:', todosProdutos.length, '| promoções encontradas:', maioresDescontos.length);
            await renderizarCarrosselDinâmico(maioresDescontos); // Só troca o banner quando as fotos estiverem prontas
        } catch (erroCarrossel) {
            console.error('[Carrossel] erro ao montar:', erroCarrossel);
        }

    } catch (erro) {
        clearTimeout(timerAviso);
        console.error('Erro ao carregar produtos:', erro);
        mostrarEstadoErro();
    }
}

// Filtra os produtos já carregados pelo termo digitado
function filtrarProdutos(termo, apenasPromocao) {
    const base = apenasPromocao ? todosProdutos.filter(produto => produto.emPromocao) : todosProdutos;
    const termoBusca = termo.trim().toLowerCase();

    if (!termoBusca) return base;

    return base.filter(produto => produto.nomeProduto.toLowerCase().includes(termoBusca));
}

// Liga o input + botão de busca de uma seção ao grid de resultados correspondente
function configurarBusca(inputId, containerId, apenasPromocao) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);

    if (!input || !container) return;

    const executarBusca = () => {
        const resultado = filtrarProdutos(input.value, apenasPromocao);
        renderizarProdutos(resultado, container, apenasPromocao);
        atualizarSetas();
    };

    input.addEventListener('input', executarBusca);
    input.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter') executarBusca();
    });

    const containerPesquisa = input.closest('.pesquisa-container');
    const botaoBuscar = containerPesquisa ? containerPesquisa.querySelector('.btn-pesquisar') : null;
    if (botaoBuscar) botaoBuscar.addEventListener('click', executarBusca);
}

// Carrega os produtos assim que a página abre e conecta as duas barras de pesquisa
window.addEventListener('load', () => {
    carregarProdutos().then(() => {
        configurarPaginaProdutos();
        configurarBusca('search-input-ofertas', 'grid-promocoes', true);
    });

    const anoAtual = document.getElementById('ano-atual');
    if (anoAtual) anoAtual.textContent = new Date().getFullYear();
});
