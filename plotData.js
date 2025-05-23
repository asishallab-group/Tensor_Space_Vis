"use strict";

import { handler as dataHandler } from "./dataHandler.js";

/**
 * Function: create3DGrid
 * Purpose: Creates a 3D grid with customizable size and density.
 * - Useful for visualizing spatial boundaries in a 3D plot.
 * @param {BABYLON.Scene} scene - The Babylon.js scene where the grid will be added.
 * @param {number} size - The total size of the grid (length of each axis).
 * @param {number} step - The spacing between grid lines.
 */
function create3DGrid(scene, size = 100, step = 10) {
  // Create a parent node to group all grid lines for easy management.
  const gridParent = new BABYLON.TransformNode("gridParent", scene);

  // Helper function to create a single line.
  function createLine(start, end, color) {
    const line = BABYLON.MeshBuilder.CreateLines("line", { points: [start, end] }, scene);
    const material = new BABYLON.StandardMaterial("lineMat", scene);
    material.emissiveColor = color; // Use emissive color to make lines bright.
    material.disableLighting = true; // Lines are unaffected by scene lighting.
    material.alpha = 0.2;
    line.material = material;
    line.parent = gridParent; // Attach the line to the parent node.
  }

  // Create grid lines parallel to each axis.
  const halfSize = size / 2;
  const color = BABYLON.Color3.Gray(); // Default color for grid lines.

  // Lines along the X-axis.
  for (let a = -halfSize; a <= halfSize; a += step) {
    for (let b = -halfSize; b <= halfSize; b += step) {
      // along x axis
      createLine(
        new BABYLON.Vector3(-halfSize, a, b), // Start point
        new BABYLON.Vector3(halfSize, a, b),  // End point
        color
      );
      // along y axis
      createLine(
        new BABYLON.Vector3(a, -halfSize, b), // Start point
        new BABYLON.Vector3(a, halfSize, b),  // End point
        color
      );
      // along z axis
      createLine(
        new BABYLON.Vector3(a, b, -halfSize), // Start point
        new BABYLON.Vector3(a, b, halfSize),  // End point
        color
      );
    }
  }

  return gridParent; // Return the parent node containing all grid lines.
}

/**
 * Plots data points in the scene by instancing a base sphere mesh onto different chunks.
 * 
 * Data points are grouped into "chunks" based on spatial positions determined by a chunk diameter.
 * Chunks that fall outside a defined sight range relative to the config coordinates are disabled,
 * and an update function dynamically loads/unloads chunks as the config position (e.g. camera)
 * changes. A 3D grid is also created for visual reference.
 *
 * @param {BABYLON.Scene} scene - The BabylonJS scene in which to plot the data.
 */
function plotData(scene) {
  // get the initial position
  const posX = scene.activeCamera.position.x;
  const posY = scene.activeCamera.position.y;
  const posZ = scene.activeCamera.position.z;

  // Diameter of each chunk in world units.
  let chunkDiameter = config.get("chunkDiameter");

  // Range (in number of chunks) around the current chunk that should be loaded.
  let chunkLoadRange = config.get("chunkLoadRange");

  // The maximum distance (in world units) to load/unload chunks.
  let lastChunkDist = chunkLoadRange * chunkDiameter;

  // Each key in this object corresponds to a chunk's centroid in string form.
  let [ chunks, activeChunks ] = calculateChunks(posX, posY, posZ, chunkDiameter, chunkLoadRange);

  for (const chunk of activeChunks) {
    loadChunk(scene, chunks[chunk]);
  }

  document.addEventListener("chunkReload", (evt) => {
    [chunks, activeChunks, chunkDiameter, chunkLoadRange] = reloadChunks(scene, chunks, activeChunks);
    lastChunkDist = chunkLoadRange * chunkDiameter;
  })

  // Determine the initial chunk centroid based on the config position.
  // This represents the "active" chunk coordinates in which data is loaded.
  let chunkCentroid = getChunkCentroid([posX, posY, posZ], chunkDiameter);

  // Temporary array used to compute the centroid for chunks that need updating.
  // This array is reused within the render loop for efficiency.
  const triggeredChunkCentroid = [0, 0, 0];

  /**
   * Register a callback that fires before every render.
   * This callback compares the current chunk centroid (from config)
   * with the previous one and determines which neighboring chunks need to be loaded/unloaded.
   */
  scene.registerBeforeRender(() => {
    // Get the current chunk centroid from the config position.
    const currentChunkCentroid = getChunkCentroid(
      [ scene.activeCamera.position.x, scene.activeCamera.position.y, scene.activeCamera.position.z ],
      chunkDiameter
    );

    // Loop through each axis (x, y, z) and detect any change in the chunk centroid.
    // If a change is detected along an axis, adjust chunks along that axis.
    chunkCentroid.forEach((axis, i) => {
      const currentAxis = currentChunkCentroid[i];
      // Only proceed if the coordinate along this axis has changed.
      if (currentAxis !== axis) {

        // Determine the direction of movement on the changed axis.
        // If currentAxis > axis then we are moving positively (direction = 1) else negatively (direction = -1).
        const direction = currentAxis > axis ? 1 : -1;

        // Loop over all possible offsets on the remaining two axes (j and k)
        // covering the range from -lastChunkDist to lastChunkDist (in steps of chunkDiameter).
        for (let aAxis = -lastChunkDist; aAxis <= lastChunkDist; aAxis += chunkDiameter) {
          // Calculate the index for the first non-changing axis.
          const j = (i + 1) % 3;
          triggeredChunkCentroid[j] = chunkCentroid[j] + aAxis;
          for (let bAxis = -lastChunkDist; bAxis <= lastChunkDist; bAxis += chunkDiameter) {
            // Calculate the index for the second non-changing axis.
            const k = (i + 2) % 3;
            triggeredChunkCentroid[k] = chunkCentroid[k] + bAxis;

            // For the changing axis, first compute the position for the chunk that should be loaded,
            // i.e. the new chunk in range along this axis.
            triggeredChunkCentroid[i] = currentAxis + direction * lastChunkDist;
            // Call loadChunk with a flag "true" to enable the chunk.
            loadChunk(scene, chunks[triggeredChunkCentroid], true);
            activeChunks.push(triggeredChunkCentroid.toString());

            // Next, compute the position for the chunk that should be disabled,
            // i.e. the chunk that is no longer within range, so on the complementary side.
            triggeredChunkCentroid[i] = axis - direction * lastChunkDist;
            // Call loadChunk with the flag "false" to disable the chunk.
            loadChunk(scene, chunks[triggeredChunkCentroid], false);
            const chunkIndex = activeChunks.indexOf(triggeredChunkCentroid.toString());
            if (chunkIndex !== -1) {
              activeChunks.splice(chunkIndex, 1);
            }
          }
        }
      }
    });
    // Update the chunkCentroid to the current value for use in the next frame.
    chunkCentroid = currentChunkCentroid;
  });

  // Create a 3D grid in the scene for improving interpretability.
  create3DGrid(scene);
}

function reloadChunks(scene, chunks, activeChunks) {
  clearChunks(scene, chunks, activeChunks);
  const chunkDiameter = config.get("chunkDiameter");
  const chunkLoadRange = config.get("chunkLoadRange");
  const [newChunks, newActiveChunks] = calculateChunks(
    scene.activeCamera.position.x,
    scene.activeCamera.position.y,
    scene.activeCamera.position.z,
    chunkDiameter,
    chunkLoadRange
  );
  for (const chunk of newActiveChunks) {
    loadChunk(scene, newChunks[chunk]);
  }
  return [newChunks, newActiveChunks, chunkDiameter, chunkLoadRange];
}

function clearChunks(scene, chunks, activeChunks) {
  for (const chunk of activeChunks) {
    loadChunk(scene, chunks[chunk], false);
  }
}

function calculateChunks(posX, posY, posZ, chunkDiameter, chunkLoadRange) {
  // Each key in this object corresponds to a chunk's centroid in string form.
  const chunks = {};

  // Define the "sight" range: the distance threshold (in world units) used to decide whether a chunk is visible.
  // The value includes an extra 0.5 chunk diameter margin.
  const sight = (chunkLoadRange + 0.5) * chunkDiameter;

  const activeChunks = [];

  const tissueX = config.get("tissueX");
  const tissueY = config.get("tissueY");
  const tissueZ = config.get("tissueZ");

  const scale = config.get("scale");
  const familiesToShow = config.get("shownFamilies") ?? dataHandler.families;

  // Loop through each family available in the data handler.
  // For each family, iterate through the genes for specific tissues
  // and create an instance of the outlier mesh for each data point.
  for (const family of familiesToShow) {
    for (const { coordinates, ...metaData } of dataHandler.iterGenes(family, tissueX, tissueY, tissueZ)) {
      const scaled = coordinates.map((v) => v*scale);

      // Determine the centroid of the chunk this position falls into.
      // getChunkCentroid is assumed to return an array-like coordinate (e.g. [x, y, z])
      // which is also used as a key in the `chunks` object.
      const chunk = getChunkCentroid(scaled, chunkDiameter);

      if (chunks[chunk] === undefined) {
        chunks[chunk] = [[], {}, 0, null, null];
        if (
          Math.abs(chunk[0] - posX) < sight &&
          Math.abs(chunk[1] - posY) < sight &&
          Math.abs(chunk[2] - posZ) < sight
        ) {
          activeChunks.push(chunk.toString());
        }
      }
      chunks[chunk][0].push({ coordinates: scaled, ...metaData });
      chunks[chunk][1][family] ??= 0;
      chunks[chunk][1][family]++;
      chunks[chunk][2] += metaData.is_outlier;
    }
  }

  return [ chunks, activeChunks ]
}

function getChunkCentroid([ x, y, z ], diameter) {
  function trim(a) {
    return Math.floor((a + diameter / 2) / diameter) * diameter;
  }
  return [trim(x), trim(y), trim(z)];
}

function loadChunk(scene, chunkData, state=true) {
  if (chunkData) {
    if (state) {
      const [dataPoints, memberCounts, outlierCount, ...meshes] = chunkData;

      for (const mesh of meshes) {
        mesh?.dispose();
      }

      // data points -- spheres
      const sphereDimensionsBuffer = new Float32Array(16 * (dataPoints.length - outlierCount)); // the translation buffer for one position takes 16 entries (it is a 4x4 rotation matrix)
      const sphereColorBuffer = new Float32Array(4 * (dataPoints.length - outlierCount)); // rgba
      if (sphereColorBuffer.length > 0) { // false if all members are outliers
        chunkData[3] = BABYLON.MeshBuilder.CreateSphere(name, { diameter: 1, segments: 16 }, scene);
      }

      // outliers -- octahedrons
      const octDimensionsBuffer = new Float32Array(16 * outlierCount); // the translation buffer for one position takes 16 entries (it is a 4x4 rotation matrix)
      const octColorBuffer = new Float32Array(4 * outlierCount); // rgba
      if (outlierCount > 0) {
        chunkData[4] = BABYLON.MeshBuilder.CreatePolyhedron(name, { type: 2, size: 0.5, flat: false }, scene);
        chunkData[4].enableEdgesRendering();
        chunkData[4].edgesWidth = 3;
        chunkData[4].edgesColor = new BABYLON.Color4(0, 0, 0, 1); // Black edges
        chunkData[4].edgesShareWithThinInstances = true;
      }

      let familyIndex = 0;
      let outlierIndex = 0;
      Object.entries(memberCounts).forEach(([family, chunkMemberCount]) => {
        const familyColor = BABYLON.Color4.FromHexString(config.get(`${family}_Color`) ?? dataHandler.getColor(family));
        const outlierColorHex = config.get(`${family}_OutlierColor`);
        const outlierColor = outlierColorHex === undefined ? familyColor : BABYLON.Color4.FromHexString(outlierColorHex);
        for (let i = 0; i < chunkMemberCount; i++) {
          const index = familyIndex + i;
          const pointData = dataPoints[index]
          if (pointData.is_outlier) {
            const diameter = config.get(`${family}_OutlierDiameter`) ?? 0.25;
            fillThinInstanceBuffers(
              octDimensionsBuffer, outlierIndex * 16,
              octColorBuffer, outlierIndex * 4,
              diameter,
              pointData.coordinates,
              outlierColor
            );
            outlierIndex++;
          } else {
            const diameter = config.get(`${family}_Diameter`) ?? 0.25;
            fillThinInstanceBuffers(
              sphereDimensionsBuffer, (index - outlierIndex) * 16,
              sphereColorBuffer, (index - outlierIndex) * 4,
              diameter,
              pointData.coordinates,
              familyColor
            );
          }
        }
        familyIndex += chunkMemberCount;
      });

      chunkData[3]?.thinInstanceSetBuffer("matrix", sphereDimensionsBuffer, 16);
      chunkData[3]?.thinInstanceSetBuffer("color", sphereColorBuffer, 4);
      chunkData[4]?.thinInstanceSetBuffer("matrix", octDimensionsBuffer, 16);
      chunkData[4]?.thinInstanceSetBuffer("color", octColorBuffer, 4);
    } else {
      for (let i = chunkData.length - 2; i < chunkData.length; i++) {
        chunkData[i]?.dispose();
        chunkData[i] = null;
      }
    }
  }
}

function fillThinInstanceBuffers(dimensionsBuffer, dIndex, colorBuffer, cIndex, diameter, [x, y, z], color) {
  dimensionsBuffer[dIndex] = diameter; // set x scale
  dimensionsBuffer[dIndex + 5] = diameter; // set y scale
  dimensionsBuffer[dIndex + 10] = diameter; // set z scale

  dimensionsBuffer[dIndex + 12] = x;
  dimensionsBuffer[dIndex + 13] = y;
  dimensionsBuffer[dIndex + 14] = z;

  dimensionsBuffer[dIndex + 15] = 1;
  // the unchanged indices affect the rotation of the sphere -> zero 

  // setting color
  colorBuffer[cIndex++] = color.r;
  colorBuffer[cIndex++] = color.g;
  colorBuffer[cIndex++] = color.b;
  colorBuffer[cIndex] = color.a;
}

function createSphereMesh(scene, name, configColorAttribute, configDiameterAttribute) {
  const mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter: 1, segments: 16 }, scene);

  // Create and assign a blue material for the spheres.
  const sphereMaterial = new BABYLON.StandardMaterial(name + "Mat", scene);
  mesh.material = sphereMaterial;

  // set size
  if (configDiameterAttribute) {
    config.setSetterCallback(configDiameterAttribute, (diameter) => {
      setSphereSize(mesh, diameter);
      for (const instance of mesh.instances) {
        setSphereSize(instance, diameter);
      }
    })
  }

  // set color
  config.setSetterCallback(configColorAttribute, (hexColorCode) => {
    setSphereColor(mesh, hexColorCode);
  });

  // Hide the original sphere since we will use instances.
  mesh.isVisible = false;

  mesh.dataPoint = function (name, position) {
    const instance = this.createInstance(name);
    instance.position = position;
    instance.actionManager = this.actionManager;
    return instance;
  }

  // Enable pointer interactions by attaching an ActionManager to each instance.
  mesh.actionManager = new BABYLON.ActionManager(scene);

  // Register a click action to select a sphere.
  mesh.actionManager.registerAction(
    new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function (evt) {
      const instance = evt.source;
      const meshSelectedPoints = scene.getMeshByName("meshSelectedPoints");
      if (instance.TOX_unselectedInstance === undefined) {
        // Create an instance of meshSelectedPoints
        const selectedInstance = meshSelectedPoints.dataPoint(instance.name + "_selected", instance.position);
        selectedInstance.scaling = instance.scaling;

        // Hide instance
        instance.setEnabled(false);
        selectedInstance.TOX_unselectedInstance = instance;
      } else {
        instance.TOX_unselectedInstance.setEnabled(true);

        instance.dispose();
      }
    })
  );

  setupTooltip(scene, mesh);

  return mesh;
}

function setSphereSize(sphere, diameter) {
  sphere.scaling = new BABYLON.Vector3(diameter, diameter, diameter);
}

function setSphereColor(sphere, color) {
  sphere.material.diffuseColor = BABYLON.Color4.FromHexString(color);
  sphere.material.alpha = sphere.material.diffuseColor.a;
}

/***************************************************************
 * Function: setupTooltipFollow
 * Purpose: Make the tooltip div follow the mouse pointer.
 * - Listens for mousemove events on the canvas.
 * - Offsets the tooltip by a few pixels from the pointer for better visibility.
 ***************************************************************/
function setupTooltip(scene, mesh) {
  // Register a hover action to display a tooltip with the data values.
  const datapointDiv = document.getElementById("datapoint");
  mesh.actionManager.registerAction(
    new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, function (evt) {
      const dataPoint = evt.source;
      if (dataPoint) {
        datapointDiv.style.display = "block";
        document.body.style.cursor = "pointer";
        // Format the tooltip content with two decimal places.
        datapointDiv.innerHTML = "x: " + dataPoint.position.x.toFixed(2) + 
                               "<br>y: " + dataPoint.position.y.toFixed(2) + 
                               "<br>z: " + dataPoint.position.z.toFixed(2);
      }
    })
  );

  // Hide the tooltip when the pointer leaves the sphere.
  mesh.actionManager.registerAction(
    new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, function () {
      datapointDiv.style.display = "none";
      document.body.style.cursor = "unset";
    })
  );

  scene.getEngine().getRenderingCanvas().addEventListener("mousemove", function (evt) {
    datapointDiv.style.left = (evt.clientX + 10) + "px";
    datapointDiv.style.top = (evt.clientY + 10) + "px";
  });
}

export { plotData, createSphereMesh };