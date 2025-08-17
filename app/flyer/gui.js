"use strict";

import { getNumericAttribute } from "./gui/dom.js";
import { createOverlay } from "./gui/overlay.js";
import { setupDetailView } from "./gui/details.js";

export function setupGUI() {
  createOverlay();
  setupDetailView();
  setupConfigCallbacks();
}

function setupConfigCallbacks() {
  function setText(cell, value) {
    if (cell.type === "checkbox") {
      cell.checked = value;
    } else if (cell.tagName === "input") {
      cell.value = value;
    } else {
      cell.innerText = value;
    }
  }

  for (const familyRelated of ["ShiftVector", "Centroid", "Hull", "Color", "Diameter", "PickedGene", "PickedShiftVector", "PickedCentroid", "Visible"]) {
    config.onChange(familyRelated, ({ family, gene, value }) => {
      for (const cell of document.getElementsByClassName(familyRelated)) {
        const tr = cell.closest("tr");
        if (getNumericAttribute(tr, "tox-family") == family && getNumericAttribute(tr, "tox-gene") == gene) {
          setText(cell, value);
          break;
        }
      }
    }, null);
  }

  for (const tissue of ["tissueX", "tissueY", "tissueZ"]) {
    config.onChange(tissue, ({ value }) => {
      for (const cell of document.getElementsByClassName(tissue)) {
        if (cell.classList.contains("data")) {
          const tr = cell.closest("tr");
          const family = getNumericAttribute(tr, "tox-family");
          const gene = getNumericAttribute(tr, "tox-gene");
          let data;
          if (gene === "undefined") {
            [data] = dataHandler.getFamilyData(family, value).centroid;
          } else {
            [data] = dataHandler.getGeneData(family, gene, [value], []).coordinates;
          }
          setText(cell, data.toFixed(3));
        } else {
          setText(cell, value);
        }
      }
    }, null);
  }

  for (const nonFamilyRelated of ["orbitMode", "darkMode", "x", "y", "z", "rotationX", "rotationY", "orbitModeTargetDistance", "mouseSensibility", "movementSpeed", "scale", "chunkDiameter", "chunkLoadRange", "selectedDataPointColor", "backgroundColor", "xAxisColor", "yAxisColor", "zAxisColor"]) {
    config.onChange(nonFamilyRelated, ({ value }) => {
      for (const cell of document.getElementsByClassName(nonFamilyRelated)) {
        setText(cell);
      }
    }, null);
  }
}
