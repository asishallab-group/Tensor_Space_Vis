"use strict";

import {
  createTableUIWithCustomizationButton,
  getDetailsTableDataMap,
  createDetailsDialog,
  createMultiView
} from "./tables.js";
import {
  createMasterTable,
  createRowSelector,
  createElement,
  createTableUI
} from "../dom.js";
import {
  applyChanges
} from "../customization.js";

export function createPickedDetailsDialog() {
  if (!document.getElementById("pickedDetails")) {
    {
      const tableHeaders = getDetailsTableDataMap("Gene", "ShiftVector", "Centroid");
      const menuNames = {Gene: "Genes", ShiftVector: "Shift Vectors", Centroid: "Centroids"};
      const multiViewArg = {};

      for (const [pickType, headers] of Object.entries(tableHeaders)) {
        const { table } = createMasterTable({ elements: [] }, null, headers);
        table.id = pickType + "DetailsTable";

        let tableUI;
        if (pickType === "Gene") {
          tableUI = createTableUIWithCustomizationButton({ table }, "Gene");
        } else {
          tableUI = createTableUI({ table }, { beforePageSwitch: applyChanges });
        }

        multiViewArg[menuNames[pickType]] = tableUI;
      }
      createDetailsDialog({
        id: "pickedDetails",
        children: [createMultiView(multiViewArg)]
      });
    }
  }
}

export function appendDetailRow({ family, gene, type }) {
  const id = `${family}.${gene}.${type}`;
  if (document.getElementById(id) === null) {
    let data;
    if (type === "Centroid") {
      const familyData = dataHandler.getFamilyData(family, ...dataHandler.tissues);
      data = { coordinates: familyData.centroid, family: familyData.family };
    } else {
      data = dataHandler.getGeneData(family, gene);
    }
    const table = document.getElementById(type + "DetailsTable");
    table.TOX_elements.push({ family, gene });
    const row = createElement("tr", { id, "tox-family": family, "tox-gene": gene });
    row.appendChild(createRowSelector(false, family, gene, type));

    const dataMap = getDetailsTableDataMap(type);
    for (const cell of dataMap[type]) {
      const td = createElement("td", {
        children: [cell.data(data, family, gene)]
      });
      row.appendChild(td);
    }
    table.tBodies[0].appendChild(row);
    table.querySelector("#selectAll").checked = false;

    return true;
  }

  return false;
}

export function removeDetailRow({ family, gene, type }) {
  const row = document.getElementById(`${family}.${gene}.${type}`);
  if (row !== null) {
    row.querySelector(".row-selector").click();
    const table = row.closest("table");
    const elementIdx = table.TOX_elements.findIndex(element => (family === element.family) && (gene === element.gene));
    table.TOX_elements.splice(elementIdx, 1);
    row.remove();
    return true;
  }

  return false;
}