"use strict";

import {
  Mesh,
  Color,
  Vector,
  Material,
  getInstanceMatrix,
} from "../babylon.js";

const DYNAMIC_THIN_INSTANCE_STEP_SIZE = 1000;

export function setupDynamicThinInstanceMesh(mesh, hasColor=true) {
  mesh.isVisible = false;
  mesh.TOX_metadata = [];
  mesh.TOX_instanceCount = 0;
  mesh.TOX_matrixBuffer = new Float32Array(16 * DYNAMIC_THIN_INSTANCE_STEP_SIZE);
  if (hasColor) {
    mesh.TOX_colorBuffer = new Float32Array(4 * DYNAMIC_THIN_INSTANCE_STEP_SIZE);
  }
}

export function dynamicThinInstanceBufferUpdated(mesh) {
  mesh.thinInstanceSetBuffer("matrix", mesh.TOX_matrixBuffer.subarray(0, mesh.TOX_instanceCount * 16), 16);
  if (mesh.TOX_colorBuffer !== undefined) {
    mesh.thinInstanceSetBuffer("color", mesh.TOX_colorBuffer.subarray(0, mesh.TOX_instanceCount * 4), 4);
  }
  mesh.thinInstanceCount = mesh.TOX_instanceCount;
  mesh.isVisible = mesh.hasThinInstances;
}

function extendDynamicThinInstanceBuffer(oldContents, stride) {
  const newContents = new Float32Array(oldContents.length + DYNAMIC_THIN_INSTANCE_STEP_SIZE * stride);
  newContents.set(oldContents);
  return newContents;
}

function getThinInstanceIndexDynamicBuffer(mesh, family, geneIndex) {
  for (let i = 0; i < mesh.TOX_instanceCount; i++) {
    const data = mesh.TOX_metadata[i];
    if (data.family === family) {
      if (data.geneIndex === geneIndex) {
        return i;
      }
    }
  }
  return null;
}

export function createDynamicThinInstance(mesh, family, geneIndex, instanceMatrix, color) {
  let index = getThinInstanceIndexDynamicBuffer(mesh, family, geneIndex);
  if (index === null) {
    index = mesh.TOX_instanceCount;
    if (mesh.TOX_instanceCount * 16 === mesh.TOX_matrixBuffer.length) {
      mesh.TOX_matrixBuffer = extendDynamicThinInstanceBuffer(mesh.TOX_matrixBuffer, 16);
      if (mesh.TOX_colorBuffer !== undefined) {
        mesh.TOX_colorBuffer = extendDynamicThinInstanceBuffer(mesh.TOX_colorBuffer, 4);
      }
    }
    mesh.TOX_instanceCount++;
  }
  instanceMatrix.copyToArray(mesh.TOX_matrixBuffer, index * 16);
  mesh.TOX_metadata[index] = { family, geneIndex };

  if (mesh.TOX_colorBuffer !== undefined) {
    mesh.TOX_colorBuffer.set(color.asArray(), index * 4);
  }
}

export function removeDynamicThinInstance(mesh, family, geneIndex) {
  const index = getThinInstanceIndexDynamicBuffer(mesh, family, geneIndex);

  if (index !== null) {
    function remove(buffer, stride) {
      const lastInstanceIndex = (mesh.TOX_instanceCount - 1) * stride;
      const removingInstanceIndex = index * stride;
      for (let i = 0; i < stride; i++) {
        buffer[removingInstanceIndex + i] = buffer[lastInstanceIndex + i];
      }
    }

    remove(mesh.TOX_matrixBuffer, 16);

    if (mesh.TOX_colorBuffer !== undefined) {
      remove(mesh.TOX_colorBuffer, 4);
    }

    mesh.TOX_metadata[index] = mesh.TOX_metadata.pop();
    mesh.TOX_instanceCount--;

    return true;
  }
  return false;
}

export function setupFamilyHullMesh(scene) {
  const hull = BABYLON.MeshBuilder.CreateCapsule("hull", {height: 1, radius: 1/3, subdivisions: 2, capSubdivisions: 3}, scene);
  setupDynamicThinInstanceMesh(hull);

  hull.material = Material(scene, null, {wireframe: true});

  function createHull(evt) {
    const { family, gene, value } = evt.detail;
    if (value) {
      const scale = config.get("scale");
      const familyData = dataHandler.getFamilyData(family, config.get("tissueX"), config.get("tissueY"), config.get("tissueZ"));
      const centroid = Vector(...familyData.centroid.map(v => v*scale));
      const stdDevs = familyData.stdDevs.map(v => v*scale);
      const color = Color(config.familyGet(family, "Color")).scale(2);
      color.a /= 2;

      const instanceMatrix = getInstanceMatrix(
        centroid,
        Vector(stdDevs[0] * 3, stdDevs[1] * 2, stdDevs[2] * 3)
      );

      createDynamicThinInstance(hull, family, undefined, instanceMatrix, color);
    } else {
      removeDynamicThinInstance(hull, family);
    }
  }

  document.addEventListener("Hull", createHull);
  document.addEventListener("HullUpdated", () => dynamicThinInstanceBufferUpdated(hull));

  function recreate() {
    for (const { family } of hull.TOX_metadata) {
      config.familySet(family, "Hull", true, undefined, false);
    }
    document.dispatchEvent(new CustomEvent("HullUpdated"));
  }
  for (const setting of ["tissueX", "tissueY", "tissueZ", "scale", "Color", "darkMode"]) {
    document.addEventListener(setting, recreate);
  }
}

export function createVectorPartsInstanceMatrices(family, geneIndex, grow=0) {
  const scale = config.get("scale");
  const tissues = [config.get("tissueX"), config.get("tissueY"), config.get("tissueZ")];

  const centroid = Vector(...dataHandler.getFamilyData(family, ...tissues).centroid.map(v => v*scale));
  const sphereDiameter = config.familyGet(family, "Diameter");

  const { coordinates } = dataHandler.getGeneData(family, geneIndex, tissues, []);
  const genePos = Vector(...coordinates.map(v => v*scale));
  const direction = genePos.subtract(centroid);
  const vectorLength = direction.length() - sphereDiameter / 2;
  const shaftLengthScale = 1 - 2 * sphereDiameter / vectorLength;
  const shaftPosition = centroid.add(direction.scale(shaftLengthScale / 2));
  const headPosition = centroid.add(direction.scale(shaftLengthScale + sphereDiameter / vectorLength / 2));

  return {
    shaft: getInstanceMatrix(
      shaftPosition,
      Vector(sphereDiameter / 2 + grow, vectorLength * shaftLengthScale + grow, sphereDiameter / 2 + grow),
      genePos
    ),
    head: getInstanceMatrix(
      headPosition,
      Vector(sphereDiameter + grow, sphereDiameter * 2 + grow, sphereDiameter + grow),
      genePos
    )
  };
}

export function setupShiftVectorMesh(scene) {
  const shiftVectorShaft = Mesh.Cylinder(scene, "shiftVectorShaft");
  setupDynamicThinInstanceMesh(shiftVectorShaft);
  const shiftVectorHead = Mesh.Cone(scene, "shiftVectorHead");
  setupDynamicThinInstanceMesh(shiftVectorHead);

  document.addEventListener("ShiftVector", evt => {
    const { family, gene, value } = evt.detail;
    if (value) {
      const matrices = createVectorPartsInstanceMatrices(family, gene);

      let color = Color(config.familyGet(family, "Color"));
      const colorScale = 1 / Math.max(color.r, color.g, color.b);
      color = color.scale(colorScale);
      color.a /= colorScale;
      createDynamicThinInstance(shiftVectorShaft, family, gene, matrices.shaft, color);
      createDynamicThinInstance(shiftVectorHead, family, gene, matrices.head, color);
    } else {
      removeDynamicThinInstance(shiftVectorHead, family, gene);
      removeDynamicThinInstance(shiftVectorShaft, family, gene);
    }
  });

  document.addEventListener("ShiftVectorUpdated", () => {
    dynamicThinInstanceBufferUpdated(shiftVectorHead);
    dynamicThinInstanceBufferUpdated(shiftVectorShaft);
  });

  function recreate() {
    for (const { family, geneIndex } of shiftVectorHead.TOX_metadata) {
      config.familySet(family, "ShiftVector", true, geneIndex, false);
    }
    document.dispatchEvent(new CustomEvent("ShiftVectorUpdated"));
  }
  for (const setting of ["tissueX", "tissueY", "tissueZ", "scale", "Diameter", "defaultDiameter", "Color", "darkMode"]) {
    document.addEventListener(setting, recreate);
  }
}

export function setupSelectionMeshes(scene) {
  const meshes = [
    Mesh.Sphere(scene, "pickedSphere"),
    Mesh.Octahedron(scene, "pickedOctahedron"),
    Mesh.Cylinder(scene, "pickedVectorShaft"),
    Mesh.Cone(scene, "pickedVectorHead")
  ];

  const highlightLayer = new BABYLON.HighlightLayer("highlight", scene);

  {
    function setHighlightColor(evt) {
      const color = Color(evt.detail);
      for (const mesh of meshes) {
        highlightLayer.removeMesh(mesh);
        highlightLayer.addMesh(mesh, color);
      }
    }
    document.addEventListener("selectedDataPointColor", setHighlightColor);
    document.addEventListener("darkMode", () => setHighlightColor({ detail: config.get("selectedDataPointColor") }));
    setHighlightColor({ detail: config.get("selectedDataPointColor") });
  }

  const material =  Material(scene, null, {color: Color(0, 0, 0, 0)});

  for (const mesh of meshes) {
    setupDynamicThinInstanceMesh(mesh, false);
    mesh.material = material;
    highlightLayer.setEffectIntensity(mesh, 0.7);
  }
}