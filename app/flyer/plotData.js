"use strict";

import { getChunks } from "./chunks.js";
import { createTooltip, removeTooltip } from "./gui.js";
import {
  Mesh,
  Color,
  Vector,
  TransformNode,
  Material,
  fillThinInstanceBuffers,
  getInstanceMatrix
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
  setupSelectionMeshes(scene);
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
      case BABYLON.PointerEventTypes.POINTERDOWN:
        removeTooltip();
        break;
      case BABYLON.PointerEventTypes.POINTERTAP:
        picked = pickFromMeshes(chunks);
        if (picked !== null) {
          switch (picked.type) {
            case "gene": {
              if (!unpickInstance(picked)) {
                pickInstance(picked);
                const geneData = dataHandler.getGeneData(picked.family, picked.geneIndex, chunks.tissues, ["genes", "species"]);
                createTooltip(evt.event.clientX, evt.event.clientY,
                  "Data Point<table><tbody>" +
                  `<tr><td>Gene:</td><td>${geneData.genes}</td></tr>` +
                  `<tr><td>Species:</td><td>${geneData.species}</td></tr>` +
                  `<tr><td>${chunks.tissues[0]}:</td><td>${geneData.coordinates[0].toFixed(2)}</td></tr>` +
                  `<tr><td>${chunks.tissues[1]}:</td><td>${geneData.coordinates[1].toFixed(2)}</td></tr>` +
                  `<tr><td>${chunks.tissues[2]}:</td><td>${geneData.coordinates[2].toFixed(2)}</td></tr>` +
                  "</tbody></table>"
                );
              }
              break;
            }
            case "centroid": {
              // const selected = scene.getMeshByName("meshSelectedCentroids");
              if (!unpickInstance(picked)) {
                pickInstance(picked);
                const { centroid } = dataHandler.getFamilyData(picked.family, ...chunks.tissues);
                createTooltip(evt.event.clientX, evt.event.clientY,
                  "Centroid<table><tbody>" +
                  `<tr><td>Family:</td><td>${dataHandler.getFamilyIDs(picked.family)[0]}</td></tr>` +
                  `<tr><td>${chunks.tissues[0]}:</td><td>${centroid[0].toFixed(2)}</td></tr>` +
                  `<tr><td>${chunks.tissues[1]}:</td><td>${centroid[1].toFixed(2)}</td></tr>` +
                  `<tr><td>${chunks.tissues[2]}:</td><td>${centroid[2].toFixed(2)}</td></tr>` +
                  "</tbody></table>"
                );
              }
              break;
            }
          }
        } else {
          removeTooltip();
        }
        break;
      case BABYLON.PointerEventTypes.POINTERDOUBLETAP:
        // // should pick/unpick all instances of a family, TODO, not yet working
        // if (picked !== null) {
        //   // if unpick was successful, so it was picked already, the original pick was initiated by the simultaneously triggered POINTERTAP
        //   const wasUnselected = unpickInstance(picked);
        //   if (!wasUnselected) {
        //     unpickInstance(picked);
        //   } else {
        //     pickInstance(picked);
        //     createTooltip(evt.event.clientX, evt.event.clientY,
        //       "Family<table><tbody>" +
        //       `<tr><td>Family:</td><td>${dataHandler.getFamilyIDs(picked.family)[0]}</td></tr>` +
        //       `<tr><td>Members:</td><td>${dataHandler.getGeneCount(picked.family)}</td></tr>` +
        //       "</tbody></table>"
        //     );
        //   }
        // }
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
      const familyData = dataHandler.getFamilyData(family, ...tissues);
      const centroid = Vector(...familyData.centroid.map(v => v*scale));
      const stdDevs = familyData.stdDevs.map(v => v*scale);
      const color = Color(config.get(family + "_Color") ?? dataHandler.getColor(family)).scale(2);
      fillThinInstanceBuffers(
        dimensionsBuffer, i * 16,
        {
          position: centroid,
          scaling: Vector(stdDevs[0] * 3, stdDevs[1] * 2, stdDevs[2] * 3)
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
    for (const geneIndex of dataHandler.genes(family)) {
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
      shaft: new Float32Array(vectorCount * 16),
      head: new Float32Array(vectorCount * 16)
    }
    const colorBuffer = new Float32Array(vectorCount * 4);

    let bufferIndex = 0;
    for (const family of families) {
      let color = Color(config.get(family + "_Color") ?? dataHandler.getColor(family));
      color = color.scale(1 / Math.max(color.r, color.g, color.b));
      const centroid = Vector(...dataHandler.getFamilyData(family, ...tissues).centroid.map(v => v*scale));
      const sphereDiameter = config.get(`${family}_Diameter`) ?? config.get("defaultDiameter");

      for (const geneIndex of dataHandler.genes(family)) {
        if (config.get(`${family}_ShiftVector:${geneIndex}`)) {
          const { coordinates } = dataHandler.getGeneData(family, geneIndex, tissues, []);
          const genePos = Vector(...coordinates.map(v => v*scale));
          const direction = genePos.subtract(centroid);
          const vectorLength = direction.length() - sphereDiameter / 2;
          const shaftLengthScale = 1 - 2 * sphereDiameter / vectorLength;
          const shaftPosition = centroid.add(direction.scale(shaftLengthScale / 2));
          const headPosition = centroid.add(direction.scale(shaftLengthScale + sphereDiameter / vectorLength / 2));

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
    const shiftVectorShaft = Mesh.Cylinder(scene, "shiftVectorShaft");
    shiftVectorShaft.thinInstanceSetBuffer("matrix", dimensionBuffers.shaft, 16);
    shiftVectorShaft.thinInstanceSetBuffer("color", colorBuffer, 4);
    const shiftVectorHead = Mesh.Cone(scene, "shiftVectorHead");
    shiftVectorHead.thinInstanceSetBuffer("matrix", dimensionBuffers.head, 16);
    shiftVectorHead.thinInstanceSetBuffer("color", colorBuffer, 4);
  }
}

function pickInstance({ mesh, family, geneIndex, position, scaling, rotation, type }) {
  unpickInstance({ mesh, family, geneIndex });
  const selectionMesh = mesh.getScene().getMeshByName("picked_" + mesh.TOX_shape);
  const instance = selectionMesh.thinInstanceAdd(BABYLON.Matrix.Compose(scaling.add(Vector(.001, .001, .001)), rotation, position));
  selectionMesh.TOX_metadata[instance] = { family, geneIndex };
  selectionMesh.isVisible = true;

  document.dispatchEvent(new CustomEvent("pick", { detail: { family, gene: geneIndex, type } }));
}

function unpickInstance({ mesh, family, geneIndex, type }) {
  const selectionMesh = mesh.getScene().getMeshByName("picked_" + mesh.TOX_shape);
  const worldMatrices = selectionMesh.thinInstanceGetWorldMatrices();
  for (let i = 0; i < selectionMesh.thinInstanceCount; i++) {
    const data = selectionMesh.TOX_metadata[i];
    if (data.family === family) {
      if (data.geneIndex === geneIndex) {
        selectionMesh.thinInstanceCount--;
        selectionMesh.thinInstanceSetMatrixAt(i, worldMatrices[selectionMesh.thinInstanceCount]);
        selectionMesh.TOX_metadata[i] = selectionMesh.TOX_metadata[selectionMesh.thinInstanceCount];
        selectionMesh.isVisible = selectionMesh.hasThinInstances;

        document.dispatchEvent(new CustomEvent("unpick", { detail: { family, gene: data.geneIndex, type } }));
        break;
      }
    }
  }
  return selectionMesh.TOX_metadata.splice(selectionMesh.thinInstanceCount).length;
}

function setupSelectionMeshes(scene) {
  const highlightLayer = new BABYLON.HighlightLayer("highlight", scene);

  const material =  Material(scene, null, {color: Color(0, 0, 0, 0)});

  function setupMesh(mesh) {
    mesh.isVisible = false;
    mesh.material = material;
    highlightLayer.setEffectIntensity(mesh, 0.7);
    mesh.TOX_metadata = [];
  }

  const meshes = [
    Mesh.Sphere(scene, "picked_sphere"),
    Mesh.Octahedron(scene, "picked_octahedron"),
    Mesh.Octahedron(scene, "picked_cylinder"),
    Mesh.Cone(scene, "picked_cone")
  ];

  for (const mesh of meshes) {
    setupMesh(mesh);
  }

  config.setSetterCallback("selectedDataPointColor", hexColorCode => {
    const color = Color(hexColorCode);
    for (const mesh of meshes) {
      highlightLayer.removeMesh(mesh);
      highlightLayer.addMesh(mesh, color);
    }
  });

  // initially fetch picked instances from config and set them up
  new Promise(resolve => {
    document.dispatchEvent(new CustomEvent("initializePicked", { detail: resolve }));
  }).then(picked => {
    try {
      if (typeof picked === "object") {
        for (const [family, genes] of Object.entries(picked)) {
          for (const geneIndex of genes) {
            // meshSelectedPoints.TOX_pick(family, geneIndex);
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
    const meshes = [
      ...chunks.chunks.get(chunkCentroid)[2],
      ["arrow", chunks.scene.getMeshByName("shiftVectorHead")],
      ["arrow", chunks.scene.getMeshByName("shiftVectorShaft")]
    ];

    for (const [meshType, mesh] of meshes) {
      const sphereMatrices = mesh.thinInstanceGetWorldMatrices(); 

      for (const i in sphereMatrices) {
        const position = Vector();
        const scaling = Vector();
        const rotation = new BABYLON.Quaternion();

        sphereMatrices[i].decompose(scaling, rotation, position);
        let intersects;
        if (["sphere", "octahedron"].includes(mesh.TOX_shape)) {
          intersects = pickRay.intersectsSphere(
            { center: position, radius: scaling.x / 2 }
          );
        } else {
          // TODO: maybe use bounding box in local space
          intersects = false;
        }
        if (intersects) {
          const distance = Vector.Distance(chunks.scene.activeCamera.position, position);
          if (distance < closestDist) {
            closestDist = distance;
            picked = {
              position,
              rotation,
              scaling,
              index: i,
              meshType,
              mesh,
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
        picked.type = "centroid";
        for (const [family, members] of genes) {
          if (pickedIndex === 0) {
            picked.family = family;
            break;
          }
          pickedIndex -= Boolean(members.centroids)
        }
        break;
      }
      case "inliers":
      case "outliers": {
        picked.type = "gene";
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
        break;
      }
    }
  }
  return picked;
}

export { plotData };