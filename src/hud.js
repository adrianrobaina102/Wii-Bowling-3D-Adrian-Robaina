export const TOTAL_FRAMES = 5;
const BANNER_DURATION_MS = 1500;

let frames = [];
let currentFrame = 0;

// Reinicia el array de rondas a cero y actualiza el marcador y el diagrama de bolos
export function resetScoreboard(standingPins = []) {
  frames = [];
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    frames.push({ r1: null, r2: null, total: null });
  }
  currentFrame = 0;
  renderScoreboard();
  updatePinDiagram(standingPins);
}

// Marca visualmente en el diagrama superior izquierdo qué bolos siguen en pie y cuáles han caído
export function updatePinDiagram(standingPins) {
  const standingIds = new Set(standingPins.map((pin) => pin.userData.number));

  for (let n = 1; n <= 10; n++) {
    const el = document.getElementById("pin-" + n);
    if (!el) continue;
    el.classList.toggle("knocked", !standingIds.has(n));
  }
}

// Muestra temporalmente el cartel central de STRIKE, SPARE o GUTTER
export function showEventBanner(text, cssClass = "") {
  const banner = document.getElementById("event-banner");
  if (!banner) return;

  banner.textContent = text;
  banner.className = cssClass;
  setTimeout(() => banner.classList.add("hidden"), BANNER_DURATION_MS);
}

// Muestra u oculta el indicador rojo de REPLAY durante la repetición en cámara lenta
export function showReplayBadge(visible) {
  const badge = document.getElementById("replay-badge");
  if (!badge) return;
  badge.classList.toggle("hidden", !visible);
}

// Registra los bolos derribados en el turno actual, dispara el aviso correspondiente y devuelve si fue Strike
export function recordRoll(ballInTurn, knockedCount) {
  const frame = frames[currentFrame];
  if (!frame) return false;

  let isStrike = false;

  if (ballInTurn === 1) {
    frame.r1 = knockedCount;
    if (knockedCount === 10) {
      isStrike = true;
      showEventBanner("STRIKE", "strike");
    } else if (knockedCount === 0) {
      showEventBanner("GUTTER", "gutter");
    }
  } else {
    frame.r2 = knockedCount;
    if (frame.r1 + frame.r2 === 10) {
      showEventBanner("SPARE", "spare");
    } else if (knockedCount === 0) {
      showEventBanner("GUTTER", "gutter");
    }
  }

  recalculateTotals();
  renderScoreboard();
  return isStrike;
}

// Avanza a la siguiente ronda y devuelve false si ya se completaron todas
export function advanceFrame() {
  if (currentFrame < TOTAL_FRAMES - 1) {
    currentFrame++;
    renderScoreboard();
    return true;
  }
  return false;
}

// Calcula la bonificación de los dos lanzamientos siguientes para un Strike
function getStrikeBonus(idx) {
  const next1 = frames[idx + 1];
  const next2 = frames[idx + 2];
  if (!next1 || next1.r1 === null) return null;

  const roll1 = next1.r1;
  // Si el siguiente turno también fue Strike, el segundo lanzamiento de bonus está dos rondas adelante
  const roll2 = next1.r1 === 10 ? (next2 ? next2.r1 : null) : next1.r2;
  if (roll2 === null) return null;

  return roll1 + roll2;
}

// Calcula la bonificación del siguiente lanzamiento para un Spare
function getSpareBonus(idx) {
  const next1 = frames[idx + 1];
  return next1 && next1.r1 !== null ? next1.r1 : null;
}

// Recalcula la puntuación acumulada aplicando las reglas oficiales de Strike y Spare
function recalculateTotals() {
  let runningTotal = 0;

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const f = frames[i];
    if (f.r1 === null) break;

    const isLastFrame = i === TOTAL_FRAMES - 1;

    // Caso 1: Strike en el primer lanzamiento
    if (f.r1 === 10) {
      const bonus = getStrikeBonus(i);
      if (bonus !== null) {
        runningTotal += 10 + bonus;
        f.total = runningTotal;
      } else if (isLastFrame) {
        runningTotal += 10;
        f.total = runningTotal;
      }
      continue;
    }

    if (f.r2 === null) continue;

    // Caso 2: Spare entre ambos lanzamientos o jugada abierta normal
    if (f.r1 + f.r2 === 10) {
      const bonus = getSpareBonus(i);
      if (bonus !== null) {
        runningTotal += 10 + bonus;
        f.total = runningTotal;
      } else if (isLastFrame) {
        runningTotal += 10;
        f.total = runningTotal;
      }
    } else {
      runningTotal += f.r1 + f.r2;
      f.total = runningTotal;
    }
  }
}

// Convierte los valores numéricos de una ronda en los símbolos del marcador (X, /, -)
function formatFrameCells(frame) {
  let textR1 = "";
  let textR2 = "";
  let classR2 = "roll-cell second";

  if (frame.r1 === null) return { textR1, textR2, classR2 };

  if (frame.r1 === 10) {
    return { textR1: "", textR2: "X", classR2: classR2 + " strike" };
  }

  textR1 = frame.r1 === 0 ? "-" : frame.r1;

  if (frame.r2 !== null) {
    if (frame.r1 + frame.r2 === 10) {
      textR2 = "/";
      classR2 += " spare";
    } else {
      textR2 = frame.r2 === 0 ? "-" : frame.r2;
    }
  }

  return { textR1, textR2, classR2 };
}

// Regenera en el DOM las casillas del marcador superior derecho
function renderScoreboard() {
  const container = document.getElementById("frames-container");
  if (!container) return;
  container.innerHTML = "";

  frames.forEach((frame, idx) => {
    const box = document.createElement("div");
    box.className = "frame-box" + (idx === currentFrame ? " active" : "");

    const { textR1, textR2, classR2 } = formatFrameCells(frame);

    box.innerHTML = `
      <div class="frame-header">${idx + 1}</div>
      <div class="frame-rolls">
        <div class="roll-cell">${textR1}</div>
        <div class="${classR2}">${textR2}</div>
      </div>
      <div class="frame-total">${frame.total !== null ? frame.total : ""}</div>
    `;
    container.appendChild(box);
  });
}
