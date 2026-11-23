import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as TWEEN from "@tweenjs/tween.js";

// Posiciones y puntos de mira predefinidos para los distintos estados de la partida
const INITIAL_CAM_POS = new THREE.Vector3(0, 3.8, 13.5);
const INITIAL_TARGET = new THREE.Vector3(0, 0.8, -4);

const SHOT_CAM_POS = { x: 0, y: 2.2, z: -2.5 };
const SHOT_TARGET = { x: 0, y: 0.6, z: -9 };

const REPLAY_CAM_POS = new THREE.Vector3(2.4, 1.35, -5.2);
const REPLAY_TARGET = new THREE.Vector3(0, 0.5, -8.8);

let camera = null;
let controls = null;
let cameraTween = null;

// Configura la cámara perspectiva y los controles orbitales mirando hacia la pista central
export function initCamera(rendererDomElement) {
  camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.2,
    200
  );
  camera.position.copy(INITIAL_CAM_POS);

  controls = new OrbitControls(camera, rendererDomElement);
  controls.target.copy(INITIAL_TARGET);
  controls.update();

  return camera;
}

// Devuelve la instancia activa de la cámara
export function getCamera() {
  return camera;
}

// Ajusta la relación de aspecto de la cámara al redimensionar la ventana del navegador
export function onCameraResize() {
  if (!camera) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

// Interpola posición y punto de mira a la vez para evitar saltos bruscos con OrbitControls
function moveCamera(targetPos, lookAtPos, duration, delayMs, easing) {
  if (cameraTween) cameraTween.stop();

  // Capturamos el estado actual de la cámara y su objetivo como punto de partida
  const state = {
    camX: camera.position.x,
    camY: camera.position.y,
    camZ: camera.position.z,
    tarX: controls.target.x,
    tarY: controls.target.y,
    tarZ: controls.target.z,
  };

  cameraTween = new TWEEN.Tween(state)
    .to(
      {
        camX: targetPos.x,
        camY: targetPos.y,
        camZ: targetPos.z,
        tarX: lookAtPos.x,
        tarY: lookAtPos.y,
        tarZ: lookAtPos.z,
      },
      duration
    )
    .delay(delayMs)
    .easing(easing)
    .onUpdate(() => {
      camera.position.set(state.camX, state.camY, state.camZ);
      controls.target.set(state.tarX, state.tarY, state.tarZ);
      controls.update();
    })
    .start();
}

// Acerca la cámara hacia los bolos mientras la bola avanza por la pista
export function animateShotCamera() {
  moveCamera(SHOT_CAM_POS, SHOT_TARGET, 1400, 0, TWEEN.Easing.Quadratic.Out);
}

// Devuelve la cámara suavemente a la posición inicial de lanzamiento
export function resetCamera(delayMs = 400) {
  moveCamera(
    INITIAL_CAM_POS,
    INITIAL_TARGET,
    1000,
    delayMs,
    TWEEN.Easing.Quadratic.InOut
  );
}

// Coloca la cámara en un plano lateral bajo para la repetición en cámara lenta del Strike
export function setReplayCamera() {
  if (cameraTween) cameraTween.stop();
  camera.position.copy(REPLAY_CAM_POS);
  controls.target.copy(REPLAY_TARGET);
  controls.update();
}
