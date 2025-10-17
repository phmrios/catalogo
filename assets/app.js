/* Vitrine somente-leitura — versão “detalhe completo”.
   Mudanças principais:
   - Cada card exibe resumo + <details> com TODOS os campos do JSON.
   - Tabela acessível para avaliacoes (th + scope, caption).
   - Renderização condicional de campos (só mostra o que existe).
*/

import {
  normalizarCafe,
  validarCafe,
  notaAgregada,
  stars,
  fmtData,
} from "./core.js";

/* Estado leve (somente leitura) */
const state = {
  cafes: [],
  filtros: {
    origem: "",
    processo: "",
    metodo: "",
    torra: "",
    ordenar: "recentes",
    query: "",
  },
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const grid = $("#grid");
const empty = $("#empty");
const status = $("#status");

bindUI();
loadAll().then(render).catch(showError);

/* ----------------- Carregamento ------------------ */
async function loadAll() {
  showStatus("Carregando manifesto…");
  const manifest = await fetchJSON("./data/index.json");
  const entries = Array.isArray(manifest?.cafes) ? manifest.cafes : [];
  if (!entries.length) {
    showStatus("Manifesto vazio. Edite /data/index.json.", true);
    return;
  }

  const results = [];
  const errors = [];

  for (const entry of entries) {
    const href = typeof entry === "string" ? entry : entry?.href;
    if (!href) {
      errors.push("Entrada de manifesto sem 'href' válido.");
      continue;
    }
    try {
      const raw = await fetchJSON(`./data/${href}`);
      const cafe = normalizarCafe(raw);
      const errs = validarCafe(cafe);
      if (errs.length) {
        errors.push(`${href}: ${errs.join("; ")}`);
        continue;
      }
      cafe.__href = href; // guardamos o arquivo de origem para exibir no detalhe
      results.push(cafe);
    } catch (e) {
      errors.push(`${href}: ${e.message}`);
    }
  }

  state.cafes = results.sort((a, b) => (b._ts || 0) - (a._ts || 0));
  if (errors.length) {
    showStatus(
      "Alguns itens não foram carregados:\n" + errors.join("\n"),
      true,
    );
  } else hideStatus();
}

/* ----------------- UI & Render ------------------- */
function bindUI() {
  $("#btnReload").addEventListener("click", () => {
    loadAll().then(render).catch(showError);
  });
  $("#query").addEventListener("input", (e) => {
    state.filtros.query = e.target.value.trim();
    render();
  });
  $("#fOrigem").addEventListener("change", (e) => {
    state.filtros.origem = e.target.value;
    render();
  });
  $("#fProcesso").addEventListener("change", (e) => {
    state.filtros.processo = e.target.value;
    render();
  });
  $("#fMetodo").addEventListener("change", (e) => {
    state.filtros.metodo = e.target.value;
    render();
  });
  $("#fTorra").addEventListener("change", (e) => {
    state.filtros.torra = e.target.value;
    render();
  });
  $("#fOrdenar").addEventListener("change", (e) => {
    state.filtros.ordenar = e.target.value;
    render();
  });
}

function render() {
  const { query, origem, processo, metodo, torra, ordenar } = state.filtros;
  let list = state.cafes.slice();

  if (query) {
    const q = query.toLowerCase();
    list = list.filter((c) => JSON.stringify(c).toLowerCase().includes(q));
  }
  if (origem)
    list = list.filter((c) =>
      (c.origem || "").toLowerCase().includes(origem.toLowerCase()),
    );
  if (processo)
    list = list.filter(
      (c) => (c.processo || "").toLowerCase() === processo.toLowerCase(),
    );
  if (metodo)
    list = list.filter((c) =>
      c.avaliacoes?.some(
        (m) => (m.metodo || "").toLowerCase() === metodo.toLowerCase(),
      ),
    );
  if (torra)
    list = list.filter(
      (c) => (c.torraNivel || "").toLowerCase() === torra.toLowerCase(),
    );

  if (ordenar === "nome")
    list.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  else if (ordenar === "nota")
    list.sort(
      (a, b) => notaAgregada(b.avaliacoes) - notaAgregada(a.avaliacoes),
    );
  else list.sort((a, b) => (b._ts || 0) - (a._ts || 0));

  grid.setAttribute("aria-busy", "true");
  grid.innerHTML = list.map(cardHTML).join("");
  grid.setAttribute("aria-busy", "false");

  empty.style.display = list.length ? "none" : "block";
  fillDynamicFilters();
}

function cardHTML(c) {
  const meta = [
    c.produtor && badge("Produtor/Fazenda", c.produtor),
    c.origem && badge("Origem", c.origem),
    c.variedade && badge("Variedade", c.variedade),
    c.processo && badge("Processo", c.processo),
    c.torraNivel && badge("Torra", c.torraNivel),
  ]
    .filter(Boolean)
    .join(" ");

  const notaAvg = notaAgregada(c.avaliacoes);
  const tags = (c.tags || [])
    .map((t) => `<span class="badge" aria-label="Tag">${esc(t)}</span>`)
    .join(" ");
  const blocoLivre =
    c.perfil || c.impressoes
      ? `<div class="note"><strong>Notas:</strong> ${esc([c.perfil, c.impressoes].filter(Boolean).join(" | "))}</div>`
      : "";

  return `
    <article class="card">
      <h3>${esc(c.nome || "—")}</h3>
      <div class="meta">${meta}</div>
      <div>
        <span class="stars" aria-label="Nota média ${notaAvg} de 5">${stars(notaAvg)}</span>
        ${c.dataTorra ? `• torra ${fmtData(c.dataTorra)}` : ""}
      </div>
      ${tags ? `<div class="meta">${tags}</div>` : ""}
      ${blocoLivre}

      <details class="details-block">
        <summary class="btn-ghost" aria-label="Ver detalhes de ${esc(c.nome || "café")}">
          Ver detalhes
        </summary>

        <div class="detail-grid">
          ${dlRow("Arquivo", c.__href)}
          ${dlRow("ID", c.id)}
          ${dlRow("Timestamp (_ts)", c._ts)}
          ${dlRow("Nome", c.nome)}
          ${dlRow("Produtor", c.produtor)}
          ${dlRow("Origem", c.origem)}
          ${dlRow("Variedade", c.variedade)}
          ${dlRow("Processo", c.processo)}
          ${dlRow("Data de torra", c.dataTorra ? fmtData(c.dataTorra) : "")}
          ${dlRow("Torrefador", c.torrefador)}
          ${dlRow("Densidade (g/L)", c.densidade)}
          ${dlRow("Tamanho (μm)", c.tamanho)}
          ${dlRow("Umidade (%)", c.umidade)}
          ${dlRow("Agtron", c.agtron)}
          ${dlRow("Torra (nível)", c.torraNivel)}
          ${dlRow("Defeitos", c.defeitos)}
          ${dlRow("Perfil sensorial", c.perfil)}
          ${dlRow("Impressões", c.impressoes)}
          ${dlRow("Melhor uso (global)", c.melhorUso)}          
        </div>

        ${renderAvaliacoesTable(c.avaliacoes)}
      </details>
    </article>
  `;
}

function badge(title, value) {
  return `<span class="badge" title="${esc(title)}">${esc(value)}</span>`;
}

function dlRow(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return `
    <div class="dl-row">
      <div class="dl-term">${esc(label)}</div>
      <div class="dl-def">${esc(String(value))}</div>
    </div>
  `;
}

function renderAvaliacoesTable(avals) {
  if (!Array.isArray(avals) || avals.length === 0) return "";
  const rows = avals
    .map(
      (m, i) => `
    <tr>
      <th scope="row">${i + 1}</th>
      <td>${esc(m.metodo || "")}</td>
      <td><span class="stars" aria-label="Nota ${m.nota} de 5">${stars(m.nota || 0)}</span></td>
      <td>${safe(m.moagem)}</td>
      <td>${safe(m.dose)}</td>
      <td>${safe(m.rendimento)}</td>
      <td>${safe(m.tempo)}</td>
      <td>${safe(m.tempAgua)}</td>
      <td>${esc(m.melhorUso || "")}</td>
      <td>${esc(m.comentarios || "")}</td>
    </tr>
  `,
    )
    .join("");

  return `
    <div class="table-wrap">
      <table class="tbl" role="table">
        <caption>Avaliações por método de extração</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Método</th>
            <th scope="col">Nota</th>
            <th scope="col">Moagem (μm)</th>
            <th scope="col">Dose (g)</th>
            <th scope="col">Rendimento (g)</th>
            <th scope="col">Tempo (s)</th>
            <th scope="col">Água (°C)</th>
            <th scope="col">Melhor uso</th>
            <th scope="col">Comentários</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function safe(v) {
  return v === null || v === undefined || v === "" ? "—" : esc(String(v));
}

/* Filtros dinâmicos */
function fillDynamicFilters() {
  setOptions(
    $("#fOrigem"),
    uniqSorted(
      state.cafes
        .map((c) => (c.origem || "").split("/")[0].trim())
        .filter(Boolean),
    ),
    "Origem",
  );
  setOptions(
    $("#fProcesso"),
    uniqSorted(state.cafes.map((c) => c.processo || "")),
    "Processo",
  );
  setOptions(
    $("#fMetodo"),
    uniqSorted(
      state.cafes.flatMap((c) =>
        (c.avaliacoes || []).map((m) => m.metodo || ""),
      ),
    ),
    "Método",
  );
}
function setOptions(sel, vals, label) {
  const v = sel.value;
  sel.innerHTML =
    `<option value="">${esc(label)}</option>` +
    vals.map((x) => `<option>${esc(x)}</option>`).join("");
  if (vals.includes(v)) sel.value = v;
}
function uniqSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

/* ----------------- Utilidades ------------------- */
async function fetchJSON(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ao carregar ${url}`);
  return await r.json();
}
function esc(s = "") {
  return s.replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ],
  );
}
function showStatus(msg, isWarn = false) {
  status.style.display = "block";
  status.textContent = msg;
  status.setAttribute("data-warn", isWarn ? "true" : "false");
}
function hideStatus() {
  status.style.display = "none";
  status.textContent = "";
}
function showError(e) {
  showStatus(String(e?.message || e), true);
}
