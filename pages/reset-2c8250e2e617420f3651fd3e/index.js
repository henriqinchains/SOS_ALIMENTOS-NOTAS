const API_URL = "https://sos-alimentos-servidor.onrender.com/api";

document.addEventListener("DOMContentLoaded", () => {
    initReset();
});

function initReset() {
    const form = document.getElementById("reset-form");
    const button = document.getElementById("reset-button");
    const message = document.getElementById("reset-message");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const usuario = document.getElementById("usuario-reset").value.trim();
        const senha = document.getElementById("senha-reset").value;
        const confirmacaoSenha = document.getElementById("confirm-senha-reset").value;

        if (!usuario || !senha || !confirmacaoSenha) {
            mostrarMensagem(message, "Preencha todos os campos.", "erro");
            return;
        }

        if (senha.length < 6) {
            mostrarMensagem(message, "A nova senha precisa ter pelo menos 6 caracteres.", "erro");
            return;
        }

        if (senha !== confirmacaoSenha) {
            mostrarMensagem(message, "As senhas não coincidem. Tente novamente.", "erro");
            document.getElementById("confirm-senha-reset").value = "";
            return;
        }

        button.disabled = true;
        button.textContent = "Redefinindo...";
        mostrarMensagem(message, "Enviando...", "pendente");

        try {
            const response = await fetch(`${API_URL}/auth/redefinir-senha`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: usuario, novaSenha: senha }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.erro || "Não foi possível redefinir a senha.");
            }

            mostrarMensagem(message, "✅ Senha redefinida com sucesso! Você já pode fazer login com a nova senha.", "sucesso");
            form.reset();
        } catch (error) {
            mostrarMensagem(message, `❌ ${error.message || "Erro ao conectar com o servidor."}`, "erro");
        } finally {
            button.disabled = false;
            button.textContent = "Redefinir senha";
        }
    });
}

function mostrarMensagem(elemento, texto, tipo) {
    elemento.style.display = "block";
    elemento.textContent = texto;
    elemento.classList.remove("reset-message--erro", "reset-message--sucesso", "reset-message--pendente");
    elemento.classList.add(`reset-message--${tipo}`);
}
