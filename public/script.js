// script.js
// Login com o Google (Google Identity Services) e chamada a rota /api/desenho.
// O desenho e gerado no servidor; esta pagina so envia o numero e o id_token
// e exibe a resposta. O e-mail da assinatura vem do token, verificado no servidor.

// Client ID do OAuth (publico). Deve ser o mesmo valor da variavel de ambiente
// GOOGLE_CLIENT_ID configurada no painel do Cloudflare Pages.
const GOOGLE_CLIENT_ID = "99578499287-e85hffqm9vn6o636megogo1kbqouksnb.apps.googleusercontent.com";

const formulario = document.getElementById("formulario");
const campoNumero = document.getElementById("numero");
const area = document.getElementById("desenho");
const mensagem = document.getElementById("mensagem");
const botaoBaixar = document.getElementById("baixar");
const usuario = document.getElementById("usuario");

let idToken = "";
let svgAtual = "";

function iniciarLogin() {
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (resposta) => {
      idToken = resposta.credential;
      const email = lerEmailDoToken(idToken);
      usuario.textContent = email ? `Conectado como ${email}` : "Conectado.";
      mensagem.textContent = "";
    },
  });
  google.accounts.id.renderButton(document.getElementById("botao-google"), {
    theme: "filled_black",
    size: "large",
    text: "signin_with",
  });
}

// Apenas para exibir quem esta logado. Quem decide a assinatura e o servidor.
function lerEmailDoToken(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json).email || "";
  } catch {
    return "";
  }
}

if (window.google?.accounts?.id) {
  iniciarLogin();
} else {
  window.onGoogleLibraryLoad = iniciarLogin;
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mensagem.textContent = "";

  const texto = campoNumero.value.trim();
  const numero = texto === "" ? null : Number(texto);

  const cabecalhos = { "Content-Type": "application/json" };
  if (idToken) cabecalhos.Authorization = `Bearer ${idToken}`;

  let resposta;
  try {
    resposta = await fetch("/api/desenho", {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify({ numero }),
    });
  } catch {
    mensagem.textContent = "Não foi possível falar com o servidor. Tente novamente.";
    return;
  }

  if (resposta.ok) {
    svgAtual = await resposta.text();
    area.innerHTML = svgAtual;
    botaoBaixar.hidden = false;
    return;
  }

  const detalhe = await lerErro(resposta);
  if (resposta.status === 400) {
    mensagem.textContent = `Erro 400: número inválido. ${detalhe}`;
  } else if (resposta.status === 401) {
    mensagem.textContent = `Erro 401: não autorizado. ${detalhe}`;
  } else {
    mensagem.textContent = `Erro ${resposta.status}. ${detalhe}`;
  }
  area.innerHTML = "";
  botaoBaixar.hidden = true;
});

async function lerErro(resposta) {
  try {
    const dados = await resposta.json();
    return dados.erro || "";
  } catch {
    return "";
  }
}

botaoBaixar.addEventListener("click", () => {
  const arquivo = new Blob([svgAtual], { type: "image/svg+xml" });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = "exemplo.svg";
  link.click();
  URL.revokeObjectURL(url);
});
