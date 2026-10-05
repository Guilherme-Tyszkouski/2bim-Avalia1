// functions/api/desenho.js
// Pages Function da rota POST /api/desenho.
//
// Contrato:
//   corpo          {"numero": 42}
//   cabecalho      Authorization: Bearer <id_token>
//   200            SVG (image/svg+xml) assinado com o e-mail do token
//   400            corpo ausente, JSON invalido, numero ausente, nao inteiro ou fora de 1..100
//   401            token ausente, invalido, expirado, de outro Client ID ou e-mail nao verificado
//   405            qualquer metodo diferente de POST
// Ordem das verificacoes: metodo (405), corpo (400), token (401).

import { gerarDesenho, numeroValido } from "../../lib/desenho.js";

const TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?id_token=";

function erro(status, mensagem, cabecalhos = {}) {
  return new Response(JSON.stringify({ erro: mensagem }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...cabecalhos,
    },
  });
}

// Devolve o e-mail verificado do token, ou null se o token nao for aceito.
async function emailDoToken(token, clientId) {
  if (!clientId) return null;

  let resposta;
  try {
    resposta = await fetch(TOKENINFO + encodeURIComponent(token));
  } catch {
    return null;
  }
  if (resposta.status !== 200) return null;

  let info;
  try {
    info = await resposta.json();
  } catch {
    return null;
  }

  if (info.aud !== clientId) return null;
  if (info.email_verified !== "true" && info.email_verified !== true) return null;
  if (typeof info.email !== "string" || info.email === "") return null;

  return info.email;
}

export async function onRequest(context) {
  const { request, env } = context;

  // 1. Metodo
  if (request.method !== "POST") {
    return erro(405, "Método não permitido. Use POST.", { Allow: "POST" });
  }

  // 2. Corpo
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return erro(400, "Corpo ausente ou JSON inválido.");
  }
  if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) {
    return erro(400, "Corpo deve ser um objeto JSON no formato {\"numero\": 42}.");
  }
  if (!numeroValido(corpo.numero)) {
    return erro(400, "O número deve ser um inteiro entre 1 e 100.");
  }

  // 3. Token
  const autorizacao = request.headers.get("Authorization") || "";
  const encontrado = autorizacao.match(/^Bearer\s+(\S+)$/i);
  if (!encontrado) {
    return erro(401, "Token ausente. Faça login com o Google.");
  }

  const email = await emailDoToken(encontrado[1], env.GOOGLE_CLIENT_ID);
  if (!email) {
    return erro(401, "Token inválido, expirado ou não emitido para este site. Faça login novamente.");
  }

  const svg = gerarDesenho(corpo.numero, email);
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}
