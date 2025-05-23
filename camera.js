"use strict";

import { createSphereMesh } from "./plotData.js";

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
  const camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(0, 0, 0), scene);
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

  // Set the movement speed and mouse sensitivity for a smooth experience.
  config.setSetterCallback("movementSpeed", (speed) => {
    camera.speed = speed; // Controls the speed of movement for WASD and arrow keys.
  });
  config.setSetterCallback("mouseSensibility", (sensibility) => {
    camera.angularSensibility = sensibility; // Controls mouse drag sensitivity for view rotation.
  })

  // // Listen to the mouse wheel event on the canvas to simulate zooming.
  // canvas.addEventListener("wheel", event => {
  //   // event.deltaY is positive when scrolling down (zoom out) and negative when scrolling up (zoom in).
  //   const delta = event.deltaY * 0.0005;
  //   // Adjust the camera's field of view (fov) to simulate zoom changes.
  //   camera.fov += delta;
  //   // Clamp the FOV value to keep the zoom within sensible limits.
  //   camera.fov = Math.min(Math.max(camera.fov, 0.1), 1.5);
  // });

  // create an ArcRotateCamera for orbit view
  const orbitCam = new BABYLON.ArcRotateCamera("orbitCamera", null, null, 10, new BABYLON.Vector3.Zero(), scene);
  orbitCam.lowerRadiusLimit = 1;
  const meshSelectedPoints = createSphereMesh(scene, "meshSelectedPoints", "selectedDataPointColor");
  setupOrbitView(scene, meshSelectedPoints);

  config.setSetterCallback("rotationX", (radians) => {
    if (config.get("orbitMode")) {
      orbitCam.beta = -radians + Math.PI / 2;
    } else {
      camera.rotation.x = radians;
    }
  });
  config.setSetterCallback("rotationY", (radians) => {
    if (config.get("orbitMode")) {
      orbitCam.alpha = radians + 1.5 * Math.PI;
    } else {
      camera.rotation.y = -radians;
    }
  });

  for (const axis of "xyz") {
    config.setSetterCallback(axis, (position) => {
      const scale = config.get("scale");
      if (config.get("orbitMode")) {
        const newPosition = new BABYLON.Vector3(config.get("x"), config.get("y"), config.get("z")).scale(scale);
        const newTarget = getOrbitTargetFromPosition(scene, newPosition, orbitCam.radius);
        orbitCam.setTarget(newTarget);
        orbitCam.position = newPosition;
      } else {
        camera.position[axis] = position * scale;
      }
    })
  }

  config.setSetterCallback("orbitModeTargetDistance", (radius) => {
    if (config.get("orbitMode")) {
      const newTarget = getOrbitTargetFromPosition(scene, orbitCam.position, radius);
      orbitCam.setTarget(newTarget);
    }
  })

  config.setSetterCallback("scale", (scale) => {
    // update position to the scaled position
    config.set("x", config.get("x"));
    config.set("y", config.get("y"));
    config.set("z", config.get("z"));
  })
  canvas.addEventListener("wheel", event => {
    if (scene.activeCamera.name !== "orbitCamera") {
      config.set("scale", config.get("scale") - Math.floor(event.deltaY / 10));
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
  const forward = scene.activeCamera.getDirection(BABYLON.Vector3.Forward());
  forward.normalize();
  const newTarget = position.add(forward.scale(radius));
  return newTarget;
}

function setupOrbitView(scene, meshSelectedPoints) {
  config.setSetterCallback("orbitMode", (enable) => {
    if (!enable && scene.activeCamera.name !== "camera") {
      const camera = scene.getCameraByName("camera");
      const position = scene.activeCamera.position;
      scene.switchActiveCamera(camera);
      camera.position = position;
    }
    else if (enable && scene.activeCamera.name !== "orbitCamera") {
      const orbitCamera = scene.getCameraByName("orbitCamera");

      let target;
      let radius;

      if (meshSelectedPoints.instances.length === 0) {
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
        meshSelectedPoints.instances.forEach(instance => {
            const position = instance.position;
            sumX += position.x;
            sumY += position.y;
            sumZ += position.z;
        });

        // Calculate the average position
        const numInstances = meshSelectedPoints.instances.length;
        target = new BABYLON.Vector3(
            sumX / numInstances,
            sumY / numInstances,
            sumZ / numInstances
        );
        radius = BABYLON.Vector3.Distance(target, scene.activeCamera.position);
      }
      scene.switchActiveCamera(orbitCamera);
      orbitCamera.setTarget(target);
      orbitCamera.radius = radius;
    }
  })
  scene.getEngine().getRenderingCanvas().addEventListener("keydown", (evt) => {
    const key = evt.key.toLowerCase();
    if (key === "f") {
      config.set("orbitMode", !config.get("orbitMode"));
    }
  })
}
