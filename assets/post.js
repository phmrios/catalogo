import { normalizarCafe, notaAgregada, stars, fmtData } from "./core.js";

const root = document.querySelector("#postRoot");
const statusBox = document.querySelector("#status");

init().catch(showError);

/* Fluxo principal */
async function init() {
  const href = getCafeParam();
  if (!href) {
    showError(new Error("Nenhum parâmetro 'cafe' na URL."));
    return;
  }

  showStatus(`Carregando dados de ${href}...`);

  const raw = await fetchJSON(`./data/${href}`);
  const cafe = normalizarCafe(raw);
  cafe.__href = href;

  const avals = toArray(cafe.avaliacoes);
  const nota = notaAgregada(avals);

  root.innerHTML = renderPost(cafe, avals, nota, href);
  root.setAttribute("aria-busy", "false");
  hideStatus();
}

/* Renderização do post */
function renderPost(c, avals, nota, href) {
  const meta = [
    c.produtor && badge("Produtor/Fazenda", c.produtor),
    c.origem && badge("Origem", c.origem),
    c.variedade && badge("Variedade", c.variedade),
    c.processo && badge("Processo", c.processo),
    c.torraNivel && badge("Torra", c.torraNivel),
  ]
    .filter(Boolean)
    .join(" ");

  const tags = toArray(c.tags)
    .map((t) => `<span class="badge" aria-label="Tag">${esc(String(t))}</span>`)
    .join(" ");

  const titulo = c.nome || "(Café sem nome)";

  const blocoLivre =
    c.perfil || c.impressoes
      ? `<div class="note"><strong>Notas livres:</strong> ${esc(
          [c.perfil, c.impressoes].filter(Boolean).join(" | "),
        )}</div>`
      : "";

  return `
    <article class="card">
      <header>
        <h2>${esc(titulo)}</h2>
        <p class="meta">
          ${meta}
        </p>
        <p>
          <span class="stars" aria-label="Nota média ${nota} de 5">${stars(
            nota,
          )}</span>
          ${c.dataTorra ? `· torra em ${fmtData(c.dataTorra)}` : ""}
          ${c.dataBebido ? `· degustado em ${fmtData(c.dataBebido)}` : ""}
        </p>
        ${
          tags
            ? `<p class="meta">
                 ${tags}
               </p>`
            : ""
        }
        <p class="meta">
          <small>Arquivo: <code>${esc(href)}</code></small>
        </p>
      </header>

      ${blocoLivre}

      <section aria-label="Detalhes técnicos">
        <div class="detail-grid">
          ${dlRow("Produtor", c.produtor)}
          ${dlRow("Origem", c.origem)}
          ${dlRow("Variedade", c.variedade)}
          ${dlRow("Processo", c.processo)}
          ${dlRow("Data de torra", c.dataTorra ? fmtData(c.dataTorra) : "")}
          ${dlRow(
            "Data de degustação",
            c.dataBebido ? fmtData(c.dataBebido) : "",
          )}
          ${dlRow("Torrefador", c.torrefador)}
          ${dlRow("Densidade (g/L)", c.densidade)}
          ${dlRow("Tamanho (μm)", c.tamanho)}
          ${dlRow("Umidade (%)", c.umidade)}
          ${dlRow("Agtron", c.agtron)}
          ${dlRow("Torra (nível)", c.torraNivel)}
          ${dlRow("Defeitos", c.defeitos)}
        </div>
      </section>

      ${renderAvaliacoesTable(avals)}
    </article>
  `;
}

/* Helpers de URL e fetch */
function getCafeParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get("cafe");
}

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} ao carregar ${url}`);
  }
  return await r.json();
}

/* Helpers de apresentação locais a esta página */
function badge(title, value) {
  return `<span class="badge" title="${esc(title)}">${esc(value)}</span>`;
}

function dlRow(label, value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
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
          <td>${esc(m?.metodo ?? "")}</td>
          <td>
            <span class="stars" aria-label="Nota ${
              m?.nota ?? 0
            } de 5">${stars(m?.nota ?? 0)}</span>
          </td>
          <td>${safe(m?.moagem)}</td>
          <td>${safe(m?.dose)}</td>
          <td>${safe(m?.rendimento)}</td>
          <td>${safe(m?.tempo)}</td>
          <td>${safe(m?.tempAgua)}</td>
          <td>${esc(m?.melhorUso ?? "")}</td>
          <td>${esc(m?.comentarios ?? "")}</td>
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

/* Utilidades simples */
function esc(s = "") {
  return s.replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[m] || m,
  );
}

function safe(v) {
  return v === null || v === undefined || v === "" ? "n/d" : esc(String(v));
}

function toArray(x) {
  return Array.isArray(x) ? x : [];
}

/* Status e erro */
function showStatus(msg) {
  if (!statusBox) return;
  statusBox.style.display = "block";
  statusBox.textContent = msg;
  statusBox.setAttribute("data-warn", "false");
}

function hideStatus() {
  if (!statusBox) return;
  statusBox.style.display = "none";
  statusBox.textContent = "";
}

function showError(e) {
  if (!statusBox) return;
  statusBox.style.display = "block";
  statusBox.textContent = String(e?.message || e);
  statusBox.setAttribute("data-warn", "true");
  if (root) {
    root.setAttribute("aria-busy", "false");
  }
}
