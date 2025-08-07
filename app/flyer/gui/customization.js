"use strict";

import {
  getNumericAttribute,
  createMasterTable,
  createElement,
  createToggle
} from "./dom.js";

export function createCustomizationTable(table) {
  function dataFunc(key) {
    return function (geneData, familyIdx, geneIdx) {
      return createElement("span", { classes: [key], innerText: config.familyGet(familyIdx, key, geneIdx)});
    }
  }

  const headers = [
    { title: "Gene", data(geneData) {return geneData.genes} },
    { title: "Family", data(geneData) {return geneData.family} },
    { title: "Type", data(geneData) {return geneData.is_outlier ? "Outlier" : "Inlier"} },
    { title: "Shift Vector", data: createInputForHeaderData("ShiftVector", "boolean") },
    // { title: "Centroid", data: dataFunc("Centroid")},
    // { title: "Hull", data: dataFunc("Hull")},
    { title: "Color", data: createInputForHeaderData("Color", "color")},
    { title: "Diameter", data: createInputForHeaderData("Diameter", "number")},
  ];

  return createMasterTable(
    {
      elements: table.TOX_elements,
      familyOnly: table.TOX_familyOnly,
      parentTable: table
    },
    (family, gene) => dataHandler.getGeneData(family, gene),
    headers
  );
}

export function createInputForHeaderData(key, type) {
  if (type === "boolean") {
    return function(geneData, familyIdx, geneIdx) {
      const content = createToggle({
        key,
        classes: [key],
        checked: config.familyGet(familyIdx, key, geneIdx)
      });
      return content;
    }
  } else {
    return function(geneData, familyIdx, geneIdx) {
      const value = config.familyGet(familyIdx, key, geneIdx);
      const content = createElement("input", {
        type,
        key,
        classes: [key, "textselect"],
        innerText: value,
        value: type === "color" ? value.slice(0, 7) : value
      });
      return content;
    }
  }
}

export function applyChanges(ancestor) {
  for (const input of ancestor.querySelectorAll("input[key]")) {
    const tr = input.closest("tr");
    const family = getNumericAttribute(tr, "tox-family");
    const gene = getNumericAttribute(tr, "tox-gene");
    switch (input.type) {
      case "number": {
        config.familySet(family, input.getAttribute("key"), Number(input.value), gene, false);
        break;
      }
      case "checkbox": {
        config.familySet(family, input.getAttribute("key"), input.checked, gene, false);
        break;
      }
      default: {
        config.familySet(family, input.getAttribute("key"), input.value, gene, false);
        break;
      }
    }
  }
}
