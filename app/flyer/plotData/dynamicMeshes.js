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

    mesh.TOX_metadata[index] = mesh.TOX_metadata.at(-1);
    mesh.TOX_metadata.splice(-1);
    mesh.TOX_instanceCount--;

    return true;
  }
  return false;
}

export function setupFamilyHullMesh(scene) {
  const hull = BABYLON.MeshBuilder.CreateCapsule("hull", {height: 1, radius: 1/3, subdivisions: 2, capSubdivisions: 3}, scene);
  setupDynamicThinInstanceMesh(hull);

  hull.material = Material(scene, null, {wireframe: true});

  {
    function create({ family, gene, value }) {
      if (config.familyGet(family, "Visible")) {
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
    }

    config.onChange("Hull", evt => { if (config.familyGet(evt.family, "Visible")) create(evt); }, null);

    function changeVisibility({ family, value }) {
      if (config.familyGet(family, "Hull")) {
        create({ family, value});
      }
    }
    config.onChange("Visible", changeVisibility, null);
  }

  function update() {
    dynamicThinInstanceBufferUpdated(hull);
  }
  config.onChange("Hull", update);
  config.onChange("Visible", update);

  function recreate() {
    hull.TOX_instanceCount = 0;
    for (const { family } of hull.TOX_metadata) {
      config.familySet(family, "Hull", true, undefined, false);
    }
  }
  for (const setting of ["tissueX", "tissueY", "tissueZ", "scale", "Color", "darkMode"]) {
    config.onChange(setting, recreate, 1);
    config.onChange(setting, update);
  }
}

export function createVectorPartsInstanceMatrices(family, geneIndex, grow=0) {
  const scale = config.get("scale");
  const tissues = [config.get("tissueX"), config.get("tissueY"), config.get("tissueZ")];

  const centroid = Vector(...dataHandler.getFamilyData(family, ...tissues).centroid.map(v => v*scale));
  const familyDiameter = config.familyGet(family, "Diameter");
  const sphereDiameter = config.familyGet(family, "Diameter", geneIndex);

  const { coordinates } = dataHandler.getGeneData(family, geneIndex, tissues, []);
  const genePos = Vector(...coordinates.map(v => v*scale));
  const direction = genePos.subtract(centroid);
  const vectorLength = direction.length() - sphereDiameter / 2;
  const headLength = familyDiameter * 2;
  const shaftLength = vectorLength - headLength;
  const shaftPosition = centroid.add(direction.scale(shaftLength / 2 / direction.length()));
  const headPosition = centroid.add(direction.scale((shaftLength + headLength / 2) / direction.length()));

  return {
    shaft: getInstanceMatrix(
      shaftPosition,
      Vector(familyDiameter / 2 + grow, shaftLength + grow, familyDiameter / 2 + grow),
      genePos
    ),
    head: getInstanceMatrix(
      headPosition,
      Vector(familyDiameter + grow, headLength + grow, familyDiameter + grow),
      genePos
    )
  };
}

export function setupShiftVectorMesh(scene) {
  const shiftVectorShaft = Mesh.Cylinder(scene, "shiftVectorShaft");
  setupDynamicThinInstanceMesh(shiftVectorShaft);
  const shiftVectorHead = Mesh.Cone(scene, "shiftVectorHead");
  setupDynamicThinInstanceMesh(shiftVectorHead);

  {
    function create({ family, gene, value }) {
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
    };

    config.onChange("ShiftVector", evt => { if (config.familyGet(evt.family, "Visible")) create(evt); }, null);

    function changeVisibility({ family, value }) {
      for (const gene of dataHandler.genes(family)) {
        if (config.familyGet(family, "ShiftVector", gene)) {
          create({ family, gene, value});
        }
      }
    }
    config.onChange("Visible", changeVisibility, null);
  }

  function update() {
    dynamicThinInstanceBufferUpdated(shiftVectorHead);
    dynamicThinInstanceBufferUpdated(shiftVectorShaft);
  }
  config.onChange("ShiftVector", update);
  config.onChange("Visible", update);

  {
    function recreate() {
      shiftVectorHead.TOX_instanceCount = 0;
      shiftVectorShaft.TOX_instanceCount = 0;
      for (const { family, geneIndex } of shiftVectorHead.TOX_metadata) {
        config.familySet(family, "ShiftVector", true, geneIndex, false);
      }
    }
    for (const setting of ["tissueX", "tissueY", "tissueZ", "scale", "Diameter", "Color", "darkMode"]) {
      config.onChange(setting, recreate, 1);
      config.onChange(setting, update);
    }
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
    function setHighlightColor({ value }) {
      const color = Color(value);
      for (const mesh of meshes) {
        highlightLayer.removeMesh(mesh);
        highlightLayer.addMesh(mesh, color);
      }
    }
    config.onChange("selectedDataPointColor", setHighlightColor);
  }

  const material =  Material(scene, null, {color: Color(0, 0, 0, 0)});

  for (const mesh of meshes) {
    setupDynamicThinInstanceMesh(mesh, false);
    mesh.material = material;
    highlightLayer.setEffectIntensity(mesh, 0.7);
  }
}