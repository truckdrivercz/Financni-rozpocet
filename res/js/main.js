const $ = id => document.getElementById(id);
const inputsContainer = $("inputsContainer");
const slicesGroup = $("slices");
const legend = $("legend");

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

const fmt = new Intl.NumberFormat("cs-CZ",{style:"currency",currency:"CZK",maximumFractionDigits:0});
const R = 95;
const EPS_DEG = 2;
const palette = ["#8b5cf6","#22c55e","#06b6d4","#ef4444","#3b82f6","#f97316","#eab308","#14b8a6","#a78bfa","#10b981"];
let categories = [];

const norm = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

const createCategoryRow = cat => {
  const row = document.createElement("div");
  row.className = "row";
  row.dataset.catId = cat.id;
  row.innerHTML = `
    <div class="cat-actions">
      <label for="${cat.id}">${cat.name}</label>
      <button class="del" title="Smazat kategorii">✕</button>
    </div>
    <input id="${cat.id}" type="number" min="0" step="100" placeholder="0" value="${cat.value || ""}">
  `;
  const input = row.querySelector("input");
  input.addEventListener("input", () => { cat.value = input.value; update(); save(); });
  row.querySelector(".del").addEventListener("click", () => {
    if (!confirm(`Smazat kategorii „${cat.name}“?`)) return;
    categories = categories.filter(c => c.id !== cat.id);
    row.remove();
    update(); save();
  });
  inputsContainer.appendChild(row);
};

const rebuildLegend = (parts, leftoverPct) => {
  legend.innerHTML = "";
  parts.forEach(p=>{
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.innerHTML = `<span class="dot" style="background:${p.color}"></span> ${p.name}`;
    legend.appendChild(pill);
  });
  if (leftoverPct > 0){
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.innerHTML = `<span class="dot" style="background:var(--zbyva)"></span> Zůstatek`;
    legend.appendChild(pill);
  }
};

const polarToCartesian = (cx, cy, r, angleDeg) => {
  const a = (angleDeg - 90) * Math.PI/180;
  return { x: cx + (r * Math.cos(a)), y: cy + (r * Math.sin(a)) };
};

const describeArc = (cx, cy, r, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end   = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

const drawDonut = (parts, leftoverPct) => {
  slicesGroup.innerHTML = "";
  let start = 0;
  parts.forEach(p=>{
    const realSpan = (p.pct/100) * 360;
    const drawSpan = p.pct > 0 ? realSpan : EPS_DEG;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class","slice");
    path.setAttribute("d", describeArc(130,130,R, start, start + drawSpan));
    path.setAttribute("stroke", p.color);
    path.setAttribute("opacity", p.pct > 0 ? "1" : "0.25");
    slicesGroup.appendChild(path);
    start += realSpan;
  });
  if (leftoverPct > 0){
    const span = (leftoverPct/100)*360;
    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("class","slice");
    path.setAttribute("d", describeArc(130,130,R, start, start + span));
    path.setAttribute("stroke", getComputedStyle(document.documentElement).getPropertyValue('--zbyva').trim() || "#f59e0b");
    slicesGroup.appendChild(path);
  }
};

const STORAGE_KEY = "rozpocetData_v4";

const save = () => {
  const data = {
    prijem: ui.prijem.value,
    categories: categories.map(c => ({id:c.id,name:c.name,value:c.value,color:c.color}))
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const load = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw){
    categories = [
      {id:"spl",  name:"Splátky",   value:"", color:palette[0]},
      {id:"uspo", name:"Úspory",    value:"", color:palette[1]},
      {id:"pred", name:"Předplatné",value:"", color:palette[2]},
    ];
    categories.forEach(createCategoryRow);
    return;
  }
  try{
    const d = JSON.parse(raw);
    ui.prijem.value = d.prijem || "";
    categories = (d.categories || []).map((c,i)=>({
      id:c.id || ("cat-"+i),
      name:c.name || ("Kategorie "+(i+1)),
      value:c.value || "",
      color:c.color || palette[i % palette.length]
    }));
    categories.forEach(createCategoryRow);
  }catch(e){}
};

const update = () => {
  const prijem = Math.max(0, parseFloat(String(ui.prijem.value).replace(",", ".")) || 0);
  const partsRaw = categories.map((c,i)=>({
    name: c.name,
    value: Math.max(0, parseFloat(String(c.value).replace(",", ".")) || 0),
    color: c.color || palette[i % palette.length]
  }));
  const vydaje = partsRaw.reduce((a,b)=>a+b.value, 0);
  const precerpano = Math.max(0, vydaje - prijem);
  const zustatek = Math.max(0, prijem - vydaje);

  ui.sumVydeje.textContent = (prijem || vydaje) ? fmt.format(vydaje) : "–";
  ui.zustatek.textContent = prijem ? fmt.format(zustatek) : "–";

  const usp = partsRaw.find(p => norm(p.name).includes("usp"));
  ui.pomerUspor.textContent = (prijem && usp) ? ((usp.value/prijem)*100).toFixed(1) + " %" : "–";

  let badgeHtml = `<span class="badge warn">Zadej částky</span>`;
  if (precerpano > 0) badgeHtml = `<span class="badge bad">Přečerpáno o ${fmt.format(precerpano)}</span>`;
  else if (prijem > 0){
    const r = vydaje / prijem;
    if (r <= 0.6) badgeHtml = `<span class="badge ok">Výdaje pod kontrolou</span>`;
    else if (r <= 0.8) badgeHtml = `<span class="badge warn">Výdaje vyšší</span>`;
    else badgeHtml = `<span class="badge warn">Blížíš se limitu</span>`;
  }
  ui.stavBadge.innerHTML = badgeHtml;

  ui.centerBig.textContent = prijem ? fmt.format(prijem) : (vydaje ? fmt.format(vydaje) : "0 Kč");
  ui.centerSmall.textContent = prijem ? "Měsíční příjem" : "Zadej příjem a výdaje";

  let partsPct = [];
  let leftoverPct = 0;
  if (prijem > 0){
    if (vydaje <= prijem){
      partsPct = partsRaw.map(p => ({...p, pct: (p.value/prijem)*100 }));
      leftoverPct = ((prijem - vydaje)/prijem)*100;
    } else {
      const total = vydaje || 1;
      partsPct = partsRaw.map(p => ({...p, pct: (p.value/total)*100 }));
      leftoverPct = 0;
    }
  } else if (vydaje > 0){
    const total = vydaje;
    partsPct = partsRaw.map(p => ({...p, pct: (p.value/total)*100 }));
    leftoverPct = 0;
  } else {
    partsPct = partsRaw.map(p => ({...p, pct: 0 }));
    leftoverPct = 0;
  }

  drawDonut(partsPct, leftoverPct);
  rebuildLegend(partsPct, leftoverPct);
  save();
};

ui.prijem.addEventListener("input", update);

ui.btnAdd.addEventListener("click", () => {
  const name = prompt("Název nové kategorie:");
  if (!name) return;
  const id = "cat-" + Date.now();
  const color = palette[categories.length % palette.length];
  const cat = { id, name, value:"", color };
  categories.push(cat);
  createCategoryRow(cat);
  update(); save();
});

ui.btnReset.addEventListener("click", () => {
  if (!confirm("Opravdu chceš vymazat všechny uložené hodnoty?")) return;
  localStorage.removeItem(STORAGE_KEY);
  inputsContainer.querySelectorAll('.row:not(:first-child)').forEach(r => r.remove());
  ui.prijem.value = "";
  categories = [];
  slicesGroup.innerHTML = "";
  legend.innerHTML = "";
  load();
  update();
});

load();
update();
