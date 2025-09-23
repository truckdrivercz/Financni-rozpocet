const $ = id => document.getElementById(id);

const categoriesEl = $("categories");
const slicesGroup  = $("slices");
const legend       = $("legend");

const ui = {
  sumVydeje: $("sumVydeje"),
  zustatek: $("zustatek"),
  pomerUspor: $("pomerUspor"),
  stavBadge: $("stavBadge"),
  centerBig: $("centerBig"),
  centerSmall: $("centerSmall"),
  btnAdd: $("addCategory"),
  btnReset: $("btnReset"),
  prijem: $("prijem"),
};

const fmt = new Intl.NumberFormat("cs-CZ",{ style:"currency", currency:"CZK", maximumFractionDigits:0 });
const R = 95;
const EPS_DEG = 2;
const palette = ["#8b5cf6","#22c55e","#06b6d4","#ef4444","#3b82f6","#f97316","#eab308","#14b8a6"];
const zbyvaColor = getComputedStyle(document.documentElement).getPropertyValue("--zbyva").trim() || "#f59e0b";

let categories = [];

const createItemRow = (wrap, cat, item) => {
  const row = document.createElement("div");
  row.className = "item-row";
  row.dataset.itemId = item.id;

  row.innerHTML = `
    <input type="text" placeholder="Název položky" value="${item.name || ""}">
    <input type="number" min="0" step="100" placeholder="0" value="${item.value || ""}">
    <button class="del-item">✕</button>
  `;

  const [nameInput, valInput] = row.querySelectorAll("input");

  nameInput.addEventListener("input", () => { item.name  = nameInput.value; save(); });
  valInput.addEventListener("input", () => { item.value = valInput.value; update(); save(); });

  row.querySelector(".del-item").addEventListener("click", () => {
    cat.items = cat.items.filter(i => i.id !== item.id);
    row.remove();
    update(); save();
  });

  wrap.appendChild(row);
};

const createCategoryBlock = (cat) => {
  const block = document.createElement("div");
  block.className = "category-block";
  block.dataset.catId = cat.id;

  block.innerHTML = `
    <div class="cat-header">
      <span class="cat-name">${cat.name}</span>
      <div class="cat-actions">
        <button class="edit" title="Přejmenovat">✏️</button>
        <button class="add-item" title="Přidat položku">➕ Položka</button>
        <button class="del" title="Smazat kategorii">✕</button>
      </div>
    </div>
    <div class="items"></div>
  `;

  const nameSpan = block.querySelector(".cat-name");

  block.querySelector(".edit").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = cat.name;
    input.className = "edit-input";
    nameSpan.replaceWith(input);
    input.focus();

    const saveName = () => {
      cat.name = input.value.trim() || cat.name;
      const span = document.createElement("span");
      span.className = "cat-name";
      span.textContent = cat.name;
      input.replaceWith(span);
      update(); save();
    };
    input.addEventListener("blur", saveName);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") saveName();
      if (e.key === "Escape") { input.value = cat.name; saveName(); }
    });
  });

  block.querySelector(".add-item").addEventListener("click", () => {
    const item = { id: "item-"+Date.now(), name: "", value: "" };
    cat.items.push(item);
    createItemRow(block.querySelector(".items"), cat, item);
    update(); save();
  });

  block.querySelector(".del").addEventListener("click", () => {
    if (!confirm(`Smazat kategorii „${cat.name}“?`)) return;
    categories = categories.filter(c => c.id !== cat.id);
    block.remove();
    update(); save();
  });

  const itemsWrap = block.querySelector(".items");
  (cat.items || []).forEach(i => createItemRow(itemsWrap, cat, i));

  categoriesEl.appendChild(block);
};

const STORAGE_KEY = "rozpocetData_v7";

const save = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    prijem: ui.prijem.value,
    categories
  }));
};

const load = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    categories = [];
  } else {
    const d = JSON.parse(raw);
    ui.prijem.value = d.prijem || "";
    categories = (d.categories || []);
  }
  categoriesEl.innerHTML = "";
  categories.forEach(createCategoryBlock);
};

const polar = (cx,cy,r,a)=>{const rad=(a-90)*Math.PI/180;return{x:cx+r*Math.cos(rad),y:cy+r*Math.sin(rad)};};
const describeArc = (cx,cy,r,start,end)=>{const s=polar(cx,cy,r,end),e=polar(cx,cy,r,start);const f=end-start<=180?"0":"1";return`M ${s.x} ${s.y} A ${r} ${r} 0 ${f} 0 ${e.x} ${e.y}`;};

const rebuildLegend = (parts, leftoverPct) => {
  legend.innerHTML = "";
  parts.forEach(p => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.innerHTML = `<span class="dot" style="background:${p.color}"></span> ${p.name}`;
    legend.appendChild(pill);
  });
  if (leftoverPct > 0){
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.innerHTML = `<span class="dot" style="background:${zbyvaColor}"></span> Zůstatek`;
    legend.appendChild(pill);
  }
};

const drawDonut = (parts, leftoverPct) => {
  slicesGroup.innerHTML = "";
  let start = 0;

  parts.forEach(p => {
    const realSpan = (p.pct/100) * 360;
    const drawSpan = p.pct > 0 ? realSpan : EPS_DEG;
    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("class","slice");
    path.setAttribute("d", describeArc(130,130,R,start,start+drawSpan));
    path.style.stroke = p.color;
    path.style.opacity = p.pct > 0 ? "1" : "0.25";
    slicesGroup.appendChild(path);
    start += realSpan;
  });

  if (leftoverPct > 0) {
    const span = (Math.min(leftoverPct, 99.999) / 100) * 360;
    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("class","slice");
    path.setAttribute("d", describeArc(130,130,R,start,start+span));
    path.style.stroke = zbyvaColor;
    slicesGroup.appendChild(path);
  }
};

const update = () => {
  const prijem = Math.max(0, parseFloat(String(ui.prijem.value).replace(",", ".")) || 0);

  const partsRaw = categories.map((c,i) => ({
    name: c.name,
    value: (c.items || []).reduce((a,b)=>a+(parseFloat(b.value)||0),0),
    color: c.color || palette[i % palette.length]
  }));

  const vydaje     = partsRaw.reduce((a,b)=>a+b.value, 0);
  const precerpano = Math.max(0, vydaje - prijem);
  const zustatek   = Math.max(0, prijem - vydaje);

  ui.sumVydeje.textContent = (prijem || vydaje) ? fmt.format(vydaje) : "–";
  ui.zustatek.textContent  = prijem ? fmt.format(zustatek) : "–";

  const usp = partsRaw.find(p => p.name.toLowerCase().includes("úsp"));
  ui.pomerUspor.textContent = (prijem && usp) ? ((usp.value/prijem)*100).toFixed(1) + " %" : "–";

  let badgeHtml = `<span class="badge warn">Čekám na data…</span>`;
  if (precerpano > 0) badgeHtml = `<span class="badge bad">Přečerpáno o ${fmt.format(precerpano)}</span>`;
  else if (prijem > 0) {
    const r = vydaje / prijem;
    if (r <= 0.5)      badgeHtml = `<span class="badge ok">Výdaje pod kontrolou</span>`;
    else if (r <= 0.8) badgeHtml = `<span class="badge warn">Výdaje vyšší</span>`;
    else               badgeHtml = `<span class="badge warn">Blížíš se limitu</span>`;
  }
  ui.stavBadge.innerHTML = badgeHtml;

  ui.centerBig.textContent   = prijem ? fmt.format(prijem) : (vydaje ? fmt.format(vydaje) : "0 Kč");
  ui.centerSmall.textContent = prijem ? "Měsíční příjem" : "Zadej příjem a výdaje";

  let partsPct = [], leftoverPct = 0;
  if (prijem > 0) {
    if (vydaje <= prijem) {
      partsPct    = partsRaw.map(p => ({...p, pct:(p.value/prijem)*100}));
      leftoverPct = ((prijem - vydaje)/prijem)*100;
    } else {
      const total = vydaje || 1;
      partsPct    = partsRaw.map(p => ({...p, pct:(p.value/total)*100}));
      leftoverPct = 0;
    }
  } else if (vydaje > 0) {
    const total = vydaje;
    partsPct    = partsRaw.map(p => ({...p, pct:(p.value/total)*100}));
    leftoverPct = 0;
  } else {
    partsPct    = partsRaw.map(p => ({...p, pct:0}));
    leftoverPct = 0;
  }

  drawDonut(partsPct, leftoverPct);
  rebuildLegend(partsPct, leftoverPct);
  save();
};

ui.prijem.addEventListener("input", () => { update(); save(); });

ui.btnAdd.addEventListener("click", () => {
  const name = prompt("Název nové kategorie:");
  if (!name) return;
  const cat = { id:"cat-"+Date.now(), name, color: palette[categories.length % palette.length], items: [] };
  categories.push(cat);
  createCategoryBlock(cat);
  update(); save();
});

ui.btnReset.addEventListener("click", () => {
  if (!confirm("Vymazat vše?")) return;
  localStorage.removeItem(STORAGE_KEY);
  categories = [];
  categoriesEl.innerHTML = "";
  slicesGroup.innerHTML = "";
  legend.innerHTML = "";
  ui.prijem.value = "";
  update();
});

load();
update();