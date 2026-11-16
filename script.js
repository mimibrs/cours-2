// ====== RÉGLAGES (tu peux les modifier !) ======
const DEGATS_JOUEUR = 20;      // coup de poing
const DEGATS_BARRE = 50;       // coup avec la barre en métal
const USAGES_BARRE = 8;        // coups avant que la barre soit tordue
const PV_CRS = 60, PV_BAC = 40;
const DEGATS_CRS = 6, DEGATS_BAC = 5;
const VITESSE_BAC = 2.4;       // la BAC court : plus vite que les CRS
const PAUSE_ENTRE_COUPS = 0.3;
const VITESSE_JOUEUR = 4;      // mètres par seconde
const PORTEE = 3;              // distance max de ton coup (mètres)
const SOIN_SERUM = 35;         // PV rendus par le sérum physiologique
const DEGATS_GAZ = 4;          // PV perdus par seconde dans la fumée
const DEGATS_GRENADE = 8;      // dégâts si la grenade tombe tout près de toi

// ====== MISE EN PLACE ======
const canvas = document.getElementById("jeu");
let ctx = canvas.getContext("2d");
const ctxEcran = ctx;
const L = canvas.width, H = canvas.height;
const FOC = 520, HORIZON = 270, YEUX = 1.6, NEAR = 0.5;
const ecran = document.getElementById("ecran");
const titre = document.getElementById("titre");
const texte = document.getElementById("texte");

let j = { x: 0, z: 0, a: 0, barre: 0, serum: 2 };
let ennemis = [], pvJoueur = 100, vague = 1, score = 0, etat = "menu";
let animCoup = 0, recharge = 0, secousse = 0, attenteVague = 0, temps = 0;
let souris = { x: L / 2, y: H / 2 }, touches = {};
let barreSol = null, attenteBarre = 0, serumsSol = [], message = { txt: "", t: 0 };
let grenades = [], fumees = [], tirGaz = 5, gazNiveau = 0, immun = 0;
let cam = { fx: 0, fz: 1, rx: 1, rz: 0 };
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function alea(i) { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }

// ====== TEXTURES (dessinées une seule fois) ======
function faireMotif(w, h, f) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  f(c.getContext("2d"));
  return ctx.createPattern(c, "repeat");
}
const motifBrique = faireMotif(40, 20, (g) => {
  g.fillStyle = "#a85a40"; g.fillRect(0, 0, 40, 20);
  for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(" + (i % 2 ? "255,200,170" : "60,20,10") + ",0.18)"; g.fillRect(((i * 17) % 36), (i % 2) * 10, 18, 9); }
  g.strokeStyle = "#7d3f2c"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(40, 0); g.moveTo(0, 10); g.lineTo(40, 10);
  g.moveTo(0, 0); g.lineTo(0, 10); g.moveTo(20, 0); g.lineTo(20, 10);
  g.moveTo(10, 10); g.lineTo(10, 20); g.moveTo(30, 10); g.lineTo(30, 20); g.stroke();
});
const motifPierre = faireMotif(60, 30, (g) => {
  g.fillStyle = "#8d8a84"; g.fillRect(0, 0, 60, 30);
  g.strokeStyle = "#5e5c58"; g.lineWidth = 2;
  g.strokeRect(0, 0, 30, 15); g.strokeRect(30, 0, 30, 15); g.strokeRect(-15, 15, 30, 15); g.strokeRect(15, 15, 30, 15); g.strokeRect(45, 15, 30, 15);
});
const motifBois = faireMotif(64, 40, (g) => {
  g.fillStyle = "#8a5a32"; g.fillRect(0, 0, 64, 40);
  g.strokeStyle = "rgba(50,25,8,0.5)"; g.lineWidth = 1;
  for (let y = 4; y < 40; y += 6) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(20, y - 3, 40, y + 3, 64, y); g.stroke(); }
  g.strokeStyle = "rgba(30,12,4,0.7)"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 20); g.lineTo(64, 20); g.stroke();
});

// ====== ÉLÉMENTS DU MONDE (x, z en mètres) ======
const decor = [];
for (let i = -8; i <= 8; i++) if (i !== 0) decor.push({ t: "barricade", x: i * 1.7, z: 6, v: Math.abs(i) % 4 }); // trou au milieu = passage
for (let i = -3; i <= 3; i++) decor.push({ t: "barricade", x: i * 1.7, z: -9, v: (i + 9) % 4 });
[[-7, 5, "ÉDUCATION", "lycée en lutte"], [-2.5, 5, "BLOCUS", "pas de lycée sans élèves"],
 [2.8, 5, "ÉDUCATION", "pour toutes et tous"], [7, 5, "BLOCUS", "on ne lâche rien"],
 [-6, -8, "ÉDUCATION", "lycée en lutte"], [0, -8, "BLOCUS", "ouvert à tous"], [6, -8, "ÉDUCATION", "on ne lâche rien"]]
  .forEach(([x, z, mot, sous]) => decor.push({ t: "pancarte", x, z, mot, sous }));

// au fond : camions de police et ligne de CRS qui ne bougent pas
const camions = [{ x: -10, z: 38 }, { x: 0, z: 39 }, { x: 10, z: 38 }];
camions.forEach((c) => decor.push({ t: "camion", x: c.x, z: c.z }));
for (let i = -7; i <= 7; i++) decor.push({ t: "crsFixe", x: i * 1.8, z: 33 + (i % 2 ? 0.8 : 0), flash: 0, swing: 0, marche: 0, enMarche: false });

// les élèves sont derrière toi : c'est toi qui les défends
const pull = ["#c0392b", "#27ae60", "#8e44ad", "#e67e22", "#16a085", "#7f8c8d", "#2c3e50", "#d4ac0d"];
const eleves = [[-1.8, -2.2], [2.2, -2.8], [-4.2, -3.5], [4.8, -4], [-6.5, -2], [7, -3], [-2.5, -6], [1, -6.2], [5.5, -6.5], [-7.5, -6], [0, -4.5]].map(([x, z], i) => ({
  t: "pnj", id: i, meneur: i === 0, bx: x, bz: z, x, z,
  c: { pull: pull[i % pull.length], jean: i % 2 ? "#2d4a7a" : "#222a33", cheveux: ["#2a1a10", "#caa24a", "#111", "#6b3b1f"][i % 4], peau: ["#e8b48f", "#c68a62", "#8d5a3a"][i % 3] },
  marche: i, enMarche: false, flash: 0, poing: i % 3 === 0, sac: true, brassard: false, capuche: i % 2 === 0,
}));

const obstacles = [
  { x0: -60, x1: 60, z0: -80, z1: -11.4 },       // le lycée est solide
  { x0: -20, x1: -0.85, z0: 5.55, z1: 6.45 },    // barricade de la rue (gauche)
  { x0: 0.85, x1: 20, z0: 5.55, z1: 6.45 },      // barricade de la rue (droite)
  { x0: -6.4, x1: 6.4, z0: -9.45, z1: -8.55 },   // barricade devant l'entrée
];
function libre(x, z, r) {
  if (x < -14 || x > 14 || z > 26) return false;
  return !obstacles.some((o) => x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r);
}
function deplacer(o, dx, dz, r) {
  if (libre(o.x + dx, o.z, r)) o.x += dx;
  if (libre(o.x, o.z + dz, r)) o.z += dz;
}
function bloqueParBarricade(e) {
  if ((e.z - 6) * (j.z - 6) >= 0) return false;
  const xc = e.x + (j.x - e.x) * (6 - e.z) / (j.z - e.z);
  return Math.abs(xc) > 0.85;
}

// détritus et fissures du sol, ville et nuages (positions fixes)
const detritus = [], fissures = [], immeubles = [], nuages = [];
for (let i = 0; i < 60; i++) detritus.push({ x: -15 + alea(i) * 30, z: -11 + alea(i + 99) * 50, c: ["#e9e4d6", "#c9c3b0", "#2a2a2a", "#9a3b2e", "#d6d0bf"][i % 5], w: 0.12 + alea(i + 7) * 0.25 });
for (let i = 0; i < 70; i++) {
  const couche = i % 2;
  immeubles.push({ th: i * (2 * Math.PI / 70) + alea(i) * 0.03, couche, w: couche ? 40 + alea(i + 3) * 50 : 60 + alea(i + 3) * 80,
    h: i % 17 === 0 ? 170 : couche ? 30 + alea(i + 8) * 60 : 55 + alea(i + 8) * 90, clocher: i % 23 === 5, arbre: i % 9 === 4 });
}
for (let i = 0; i < 18; i++) nuages.push({ th: i * 0.35, y: 22 + alea(i + 20) * 150, w: 80 + alea(i + 30) * 150, v: 0.006 + alea(i + 40) * 0.014 });

// ====== FAÇADE DU LYCÉE : dessinée une fois, puis posée comme un vrai mur ======
let imgLycee = null;
function preRendu() {
  const oc = document.createElement("canvas"); oc.width = 3120; oc.height = 1480;
  const g = oc.getContext("2d");
  ctx = g; g.scale(2, 2); g.translate(780, 730);
  dessinerLycee();
  ctx = ctxEcran;
  imgLycee = oc;
}

// ====== DÉMARRAGE ======
function demarrer() {
  j = { x: 0, z: 0, a: 0, barre: 0, serum: 2 };
  pvJoueur = 100; vague = 1; score = 0; ennemis = []; secousse = 0; temps = 0;
  grenades = []; fumees = []; tirGaz = 5; gazNiveau = 0; immun = 0;
  barreSol = null; attenteBarre = 0; serumsSol = []; message = { txt: "", t: 0 };
  poserBarre(); poserSerum(); poserSerum();
  etat = "jeu";
  ecran.classList.add("cache");
  lancerVague();
}

function poserBarre() {
  const lieux = [[-4, 2], [4, 3], [-7, -3], [8, -4], [-9, 4], [0, 3.5]];
  const ok = lieux.filter(([x, z]) => Math.hypot(x - j.x, z - j.z) > 3);
  const [x, z] = ok[Math.floor(Math.random() * ok.length)];
  barreSol = { t: "barre", x, z };
}
function poserSerum() {
  const lieux = [[-3, -4], [4, -5], [-6, 0.5], [6, -1], [0, -6.5], [-8, -4], [8, -5.5]];
  const [x, z] = lieux[Math.floor(Math.random() * lieux.length)];
  serumsSol.push({ t: "serum", x, z });
}

function nouvelEnnemi(type) {
  const bac = type === "bac";
  const cote = Math.random() < 0.5 ? -1 : 1;
  return {
    t: "ennemi", type, pv: bac ? PV_BAC : PV_CRS, pvMax: bac ? PV_BAC : PV_CRS,
    x: bac ? cote * (8 + Math.random() * 5) : -12 + Math.random() * 24,
    z: bac ? 12 + Math.random() * 4 : 23 + Math.random() * 2.5,   // les CRS sortent de la ligne du fond
    attente: 1, flash: 0, swing: 0, marche: Math.random() * 6, decalage: Math.random() * 6, enMarche: true,
    c: { pull: ["#2b2f36", "#4a5240", "#3a2f2f"][Math.floor(Math.random() * 3)], jean: "#2d4a7a", cheveux: "#1a1a1a", peau: "#d9a47e" },
  };
}
function lancerVague() {
  for (let i = 0; i < vague + 1; i++) ennemis.push(nouvelEnnemi("crs"));
  for (let i = 0; i < 1 + Math.floor((vague - 1) / 2); i++) ennemis.push(nouvelEnnemi("bac"));
  if (vague > 1 && serumsSol.length < 3) poserSerum();
}

// ====== GAZ LACRYMOGÈNE ======
function lancerGrenade() {
  const c = camions[Math.floor(Math.random() * camions.length)];
  const ang = Math.random() * 6.28, r = 0.5 + Math.random() * 2;
  grenades.push({ sx: c.x, sz: c.z - 1.5, tx: clamp(j.x + Math.cos(ang) * r, -13, 13), tz: clamp(j.z + Math.sin(ang) * r, -10.5, 25), t: 0, T: 1.9, x: c.x, z: c.z, y: 3.5 });
}
function utiliserSerum() {
  if (etat !== "jeu") return;
  if (j.serum <= 0) { message = { txt: "Plus de sérum ! Cherches-en derrière toi.", t: 2.5 }; return; }
  if (pvJoueur >= 100 && gazNiveau < 0.05) { message = { txt: "Tu n'as pas besoin de sérum.", t: 2 }; return; }
  j.serum--; pvJoueur = Math.min(100, pvJoueur + SOIN_SERUM); immun = 5; gazNiveau = 0;
  message = { txt: "Sérum physiologique : +" + SOIN_SERUM + " PV, yeux rincés !", t: 2.5 };
}

// ====== MISE À JOUR ======
function miseAJour(dt) {
  if (etat !== "jeu") return;
  temps += dt;
  recharge -= dt;
  message.t = Math.max(0, message.t - dt);
  if (animCoup > 0) animCoup = Math.max(0, animCoup - dt / 0.25);
  secousse = Math.max(0, secousse - dt);
  immun = Math.max(0, immun - dt);

  const k = (...n) => n.some((t) => touches[t]);
  const av = (k("z", "w", "arrowup") ? 1 : 0) - (k("s", "arrowdown") ? 1 : 0);
  const la = (k("d") ? 1 : 0) - (k("q", "a") ? 1 : 0);
  let tourne = (k("arrowright") ? 1 : 0) - (k("arrowleft") ? 1 : 0);
  if (souris.x < 90) tourne -= 1;
  if (souris.x > L - 90) tourne += 1;
  j.a += tourne * 1.8 * dt;
  const fx = Math.sin(j.a), fz = Math.cos(j.a), rx = Math.cos(j.a), rz = -Math.sin(j.a);
  deplacer(j, (fx * av + rx * la) * VITESSE_JOUEUR * dt, (fz * av + rz * la) * VITESSE_JOUEUR * dt, 0.4);

  // objets à ramasser
  if (barreSol && Math.hypot(barreSol.x - j.x, barreSol.z - j.z) < 1.2) {
    j.barre = USAGES_BARRE; barreSol = null;
    message = { txt: "Barre en métal ramassée ! Tes coups sont bien plus forts.", t: 3 };
  }
  if (!barreSol && j.barre === 0) { attenteBarre -= dt; if (attenteBarre <= 0) poserBarre(); }
  for (const s of [...serumsSol]) {
    if (Math.hypot(s.x - j.x, s.z - j.z) < 1.2 && j.serum < 5) {
      j.serum++; serumsSol.splice(serumsSol.indexOf(s), 1);
      message = { txt: "Sérum physiologique ramassé (touche E pour l'utiliser).", t: 3 };
    }
  }

  // élèves : ils bougent un peu sur place
  for (const p of eleves) {
    p.x = p.bx + Math.sin(temps * 0.7 + p.id) * 0.5;
    p.z = p.bz + Math.cos(temps * 0.5 + p.id * 2) * 0.3;
    p.enMarche = true; p.marche += dt * 3;
  }

  // grenades lacrymogènes tirées depuis les camions
  tirGaz -= dt;
  if (tirGaz <= 0) { lancerGrenade(); tirGaz = Math.max(3.5, 8 - vague * 0.6) + Math.random() * 2; }
  for (const g of [...grenades]) {
    g.t += dt;
    const u = Math.min(1, g.t / g.T);
    g.x = g.sx + (g.tx - g.sx) * u; g.z = g.sz + (g.tz - g.sz) * u;
    g.y = (1 - u) * 3.5 + 11 * u * (1 - u);
    if (u >= 1) {
      grenades.splice(grenades.indexOf(g), 1);
      fumees.push({ x: g.tx, z: g.tz, age: 0, dur: 9, r: 3, id: Math.random() * 10 });
      if (Math.hypot(j.x - g.tx, j.z - g.tz) < 2 && immun <= 0) { pvJoueur -= DEGATS_GRENADE; secousse = 0.3; }
    }
  }
  let dansGaz = false;
  for (const f of fumees) { f.age += dt; if (Math.hypot(j.x - f.x, j.z - f.z) < f.r && f.age < f.dur - 1) dansGaz = true; }
  fumees = fumees.filter((f) => f.age < f.dur);
  if (dansGaz && immun <= 0) {
    pvJoueur -= DEGATS_GAZ * dt;
    gazNiveau = Math.min(1, gazNiveau + dt * 1.2);
    if (message.t <= 0) message = { txt: "Gaz lacrymogène ! Sors de la fumée ou utilise le sérum (E).", t: 1.5 };
  } else gazNiveau = Math.max(0, gazNiveau - dt * (immun > 0 ? 3 : 0.6));

  // CRS et BAC
  for (const e of ennemis) {
    e.flash = Math.max(0, e.flash - dt);
    e.swing = Math.max(0, e.swing - dt);
    const bac = e.type === "bac";
    const bloque = bloqueParBarricade(e);
    const tx = bloque ? 0 : j.x, tz = bloque ? 6 : j.z;
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz) || 1;
    if (bloque || d > 1.7) {
      const v = bac ? VITESSE_BAC : 0.9 + vague * 0.1;
      deplacer(e, (dx / d) * v * dt + Math.sin(temps * 1.5 + e.decalage) * 0.3 * dt, (dz / d) * v * dt, 0.35);
      e.marche += dt * (bac ? 12 : 8); e.enMarche = true;
    } else {
      e.enMarche = false;
      e.attente -= dt;
      if (e.attente <= 0) {
        pvJoueur -= (bac ? DEGATS_BAC : DEGATS_CRS) + vague;
        secousse = 0.3; e.swing = 0.4;
        e.attente = bac ? 1.1 : 1.6;
      }
    }
  }

  if (pvJoueur <= 0) {
    pvJoueur = 0; etat = "fin";
    titre.textContent = "Tu es à terre !";
    texte.textContent = "Score : " + score + " — Vague atteinte : " + vague;
    document.getElementById("bouton").textContent = "Rejouer";
    ecran.classList.remove("cache");
  }
  if (etat === "jeu" && ennemis.length === 0) {
    attenteVague -= dt;
    if (attenteVague <= 0) { vague++; lancerVague(); }
  }
}

function frapper(x, y) {
  if (etat !== "jeu" || recharge > 0) return;
  recharge = PAUSE_ENTRE_COUPS;
  animCoup = 1;
  const proches = ennemis.filter((e) => e.rect && e.dist < PORTEE && !bloqueParBarricade(e)).sort((a, b) => a.dist - b.dist);
  for (const e of proches) {
    const r = e.rect;
    if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) {
      const avecBarre = j.barre > 0;
      e.pv -= avecBarre ? DEGATS_BARRE : DEGATS_JOUEUR;
      e.flash = 0.12;
      const dx = e.x - j.x, dz = e.z - j.z, d = Math.hypot(dx, dz) || 1, rec = avecBarre ? 1.8 : 1.1;
      deplacer(e, (dx / d) * rec, (dz / d) * rec, 0.35);
      if (avecBarre) {
        j.barre--;
        if (j.barre === 0) { message = { txt: "La barre est tordue... trouves-en une autre.", t: 3 }; attenteBarre = 8; }
      }
      if (e.pv <= 0) {
        ennemis.splice(ennemis.indexOf(e), 1);
        score += e.type === "bac" ? 150 : 100;
        if (ennemis.length === 0) attenteVague = 1.5;
      }
      return;
    }
  }
}

// ====== OUTILS DE PROJECTION ======
function camCoord(x, z) {
  const dx = x - j.x, dz = z - j.z;
  return { d: dx * cam.fx + dz * cam.fz, s: dx * cam.rx + dz * cam.rz };
}
function ecr(p) { const k = FOC / p.d; return [L / 2 + p.s * k, HORIZON + YEUX * k]; }
function polySol(pts, col) {
  const c = pts.map((p) => camCoord(p[0], p[1])), out = [];
  for (let i = 0; i < c.length; i++) {
    const a = c[i], b = c[(i + 1) % c.length], ain = a.d >= NEAR, bin = b.d >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) { const t = (NEAR - a.d) / (b.d - a.d); out.push({ d: NEAR, s: a.s + (b.s - a.s) * t }); }
  }
  if (out.length < 3) return;
  ctx.fillStyle = col; ctx.beginPath();
  out.forEach((p, i) => { const [x, y] = ecr(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.fill();
}
function ligneSol(x1, z1, x2, z2) {
  let a = camCoord(x1, z1), b = camCoord(x2, z2);
  if (a.d < NEAR && b.d < NEAR) return;
  if (a.d < NEAR) { const t = (NEAR - a.d) / (b.d - a.d); a = { d: NEAR, s: a.s + (b.s - a.s) * t }; }
  else if (b.d < NEAR) { const t = (NEAR - b.d) / (a.d - b.d); b = { d: NEAR, s: b.s + (a.s - b.s) * t }; }
  const [ax, ay] = ecr(a), [bx, by] = ecr(b);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
}
function azim(th) { const d = th - j.a; return ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; }

// ====== DESSINS (unités locales : 50 = 1 mètre) ======
function fenetre(x, y) {
  ctx.fillStyle = "#efe9dc"; ctx.fillRect(x - 34, y - 6, 68, 112);
  const g = ctx.createLinearGradient(x - 28, y, x + 28, y + 100);
  g.addColorStop(0, "#8fb3d1"); g.addColorStop(0.5, "#4f7392"); g.addColorStop(1, "#35526b");
  ctx.fillStyle = g; ctx.fillRect(x - 28, y, 56, 100);
  ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.moveTo(x - 28, y + 50); ctx.lineTo(x - 28, y + 20); ctx.lineTo(x + 10, y); ctx.lineTo(x + 28, y); ctx.lineTo(x - 28, y + 60); ctx.fill();
  ctx.fillStyle = "#efe9dc"; ctx.fillRect(x - 2, y, 4, 100); ctx.fillRect(x - 28, y + 45, 56, 4);
  ctx.fillStyle = "#cfc6b2"; ctx.fillRect(x - 40, y + 106, 80, 9);
}

function dessinerLycee() {
  ctx.fillStyle = motifBrique; ctx.fillRect(-750, -480, 1500, 480);
  ctx.fillStyle = motifPierre; ctx.fillRect(-750, -42, 1500, 42);
  ctx.fillStyle = "#d9d2c3"; ctx.fillRect(-770, -504, 1540, 26);
  ctx.fillStyle = "#3b4250"; ctx.beginPath(); ctx.moveTo(-770, -504); ctx.lineTo(-690, -566); ctx.lineTo(690, -566); ctx.lineTo(770, -504); ctx.fill();
  ctx.strokeStyle = "#2a303b"; ctx.lineWidth = 2;
  for (let x = -680; x < 690; x += 28) { ctx.beginPath(); ctx.moveTo(x, -566); ctx.lineTo(x - 10, -506); ctx.stroke(); }
  ctx.fillStyle = "#8a4a38"; ctx.fillRect(-560, -620, 40, 60); ctx.fillRect(500, -620, 40, 60);
  ctx.fillStyle = "#555"; ctx.fillRect(-566, -626, 52, 8); ctx.fillRect(494, -626, 52, 8);
  for (const s of [-1, 1]) {
    for (let n = 0; n < 4; n++) { fenetre(s * (320 + n * 110), -440); fenetre(s * (320 + n * 110), -290); }
    ctx.fillStyle = "#454545"; ctx.fillRect(s * 745 - 4, -480, 8, 480);
  }
  ctx.fillStyle = "#cfc6b2"; ctx.fillRect(-235, -540, 470, 540);
  ctx.strokeStyle = "rgba(90,80,60,0.35)"; ctx.lineWidth = 1;
  for (let y = -510; y < 0; y += 30) { ctx.beginPath(); ctx.moveTo(-235, y); ctx.lineTo(235, y); ctx.stroke(); }
  ctx.fillStyle = "#d9d2c3"; ctx.beginPath(); ctx.moveTo(-255, -540); ctx.lineTo(0, -650); ctx.lineTo(255, -540); ctx.fill();
  ctx.fillStyle = "#bdb5a2"; ctx.beginPath(); ctx.moveTo(-205, -552); ctx.lineTo(0, -634); ctx.lineTo(205, -552); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, -586, 27, 0, 7); ctx.fill();
  ctx.strokeStyle = "#222"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -586, 27, 0, 7); ctx.moveTo(0, -586); ctx.lineTo(0, -606); ctx.moveTo(0, -586); ctx.lineTo(13, -580); ctx.stroke();
  ctx.fillStyle = "#555"; ctx.fillRect(-2, -720, 4, 72);
  ctx.fillStyle = "#1f4fd8"; ctx.fillRect(2, -718, 18, 28); ctx.fillStyle = "#fff"; ctx.fillRect(20, -718, 18, 28); ctx.fillStyle = "#d81f2d"; ctx.fillRect(38, -718, 18, 28);
  fenetre(-130, -450); fenetre(0, -450); fenetre(130, -450);
  for (const x of [-205, -105, 105, 205]) {
    ctx.fillStyle = "#e6dfcf"; ctx.fillRect(x - 14, -500, 28, 460);
    ctx.fillStyle = "#cfc6b2"; ctx.fillRect(x - 19, -508, 38, 12); ctx.fillRect(x - 19, -50, 38, 10);
  }
  ctx.fillStyle = "#1c2a4a"; ctx.fillRect(-135, -268, 270, 56);
  ctx.fillStyle = "#fff"; ctx.font = "bold 34px Arial"; ctx.textAlign = "center"; ctx.fillText("LYCÉE", 0, -232);
  ctx.font = "9px Arial"; ctx.fillText("Liberté · Égalité · Fraternité", 0, -218);
  ctx.fillStyle = "#3a2b24"; ctx.fillRect(-88, -200, 176, 160);
  const v = ctx.createLinearGradient(0, -190, 0, -50); v.addColorStop(0, "#9bbbd6"); v.addColorStop(1, "#4d6d89");
  ctx.fillStyle = v; ctx.fillRect(-80, -192, 72, 142); ctx.fillRect(8, -192, 72, 142);
  ctx.fillStyle = "#d8c38a"; ctx.fillRect(-14, -120, 4, 26); ctx.fillRect(10, -120, 4, 26);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = ["#bdb7a8", "#ada797", "#9d9787"][i]; ctx.fillRect(-150 - i * 15, -14 * (3 - i), 300 + i * 30, 14); }
  ctx.fillStyle = "#fff"; ctx.fillRect(-215, -345, 430, 62);
  ctx.strokeStyle = "#d81f2d"; ctx.lineWidth = 4; ctx.strokeRect(-215, -345, 430, 62);
  ctx.fillStyle = "#d81f2d"; ctx.font = "bold 27px Arial"; ctx.fillText("LYCÉE BLOQUÉ · ÉDUCATION", 0, -304);
  ctx.fillStyle = "#555"; ctx.fillRect(-212, -351, 4, 8); ctx.fillRect(208, -351, 4, 8);
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#f2efe6"; ctx.fillRect(s * 530 - 110, -160, 220, 56);
    ctx.fillStyle = "#222"; ctx.font = "bold 22px Arial"; ctx.fillText(s < 0 ? "ON LÂCHE RIEN" : "LYCÉE EN LUTTE", s * 530, -123);
  }
}

// la façade est un vrai mur dans le monde : elle ne bouge pas quand tu tournes
function dessinerFacade() {
  if (!imgLycee) return;
  const Z = -12.2, X0 = -15.6, LARG = 31.2, HAUT = 14.6, NS = 104;
  for (let i = 0; i < NS; i++) {
    let u0 = i / NS, u1 = (i + 1) / NS;
    let a = camCoord(X0 + u0 * LARG, Z), b = camCoord(X0 + u1 * LARG, Z);
    if (a.d < NEAR && b.d < NEAR) continue;
    if (a.d < NEAR) { const t = (NEAR - a.d) / (b.d - a.d); a = { d: NEAR, s: a.s + (b.s - a.s) * t }; u0 += (u1 - u0) * t; }
    else if (b.d < NEAR) { const t = (NEAR - b.d) / (a.d - b.d); b = { d: NEAR, s: b.s + (a.s - b.s) * t }; u1 -= (u1 - u0) * t; }
    const ka = FOC / a.d, kb = FOC / b.d, x0 = L / 2 + a.s * ka, x1 = L / 2 + b.s * kb;
    if (x1 <= x0 || x1 < 0 || x0 > L) continue;
    const k = (ka + kb) / 2, h = HAUT * k, sol = HORIZON + YEUX * k;
    ctx.drawImage(imgLycee, u0 * 3120, 0, (u1 - u0) * 3120, 1460, x0, sol - h, x1 - x0 + 0.8, h);
  }
}

function poubelle(x, couche) {
  ctx.save(); ctx.translate(x, 0);
  if (couche) { ctx.rotate(-1.45); ctx.translate(14, 0); }
  ctx.fillStyle = "#2f6b3a"; ctx.beginPath(); ctx.moveTo(-15, -44); ctx.lineTo(15, -44); ctx.lineTo(12, 0); ctx.lineTo(-12, 0); ctx.fill();
  ctx.strokeStyle = "#1f4a28"; ctx.lineWidth = 2;
  for (const dx of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(dx, -42); ctx.lineTo(dx * 0.8, -2); ctx.stroke(); }
  ctx.fillStyle = "#1f4a28"; ctx.fillRect(-17, -50, 34, 8);
  ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(-9, 0, 4, 0, 7); ctx.arc(9, 0, 4, 0, 7); ctx.fill();
  ctx.restore();
}
function sacs(x) {
  ctx.fillStyle = "#15151a"; ctx.beginPath(); ctx.ellipse(x, -9, 14, 10, 0, 0, 7); ctx.ellipse(x + 15, -6, 10, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.beginPath(); ctx.ellipse(x - 4, -13, 5, 3, 0, 0, 7); ctx.fill();
}
function dessinerBarricade(v) {
  ctx.strokeStyle = "#cfd3d8"; ctx.fillStyle = "#cfd3d8"; ctx.lineWidth = 3;
  ctx.strokeRect(-42, -52, 84, 38);
  for (let x = -32; x <= 32; x += 10) { ctx.beginPath(); ctx.moveTo(x, -52); ctx.lineTo(x, -14); ctx.stroke(); }
  ctx.fillRect(-44, -14, 14, 14); ctx.fillRect(30, -14, 14, 14);
  if (v === 0) { poubelle(-20, false); sacs(26); }
  else if (v === 1) { poubelle(22, false); poubelle(-26, true); }
  else if (v === 2) { poubelle(-18, false); poubelle(14, false); sacs(34); }
  else { poubelle(8, true); sacs(-22); poubelle(30, false); }
}
function dessinerPancarte(o) {
  ctx.fillStyle = "#5a3a1e"; ctx.fillRect(-40, -96, 6, 96); ctx.fillRect(34, -96, 6, 96);
  ctx.fillStyle = motifBois; ctx.fillRect(-52, -104, 104, 56);
  ctx.strokeStyle = "#4a2c12"; ctx.lineWidth = 3; ctx.strokeRect(-52, -104, 104, 56);
  ctx.fillStyle = "#7a1010"; ctx.textAlign = "center";
  ctx.font = "bold 9px Arial"; ctx.fillText(o.mot, 0, -79);
  ctx.font = "5.5px Arial"; ctx.fillText(o.sous, 0, -66);
}

function dessinerBarreSol() {
  ctx.strokeStyle = "rgba(255,220,0,0.75)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, -6, 52 + Math.sin(temps * 4) * 4, 13, 0, 0, 7); ctx.stroke();
  ctx.save(); ctx.rotate(-0.12);
  ctx.fillStyle = "#555"; ctx.fillRect(-46, -12, 92, 8);
  ctx.fillStyle = "#cfd5da"; ctx.fillRect(-46, -12, 92, 3);
  ctx.restore();
  ctx.fillStyle = "#ffd400"; const b = Math.sin(temps * 5) * 5;
  ctx.beginPath(); ctx.moveTo(-9, -70 + b); ctx.lineTo(9, -70 + b); ctx.lineTo(0, -56 + b); ctx.fill();
}
function dessinerSerumSol() {
  ctx.strokeStyle = "rgba(80,200,255,0.8)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, -4, 34 + Math.sin(temps * 4) * 3, 9, 0, 0, 7); ctx.stroke();
  ctx.fillStyle = "#f4f8fb"; ctx.fillRect(-7, -30, 14, 26);
  ctx.fillStyle = "#2a8fd6"; ctx.fillRect(-5, -37, 10, 7); ctx.fillRect(-7, -22, 14, 10);
  ctx.fillStyle = "#fff"; ctx.fillRect(-1, -21, 2, 8); ctx.fillRect(-4, -18, 8, 2);
  ctx.fillStyle = "#4fc3ff"; const b = Math.sin(temps * 5) * 5;
  ctx.beginPath(); ctx.moveTo(-9, -80 + b); ctx.lineTo(9, -80 + b); ctx.lineTo(0, -66 + b); ctx.fill();
}

function dessinerCivil(o) {
  const f = o.flash > 0, c = o.c;
  ctx.translate(0, o.enMarche ? -Math.abs(Math.sin(o.marche)) * 7 : 0);
  ctx.fillStyle = f ? "#fff" : c.jean; ctx.fillRect(-28, -92, 25, 92); ctx.fillRect(3, -92, 25, 92);
  ctx.fillStyle = "#f2f2f2"; ctx.fillRect(-32, -10, 30, 10); ctx.fillRect(2, -10, 30, 10);
  if (o.sac) { ctx.fillStyle = "#24282e"; ctx.fillRect(-50, -178, 26, 78); }
  ctx.fillStyle = f ? "#fff" : c.pull; ctx.fillRect(-40, -185, 80, 98); ctx.fillRect(-58, -180, 18, 80);
  if (o.poing) { ctx.fillRect(40, -250, 18, 72); ctx.fillStyle = c.peau; ctx.beginPath(); ctx.arc(49, -254, 11, 0, 7); ctx.fill(); }
  else ctx.fillRect(40, -180, 18, 80);
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(-24, -125, 48, 22);
  if (o.brassard) { ctx.fillStyle = "#ff8a00"; ctx.fillRect(-58, -152, 18, 24); ctx.fillStyle = "#111"; ctx.fillRect(-58, -143, 18, 4); }
  ctx.fillStyle = c.peau; ctx.beginPath(); ctx.arc(0, -210, 24, 0, 7); ctx.fill();
  ctx.fillStyle = o.capuche ? c.pull : c.cheveux;
  ctx.beginPath(); ctx.arc(0, -214, o.capuche ? 28 : 25, Math.PI, 0); ctx.fill();
  ctx.fillRect(o.capuche ? -28 : -25, -214, o.capuche ? 8 : 6, 20); ctx.fillRect(o.capuche ? 20 : 19, -214, o.capuche ? 8 : 6, 20);
  ctx.fillStyle = "#222"; ctx.fillRect(-11, -208, 5, 5); ctx.fillRect(6, -208, 5, 5);
  if (o.pvMax) barreDeVie(o, -258);
}
function barreDeVie(e, y) {
  ctx.fillStyle = "#000"; ctx.fillRect(-47, y - 2, 94, 14);
  ctx.fillStyle = "#8b0000"; ctx.fillRect(-45, y, 90, 10);
  ctx.fillStyle = "#35d44a"; ctx.fillRect(-45, y, 90 * Math.max(0, e.pv) / e.pvMax, 10);
}
function dessinerCRS(e) {
  const c = e.flash > 0;
  ctx.translate(0, e.enMarche ? -Math.abs(Math.sin(e.marche)) * 8 : 0);
  ctx.fillStyle = c ? "#fff" : "#0b1a3a"; ctx.fillRect(-32, -95, 27, 95); ctx.fillRect(5, -95, 27, 95);
  ctx.fillStyle = "#000"; ctx.fillRect(-36, -12, 33, 12); ctx.fillRect(3, -12, 33, 12);
  ctx.fillStyle = c ? "#fff" : "#1a3fb0"; ctx.fillRect(-64, -190, 20, 85); ctx.fillRect(44, -190, 20, 85);
  ctx.fillStyle = c ? "#fff" : "#1f4fd8"; ctx.fillRect(-46, -195, 92, 105);
  ctx.fillStyle = "#fff"; ctx.fillRect(-32, -175, 64, 38);
  ctx.fillStyle = "#d81f2d"; ctx.fillRect(-32, -175, 64, 5);
  ctx.fillStyle = "#0b1a3a"; ctx.font = "bold 24px Arial"; ctx.textAlign = "center"; ctx.fillText("CRS", 0, -146);
  ctx.fillStyle = "rgba(170,210,255,0.35)"; ctx.fillRect(-110, -200, 58, 130);
  ctx.strokeStyle = "#dfefff"; ctx.lineWidth = 3; ctx.strokeRect(-110, -200, 58, 130);
  ctx.fillStyle = "#fff"; ctx.font = "bold 14px Arial"; ctx.fillText("CRS", -81, -135);
  ctx.fillStyle = "#e8b48f"; ctx.beginPath(); ctx.arc(0, -222, 26, 0, 7); ctx.fill();
  ctx.fillStyle = c ? "#fff" : "#0b1a3a"; ctx.beginPath(); ctx.arc(0, -226, 29, Math.PI, 0); ctx.fill(); ctx.fillRect(-29, -226, 58, 8);
  ctx.fillStyle = "rgba(120,190,255,0.55)"; ctx.fillRect(-24, -218, 48, 18);
  ctx.save(); ctx.translate(54, -108);
  ctx.rotate(e.swing > 0 ? -2.2 + (1 - e.swing / 0.4) * 3 : 0.3 + Math.sin(e.marche) * 0.1);
  ctx.fillStyle = "#111"; ctx.fillRect(-5, -8, 10, 110);
  ctx.fillStyle = "#ddd"; ctx.fillRect(-5, 70, 10, 6);
  ctx.fillStyle = "#e8b48f"; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
  ctx.restore();
  if (e.pvMax) barreDeVie(e, -276);
}

function dessinerCamion() { // gros camion de police vu de face
  const alt = Math.floor(temps * 4) % 2 === 0;
  ctx.fillStyle = "#1d3f8f"; ctx.fillRect(-92, -215, 184, 200);
  ctx.fillStyle = "#e9edf5"; ctx.fillRect(-92, -215, 184, 22);
  ctx.fillStyle = "#14295f"; ctx.fillRect(-80, -200, 160, 8);
  ctx.fillStyle = alt ? "#2a6bff" : "#5a7bd0"; ctx.fillRect(-70, -240, 50, 22);
  ctx.fillStyle = alt ? "#8a2a2a" : "#ff2a2a"; ctx.fillRect(20, -240, 50, 22);
  ctx.fillStyle = alt ? "rgba(60,120,255,0.35)" : "rgba(255,50,50,0.35)"; ctx.beginPath(); ctx.arc(alt ? -45 : 45, -229, 46, 0, 7); ctx.fill();
  const v = ctx.createLinearGradient(0, -185, 0, -110); v.addColorStop(0, "#8fb0c8"); v.addColorStop(1, "#2c4458");
  ctx.fillStyle = v; ctx.fillRect(-78, -185, 156, 72);
  ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.moveTo(-78, -150); ctx.lineTo(-30, -185); ctx.lineTo(0, -185); ctx.lineTo(-78, -125); ctx.fill();
  ctx.fillStyle = "#1a3680"; ctx.fillRect(-92, -108, 184, 82);
  ctx.fillStyle = "#fff"; ctx.fillRect(-92, -108, 184, 20);
  ctx.fillStyle = "#14295f"; ctx.font = "bold 15px Arial"; ctx.textAlign = "center"; ctx.fillText("POLICE NATIONALE", 0, -93);
  ctx.fillStyle = "#1a1a1a"; ctx.fillRect(-48, -82, 96, 34);
  ctx.strokeStyle = "#555"; ctx.lineWidth = 2;
  for (let y = -76; y < -50; y += 7) { ctx.beginPath(); ctx.moveTo(-48, y); ctx.lineTo(48, y); ctx.stroke(); }
  ctx.fillStyle = "#fff4b0"; ctx.beginPath(); ctx.arc(-70, -62, 11, 0, 7); ctx.arc(70, -62, 11, 0, 7); ctx.fill();
  ctx.fillStyle = "#777"; ctx.fillRect(-96, -26, 192, 16);
  ctx.fillStyle = "#111"; ctx.fillRect(-84, -22, 34, 22); ctx.fillRect(50, -22, 34, 22);
}

function dessinerGrenade() {
  ctx.fillStyle = "#2b2f33"; ctx.fillRect(-8, -26, 16, 26);
  ctx.fillStyle = "#e8e8e0"; ctx.fillRect(-8, -18, 16, 5);
  ctx.fillStyle = "rgba(230,230,220,0.6)"; ctx.beginPath(); ctx.arc(0, 8, 9, 0, 7); ctx.arc(2, 22, 6, 0, 7); ctx.fill();
}
function dessinerCible(o) {
  ctx.strokeStyle = "rgba(255,60,40," + (0.5 + 0.4 * Math.sin(temps * 12)) + ")"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, 0, 100, 26, 0, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, 50, 13, 0, 0, 7); ctx.stroke();
}
function dessinerFumee(o) {
  const R = o.r * 50, g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, "rgba(236,236,228," + o.a + ")"); g.addColorStop(1, "rgba(236,236,228,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
}

// ====== SCÈNE ======
function dessinerCiel() {
  const ciel = ctx.createLinearGradient(0, 0, 0, HORIZON);
  ciel.addColorStop(0, "#5f9ad4"); ciel.addColorStop(1, "#dcecf7");
  ctx.fillStyle = ciel; ctx.fillRect(0, 0, L, HORIZON);
  for (const n of nuages) {
    const d = azim(n.th + temps * n.v); if (Math.abs(d) > 1.5) continue;
    const x = L / 2 + d * FOC;
    ctx.fillStyle = "rgba(190,205,225,0.5)"; ctx.beginPath(); ctx.ellipse(x, n.y + 7, n.w / 2, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.ellipse(x, n.y, n.w / 2, 16, 0, 0, 7); ctx.ellipse(x - n.w / 4, n.y - 9, n.w / 4, 15, 0, 0, 7);
    ctx.ellipse(x + n.w / 5, n.y - 11, n.w / 3.5, 17, 0, 0, 7); ctx.ellipse(x + n.w / 2.6, n.y - 2, n.w / 6, 11, 0, 0, 7); ctx.fill();
  }
  for (let couche = 0; couche < 2; couche++) {
    for (const b of immeubles) {
      if (b.couche !== couche) continue;
      const d = azim(b.th); if (Math.abs(d) > 1.5) continue;
      const x = L / 2 + d * FOC;
      if (b.arbre && couche) {
        ctx.fillStyle = "#5b3d22"; ctx.fillRect(x - 3, HORIZON - 30, 6, 30);
        ctx.fillStyle = "#4f7a45"; ctx.beginPath(); ctx.arc(x, HORIZON - 45, 26, 0, 7); ctx.fill();
        continue;
      }
      ctx.fillStyle = couche ? "#8498ae" : "#aebfd0"; ctx.fillRect(x - b.w / 2, HORIZON - b.h, b.w, b.h);
      if (b.clocher) { ctx.beginPath(); ctx.moveTo(x - 10, HORIZON - b.h); ctx.lineTo(x, HORIZON - b.h - 40); ctx.lineTo(x + 10, HORIZON - b.h); ctx.fill(); }
      ctx.fillStyle = couche ? "rgba(255,240,180,0.55)" : "rgba(255,255,255,0.3)";
      for (let wy = HORIZON - b.h + 8; wy < HORIZON - 8; wy += 14) for (let wx = x - b.w / 2 + 6; wx < x + b.w / 2 - 8; wx += 12) if (alea(wx * 3 + wy) > 0.35) ctx.fillRect(wx, wy, 5, 7);
    }
  }
}

function dessinerSol() {
  const sol = ctx.createLinearGradient(0, HORIZON, 0, H);
  sol.addColorStop(0, "#8a8d90"); sol.addColorStop(1, "#4a4d50");
  ctx.fillStyle = sol; ctx.fillRect(0, HORIZON, L, H - HORIZON);
  const T = 3; // grosses dalles de béton de 3 m
  for (let ix = -8; ix < 8; ix++) for (let iz = -5; iz < 15; iz++) {
    const x = ix * T, z = iz * T, p = camCoord(x + 1.5, z + 1.5);
    if (p.d < -3 || p.d > 70) continue;
    const n = ix * 31 + iz * 17, v = 112 + Math.floor(alea(n) * 30);
    polySol([[x, z], [x + T, z], [x + T, z + T], [x, z + T]], "rgb(" + v + "," + v + "," + (v + 3) + ")");
    if (alea(n + 1) > 0.4) polySol([[x + 0.3 + alea(n + 2), z + 0.4], [x + 1.8 + alea(n + 3), z + 0.5 + alea(n + 4)], [x + 1.5, z + 2.2 + alea(n + 5) * 0.5], [x + 0.4, z + 1.8]], "rgba(40,40,45,0.15)");
    if (alea(n + 6) > 0.6) polySol([[x + 1.5, z + 1.5], [x + 2.7, z + 1.7], [x + 2.5, z + 2.7], [x + 1.4, z + 2.4]], "rgba(255,255,255,0.08)");
    if (alea(n + 7) > 0.65) polySol([[x + 0.2, z + 2.1], [x + 0.9, z + 2.2], [x + 0.8, z + 2.8], [x + 0.2, z + 2.7]], "rgba(25,25,28,0.3)");
  }
  ctx.strokeStyle = "rgba(30,30,34,0.85)"; ctx.lineWidth = 3;      // joints entre les dalles
  for (let x = -24; x <= 24; x += T) ligneSol(x, -15, x, 45);
  for (let z = -15; z <= 45; z += T) ligneSol(-24, z, 24, z);
  ctx.strokeStyle = "rgba(15,15,18,0.55)"; ctx.lineWidth = 1.5;     // fissures
  for (let ix = -8; ix < 8; ix++) for (let iz = -5; iz < 15; iz++) {
    const n = ix * 31 + iz * 17;
    if (alea(n + 9) > 0.55) {
      const x = ix * T + alea(n + 10) * 2, z = iz * T + alea(n + 11) * 2, mx = x + 0.7 * (alea(n + 12) - 0.3), mz = z + 0.6;
      ligneSol(x, z, mx, mz); ligneSol(mx, mz, mx + 0.5, mz + 0.8);
    }
  }
  for (const d of detritus) polySol([[d.x, d.z], [d.x + d.w, d.z], [d.x + d.w, d.z + d.w * 0.7], [d.x, d.z + d.w * 0.7]], d.c);
}

function dessinerScene() {
  cam = { fx: Math.sin(j.a), fz: Math.cos(j.a), rx: Math.cos(j.a), rz: -Math.sin(j.a) };
  dessinerCiel();
  dessinerSol();
  dessinerFacade();
  const liste = [...decor, ...eleves, ...ennemis, ...serumsSol];
  if (barreSol) liste.push(barreSol);
  for (const g of grenades) { liste.push({ t: "grenade", x: g.x, z: g.z, y: g.y }); liste.push({ t: "cible", x: g.tx, z: g.tz }); }
  for (const f of fumees) {
    const a = Math.min(1, f.age) * Math.min(1, (f.dur - f.age) / 2.5);
    for (let n = 0; n < 14; n++) {
      const ang = n * 0.9 + f.id + f.age * 0.15, rad = f.r * 0.65 * (((n * 5) % 7) / 7 + 0.15);
      liste.push({ t: "fumee", x: f.x + Math.cos(ang) * rad, z: f.z + Math.sin(ang) * rad, y: 0.3 + ((n * 3) % 5) * 0.28 + f.age * 0.12, r: 0.9 + (n % 4) * 0.25 + f.age * 0.05, a: a * 0.5 });
    }
  }
  for (const o of liste) { const p = camCoord(o.x, o.z); o.depth = p.d; o.side = p.s; }
  let bulleMeneur = null;
  liste.filter((o) => o.depth > 0.5).sort((a, b) => b.depth - a.depth).forEach((o) => {
    const k = FOC / o.depth, sx = L / 2 + o.side * k, sy = HORIZON + (YEUX - (o.y || 0)) * k;
    ctx.save(); ctx.translate(sx, sy);
    if (o.t === "ennemi") {
      const s = k * 1.8 / 260; ctx.scale(s, s);
      if (o.type === "crs") dessinerCRS(o);
      else { o.sac = false; o.brassard = true; o.capuche = true; dessinerCivil(o); }
      o.dist = o.depth;
      o.rect = { x0: sx - 55 * s, x1: sx + 55 * s, y0: sy - 270 * s, y1: sy };
    } else if (o.t === "crsFixe") {
      const s = k * 1.8 / 260; ctx.scale(s, s); dessinerCRS(o);
    } else if (o.t === "pnj") {
      const s = k * 1.7 / 245; ctx.scale(s, s);
      dessinerCivil(o);
      if (o.meneur) bulleMeneur = [sx, sy - 1.85 * k];
    } else {
      ctx.scale(k / 50, k / 50);
      if (o.t === "barricade") dessinerBarricade(o.v);
      else if (o.t === "pancarte") dessinerPancarte(o);
      else if (o.t === "camion") dessinerCamion();
      else if (o.t === "grenade") dessinerGrenade();
      else if (o.t === "cible") dessinerCible(o);
      else if (o.t === "fumee") dessinerFumee(o);
      else if (o.t === "serum") dessinerSerumSol();
      else dessinerBarreSol();
    }
    ctx.restore();
  });
  if (bulleMeneur && temps < 7) bulle(bulleMeneur[0], bulleMeneur[1], ["Courage camarade,", "défendons notre lycée !"]);
}

function bulle(x, y, lignes) {
  ctx.font = "bold 14px Arial";
  const w = Math.max(...lignes.map((t) => ctx.measureText(t).width)) + 22, h = lignes.length * 18 + 12;
  const bx = clamp(x - w / 2, 6, L - w - 6), by = clamp(y - h - 14, 6, H), tx = clamp(x, bx + 14, bx + w - 14);
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(bx, by, w, h, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tx - 8, by + h); ctx.lineTo(tx, by + h + 12); ctx.lineTo(tx + 8, by + h); ctx.fill();
  ctx.fillStyle = "#111"; ctx.textAlign = "center";
  lignes.forEach((t, i) => ctx.fillText(t, bx + w / 2, by + 22 + i * 18));
}

function dessinerArme() {
  const p = Math.sin(animCoup * Math.PI);
  ctx.save();
  if (j.barre > 0) {
    ctx.translate(L - 190 - p * 160, H - 30 - p * 190);
    ctx.rotate(-0.35 - p * 0.9);
    const g = ctx.createLinearGradient(-15, 0, 15, 0); g.addColorStop(0, "#5f656a"); g.addColorStop(0.45, "#dfe4e8"); g.addColorStop(1, "#555a5f");
    ctx.fillStyle = g; ctx.fillRect(-15, -400, 30, 440);
    ctx.fillStyle = "#2b2b2b"; ctx.fillRect(-15, -400, 30, 10); ctx.fillRect(-15, -250, 30, 5);
    ctx.fillStyle = "#2a2a2a"; ctx.fillRect(-32, 40, 64, 160);
    ctx.fillStyle = "#e8b48f"; ctx.beginPath(); ctx.roundRect(-36, -34, 72, 80, 22); ctx.fill();
  } else {
    ctx.translate(L - 230 - p * 150, H - 120 - p * 190);
    ctx.scale(1 - p * 0.35, 1 - p * 0.35);
    ctx.fillStyle = "#2a2a2a"; ctx.fillRect(10, 30, 130, 160);
    ctx.fillStyle = "#e8b48f"; ctx.beginPath(); ctx.roundRect(0, -30, 150, 85, 25); ctx.fill();
    ctx.strokeStyle = "#b98660"; ctx.lineWidth = 3;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(i * 37, -28); ctx.lineTo(i * 37, 20); ctx.stroke(); }
  }
  ctx.restore();
}

// ====== INTERFACE + MINI-CARTE ======
function dessinerMiniCarte() {
  const X = 20, Y = H - 170, T = 150;
  const mx = (x) => X + (x + 15) / 30 * T, mz = (z) => Y + T - (z + 16) / 58 * T;
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(X, Y, T, T);
  ctx.fillStyle = "#b5654a"; ctx.fillRect(X, mz(-12.2), T, Y + T - mz(-12.2));
  ctx.strokeStyle = "#cfd3d8"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(mx(-14), mz(6)); ctx.lineTo(mx(-0.85), mz(6)); ctx.moveTo(mx(0.85), mz(6)); ctx.lineTo(mx(14), mz(6));
  ctx.moveTo(mx(-6), mz(-9)); ctx.lineTo(mx(6), mz(-9)); ctx.stroke();
  ctx.fillStyle = "#4a6fd0"; for (const c of camions) ctx.fillRect(mx(c.x) - 6, mz(c.z) - 3, 12, 6);
  ctx.fillStyle = "#8fd0ff"; for (const p of eleves) { ctx.beginPath(); ctx.arc(mx(p.x), mz(p.z), 2.5, 0, 7); ctx.fill(); }
  for (const e of ennemis) { ctx.fillStyle = e.type === "bac" ? "#ff9a1a" : "#ff3b3b"; ctx.beginPath(); ctx.arc(mx(e.x), mz(e.z), 4, 0, 7); ctx.fill(); }
  ctx.fillStyle = "rgba(230,230,220,0.6)"; for (const f of fumees) { ctx.beginPath(); ctx.arc(mx(f.x), mz(f.z), f.r / 30 * T, 0, 7); ctx.fill(); }
  if (barreSol) { ctx.fillStyle = "#ffd400"; ctx.fillRect(mx(barreSol.x) - 3, mz(barreSol.z) - 3, 6, 6); }
  ctx.fillStyle = "#4fc3ff"; for (const s of serumsSol) ctx.fillRect(mx(s.x) - 2, mz(s.z) - 2, 4, 4);
  ctx.save(); ctx.translate(mx(j.x), mz(j.z)); ctx.rotate(j.a);
  ctx.fillStyle = "#4da3ff"; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#fff"; ctx.font = "bold 12px Arial"; ctx.textAlign = "left"; ctx.fillText("N", X + T / 2 - 4, Y + 12);
}

function dessinerInterface() {
  ctx.fillStyle = "#000"; ctx.fillRect(18, 18, 264, 28);
  ctx.fillStyle = "#8b0000"; ctx.fillRect(22, 22, 256, 20);
  ctx.fillStyle = pvJoueur > 30 ? "#35d44a" : "#ff8c1a"; ctx.fillRect(22, 22, 256 * pvJoueur / 100, 20);
  ctx.fillStyle = "#fff"; ctx.font = "bold 14px Arial"; ctx.textAlign = "left";
  ctx.fillText("TOI : " + Math.ceil(pvJoueur) + " PV", 28, 37);
  ctx.strokeStyle = "#000"; ctx.lineWidth = 4; ctx.font = "bold 16px Arial";
  const sr = "Sérum [E] : " + j.serum + (immun > 0 ? "  (yeux rincés)" : "");
  ctx.fillStyle = "#4fc3ff"; ctx.strokeText(sr, 20, 68); ctx.fillText(sr, 20, 68);
  if (j.barre > 0) { const t = "Barre en métal : " + j.barre + " coups"; ctx.fillStyle = "#ffd400"; ctx.strokeText(t, 20, 90); ctx.fillText(t, 20, 90); }

  ctx.textAlign = "right"; ctx.font = "bold 20px Arial"; ctx.fillStyle = "#fff";
  const info = "Vague " + vague + "   Score " + score;
  ctx.strokeText(info, L - 20, 38); ctx.fillText(info, L - 20, 38);

  ctx.textAlign = "center";
  if (message.t > 0) { ctx.font = "bold 20px Arial"; ctx.fillStyle = "#ffd400"; ctx.strokeText(message.txt, L / 2, 90); ctx.fillText(message.txt, L / 2, 90); }
  if (etat === "jeu" && ennemis.length === 0) { ctx.font = "bold 40px Arial"; ctx.fillStyle = "#fff"; ctx.strokeText("Vague suivante...", L / 2, 200); ctx.fillText("Vague suivante...", L / 2, 200); }
  if (etat === "jeu" && temps < 7) {
    const t = "Un camarade derrière toi : « Courage camarade, défendons notre lycée ! »";
    ctx.font = "bold 18px Arial"; ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(L / 2 - 340, H - 52, 680, 34);
    ctx.fillStyle = "#fff"; ctx.fillText(t, L / 2, H - 29);
  }
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(souris.x, souris.y, 12, 0, 7);
  ctx.moveTo(souris.x - 18, souris.y); ctx.lineTo(souris.x - 6, souris.y);
  ctx.moveTo(souris.x + 6, souris.y); ctx.lineTo(souris.x + 18, souris.y); ctx.stroke();
  dessinerMiniCarte();
}

function dessiner() {
  ctx.save();
  if (secousse > 0) ctx.translate((Math.random() - 0.5) * 14 * secousse, (Math.random() - 0.5) * 14 * secousse);
  dessinerScene();
  dessinerArme();
  ctx.restore();
  if (gazNiveau > 0) { ctx.fillStyle = "rgba(225,225,215," + gazNiveau * 0.6 + ")"; ctx.fillRect(0, 0, L, H); }
  if (secousse > 0) { ctx.fillStyle = "rgba(255,0,0," + secousse * 0.5 + ")"; ctx.fillRect(0, 0, L, H); }
  dessinerInterface();
}

// ====== BOUCLE ET COMMANDES ======
let dernier = performance.now();
function boucle(t) {
  const dt = Math.min(0.05, (t - dernier) / 1000);
  dernier = t;
  miseAJour(dt);
  dessiner();
  requestAnimationFrame(boucle);
}
function positionSouris(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: (ev.clientX - r.left) * (L / r.width), y: (ev.clientY - r.top) * (H / r.height) };
}
canvas.addEventListener("mousemove", (ev) => { souris = positionSouris(ev); });
canvas.addEventListener("mousedown", (ev) => { souris = positionSouris(ev); frapper(souris.x, souris.y); });
window.addEventListener("keydown", (ev) => {
  const t = ev.key.toLowerCase();
  touches[t] = true;
  if (ev.key === " " || ev.key.startsWith("Arrow")) ev.preventDefault();
  if (ev.key === " ") frapper(souris.x, souris.y);
  if (t === "e" && !ev.repeat) utiliserSerum();
});
window.addEventListener("keyup", (ev) => { touches[ev.key.toLowerCase()] = false; });
document.getElementById("bouton").addEventListener("click", demarrer);

preRendu();
requestAnimationFrame(boucle);