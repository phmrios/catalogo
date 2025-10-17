/* Core puro: tipos, validação, utilidades. KISS + SRP + DRY.
   Por quê: testável sem DOM, fácil de estender (OCP), sem dependências. */

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}
export function clampInt(n, min, max) {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
export function safeFloat(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
export function safeInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
export function parseTags(s) {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function fmtData(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString("pt-BR");
}
export function stars(n = 0) {
  const score = clampInt(n, 0, 5) ?? 0;
  return "★".repeat(score) + "☆".repeat(5 - score);
}

export function normalizarMetodo(m) {
  return {
    id: m?.id || uid(),
    metodo: (m?.metodo || "").trim(),
    nota: clampInt(m?.nota ?? 0, 1, 5) ?? 0,
    moagem: safeInt(m?.moagem),
    dose: safeFloat(m?.dose),
    rendimento: safeFloat(m?.rendimento),
    tempo: safeInt(m?.tempo),
    tempAgua: safeFloat(m?.tempAgua),
    melhorUso: (m?.melhorUso || "").trim(),
    comentarios: (m?.comentarios || "").trim(),
  };
}

export function normalizarCafe(c) {
  const base = {
    id: c?.id || uid(),
    _ts: c?._ts || Date.now(),
    nome: (c?.nome || "").trim(),
    produtor: (c?.produtor || "").trim(),
    origem: (c?.origem || "").trim(),
    variedade: (c?.variedade || "").trim(),
    processo: (c?.processo || "").trim(),
    dataTorra: c?.dataTorra || "",
    torrefador: (c?.torrefador || "").trim(),
    densidade:
      typeof c?.densidade === "number" ? c.densidade : safeFloat(c?.densidade),
    tamanho: typeof c?.tamanho === "number" ? c.tamanho : safeInt(c?.tamanho),
    umidade: typeof c?.umidade === "number" ? c.umidade : safeFloat(c?.umidade),
    agtron: typeof c?.agtron === "number" ? c.agtron : safeInt(c?.agtron),
    torraNivel: (c?.torraNivel || "").trim(),
    defeitos: (c?.defeitos || "").trim(),
    perfil: (c?.perfil || "").trim(),
    impressoes: (c?.impressoes || "").trim(),
    tags: Array.isArray(c?.tags) ? c.tags : parseTags(c?.tags),
    avaliacoes: Array.isArray(c?.avaliacoes)
      ? c.avaliacoes.map(normalizarMetodo)
      : [],
  };
  return base;
}

export function validarCafe(c) {
  const erros = [];
  if (!c || typeof c !== "object") {
    return ["Objeto inválido"];
  }
  if (!c.nome || c.nome.length < 2) {
    erros.push("Nome do café é obrigatório (>=2 caracteres).");
  }
  if (!Array.isArray(c.avaliacoes)) {
    erros.push("'avaliacoes' deve ser lista.");
  } else
    c.avaliacoes.forEach((m, i) => {
      if (!m.metodo) erros.push(`Avaliação #${i + 1}: método é obrigatório.`);
      if (!m.nota || m.nota < 1 || m.nota > 5)
        erros.push(`Avaliação #${i + 1}: nota deve ser 1..5.`);
    });
  return erros;
}

export function notaAgregada(avals) {
  if (!Array.isArray(avals) || !avals.length) return 0;
  const sum = avals.reduce((a, m) => a + (m?.nota || 0), 0);
  return Math.round(sum / avals.length);
}
