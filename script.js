const L = [
  ["index", "Inicio"],
  ["causas", "Causas"],
  ["cronologia", "Cronología"],
  ["personajes", "Personajes"],
  ["sucesos", "Sucesos"],
  ["matematicos", "Matemáticos"],
  ["escritores", "Escritores"],
  ["holocausto", "Holocausto"],
  ["memoria", "Museos y homenajes"],
  ["consecuencias", "Consecuencias"],
];


const pagina = (location.pathname.split("/").pop() || "index").replace(
  /\.html$/,
  "",
);

document.body.insertAdjacentHTML(
  "afterbegin",
  '<div id="bar"></div><nav>' +
    L.map(
      (l) =>
        `<a href="${l[0]}.html"${l[0] === pagina ? ' class="on"' : ""}>${l[1]}</a>`,
    ).join("") +
    "</nav>",
);

document.body.insertAdjacentHTML(
  "beforeend",
  "<footer>Proyecto INF. 2 · Márquez Maite 3ro Inf. · Información educativa<br>" +
    "<small>Imágenes: archivos del proyecto y, cuando faltan, Wikipedia / Wikimedia Commons</small></footer>",
);


const slug = (s) => s.toLowerCase().trim().replace(/ /g, "_");

// Comprueba si una imagen carga bien
const probe = (u) =>
  new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok(true);
    i.onerror = () => ok(false);
    i.src = u;
  });


const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();


const coincide = (titulo, consulta) =>
  norm(consulta)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4)
    .every((w) => norm(titulo).includes(w));

async function wiki(lang, params, exige) {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?` +
    new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      prop: "pageimages",
      piprop: "thumbnail",
      ...params,
    });
  try {
    const j = await (await fetch(url)).json();
    const pags = Object.values((j.query && j.query.pages) || {}).sort(
      (a, b) => (a.index || 0) - (b.index || 0),
    );
    const p = pags.find(
      (x) =>
        x.thumbnail && x.thumbnail.source && (!exige || coincide(x.title, exige)),
    );
    return p ? p.thumbnail.source : null;
  } catch (e) {
    return null;
  }
}


async function imagenesArticulo(lang, titulo, ancho) {
  const api = (p) =>
    `https://${lang}.wikipedia.org/w/api.php?` +
    new URLSearchParams({ action: "query", format: "json", origin: "*", ...p });
  const malas =
    /(flag|bandera|commons|wiki|logo|icon|symbol|escudo|coat|map|mapa|blank|ambox|question|padlock|crystal|nuvola|folder|speaker|stub|disambig)/i;
  try {
    const a = await (
      await fetch(
        api({ titles: titulo, redirects: 1, prop: "images", imlimit: 40 }),
      )
    ).json();
    const pag = Object.values((a.query && a.query.pages) || {})[0];
    const arch = ((pag && pag.images) || [])
      .map((i) => i.title)
      .filter((t) => /\.(jpe?g|png)$/i.test(t) && !malas.test(t))
      .slice(0, 6);
    if (!arch.length) return null;
    const b = await (
      await fetch(
        api({
          titles: arch.join("|"),
          prop: "imageinfo",
          iiprop: "url",
          iiurlwidth: ancho,
        }),
      )
    ).json();
    const infos = Object.values((b.query && b.query.pages) || {});
    for (const t of arch) {
      const p = infos.find((x) => x.title === t);
      const u = p && p.imageinfo && p.imageinfo[0] && p.imageinfo[0].thumburl;
      if (u) return u;
    }
  } catch (e) {}
  return null;
}


async function imagenWeb(titulo, ancho) {
  const clave = `wimg3:${ancho}:${titulo}`;
  try {
    const c = localStorage.getItem(clave);
    if (c !== null) return c || null;
  } catch (e) {}
  const t = String(ancho);

  const m = titulo.match(/^(es|en):(.+)$/);
  const idiomas = m ? [m[1]] : ["es", "en"];
  const tema = m ? m[2] : titulo;
  let u = null;
  for (const lang of idiomas) {
    u =
      (await wiki(lang, { titles: tema, redirects: 1, pithumbsize: t })) ||
      (await imagenesArticulo(lang, tema, ancho)) ||
      (m
        ? null
        : await wiki(
            lang,
            {
              generator: "search",
              gsrsearch: tema,
              gsrlimit: 5,
              gsrnamespace: 0,
              pithumbsize: t,
            },
            tema,
          ));
    if (u) break;
  }
  try {
    localStorage.setItem(clave, u || "");
  } catch (e) {}
  return u;
}


async function mejorImagen(nombre, carpeta, ancho, buscar) {
  const base = nombre.replace(/^(es|en):/, "");
  for (const ext of ["jpg", "jpeg", "png"]) {
    const local = `img/${carpeta}/${slug(base)}.${ext}`;
    if (await probe(local)) return local;
  }
  const web = await imagenWeb(buscar || nombre, ancho);
  return web && (await probe(web)) ? web : null;
}


const FONDO = "linear-gradient(180deg,#1a100c88,#1a100ccc)";
document.querySelectorAll("[data-bg]").forEach(async (e) => {
  e.style.backgroundImage = FONDO;
  const u = await mejorImagen(e.dataset.bg, "fondos", 1600);
  if (u) e.style.backgroundImage = `${FONDO}, url("${u}")`;
});


async function cargarFoto(c) {
  const h = c.querySelector("h4");
  const nombre = c.dataset.w || (h && h.textContent.trim());
  if (!nombre) return;

  const u = await mejorImagen(nombre, "tarjetas", 700, c.dataset.img);
  if (!u) return;
  const i = new Image();
  i.className = "foto";
  i.alt = nombre;
  i.src = u;
  c.prepend(i);
  requestAnimationFrame(() => i.classList.add("ok"));
}

const fio = new IntersectionObserver(
  (a) =>
    a.forEach((x) => {
      if (x.isIntersecting) {
        fio.unobserve(x.target);
        cargarFoto(x.target);
      }
    }),
  { rootMargin: "300px" },
);
document.querySelectorAll(".p, .c[data-w]").forEach((e) => fio.observe(e));


document.body.insertAdjacentHTML(
  "beforeend",
  '<div id="lb"><img alt=""><span></span></div>',
);
const lb = document.getElementById("lb");
document.addEventListener("click", (e) => {
  if (e.target.matches(".foto")) {
    lb.querySelector("img").src = e.target.src;
    lb.querySelector("span").textContent = e.target.alt;
    lb.classList.add("on");
  } else if (lb.contains(e.target)) lb.classList.remove("on");
});
addEventListener("keydown", (e) => e.key === "Escape" && lb.classList.remove("on"));


const io = new IntersectionObserver(
  (a) => a.forEach((x) => x.isIntersecting && x.target.classList.add("v")),
  { threshold: 0.1 },
);
document.querySelectorAll(".c,.p").forEach((e) => io.observe(e));


addEventListener("scroll", () => {
  document.querySelectorAll(".px").forEach((e) => {
    const y = -e.getBoundingClientRect().top,
      f = e.firstElementChild;
    if (f) {
      f.style.transform = `translateY(${y * 0.4}px)`;
      f.style.opacity = 1 - Math.min(1, Math.max(0, y / 450));
    }
  });
  const h = document.documentElement;
  document.getElementById("bar").style.width =
    (scrollY / Math.max(1, h.scrollHeight - innerHeight)) * 100 + "%";
});


const q = document.getElementById("q"),
  n = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

if (q)
  q.addEventListener("input", () => {
    document
      .querySelectorAll(".c,.p")
      .forEach((e) =>
        e.classList.toggle("o", !n(e.textContent).includes(n(q.value))),
      );
  
    document.querySelectorAll("main section").forEach((s) => {
      const k = s.querySelectorAll(".c,.p");
      if (k.length)
        s.classList.toggle(
          "o",
          [...k].every((x) => x.classList.contains("o")),
        );
    });
  });

-
const r = document.getElementById("ring");
if (r) {
  let a = 0,
    d = 0,
    x = 0;


  const elementosGaleria = [
    { titulo: "Normandía", archivo: "normandia.jpg" },
    { titulo: "Pearl Harbor", archivo: "pearl_harbor.jpeg" },
    { titulo: "Stalingrado", archivo: "stalingrado.jpeg" },
    { titulo: "Máquina Enigma", archivo: "enigma.jpeg" },
    { titulo: "Hiroshima", archivo: "hiroshima.jpeg" },
    { titulo: "Ana Frank", archivo: "ana_frank.jpg" },
    { titulo: "Alan Turing", archivo: "alan_turing.jpg" },
    { titulo: "Churchill", archivo: "churchill.jpeg" },
  ];

  elementosGaleria.forEach((item, i) => {
    const p = document.createElement("div");
    p.style.transform = `rotateY(${i * 45}deg) translateZ(300px)`;
    p.innerHTML = "<b>" + item.titulo + "</b>";
    
    
    p.style.backgroundImage = `url(galeria3d/${item.archivo})`;
    r.append(p);
  });

  
  r.parentNode.onpointerdown = (e) => {
    d = 1;
    x = e.clientX;
  };
  addEventListener("pointerup", () => (d = 0));
  addEventListener("pointermove", (e) => {
    if (d) {
      a += (e.clientX - x) * 0.5;
      x = e.clientX;
    }
  });

  
  (function f() {
    if (!d) a += 0.25;
    r.style.transform = `rotateY(${a}deg)`;
    requestAnimationFrame(f);
  })();
}
