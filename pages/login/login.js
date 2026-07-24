const API_URL = "https://sos-alimentos-servidor.onrender.com/api";

//CHECAR SE O USUÁRIO JÁ ESTÁ LOGADO
async function checarLogin() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            method: "GET",
            credentials: "include",
        });

        if (response.ok) {
            const dados = await response.json();
            redirecionarPorCargo(dados.cargo);
        }
    } catch (error) {
        console.error("Erro ao verificar sessão inicial:", error);
    }
}

// Centraliza a lógica de "pra onde cada cargo deve ir"
function redirecionarPorCargo(cargo) {
    if (cargo === "entregador") {
        window.location.href = "../entregas/entrega.html";
    } else {
        // admin e financeiro caem na página principal
        window.location.href = "../../";
    }
}

// Inicializadores do DOM
document.addEventListener("DOMContentLoaded", () => {
    checarLogin();
    initLogin();
    initCadastro();
});

function Switch() {
    document.getElementById("login-section").style.display = "none";
    document.getElementById("register-section").style.display = "block";
}

function SwitchBack() {
    document.getElementById("register-section").style.display = "none";
    document.getElementById("login-section").style.display = "block";
}



// login
function initLogin() {
    const form = document.getElementById("login-form");
    const button = document.getElementById("login-button");
    const message = document.getElementById("login-message");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const usuario = document.getElementById("usuario-login").value.trim();
        const senha = document.getElementById("senha-login").value;

        if (!usuario || !senha) {
            mostrarMensagem(message, "Preencha usuário e senha.", "erro");
            setTimeout(() => {
                message.style.display = "none";
            }, 3000);
            return;
        }

        button.disabled = true;
        button.textContent = "Entrando...";
        mostrarMensagem(message, "Validando suas credenciais...", "pendente");

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ login: usuario, password: senha }),
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.erro || "Falha no login");
            } else {
                mostrarMensagem(message, "Login realizado com sucesso! Redirecionando...", "sucesso");
                form.reset();

                window.setTimeout(() => {
                    redirecionarPorCargo(data.cargo);
                }, 1500);
            }
        } catch (error) {
            mostrarMensagem(message, error.message || "Não foi possível fazer login.", "erro");
        } finally {
            button.disabled = false;
            button.textContent = "Entrar";
        }
    });
}

//REALIZAR CADASTRO
function initCadastro() {
    const formCadastro = document.getElementById("formCadastro");
    if (!formCadastro) return;

    formCadastro.addEventListener("submit", async (e) => {
        e.preventDefault();

        const usuario = document.getElementById("usuario-cadastro").value;
        const telefone = document.getElementById("telefone-cadastro").value;
        const senha = document.getElementById("senha-cadastro").value;
        const confirmacaoSenha = document.getElementById(
            "confirm-senha-cadastro",
        ).value;
        const message = document.getElementById("cadastro-message");

        if (senha !== confirmacaoSenha) {
            message.style.display = "block";
            message.textContent =
                "As senhas não coincidem. Por favor, tente novamente.";
            message.style.color = "#C1442E";
            document.getElementById("confirm-senha-cadastro").value = "";
            setTimeout(() => {
                message.style.display = "none";
            }, 3000);
            return;
        }

        message.textContent = "Enviando...";
        message.style.color = "#5C6B58";
        message.style.display = "block";

        try {
            const resposta = await fetch(`${API_URL}/auth/cadastro`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nome: usuario,
                    telefone: telefone,
                    password: senha,
                }),
                credentials: "include",
            });

            const dados = await resposta.json();

            if (resposta.ok) {
                message.textContent = `✅ ${dados.mensagem}`;
                message.style.color = "#4C7A4A";

                formCadastro.reset();

                window.setTimeout(() => {
                    window.location.href = "../../";
                }, 2000);
            } else {
                message.textContent = `❌ ${dados.erro || "Erro ao cadastrar."}`;
                message.style.color = "#C1442E";
                setTimeout(() => {
                    message.style.display = "none";
                }, 3000);
            }
        } catch (error) {
            message.textContent = "❌ Erro ao conectar com o servidor.";
            message.style.color = "#C1442E";
            setTimeout(() => {
                message.style.display = "none";
            }, 3000);
        }
    });
}

// Atualiza o texto e o estado visual (via classe) da mensagem de status do formulário
function mostrarMensagem(elemento, texto, tipo) {
    elemento.style.display = "block";
    elemento.textContent = texto;
    elemento.classList.remove("login-message--erro", "login-message--sucesso", "login-message--pendente");
    elemento.classList.add(`login-message--${tipo}`);
}
