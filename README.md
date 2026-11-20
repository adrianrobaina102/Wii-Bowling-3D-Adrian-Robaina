# Bolera 3D (Three.js + Ammo.js + Tween.js)

**Autor:** Adrián Robaina Mejías  
**Asignatura:** Informática Gráfica — Grado en Ingeniería Informática (ULPGC)  
**Demo interactiva (CodeSandbox):** [https://codesandbox.io/p/sandbox/ig-s11-forked-ry3mvc](https://codesandbox.io/p/sandbox/ig-s11-forked-ry3mvc)  
**Vídeo demostrativo (1920x1080):** [https://youtu.be/z5heO98hOuI]

---

## Descripción del proyecto

Prototipo interactivo de bolera en 3D inspirado en la estética y dinámica de *Wii Sports*, desarrollado con **Three.js** integrando simulación física de cuerpos rígidos mediante **Ammo.js** y animaciones por fotogramas clave con **Tween.js**.

El sistema reproduce el ciclo completo de una partida de bolos (5 rondas de hasta 2 lanzamientos por turno), incluyendo detección de bolos derribados, barra barredora animada, elevación de bolos en pie entre el primer y segundo tiro, cálculo de puntuación con bonificaciones de *Strike* y *Spare*, y repetición automática en cámara lenta al conseguir un *Strike*.

---

## Características técnicas

### Física con Ammo.js (`src/physics.js`)
- **Cuerpos rígidos:** Simulación de los 10 bolos cilíndricos, la bola esférica y las colisiones con la pista, canaletas hundidas, separadores laterales y estructura del fondo.
- **Estabilidad y fricción:** Ajuste diferenciado de fricción entre la pista de madera pulida (`0.05`) y las canaletas laterales (`0.01`), junto con amortiguamiento (`setDamping`) en los bolos para evitar micro-vibraciones al inicio de cada ronda.
- **Arrastre en canaletas y foso:** Las bolas que caen en las canaletas laterales (`|x| > 1.35`) reciben un impulso constante hacia el túnel trasero para evitar bloqueos, y los cuerpos que caen al foso (`y < -3`) desactivan su cuerpo físico automáticamente.

### Animaciones con Tween.js (`src/camera.js` y `src/arena.js`)
- **Cámara dinámica:** Transiciones suaves interpolando tanto `camera.position` como `controls.target` al lanzar la bola y al regresar a la zona de tiro.
- **Mecánica de recogida de bolos:** Secuencia encadenada (`.chain()`) de animaciones que levanta los bolos que siguen en pie tras la primera bola, baja la barra barredora con efecto `Bounce.Out`, barre los bolos derribados hacia el túnel del fondo y vuelve a depositar los bolos salvados reactivando su física.

### Sistema de repetición y HUD (`src/main.js` y `src/hud.js`)
- **Replay en cámara lenta (Strike):** Durante cada lanzamiento se almacenan instantáneas (*snapshots*) de posición y orientación (`quaternion`) de la bola y los bolos. Si se derriban los 10 bolos en el primer tiro, se pausa la simulación física y se reproduce el impacto a velocidad `0.45x` desde un ángulo lateral.
- **Interfaz de usuario:** Diagrama superior izquierdo con los 10 bolos numerados (1 al 10) que refleja en tiempo real los bolos en pie, marcador superior derecho con reglas de puntuación (`X`, `/`, `-`) y avisos en pantalla para *Strike*, *Spare* y *Gutter*.

---

## Arquitectura del proyecto

El código se organiza de forma modular dentro de la carpeta `src/`:

```text
src/
├── index.html    # Estructura del HUD y carga del módulo principal
├── styles.css    # Estilos de la interfaz (diagrama de bolos, marcador y avisos)
├── main.js       # Orquestador principal, entrada de usuario, bucle de renderizado y Replay
├── physics.js    # Configuración del mundo físico de Ammo.js y gestión de cuerpos rígidos
├── arena.js      # Construcción modular de las pistas, bolos y animación de la barra barredora
├── camera.js     # Configuración de OrbitControls y transiciones de cámara con Tween.js
└── hud.js        # Lógica del marcador, actualización del diagrama de bolos y banners
```

---

## Controles

- **Clic izquierdo:** Apunta mediante `Raycaster` y lanza la bola hacia los bolos.
- **Ratón (arrastrar / rueda):** Control orbital de la cámara (`OrbitControls`).
- **Espacio:** Reinicia la partida, el marcador y recoloca los 10 bolos.

---

## Fuentes y bibliotecas utilizadas

- **Three.js:** Motor de renderizado 3D WebGL ([threejs.org](https://threejs.org/)).
- **Ammo.js (`ammojs-typed`):** Port de Bullet Physics a JavaScript/WebAssembly para simulación de cuerpos rígidos.
- **Tween.js (`@tweenjs/tween.js`):** Biblioteca de interpolación para animaciones de cámara y mecanismos de pista.
- **Material docente de la asignatura (ULPGC):** Scripts base de clase para la inicialización de `Ammo.js` (`script_45_ammo.js`) y encadenamiento de animaciones con `Tween.js` (`script_41_tween.js`, `script_46_articulada.js`).

---

## Uso de herramientas de IA

Para el desarrollo de este prototipo se ha consultado **Gemini** de forma puntual como apoyo técnico para:
- Resolver problemas de sincronización entre `OrbitControls` y las transiciones de cámara con `Tween.js`.
- Ajustar la detección de bolos derribados mediante cuaterniones y la estabilidad de los cuerpos rígidos en `Ammo.js`.
- Estructurar la separación modular del código y el sistema de repetición por instantáneas (*snapshots*).
