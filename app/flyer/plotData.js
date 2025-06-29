"use strict";

import { getChunks } from "./chunks.js";
import {
  Mesh,
  Color,
  Vector,
  TransformNode,
  calcVectorDistance,
  Material,
  fillThinInstanceBuffers
} from "./babylon.js";

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
  setupSelectionMesh(scene);
  setupFamilyHullMesh(scene);
  setupShiftVectorMesh(scene);

  const chunks = getChunks(scene);

  document.addEventListener("chunkReload", (evt) => {
    chunks.recalculate();
    chunks.load();
    setupFamilyHullMesh(scene);
    setupShiftVectorMesh(scene);
    scene.getMeshByName("meshSelectedPoints").TOX_update();
  })

  let picked = null;
  scene.onPointerObservable.add((evt) => {
    switch (evt.type) {
      case BABYLON.PointerEventTypes.POINTERTAP:
        picked = pickFromMeshes(chunks);
        if (picked !== null) {
          const selected = scene.getMeshByName("meshSelectedPoints");
          if (!selected.TOX_unpick(picked.family, picked.geneIndex)) {
            selected.TOX_pick(picked.family, picked.geneIndex);
          }
        }
        break;
      case BABYLON.PointerEventTypes.POINTERDOUBLETAP:
        if (picked !== null) {
          const selected = scene.getMeshByName("meshSelectedPoints");
          const wasSelected = selected.TOX_unpick(picked.family, picked.geneIndex);
          if (!wasSelected) {
            selected.TOX_unpick(picked.family);
          } else {
            selected.TOX_pick(picked.family);
          }
        }
        break;
    }
  });
}

function setupFamilyHullMesh(scene) {
  scene.getMeshByName("hull")?.dispose();
  const families = (config.get("shownFamilies") ?? dataHandler.families).filter((family) => config.get(`${family}_Hull`));
  if (families.length > 0) {
    const scale = config.get("scale");
    const tissues = [config.get("tissueX"), config.get("tissueY"), config.get("tissueZ")];

    const hull = BABYLON.MeshBuilder.CreateCapsule("hull", {height: 1, radius: 1/3, subdivisions: 2, capSubdivisions: 3}, scene);
    hull.material = Material(scene, null, {wireframe: true});

    const dimensionsBuffer = new Float32Array(families.length * 16);
    const colorBuffer = new Float32Array(families.length * 4);

    families.forEach((family, i) => {
      const centroid = Vector(...dataHandler.getCentroid(family, ...tissues).map(v => v*scale));
      const sphereDiameter = config.get(`${family}_Diameter`) ?? config.get("defaultDiameter");

      // calculate farthest data point from centroid
      let farthestSpherePos = centroid;
      let farthestDist = 0;
      const geneCount = dataHandler.getGeneCount(family);
      for (let geneIndex = 0; geneIndex < geneCount; geneIndex++) {
        const { is_outlier, coordinates } = dataHandler.getGeneData(family, geneIndex, tissues, ["is_outlier"]);
        if (!is_outlier) {
          const genePos = Vector(...coordinates.map(v => v*scale));
          const distance = calcVectorDistance(centroid, genePos)
          if (distance > farthestDist) {
            farthestDist = distance;
            farthestSpherePos = genePos;
          }
        }
      }

      // calculate farthest point from line centroid-farthestSphere
      const lengthVector = farthestSpherePos.subtract(centroid).normalize();
      let radius = 0;
      for (let geneIndex = 0; geneIndex < geneCount; geneIndex++) {
        const { is_outlier, coordinates } = dataHandler.getGeneData(family, geneIndex, tissues, ["is_outlier"]);
        if (!is_outlier) {
          const genePos = Vector(...coordinates.map(v => v*scale));
          const centroidToGene = genePos.subtract(centroid);
          const projectionLength = BABYLON.Vector3.Dot(centroidToGene, lengthVector);
          const projectionVector = lengthVector.scale(projectionLength);
          const heightVector = centroidToGene.subtract(projectionVector);
          const height = heightVector.length();
          if (height > radius) {
            radius = height;
          }
        }
      }

      const length = 2*(farthestDist + sphereDiameter);
      const width = 3*(radius + sphereDiameter);

      const color = Color(config.get(family + "_Color") ?? dataHandler.getColor(family)).scale(2);
      fillThinInstanceBuffers(
        dimensionsBuffer, i * 16,
        {
          position: centroid,
          scaling: Vector(width, length, width),
          target: farthestSpherePos
        },
        colorBuffer, i * 4,
        color
      );

      hull.thinInstanceSetBuffer("matrix", dimensionsBuffer, 16);
      hull.thinInstanceSetBuffer("color", colorBuffer, 4);
    });
  }
}

function setupShiftVectorMesh(scene) {
  scene.getMeshByName("shiftVectorShaft")?.dispose();
  scene.getMeshByName("shiftVectorHead")?.dispose();

  const families = config.get("shownFamilies") ?? dataHandler.families;
  const vectorCount = families.reduce((a, family) => {
    const geneCount = dataHandler.getGeneCount(family);
    for (let geneIndex = 0; geneIndex < geneCount; geneIndex++) {
      if (config.get(`${family}_ShiftVector:${geneIndex}`)) {
        a++;
      }
    }
    return a;
  }, 0);
  if (vectorCount > 0) {
    const scale = config.get("scale");
    const tissues = [config.get("tissueX"), config.get("tissueY"), config.get("tissueZ")];

    const dimensionBuffers = {
      shaft: new Float32Array(families.length * 16),
      head: new Float32Array(families.length * 16)
    }
    const colorBuffer = new Float32Array(families.length * 4);

    let bufferIndex = 0;
    for (const family of families) {
      let color = Color(config.get(family + "_Color") ?? dataHandler.getColor(family));
      color = color.scale(1 / Math.max(color.r, color.g, color.b));
      const centroid = Vector(...dataHandler.getCentroid(family, ...tissues).map(v => v*scale));
      const sphereDiameter = config.get(`${family}_Diameter`) ?? config.get("defaultDiameter");

      const geneCount = dataHandler.getGeneCount(family);
      for (let geneIndex = 0; geneIndex < geneCount; geneIndex++) {
        if (config.get(`${family}_ShiftVector:${geneIndex}`)) {
          const { coordinates } = dataHandler.getGeneData(family, geneIndex, tissues, []);
          const genePos = Vector(...coordinates.map(v => v*scale));
          const direction = genePos.subtract(centroid);
          const vectorLength = direction.length();
          const shaftLengthScale = 1 - 2.5 * sphereDiameter / vectorLength;
          const shaftPosition = centroid.add(direction.scale(shaftLengthScale / 2));
          const headPosition = centroid.add(direction.scale(1 - 1.5 * sphereDiameter / vectorLength));

          // create shaft
          fillThinInstanceBuffers(
            dimensionBuffers.shaft, bufferIndex * 16,
            {
              position: shaftPosition,
              scaling: Vector(sphereDiameter / 2, vectorLength * shaftLengthScale, sphereDiameter / 2),
              target: genePos
            },
            colorBuffer, bufferIndex * 4,
            color
          );
          // create head
          fillThinInstanceBuffers(
            dimensionBuffers.head, bufferIndex * 16,
            {
              position: headPosition,
              scaling: Vector(sphereDiameter, sphereDiameter * 2, sphereDiameter),
              target: genePos
            },
            colorBuffer, bufferIndex * 4,
            color
          );
          bufferIndex++;
        }
      }
    }
    const shiftVectorShaft = BABYLON.MeshBuilder.CreateCylinder("shiftVectorShaft", {height: 1}, scene);
    shiftVectorShaft.thinInstanceSetBuffer("matrix", dimensionBuffers.shaft, 16);
    shiftVectorShaft.thinInstanceSetBuffer("color", colorBuffer, 4);
    const shiftVectorHead = BABYLON.MeshBuilder.CreateCylinder("shiftVectorHead", {height: 1, diameterTop: 0}, scene);
    shiftVectorHead.thinInstanceSetBuffer("matrix", dimensionBuffers.head, 16);
    shiftVectorHead.thinInstanceSetBuffer("color", new Float32Array(colorBuffer), 4);
  }
}

function setupSelectionMesh(scene) {
  const highlightLayer = new BABYLON.HighlightLayer("highlight", scene);
  const meshSelectedPoints = Mesh.Sphere(scene, "meshSelectedPoints");

  config.setSetterCallback("selectedDataPointColor", hexColorCode => {
    highlightLayer.removeMesh(meshSelectedPoints);
    highlightLayer.addMesh(meshSelectedPoints, Color(hexColorCode));
  })
  highlightLayer.setEffectIntensity(meshSelectedPoints, 0.7);

  // disable as long as spheres are picked
  highlightLayer.isEnabled = false;

  meshSelectedPoints.material = Material(scene, null, {color: Color(0, 0, 0, 0)});
  Mesh.setSize(meshSelectedPoints, 0); // hide initial instance
  meshSelectedPoints.TOX_pick = function (family, geneIndex) {
    const scale = config.get("scale");
    const inlierDiameter = config.get(`${family}_Diameter`) ?? config.get("defaultDiameter");
    const outlierDiameter = config.get(`${family}_OutlierDiameter`) ?? config.get("defaultDiameter");
    const tissues = [config.get("tissueX"), config.get("tissueY"), config.get("tissueZ")];

    const pickOne = (geneIndex) => {
      const { is_outlier, coordinates } = dataHandler.getGeneData(family, geneIndex, tissues, ["is_outlier"]);
      const instance = this.createInstance();
      instance.position = Vector(...coordinates.map(v => v * scale));
      instance.TOX_family = family;
      instance.TOX_geneIndex = geneIndex;
      const diameter = is_outlier ? outlierDiameter : inlierDiameter;
      Mesh.setSize(instance, diameter + 0.001); // slightly larger so the highlightLayer can truly distinguish it from the actual sphere
      instance.freezeWorldMatrix();
    }
    this.TOX_unpick(family, geneIndex);

    if (geneIndex !== undefined) {
      pickOne(geneIndex);
    } else {
      const geneCount = dataHandler.getGeneCount(family);
      for (let geneIndex = 0; geneIndex < geneCount; geneIndex++) {
        pickOne(geneIndex);
      }
    }
    highlightLayer.isEnabled = true;
  }
  meshSelectedPoints.TOX_unpick = function (family, geneIndex) {
    const instances = this.instances.filter(i => ((i.TOX_family === family) || (family === undefined)) && ((geneIndex === undefined) || (i.TOX_geneIndex === geneIndex)))
    for (const instance of instances) {
      if (this.instances.length === 1) {
        highlightLayer.isEnabled = false;
      }
      instance.dispose();
    }
    return instances.length;
  }
  meshSelectedPoints.TOX_update = function () {
    for (const instance of [...this.instances]) {
      this.TOX_pick(instance.TOX_family, instance.TOX_geneIndex);
    }
  }

  // initially fetch picked instances from config and set them up
  new Promise(resolve => {
    document.dispatchEvent(new CustomEvent("initializePicked", { detail: resolve }));
  }).then(picked => {
    try {
      if (typeof picked === "object") {
        for (const [family, genes] of Object.entries(picked)) {
          for (const geneIndex of genes) {
            meshSelectedPoints.TOX_pick(family, geneIndex);
          }
        }
      }
    } catch {
      console.error("Could not restore picked elements");;
    }
  })

  // send picked instances to config
  document.addEventListener("feedConfig", (evt) => {
    const picked = {};
    for (const instance of meshSelectedPoints.instances) {
      picked[instance.TOX_family] ??= [];
      picked[instance.TOX_family].push(instance.TOX_geneIndex);
    }
    evt.detail.meshSelectedPoints(picked);
  })
}

function pickFromMeshes(chunks) {
  const pickRay = chunks.scene.createPickingRay(
    chunks.scene.pointerX, chunks.scene.pointerY,
    BABYLON.Matrix.Identity(),    // you can pass other transforms if you want
    chunks.scene.activeCamera
  );


  let closestDist = Infinity;
  let picked = null;
  for (const chunkCentroid of chunks.active) {
    const meshes = chunks.chunks.get(chunkCentroid)[2];
    for (const [meshType, mesh] of meshes) {
      const sphereMatrices = mesh.thinInstanceGetWorldMatrices(); 

      for (const i in sphereMatrices) {
        const matrix = sphereMatrices[i].m;
        // extract translation
        const tx = matrix[12];
        const ty = matrix[13];
        const tz = matrix[14];
        const spherePosition = Vector(tx, ty, tz);

        const intersects = pickRay.intersectsSphere(
          { center: spherePosition, radius: matrix[0] / 2 }
        );
        if (intersects) {
          const distance = calcVectorDistance(chunks.scene.activeCamera.position, spherePosition);
          if (distance < closestDist) {
            closestDist = distance;
            picked = {
              position: spherePosition,
              diameter: matrix[0],
              index: i,
              meshType,
              chunkCentroid
            }
          }
        }
      }
    }
  }

  if (picked) {
    const [genes] = chunks.chunks.get(picked.chunkCentroid);
    let pickedIndex = picked.index;
    switch (picked.meshType) {
      case "centroids": {
        for (const [family, members] of genes) {
          if (pickedIndex === 0) {
            console.log(`Picked centroid of family '${family}'`);
            return null;
          }
          pickedIndex -= Boolean(members.centroids)
        }
      }
      case "inliers":
      case "outliers": {
        for (const [family, members] of genes) {
          const indices = members[picked.meshType];
          if (indices) {
            pickedIndex -= indices.length;
            if (pickedIndex < 0) {
              picked.family = family;
              picked.geneIndex = indices[pickedIndex + indices.length];
              break;
            }
          }
        }
      }
    }
  }
  return picked;
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

export { plotData };