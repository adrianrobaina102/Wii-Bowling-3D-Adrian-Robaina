import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import {
  createBoxWithPhysics,
  createPinWithPhysics,
  removePhysicsBody,
  restorePinPhysics,
} from "./physics.js";

// Desplazamientos horizontales de las tres pistas paralelas del salón
const LANE_OFFSETS = [-4.45, 0, 4.45];

// Configuración geométrica del triángulo de 10 bolos
const PIN_ROWS = 4;
const PIN_SPACING_X = 0.58;
const PIN_SPACING_Z = 0.65;
const FIRST_PIN_Z = -8.0;
const PIN_SPAWN_Y = 0.5; // Altura inicial sobre y=0 para que caigan sin solaparse con el margen del suelo
const PIN_LIFT_Y = 1.65;
const UPRIGHT_THRESHOLD_Y = 0.7; // Equivale a ~45 grados de inclinación máxima para seguir en pie

// Cotas de recorrido de la barra barredora roja
const BAR_REST_Y = 2.2;
const BAR_SWEEP_Y = 0.25;
const BAR_START_Z = -7.2;
const BAR_END_Z = -12.2;

let pins = [];
let sweeperBar = null;

// Devuelve el array con los bolos actuales en escena
export function getPins() {
  return pins;
}

// Crea los materiales compartidos para las pistas de la bolera
function createLaneMaterials() {
  return {
    wood: new THREE.MeshPhongMaterial({ color: 0xdfb17b, shininess: 60 }),
    gutter: new THREE.MeshPhongMaterial({ color: 0x22262e }),
    divider: new THREE.MeshPhongMaterial({ color: 0xd4af37, shininess: 80 }),
    bumperCap: new THREE.MeshPhongMaterial({ color: 0xf1f5f9 }),
    backWall: new THREE.MeshPhongMaterial({ color: 0xb8d4d8 }),
    signBoard: new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0x223344,
    }),
    star: new THREE.MeshPhongMaterial({ color: 0xffd166, emissive: 0x664400 }),
    pitBack: new THREE.MeshBasicMaterial({ color: 0x050811 }),
  };
}

// Construye una pista completa (madera, canaletas, separadores y túnel trasero) desplazada en X
function buildLane(scene, offsetX, mat) {
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion(0, 0, 0, 1);

  // Carril central de madera pulida y canaletas laterales hundidas
  createBoxWithPhysics(
    scene,
    2.5,
    0.4,
    24,
    0,
    pos.set(offsetX, -0.2, 0),
    quat,
    mat.wood,
    0.05
  );
  createBoxWithPhysics(
    scene,
    0.65,
    0.4,
    24,
    0,
    pos.set(offsetX - 1.575, -0.38, 0),
    quat,
    mat.gutter,
    0.01
  );
  createBoxWithPhysics(
    scene,
    0.65,
    0.4,
    24,
    0,
    pos.set(offsetX + 1.575, -0.38, 0),
    quat,
    mat.gutter,
    0.01
  );

  // Separadores dorados entre pistas y remates frontales blancos
  createBoxWithPhysics(
    scene,
    0.32,
    0.45,
    23.2,
    0,
    pos.set(offsetX - 2.06, 0.02, -0.4),
    quat,
    mat.divider,
    0.2
  );
  createBoxWithPhysics(
    scene,
    0.32,
    0.45,
    23.2,
    0,
    pos.set(offsetX + 2.06, 0.02, -0.4),
    quat,
    mat.divider,
    0.2
  );

  const leftCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.36, 0.8),
    mat.bumperCap
  );
  leftCap.position.set(offsetX - 2.06, -0.02, 11.6);
  scene.add(leftCap);

  const rightCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.36, 0.8),
    mat.bumperCap
  );
  rightCap.position.set(offsetX + 2.06, -0.02, 11.6);
  scene.add(rightCap);

  // Estructura trasera dejando abierto el hueco inferior del túnel para recoger los bolos
  createBoxWithPhysics(
    scene,
    0.45,
    2.8,
    0.5,
    0,
    pos.set(offsetX - 2.0, 1.4, -12.2),
    quat,
    mat.backWall,
    0.5
  );
  createBoxWithPhysics(
    scene,
    0.45,
    2.8,
    0.5,
    0,
    pos.set(offsetX + 2.0, 1.4, -12.2),
    quat,
    mat.backWall,
    0.5
  );
  createBoxWithPhysics(
    scene,
    4.45,
    1.65,
    0.5,
    0,
    pos.set(offsetX, 1.98, -12.2),
    quat,
    mat.backWall,
    0.5
  );

  // Cartel decorativo con estrella en el panel superior del fondo
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.65, 0.1),
    mat.signBoard
  );
  sign.position.set(offsetX, 2.05, -11.9);
  scene.add(sign);

  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), mat.star);
  star.position.set(offsetX, 2.05, -11.82);
  scene.add(star);

  // Fondo oscuro del túnel para dar sensación de profundidad
  const pitBack = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 2.8, 0.2),
    mat.pitBack
  );
  pitBack.position.set(offsetX, 1.2, -14.2);
  scene.add(pitBack);
}

// Genera las tres pistas del salón, la barra barredora y la formación inicial de bolos
export function createArena(scene) {
  const materials = createLaneMaterials();
  LANE_OFFSETS.forEach((offsetX) => buildLane(scene, offsetX, materials));

  // Creamos la barra barredora oculta hasta que deba bajar a limpiar la pista
  const barMaterial = new THREE.MeshPhongMaterial({ color: 0xe63946 });
  sweeperBar = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.35, 0.35),
    barMaterial
  );
  sweeperBar.position.set(0, BAR_REST_Y, BAR_START_Z);
  sweeperBar.castShadow = true;
  sweeperBar.visible = false;
  scene.add(sweeperBar);

  spawnPins(scene);
}

// Elimina un bolo tanto del motor de físicas como de la escena y del listado interno
export function removePin(scene, pin) {
  removePhysicsBody(pin);
  scene.remove(pin);

  const idx = pins.indexOf(pin);
  if (idx > -1) pins.splice(idx, 1);
}

// Coloca los 10 bolos en triángulo numerados del 1 al 10 y guarda su posición inicial
export function spawnPins(scene) {
  [...pins].forEach((pin) => removePin(scene, pin));
  pins = [];

  const pinMaterial = new THREE.MeshPhongMaterial({ color: 0xf8f9fa });
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion(0, 0, 0, 1);
  let pinNumber = 1;

  for (let row = 0; row < PIN_ROWS; row++) {
    for (let col = 0; col <= row; col++) {
      // Centramos cada fila respecto al eje X = 0
      const x = (col - row * 0.5) * PIN_SPACING_X;
      const z = FIRST_PIN_Z - row * PIN_SPACING_Z;
      pos.set(x, PIN_SPAWN_Y, z);

      const pin = createPinWithPhysics(scene, pos, quat, pinMaterial);
      pin.userData.type = "pin";
      pin.userData.number = pinNumber++;
      pin.userData.initialPos = pos.clone();
      pins.push(pin);
    }
  }
}

// Evalúa la verticalidad de cada bolo mediante su cuaternión para separar los que siguen en pie de los caídos
export function classifyPins() {
  const upVector = new THREE.Vector3();
  const standing = [];
  const knocked = [];

  for (const pin of pins) {
    // Rotamos el eje Y local del bolo según su orientación actual para medir su inclinación
    upVector.set(0, 1, 0).applyQuaternion(pin.quaternion);
    const isUpright =
      pin.visible &&
      upVector.y >= UPRIGHT_THRESHOLD_Y &&
      pin.position.y >= 0.25;

    if (isUpright) {
      standing.push(pin);
    } else {
      knocked.push(pin);
    }
  }

  return { standing, knocked };
}

// Desactiva la física de los bolos en pie y los eleva simulando las pinzas antes de barrer
function liftStandingPins(standing) {
  for (const pin of standing) {
    removePhysicsBody(pin);
    new TWEEN.Tween(pin.position)
      .to({ y: PIN_LIFT_Y }, 500)
      .easing(TWEEN.Easing.Quadratic.Out)
      .start();
  }
}

// Elimina los bolos derribados conforme los alcanza el avance de la barra barredora
function sweepReachedPins(scene, targetPins, barZ) {
  for (let i = targetPins.length - 1; i >= 0; i--) {
    const pin = targetPins[i];
    if (pin && pin.position.z >= barZ - 0.3) {
      removePin(scene, pin);
    }
  }
}

// Baja los bolos salvados a su posición original y les reactiva un cuerpo físico limpio
function lowerSavedPins(scene, standing, onFinished) {
  let pending = standing.length;

  for (const pin of standing) {
    const destination = pin.userData.initialPos;
    new TWEEN.Tween(pin.position)
      .to({ x: destination.x, y: PIN_SPAWN_Y, z: destination.z }, 450)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onComplete(() => {
        restorePinPhysics(scene, pin, destination);
        pending--;
        if (pending === 0 && onFinished) onFinished();
      })
      .start();
  }
}

// Ejecuta la secuencia encadenada de limpieza: eleva los buenos (si es 2ª bola), barre caídos y recoloca
export function animateSweeperBar(scene, resetAll, onFinished) {
  sweeperBar.visible = true;
  sweeperBar.position.set(0, BAR_REST_Y, BAR_START_Z);

  const { standing, knocked } = classifyPins();

  // Si toca segundo lanzamiento, levantamos los bolos que siguen en pie para dejar pasar la barra
  if (!resetAll) {
    liftStandingPins(standing);
  }

  // Fase 1: bajar la barra delante de la zona de bolos
  const lowerBar = new TWEEN.Tween(sweeperBar.position)
    .to({ y: BAR_SWEEP_Y }, 500)
    .easing(TWEEN.Easing.Bounce.Out);

  // Fase 2: avanzar hacia el fondo barriendo los bolos derribados
  const sweepBack = new TWEEN.Tween(sweeperBar.position)
    .to({ z: BAR_END_Z }, 750)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(() => {
      const targetList = resetAll ? [...pins] : knocked;
      sweepReachedPins(scene, targetList, sweeperBar.position.z);
    })
    .onComplete(() => {
      const remaining = resetAll ? [...pins] : [...knocked];
      remaining.forEach((pin) => removePin(scene, pin));
    });

  // Fase 3: regresar la barra a su posición horizontal inicial
  const returnBar = new TWEEN.Tween(sweeperBar.position)
    .to({ z: BAR_START_Z }, 500)
    .easing(TWEEN.Easing.Quadratic.InOut);

  // Fase 4: subir la barra y recolocar los bolos nuevos o bajar los salvados
  const raiseBar = new TWEEN.Tween(sweeperBar.position)
    .to({ y: BAR_REST_Y }, 450)
    .easing(TWEEN.Easing.Quadratic.In)
    .onComplete(() => {
      sweeperBar.visible = false;

      if (resetAll || standing.length === 0) {
        spawnPins(scene);
        if (onFinished) onFinished();
        return;
      }

      lowerSavedPins(scene, standing, onFinished);
    });

  lowerBar.chain(sweepBack);
  sweepBack.chain(returnBar);
  returnBar.chain(raiseBar);
  lowerBar.start();
}
