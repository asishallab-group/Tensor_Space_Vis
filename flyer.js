"use strict";

import { plotData } from "./plotData.js";
import { setupCamera } from "./camera.js";
import { config } from "./config.js";

/***************************************************************
 * Function: initializeEngine
 * Purpose: Set up Babylon.js with the experimental WebGPU engine.
 * - Checks for WebGPU support.
 * - Creates and initializes the WebGPU engine.
 * - Wraps any initialization errors in a try/catch.
 ***************************************************************/
async function initializeEngine(canvas) {
  // Check if the browser supports WebGPU. navigator.gpu is defined only if WebGPU is available.
  if (!navigator.gpu || typeof BABYLON === "undefined") {
    throw new Error("WebGPU is not supported on this browser.");
  }
  // Create a new WebGPU engine.
  // Babylon.js automatically detects that we want to use WebGPU based on this engine.
  const engine = new BABYLON.WebGPUEngine(canvas);
  try {
    // Asynchronously initialize the engine. This prepares the WebGPU adapter.
    await engine.initAsync();
  } catch (err) {
    console.error("Failed to initialize WebGPU engine: ", err);
    throw err;
  }
  // Disable offline support for a faster startup (optional setting)
  engine.enableOfflineSupport = false;

  return engine;
}

/***************************************************************
 * Function: configureCanvas
 * Purpose: Retrieve and configure the canvas element.
 * - Sets focus to the canvas on page load to enable keyboard controls immediately.
 * - Throws an error if the canvas element is not found.
 ***************************************************************/
function configureCanvas(id) {
  // Retrieve the canvas element by its id "view".
  const canvas = document.getElementById(id);
  if (!canvas) {
    throw new Error(`Canvas element with id ${id} not found.`);
  }

  // Set focus to the canvas element to enable keyboard controls on load.
  canvas.tabIndex = 1; // Ensure the canvas is focusable.
  canvas.focus();

  return canvas;
}

/***************************************************************
 * Function: setupScene
 * Purpose: Create the Babylon scene, camera, lighting and input controls.
 * - Uses a UniversalCamera for game-like WASD movement and mouse-click drag.
 * - Sets up basic keyboard events and mouse wheel for zooming.
 * - Updates the global view state (position and rotation) every frame.
 ***************************************************************/
function setupScene(engine, canvas) {
  // Create a new Babylon scene.
  const scene = new BABYLON.Scene(engine);

  // set background color
  config.setSetterCallback("backgroundColor", (hexColorCode) => {
    setBackgroundColor(scene, hexColorCode);
  });

  setupCamera(scene, canvas);

  // Create a basic hemispheric light to illuminate the scene.
  let light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
  light.specular = new BABYLON.Color3(0.2,0.2,0.2);  // reduces reflection
  light.intensity = 0.8;
  light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, -1, 0), scene);
  light.specular = new BABYLON.Color3(0.2,0.2,0.2);  // reduces reflection
  light.intensity = 0.8;
  
  return scene;
}

function setBackgroundColor(scene, hexColorCode) {
  scene.clearColor = BABYLON.Color4.FromHexString(hexColorCode);
}

/**
 * Function: showPositionOverlay
 * Purpose: Creates a GUI overlay that displays the camera's current position.
 * - Updates dynamically as the camera moves.
 * - Position is displayed in the bottom-right corner.
 * @param {BABYLON.Scene} scene - The Babylon.js scene for GUI integration.
 */
function showPositionOverlay(scene, xAxis, yAxis, zAxis) {
  // Create a fullscreen GUI overlay using Babylon.js's GUI library.
  const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);

  // Create a text block to display the position.
  const xPosition = new BABYLON.GUI.TextBlock();
  xPosition.fontSize = "3%"; // Font size
  xPosition.fontStyle = "bold"; // Font style
  xPosition.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT; // Align text to the right
  xPosition.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM; // Align text to the bottom
  xPosition.left = "-1%"; // Add some padding from the right
  xPosition.top = "-31%"; // Add some padding from the top
  const yPosition = xPosition.clone();
  yPosition.top = "-28%"; // Add some padding from the top
  const zPosition = yPosition.clone();
  zPosition.top = "-25%"; // Add some padding from the top

  function setColorCallback(attribute, textfield, axis) {
    config.setSetterCallback(attribute, (hexColorCode) => {
      setTextfieldColor(textfield, hexColorCode);
      axis.material.diffuseColor = BABYLON.Color4.FromHexString(hexColorCode);
      axis.material.alpha = axis.material.diffuseColor.a;
    })
  }
  setColorCallback("xAxisColor", xPosition, xAxis);
  setColorCallback("yAxisColor", yPosition, yAxis);
  setColorCallback("zAxisColor", zPosition, zAxis);

  // Add the text blocks to the GUI overlay.
  advancedTexture.addControl(xPosition);
  advancedTexture.addControl(yPosition);
  advancedTexture.addControl(zPosition);

  // Update the position text dynamically as the camera moves.
  scene.registerBeforeRender(() => {
    const precision = 2 + Math.floor(Math.log10(config.get("scale")));
    xPosition.text = `${config.get("tissueX")}: ${config.get("x").toFixed(precision)}`;
    yPosition.text = `${config.get("tissueY")}: ${config.get("y").toFixed(precision)}`;
    zPosition.text = `${config.get("tissueZ")}: ${config.get("z").toFixed(precision)}`;
  });
}

function setTextfieldColor(textfield, color) {
  textfield.color = color;
}

/**
 * Function: add3DCompass
 * Purpose: Adds a 3D compass fixed to the bottom-right corner of the canvas.
 * - A mini coordinate system (X, Y, Z axes) is always visible.
 * - Rotates synchronously (inverted) with the camera to show the correct orientation of the axes.
 * @param {BABYLON.Scene} mainScene - The primary scene of your application.
 * @param {BABYLON.Engine} engine - The Babylon.js engine used for rendering.
 * @returns {BABYLON.Scene} - The mini scene containing the interactive compass.
 */
function add3DCompass(mainScene, engine) {
  // Create a new scene dedicated to the compass visualization.
  const compassScene = new BABYLON.Scene(engine);

  // Prevent the compass scene from clearing the canvas to maintain visibility of the main scene.
  compassScene.autoClear = false;
  setBackgroundColor(compassScene, "#00000000");

  // Create an orthographic ArcRotateCamera for the compass.
  const compassCamera = new BABYLON.ArcRotateCamera(
    "compassCamera",
    Math.PI / 2, Math.PI / 2, 5, BABYLON.Vector3.Zero(), compassScene
  );
  compassCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA; // Fixed scaling.
  compassCamera.orthoLeft = -1;
  compassCamera.orthoRight = 1;
  compassCamera.orthoBottom = -1;
  compassCamera.orthoTop = 1;
  compassCamera.viewport = new BABYLON.Viewport(0.85, 0, 0.15, 0.25); // Bottom-right corner.

  // Add light to the compass scene to illuminate the axes.
  new BABYLON.HemisphericLight("compassLight", new BABYLON.Vector3(0, 1, 0), compassScene);

  // Axis and arrowhead size settings.
  const axisSize = 0.8;    // Length of the axis lines.
  const axisRadius = 0.0375;
  const cross = new BABYLON.TransformNode("cross", compassScene);

  const createAxis = (direction) => {
    // Create the axis line.
    const axis = BABYLON.MeshBuilder.CreateTube(
      `${direction}Axis`,
      { path: [BABYLON.Vector3.Zero(), direction.scale(axisSize)], radius: axisRadius, cap: BABYLON.Mesh.CAP_END },
      compassScene
    );
    const axisMaterial = new BABYLON.StandardMaterial(`${direction}AxisMat`, compassScene);
    axis.material = axisMaterial;
    axis.parent = cross;
    return axis;
  };

  // Create the X, Y, and Z axes with their respective colors and show current position above
  showPositionOverlay(
    mainScene,
    createAxis(new BABYLON.Vector3(-1, 0, 0)),
    createAxis(new BABYLON.Vector3(0, 1, 0)),
    createAxis(new BABYLON.Vector3(0, 0, -1))
  )
  // add origin
  BABYLON.MeshBuilder.CreateSphere("origin", { diameter: 5 * axisRadius }, compassScene);

  // Synchronize the compass with the main camera's rotation.
  mainScene.onBeforeRenderObservable.add(() => {
    const activeCamera = mainScene.activeCamera;
    let alpha;
    let beta;

    if (activeCamera instanceof BABYLON.ArcRotateCamera) {
      // Compute quaternion from alpha and beta for ArcRotateCamera.
      alpha = activeCamera.alpha + Math.PI / 2;
      beta = -activeCamera.beta + Math.PI / 2;
    } else {
      // Fallback for UniversalCamera or other camera types
      alpha = -activeCamera.rotation.y;
      beta = activeCamera.rotation.x;
    }

    const camQuat = BABYLON.Quaternion.RotationYawPitchRoll(
      -alpha, // Yaw (horizontal rotation).
      -beta, // Pitch (vertical tilt).
      0
    );
    cross.rotationQuaternion = camQuat.invert();
  });


  // Return the compass scene for further customization or control.
  return compassScene;
}

function captureScenes(engine, ...scenes) {
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  const renderLoop = engine.activeRenderLoops[0];

  const resolution = { width: 1920, height: 1080, precision: 4 };
  tempCanvas.width = resolution.width * resolution.precision;
  tempCanvas.height = resolution.height * resolution.precision;

  const attached = scenes.map(s => {
    if (s.activeCamera.inputs.attachedToElement) {
      s.activeCamera.detachControl();
      return true;
    }
    return false;
  });

  function captureScene(scenes, i=0) {
    const scene = scenes[i]
    if (scene === undefined) {
      const finalImage = tempCanvas.toDataURL("image/png");
      downloadImage(finalImage); // Save merged screenshot
      engine.stopRenderLoop();
      engine.runRenderLoop(renderLoop);
      scenes.forEach((s, i) => {
        if (attached[i]) {
          s.activeCamera.attachControl();
        }
      });
    } else {
      const autoClear = scene.autoClear;
      if (!autoClear) {
        scene.autoClear = true;
      }
      engine.stopRenderLoop();
      engine.runRenderLoop(() => {
          scene.render();
      });
      BABYLON.Tools.CreateScreenshotUsingRenderTarget(
        engine, scene.activeCamera, resolution, (data) => {
          const img = new Image();
          img.src = data;
          img.onload = () => {
            tempCtx.drawImage(img, 0, 0);
            captureScene(scenes, i+1);
          };
        }
      );
      if (!autoClear) {
        scene.autoClear = false;
      }
    }
  }
  captureScene(scenes);
}

function downloadImage(data) {
  const link = document.createElement("a");
  link.href = data;
  link.download = "tox_flyer_screenshot.png";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/***************************************************************
 * Function: main
 * Purpose: Entry point of the application.
 * - Calls each setup function in order.
 * - Wraps the initialization steps within a try/catch block for error handling.
 * - Starts the render loop and handles browser window resizes.
 ***************************************************************/
async function main() {
  try {
    Object.defineProperty(window, "config", {
      value: config,
      writable: false, // Prevents modification
      configurable: false // Prevents deletion
    });
    const canvas = configureCanvas("view");
    const engine = await initializeEngine(canvas);
    const scene = setupScene(engine, canvas);
    console.log(scene)
    const compassScene = add3DCompass(scene, engine);

    plotData(scene);

    // Run the render loop to continuously update the scene.
    engine.runRenderLoop(() => {
      scene.render();
      compassScene.render();
    });

    // Handle browser window resize events to adjust the canvas dimension accordingly.
    window.addEventListener("resize", () => {
      engine.resize();
    });

    document.addEventListener("keydown", (evt) => {
      if (evt.key.toLowerCase() === "enter") {
        captureScenes(engine, scene, compassScene);
      }
    });

  } catch (err) {
    // Log any errors during initialization to the console.
    console.log(err);
    document.body.innerHTML = `Error during initialization: ${err}`;
  }
}

// Start the application by calling the main function.
main();
