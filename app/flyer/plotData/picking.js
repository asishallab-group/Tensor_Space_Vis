"use strict";

import {
  createDynamicThinInstance,
  removeDynamicThinInstance,
  dynamicThinInstanceBufferUpdated,
  createVectorPartsInstanceMatrices
} from "./dynamicMeshes.js";
import { createTooltip, removeTooltip } from "../gui/dom.js";
import {
  Vector,
  decomposeMatrix,
  getInstanceMatrix
} from "../babylon.js";

export function setupPicking(chunks) {
  setupGenePicking(chunks.scene);
  setupCentroidPicking(chunks.scene);
  setupVectorPicking(chunks.scene);
  registerClickEvents(chunks);
}

function registerClickEvents(chunks) {
  let picked = null;
  chunks.scene.onPointerObservable.add((evt) => {
    switch (evt.type) {
      case BABYLON.PointerEventTypes.POINTERDOWN:
        removeTooltip();
        break;
      case BABYLON.PointerEventTypes.POINTERTAP: {
        function handlePick(picked, onPick) {
          const keyType = `Picked${picked.type}`;
          const isPicked = config.familyGet(picked.family, keyType, picked.geneIndex);
          if (!isPicked) {
            onPick?.();
          }
          
          config.familySet(picked.family, keyType, !isPicked, picked.geneIndex);
        }
        picked = pickFromMeshes(chunks);
        if (picked !== null) {
          switch (picked.type) {
            case "ShiftVector": {
              handlePick(picked);
              break;
            }
            case "Gene": {
              handlePick(picked, () => {
                const geneData = dataHandler.getGeneData(picked.family, picked.geneIndex, chunks.tissues, ["id", "species", "is_outlier"]);
                createTooltip(evt.event.clientX, evt.event.clientY,
                  `<center>${geneData.is_outlier ? "Outlier" : "Inlier"}</center><table><tbody>` +
                  `<tr><td>Gene:</td><td>${geneData.id}</td></tr>` +
                  `<tr><td>Species:</td><td>${geneData.species}</td></tr>` +
                  `<tr><td>${chunks.tissues[0]}:</td><td>${geneData.coordinates[0].toFixed(2)}</td></tr>` +
                  `<tr><td>${chunks.tissues[1]}:</td><td>${geneData.coordinates[1].toFixed(2)}</td></tr>` +
                  `<tr><td>${chunks.tissues[2]}:</td><td>${geneData.coordinates[2].toFixed(2)}</td></tr>` +
                  "</tbody></table>"
                );
              });
              break;
            }
            case "Centroid": {
              handlePick(picked, () => {
                const { centroid } = dataHandler.getFamilyData(picked.family, ...chunks.tissues);
                createTooltip(evt.event.clientX, evt.event.clientY,
                  "Centroid<table><tbody>" +
                  `<tr><td>Family:</td><td>${dataHandler.getFamilyIDs(picked.family)[0]}</td></tr>` +
                  `<tr><td>${chunks.tissues[0]}:</td><td>${centroid[0].toFixed(2)}</td></tr>` +
                  `<tr><td>${chunks.tissues[1]}:</td><td>${centroid[1].toFixed(2)}</td></tr>` +
                  `<tr><td>${chunks.tissues[2]}:</td><td>${centroid[2].toFixed(2)}</td></tr>` +
                  "</tbody></table>"
                );
              });
              break;
            }
          }
        } else {
          removeTooltip();
        }
        break;
      }
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

function setupGenePicking(scene) {
  function pick({ family, gene, value }) {
    const { coordinates, is_outlier } = dataHandler.getGeneData(family, gene, [config.get("tissueX"), config.get("tissueY"), config.get("tissueZ")], ["is_outlier"]);
    const mesh = scene.getMeshByName(`picked${is_outlier ? "Octahedron" : "Sphere"}`);
    if (value) {
      const diameter = (config.familyGet(family, "Diameter", gene)) + .001;
      const scale = config.get("scale");
      createDynamicThinInstance(
        mesh,
        family,
        gene,
        getInstanceMatrix(
          Vector(...coordinates.map(v => v*scale)),
          Vector(diameter, diameter, diameter)
        )      
      );
    } else {
      removeDynamicThinInstance(mesh, family, gene);
    }
  }
  config.onChange("PickedGene", pick, null);

  function update() {
    for (const meshName of ["pickedSphere", "pickedOctahedron"]) {
      dynamicThinInstanceBufferUpdated(scene.getMeshByName(meshName));
    }
  }
  config.onChange("PickedGene", update);

  function repick() {
    for (const meshName of ["pickedSphere", "pickedOctahedron"]) {
      const mesh = scene.getMeshByName(meshName);
      for (const { family, geneIndex } of mesh.TOX_metadata) {
        if (geneIndex !== undefined) {
          config.familySet(family, "PickedGene", true, geneIndex, false);
        }
      }
    }
  }

  for (const setting of ["tissueX", "tissueY", "tissueZ", "scale", "Diameter"]) {
    config.onChange(setting, repick, 1);
    config.onChange(setting, update);
  }
}

function setupCentroidPicking(scene) {
  function pick({ family, value }) {
    const mesh = scene.getMeshByName("pickedSphere");
    if (value) {
      const { centroid } = dataHandler.getFamilyData(family, config.get("tissueX"), config.get("tissueY"), config.get("tissueZ"));
      const diameter = config.familyGet(family, "Diameter") * 4 + .001;
      const scale = config.get("scale");
      createDynamicThinInstance(
        mesh,
        family,
        undefined,
        getInstanceMatrix(
          Vector(...centroid.map(v => v*scale)),
          Vector(diameter, diameter, diameter)
        )      
      );
    } else {
      removeDynamicThinInstance(mesh, family, undefined);
    }
  }
  config.onChange("PickedCentroid", pick, null);

  function update() {
    dynamicThinInstanceBufferUpdated(scene.getMeshByName("pickedSphere"));
  }
  config.onChange("PickedCentroid", update);

  function repick() {
    for (const meshName of ["pickedSphere", "pickedOctahedron"]) {
      const mesh = scene.getMeshByName(meshName);
      for (const { family, geneIndex } of mesh.TOX_metadata) {
        if (geneIndex === undefined) {
          config.familySet(family, "PickedCentroid", true, geneIndex, false);
        }
      }
    }
  }

  for (const setting of ["tissueX", "tissueY", "tissueZ", "scale", "Diameter"]) {
    config.onChange(setting, repick, 1);
    config.onChange(setting, update);
  }
}

function setupVectorPicking(scene) {
  function pick({ family, gene, value }) {
    if (value) {
      const matrices = createVectorPartsInstanceMatrices(family, gene, .001);
      createDynamicThinInstance(scene.getMeshByName("pickedVectorShaft"), family, gene, matrices.shaft);
      createDynamicThinInstance(scene.getMeshByName("pickedVectorHead"), family, gene, matrices.head);
    } else {
      removeDynamicThinInstance(scene.getMeshByName("pickedVectorShaft"), family, gene);
      removeDynamicThinInstance(scene.getMeshByName("pickedVectorHead"), family, gene);
    }
  }
  config.onChange("PickedShiftVector", pick, null);

  function update() {
    dynamicThinInstanceBufferUpdated(scene.getMeshByName("pickedVectorShaft"));
    dynamicThinInstanceBufferUpdated(scene.getMeshByName("pickedVectorHead"));
  }

  config.onChange("PickedShiftVector", update);

  function repick() {
    const mesh = scene.getMeshByName("pickedVectorShaft");
    for (const { family, geneIndex } of mesh.TOX_metadata) {
      config.familySet(family, "PickedShiftVector", true, geneIndex, false);
    }
  }
  for (const setting of ["tissueX", "tissueY", "tissueZ", "scale", "Diameter"]) {
    config.onChange(setting, repick, 1);
    config.onChange(setting, update);
  }
}

function intersectsNonSpherical(
  worldMatrix,    // Matrix of the instance
  worldRay,       // Ray in world space
  scaling
) {
  // 1. Build local‐space AABB
  const max = Vector(.5, .5, .5);
  const min = max.negate();

  // 2. Transform ray into local space
  const inv    = BABYLON.Matrix.Invert(worldMatrix);
  const localR = new BABYLON.Ray(
    BABYLON.Vector3.TransformCoordinates(worldRay.origin, inv),
    BABYLON.Vector3.TransformNormal(worldRay.direction, inv).normalize(),
    worldRay.length
  );

  // 3. Test box
  return localR.intersectsBoxMinMax(min, max);
}

function meshHit(ray, mesh, maxDistance=Infinity) {
  const sphereMatrices = mesh.thinInstanceGetWorldMatrices(); 

  let picked = null;

  for (const i in sphereMatrices) {
    const { position, scaling } = decomposeMatrix(sphereMatrices[i]);

    const distance = Vector.Distance(ray.origin, position);
    if (distance < (picked?.distance ?? maxDistance)) {
      let intersects;
      if (["sphere", "octahedron"].includes(mesh.TOX_shape)) {
        intersects = ray.intersectsSphere(
          { center: position, radius: scaling.x / 2 }
        );
      } else {
        intersects = intersectsNonSpherical(sphereMatrices[i], ray, scaling);
      }
      if (intersects) {
        picked = {
          index: i,
          distance
        }
      }
    }
  }

  return picked;
}

function pickFromMeshes(chunks) {
  const pickRay = chunks.scene.createPickingRay(
    chunks.scene.pointerX, chunks.scene.pointerY,
    BABYLON.Matrix.Identity(),    // you can pass other transforms if you want
    chunks.scene.activeCamera
  );

  let picked = null;
  for (const chunkCentroid of chunks.active) {
    const meshes = chunks.chunks.get(chunkCentroid)[2];

    for (const [meshType, mesh] of meshes) {
      const hit = meshHit(pickRay, mesh, picked?.distance);
      if (hit !== null) {
        picked = hit;
        picked.meshType = meshType;
        picked.chunkCentroid = chunkCentroid;
      }
    }
  }

  const unchunkedMeshes = {
    arrow: ["shiftVectorShaft", "shiftVectorHead"]
  };
  for (const [meshType, meshNames] of Object.entries(unchunkedMeshes)) {
    let hit = null;
    for (const meshName of meshNames) {
      const mesh = chunks.scene.getMeshByName(meshName);
      if (mesh) {
        hit = meshHit(pickRay, mesh, picked?.distance);
        if (hit !== null) {
          const { family, geneIndex } = mesh.TOX_metadata[hit.index];
          picked = { ...hit, meshType, family, geneIndex };
          break;
        }
      }
    }
  }

  if (picked) {
    let pickedIndex = picked.index;
    switch (picked.meshType) {
      case "arrow": {
        picked.type = "ShiftVector";
        break;
      }
      case "centroids": {
        const [genes] = chunks.chunks.get(picked.chunkCentroid);
        picked.type = "Centroid";
        for (const [family, members] of genes) {
          pickedIndex -= Boolean(members.centroids);
          if (pickedIndex === -1) {
            picked.family = family;
            break;
          }
        }
        break;
      }
      case "inliers":
      case "outliers": {
        const [genes] = chunks.chunks.get(picked.chunkCentroid);
        picked.type = "Gene";
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
