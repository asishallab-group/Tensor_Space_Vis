"use strict";

import { getChunks } from "./plotData/chunks.js";
import { setupPicking } from "./plotData/picking.js";
import {
  setupFamilyHullMesh,
  setupSelectionMeshes,
  setupShiftVectorMesh
} from "./plotData/dynamicMeshes.js";

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
export function plotData(scene) {
  setupSelectionMeshes(scene);
  setupFamilyHullMesh(scene);
  setupShiftVectorMesh(scene);
  setupPicking(getChunks(scene));

  document.dispatchEvent(new CustomEvent("initialTrigger", { detail: [
    "Hull",
    "ShiftVector",
    "PickedGene",
    "PickedCentroid",
    "PickedShiftVector"
  ]}));
}