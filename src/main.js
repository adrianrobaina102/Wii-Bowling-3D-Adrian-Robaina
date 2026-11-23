import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import Ammo from "ammojs-typed";

import {
  initPhysics,
  createBallWithPhysics,
  removePhysicsBody,
  stepPhysics,
} from "./physics.js";
import {
  initCamera,
  getCamera,
  onCameraResize,
  animateShotCamera,
  resetCamera,
  setReplayCamera,
} from "./camera.js";
import {
  createArena,
  getPins,
  classifyPins,
  animateSweeperBar,
} from "./arena.js";
import {
  resetScoreboard,
  updatePinDiagram,
  recordRoll,
  advanceFrame,
  showReplayBadge,
} from "./hud.js";

// Parámetros de lanzamiento de la bola y detección de fin de recorrido
const BALL_RADIUS = 0.32;
const BALL_MASS = 25;
const BALL_START_Z = 9.5;
const BALL_SPEED_Z = -22;
const TUNNEL_TRIGGER_Z = -11.2;

// Tiempos de espera y configuración de velocidad del Replay en cámara lenta
const TURN_END_DELAY_MS = 1500;
const REPLAY_SPEED = 0.45;
const MIN_REPLAY_FRAMES = 10;

let scene, renderer;
const clock = new THREE.Clock();
const mouseCoords = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

let activeBall = null;
let ballInTurn = 1;
let standingPinsBeforeShot = 10;
let canThrow = true;
let shotFinished = false;

// Estado del sistema de repetición por instantáneas (snapshots) para no re-simular Ammo.js
let isRecordingReplay = false;
let isPlayingReplay = false;
let replayFrames = [];
let replayIndex = 0;

Ammo(Ammo).then(start);

// Punto de entrada principal tras cargar el módulo WebAssembly de Ammo.js
function start(ammoInstance) {
  initGraphics();
  initPhysics(ammoInstance);
  createArena(scene);
  resetScoreboard(getPins());
  initInput();
  animationLoop();
}

// Configura la escena, el renderizador WebGL con sombras y la iluminación del salón
function initGraphics() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdcb48a);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  initCamera(renderer.domElement);

  // Luz ambiental cálida y luz direccional superior con proyección de sombras
  scene.add(new THREE.AmbientLight(0xfff5e6, 0.85));

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.position.set(6, 14, 10);
  dirLight.castShadow = true;
  dirLight.shadow.camera.left = -14;
  dirLight.shadow.camera.right = 14;
  dirLight.shadow.camera.top = 14;
  dirLight.shadow.camera.bottom = -14;
  dirLight.shadow.mapSize.set(1024, 1024);
  scene.add(dirLight);

  window.addEventListener("resize", () => {
    onCameraResize();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Registra los eventos de ratón (lanzar) y teclado (reiniciar partida)
function initInput() {
  window.addEventListener("pointerdown", (event) => {
    if (event.button === 0) throwBall(event);
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") resetGame();
  });
}

// Calcula la dirección con Raycaster, crea la bola con efecto y comienza a grabar el Replay
function throwBall(event) {
  if (!canThrow || isPlayingReplay) return;

  canThrow = false;
  shotFinished = false;
  clearActiveBall();

  // Convertimos las coordenadas de pantalla a coordenadas normalizadas de dispositivo (-1 a 1)
  mouseCoords.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouseCoords, getCamera());

  // Acotamos la posición inicial en X al ancho útil de la madera para no lanzar fuera de pista
  const dirX = raycaster.ray.direction.x;
  const startX = THREE.MathUtils.clamp(dirX * 4.0, -0.9, 0.9);
  const startPos = new THREE.Vector3(startX, 0.35, BALL_START_Z);
  const vel = new THREE.Vector3(dirX * 3.5, 0, BALL_SPEED_Z);
  const angVel = new THREE.Vector3(-10, 0, -dirX * 5);

  activeBall = createBallWithPhysics(
    scene,
    BALL_RADIUS,
    BALL_MASS,
    startPos,
    vel,
    angVel
  );

  // Reiniciamos el búfer de instantáneas para grabar este lanzamiento
  replayFrames = [];
  isRecordingReplay = true;
  animateShotCamera();
}

// Reinicia la partida completa, recoloca los 10 bolos y limpia el marcador
function resetGame() {
  if (isPlayingReplay) return;

  clearActiveBall();
  ballInTurn = 1;
  standingPinsBeforeShot = 10;
  shotFinished = true;
  isRecordingReplay = false;

  animateSweeperBar(scene, true, () => {
    resetScoreboard(getPins());
    canThrow = true;
  });
  resetCamera(0);
}

// Elimina la bola activa de la física y de la escena
function clearActiveBall() {
  if (!activeBall) return;
  removePhysicsBody(activeBall);
  scene.remove(activeBall);
  activeBall = null;
}

// Evalúa los bolos caídos tras el tiro y decide si lanzar Replay de Strike o recoger la pista
function handleShotEnd() {
  setTimeout(() => {
    isRecordingReplay = false;
    const { standing } = classifyPins();
    updatePinDiagram(standing);

    const knockedCount = Math.max(0, standingPinsBeforeShot - standing.length);
    const isStrike = recordRoll(ballInTurn, knockedCount);

    if (isStrike && replayFrames.length > MIN_REPLAY_FRAMES) {
      startReplay();
    } else {
      finishTurnAndSweep(standing);
    }
  }, TURN_END_DELAY_MS);
}

// Activa el modo de repetición en cámara lenta y cambia al plano lateral
function startReplay() {
  isPlayingReplay = true;
  replayIndex = 0;
  showReplayBadge(true);
  setReplayCamera();
}

// Gestiona el paso a segunda bola o el cambio de ronda activando la barra barredora
function finishTurnAndSweep(standing) {
  clearActiveBall();

  // Si es la primera bola y quedan bolos en pie, pasamos al segundo tiro para intentar el Spare
  if (ballInTurn === 1 && standing.length > 0) {
    standingPinsBeforeShot = standing.length;
    ballInTurn = 2;
    animateSweeperBar(scene, false, () => {
      canThrow = true;
    });
    resetCamera(400);
    return;
  }

  // En caso contrario (Strike o fin de segunda bola), avanzamos ronda y ponemos 10 bolos nuevos
  ballInTurn = 1;
  standingPinsBeforeShot = 10;
  const hasMoreFrames = advanceFrame();

  animateSweeperBar(scene, true, () => {
    if (!hasMoreFrames) {
      resetScoreboard(getPins());
    } else {
      updatePinDiagram(getPins());
    }
    canThrow = true;
  });

  resetCamera(400);
}

// Guarda una instantánea de posición y rotación de la bola y los bolos en el frame actual
function captureReplayFrame() {
  replayFrames.push({
    ball: activeBall
      ? {
          pos: activeBall.position.clone(),
          quat: activeBall.quaternion.clone(),
          visible: activeBall.visible,
        }
      : null,
    pins: getPins().map((pin) => ({
      mesh: pin,
      pos: pin.position.clone(),
      quat: pin.quaternion.clone(),
      visible: pin.visible,
    })),
  });
}

// Avanza la reproducción del Replay interpolando el índice a velocidad reducida
function updateReplayPlayback() {
  const idx = Math.floor(replayIndex);

  // Cuando se agotan los frames grabados, cerramos el Replay y recogemos la pista
  if (idx >= replayFrames.length) {
    isPlayingReplay = false;
    showReplayBadge(false);
    finishTurnAndSweep([]);
    return;
  }

  const snapshot = replayFrames[idx];

  if (snapshot.ball && activeBall) {
    activeBall.visible = snapshot.ball.visible;
    activeBall.position.copy(snapshot.ball.pos);
    activeBall.quaternion.copy(snapshot.ball.quat);
  }

  for (let i = 0; i < snapshot.pins.length; i++) {
    const item = snapshot.pins[i];
    item.mesh.visible = item.visible;
    item.mesh.position.copy(item.pos);
    item.mesh.quaternion.copy(item.quat);
  }

  replayIndex += REPLAY_SPEED;
}

// Bucle principal de renderizado: alterna entre simulación física normal y reproducción del Replay
function animationLoop() {
  requestAnimationFrame(animationLoop);

  const deltaTime = clock.getDelta();

  if (isPlayingReplay) {
    updateReplayPlayback();
  } else {
    stepPhysics(deltaTime);

    if (isRecordingReplay) captureReplayFrame();

    // Disparamos el cierre del tiro en cuanto la bola cruza hacia el túnel del fondo
    if (
      activeBall &&
      !shotFinished &&
      activeBall.position.z < TUNNEL_TRIGGER_Z
    ) {
      shotFinished = true;
      handleShotEnd();
    }
  }

  TWEEN.update();
  renderer.render(scene, getCamera());
}
