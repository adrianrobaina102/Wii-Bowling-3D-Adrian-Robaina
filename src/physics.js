import * as THREE from "three";

// Parámetros físicos generales y constantes de Ammo.js
const GRAVITY = 9.8;
const COLLISION_MARGIN = 0.05;
const DISABLE_DEACTIVATION = 4; // Evita que los cuerpos rígidos pasen a reposo a mitad de tiro

// Límites espaciales para las canaletas laterales y el foso trasero
const GUTTER_LIMIT_X = 1.35;
const GUTTER_PUSH_SPEED = -14;
const PIT_LIMIT_Y = -3;

// Dimensiones y propiedades físicas de los bolos
const PIN_RADIUS = 0.14;
const PIN_HEIGHT = 0.9;
const PIN_MASS = 1.2;
const PIN_FRICTION = 0.35;

let AmmoLib = null;
let physicsWorld = null;
let auxTransform = null;
const rigidBodies = [];

// Inicializa el mundo de dinámicas discretas de Ammo.js y configura la gravedad
export function initPhysics(ammoInstance) {
  AmmoLib = ammoInstance;

  const collisionConfig = new AmmoLib.btDefaultCollisionConfiguration();
  const dispatcher = new AmmoLib.btCollisionDispatcher(collisionConfig);
  const broadphase = new AmmoLib.btDbvtBroadphase();
  const solver = new AmmoLib.btSequentialImpulseConstraintSolver();

  physicsWorld = new AmmoLib.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfig
  );
  physicsWorld.setGravity(new AmmoLib.btVector3(0, -GRAVITY, 0));

  // Transformación auxiliar reutilizable para no reservar memoria en cada frame
  auxTransform = new AmmoLib.btTransform();
}

// Envuelve una malla de Three.js en un cuerpo rígido de Ammo.js y lo registra en escena y física
export function createRigidBody(
  scene,
  mesh,
  physicsShape,
  mass,
  pos,
  quat,
  vel = null,
  angVel = null,
  friction = 0.5
) {
  mesh.position.copy(pos);
  mesh.quaternion.copy(quat);

  // Definimos la transformación inicial en el espacio de Ammo.js
  const transform = new AmmoLib.btTransform();
  transform.setIdentity();
  transform.setOrigin(new AmmoLib.btVector3(pos.x, pos.y, pos.z));
  transform.setRotation(
    new AmmoLib.btQuaternion(quat.x, quat.y, quat.z, quat.w)
  );
  const motionState = new AmmoLib.btDefaultMotionState(transform);

  // Calculamos la inercia local solo si el objeto es dinámico (masa mayor que cero)
  const localInertia = new AmmoLib.btVector3(0, 0, 0);
  if (mass > 0) physicsShape.calculateLocalInertia(mass, localInertia);

  const rbInfo = new AmmoLib.btRigidBodyConstructionInfo(
    mass,
    motionState,
    physicsShape,
    localInertia
  );
  const body = new AmmoLib.btRigidBody(rbInfo);
  body.setFriction(friction);

  // Aplicamos velocidades lineales o angulares iniciales si se han especificado
  if (vel) body.setLinearVelocity(new AmmoLib.btVector3(vel.x, vel.y, vel.z));
  if (angVel)
    body.setAngularVelocity(
      new AmmoLib.btVector3(angVel.x, angVel.y, angVel.z)
    );

  mesh.userData.physicsBody = body;
  scene.add(mesh);

  // Guardamos solo los objetos móviles para sincronizar su posición en cada iteración
  if (mass > 0) {
    rigidBodies.push(mesh);
    body.setActivationState(DISABLE_DEACTIVATION);
  }

  physicsWorld.addRigidBody(body);
  return body;
}

// Crea una caja estática o dinámica (usada para pistas, canaletas, separadores y paredes del fondo)
export function createBoxWithPhysics(
  scene,
  sx,
  sy,
  sz,
  mass,
  pos,
  quat,
  material,
  friction = 0.5
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.castShadow = mass > 0;
  mesh.receiveShadow = true;

  // Ammo.js define las cajas a partir de sus semiejes (mitad de ancho, alto y profundo)
  const shape = new AmmoLib.btBoxShape(
    new AmmoLib.btVector3(sx * 0.5, sy * 0.5, sz * 0.5)
  );
  shape.setMargin(COLLISION_MARGIN);

  createRigidBody(scene, mesh, shape, mass, pos, quat, null, null, friction);
  return mesh;
}

// Crea un cilindro ligeramente estrechado arriba para simular un bolo con amortiguamiento de rotación
export function createPinWithPhysics(scene, pos, quat, material) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(PIN_RADIUS * 0.75, PIN_RADIUS, PIN_HEIGHT, 16),
    material
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const shape = new AmmoLib.btCylinderShape(
    new AmmoLib.btVector3(PIN_RADIUS, PIN_HEIGHT * 0.5, PIN_RADIUS)
  );
  shape.setMargin(COLLISION_MARGIN);

  const body = createRigidBody(
    scene,
    mesh,
    shape,
    PIN_MASS,
    pos,
    quat,
    null,
    null,
    PIN_FRICTION
  );
  // Amortiguamos ligeramente la rotación para evitar micro-vibraciones al apoyarse en la madera
  body.setDamping(0.05, 0.25);
  return mesh;
}

// Restaura un cuerpo rígido recto y sin inercia a un bolo salvado tras pasar la barra barredora
export function restorePinPhysics(scene, mesh, pos) {
  const uprightQuat = new THREE.Quaternion(0, 0, 0, 1);
  const shape = new AmmoLib.btCylinderShape(
    new AmmoLib.btVector3(PIN_RADIUS, PIN_HEIGHT * 0.5, PIN_RADIUS)
  );
  shape.setMargin(COLLISION_MARGIN);

  const body = createRigidBody(
    scene,
    mesh,
    shape,
    PIN_MASS,
    pos,
    uprightQuat,
    null,
    null,
    PIN_FRICTION
  );
  body.setDamping(0.05, 0.25);
}

// Crea la esfera de la bola de bolos con su velocidad lineal y efecto de giro inicial
export function createBallWithPhysics(scene, radius, mass, pos, vel, angVel) {
  const ballMaterial = new THREE.MeshPhongMaterial({
    color: 0x00b4d8,
    shininess: 90,
  });
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 18),
    ballMaterial
  );
  ball.castShadow = true;
  ball.userData.type = "ball";

  const shape = new AmmoLib.btSphereShape(radius);
  shape.setMargin(COLLISION_MARGIN);

  createRigidBody(
    scene,
    ball,
    shape,
    mass,
    pos,
    new THREE.Quaternion(0, 0, 0, 1),
    vel,
    angVel,
    0.05
  );
  return ball;
}

// Elimina el cuerpo físico de Ammo de una malla sin borrar el objeto visual de la escena
export function removePhysicsBody(mesh) {
  if (mesh.userData.physicsBody) {
    physicsWorld.removeRigidBody(mesh.userData.physicsBody);
    mesh.userData.physicsBody = null;
  }
  const idx = rigidBodies.indexOf(mesh);
  if (idx > -1) rigidBodies.splice(idx, 1);
}

// Copia la transformación física actualizada de Ammo sobre la malla de Three.js
function syncMeshWithBody(mesh, body) {
  const motionState = body.getMotionState();
  if (!motionState) return;

  motionState.getWorldTransform(auxTransform);
  const p = auxTransform.getOrigin();
  const q = auxTransform.getRotation();
  mesh.position.set(p.x(), p.y(), p.z());
  mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
}

// Avanza la simulación física, oculta los objetos que caen al foso y empuja la bola en las canaletas
export function stepPhysics(deltaTime) {
  physicsWorld.stepSimulation(deltaTime, 10);

  for (let i = rigidBodies.length - 1; i >= 0; i--) {
    const mesh = rigidBodies[i];
    const body = mesh.userData.physicsBody;

    syncMeshWithBody(mesh, body);

    // Desactiva física y oculta la malla al caer al foso, manteniéndola viva por si hay Replay de Strike
    if (mesh.position.y < PIT_LIMIT_Y) {
      removePhysicsBody(mesh);
      mesh.visible = false;
      continue;
    }

    // Empuje tipo cinta transportadora en las canaletas laterales para que la bola nunca se quede frenada
    if (
      mesh.userData.type === "ball" &&
      Math.abs(mesh.position.x) > GUTTER_LIMIT_X
    ) {
      const currentVel = body.getLinearVelocity();
      body.setLinearVelocity(
        new AmmoLib.btVector3(0, currentVel.y(), GUTTER_PUSH_SPEED)
      );
    }
  }
}
