"use strict";

import { Vector, UniversalCam, OrbitCam, Material, Color, decomposeMatrix } from "./babylon.js";

/**
 * Function: setupCamera
 * Purpose: Configure a UniversalCamera and ArcRotationCamera for movement and rotation controls.
 * - Sets up WASD and arrow keys for navigation in 3D space.
 * - Q/E for rotating left/right, Space/Shift for upward/downward movement.
 * - Attaches camera controls to the canvas for mouse-based view rotation.
 * - Binds mouse wheel to apply zoom effect to the view.
 */
export function setupCamera(scene, canvas) {  
  // Create a UniversalCamera placed initially above the ground and away from the origin.
  // UniversalCamera is suited for first-person style movement and rotation in 3D space.
  const camera = UniversalCam(scene, "camera");
  scene.switchActiveCamera(camera);

  // Customize key bindings for movement (WASD, Arrow keys, etc.).
  // Movement forwa rd/backward is controlled by W/S (87/83) and ArrowUp/ArrowDown keys.
  camera.keysUp = [87, 38]; // W (87) and ArrowUp (38)
  camera.keysDown = [83, 40]; // S (83) and ArrowDown (40)

  // Movement left/right is controlled by A/D (65/68) and ArrowLeft/ArrowRight keys.
  camera.keysLeft = [65, 37]; // A (65) and ArrowLeft (37)
  camera.keysRight = [68, 39]; // D (68) and ArrowRight (39)

  // Add bindings for upward and downward movement.
  // Space (32) for upward movement, Shift (16) for downward movement.
  camera.keysUpward = [32]; // Space
  camera.keysDownward = [16]; // Shift

  // Add bindings for rotation controls.
  // Q (81) for rotating left, E (69) for rotating right.
  camera.keysRotateLeft = [81]; // Q
  camera.keysRotateRight = [69]; // E

  {
    // Set the movement speed and mouse sensitivity for a smooth experience.
    function setMovementSpeed({ value }) {
      camera.speed = value; // Controls the speed of movement for WASD and arrow keys.
    }
    config.onChange("movementSpeed", setMovementSpeed);
  }
  {
    function setMouseSensibility({ value }) {
      camera.angularSensibility = value; // Controls mouse drag sensitivity for view rotation.
    }
    config.onChange("mouseSensibility", setMouseSensibility);
  }

  // create an ArcRotateCamera for orbit view
  const orbitCam = OrbitCam(scene, "orbitCamera");

  setupOrbitView(scene);

  {
    function setRotationX({ value }) {
      if (config.get("orbitMode")) {
        orbitCam.beta = -value + Math.PI / 2;
      } else {
        camera.rotation.x = value;
      }
    }
    config.onChange("rotationX", setRotationX);
  }

  {
    function setRotationY({ value }) {
      if (config.get("orbitMode")) {
        orbitCam.alpha = value + 1.5 * Math.PI;
      } else {
        camera.rotation.y = -value;
      }
    }
    config.onChange("rotationY", setRotationY);
  }

  {
    function setPosition() {
      const scale = config.get("scale");
      const newPosition = Vector(config.get("x"), config.get("y"), config.get("z")).scale(scale);
      if (config.get("orbitMode")) {
        const newTarget = getOrbitTargetFromPosition(scene, newPosition, orbitCam.radius);
        orbitCam.setTarget(newTarget);
        orbitCam.position = newPosition;
      } else {
        camera.position = newPosition;
      }
    }
    for (const axis of "xyz") {
      config.onChange(axis, setPosition);
    }
  }

  {
    function setOrbitRadius({ value }) {
      if (config.get("orbitMode")) {
        const newTarget = getOrbitTargetFromPosition(scene, orbitCam.position, value);
        orbitCam.setTarget(newTarget);
      }
    }
    config.onChange("orbitModeTargetDistance", setOrbitRadius);
  }

  {
    function setScale() {
      // update position to the scaled position
      config.set("x", config.get("x"));
      config.set("y", config.get("y"));
      config.set("z", config.get("z"));
    }
    config.onChange("scale", setScale);
  }

  canvas.addEventListener("wheel", evt => {
    if (scene.activeCamera.name !== "orbitCamera" && !evt.ctrlKey && !evt.altKey && !evt.shiftKey && !evt.metaKey) {
      try {
        config.set("scale", config.get("scale") - Math.floor(evt.deltaY / 10));
      } catch {}
    }
  });

  scene.registerBeforeRender(() => {
    const scale = config.get("scale");

    // will work for both cameras
    // disabling callback function to run, as it would just set the camera to its current position
    config.set("x", scene.activeCamera.position.x / scale, false);
    config.set("y", scene.activeCamera.position.y / scale, false);
    config.set("z", scene.activeCamera.position.z / scale, false);

    if (config.get("orbitMode")) {
      config.set("rotationX", (-scene.activeCamera.beta + Math.PI / 2) % (2 * Math.PI), false);
      config.set("rotationY", (scene.activeCamera.alpha - 1.5 * Math.PI) % (2 * Math.PI), false);
    } else {
      config.set("rotationX", scene.activeCamera.rotation.x, false);
      config.set("rotationY", -scene.activeCamera.rotation.y, false);
    }

    config.set("orbitModeTargetDistance", orbitCam.radius, false);
  });
}

function getOrbitTargetFromPosition(scene, position, radius) {
  const forward = scene.activeCamera.getDirection(Vector(0, 0, 1));
  forward.normalize();
  const newTarget = position.add(forward.scale(radius));
  return newTarget;
}

function setupOrbitView(scene) {
  {
    function toggleOrbitMode({ value }) {
      if (!value && scene.activeCamera.name !== "camera") {
        const camera = scene.getCameraByName("camera");
        const position = scene.activeCamera.position;
        scene.switchActiveCamera(camera);
        camera.position = position;
      }
      else if (value && scene.activeCamera.name !== "orbitCamera") {
        const orbitCamera = scene.getCameraByName("orbitCamera");

        let target;
        let radius;
        const meshSelectedPoints = scene.getMeshByName("pickedSphere");
        const instanceCount = meshSelectedPoints.TOX_instanceCount;
        if (instanceCount === 0) {
          radius = 10;
          target = getOrbitTargetFromPosition(scene, scene.activeCamera.position, radius);
        } else {
          // calculate mid point of all selected points and set as target,
          // set distance to this point as radius

          // Initialize variables to calculate the sum of positions
          let sumX = 0;
          let sumY = 0;
          let sumZ = 0;

          // Loop through all instances and sum up their positions
          meshSelectedPoints.thinInstanceGetWorldMatrices().forEach(matrix => {
              const { position } = decomposeMatrix(matrix);
              sumX += position.x;
              sumY += position.y;
              sumZ += position.z;
          });

          // Calculate the average position
          target = Vector(
              sumX / instanceCount,
              sumY / instanceCount,
              sumZ / instanceCount
          );
          radius = Vector.Distance(target, scene.activeCamera.position);
        }
        scene.switchActiveCamera(orbitCamera);
        orbitCamera.setTarget(target);
        orbitCamera.radius = radius;
      }
    }
    config.onChange("orbitMode", toggleOrbitMode);
  }
  
  scene.getEngine().getRenderingCanvas().addEventListener("keydown", evt => {
    const key = evt.key.toLowerCase();
    if (key === "f") {
      config.set("orbitMode", !config.get("orbitMode"));
    }
  })
}
