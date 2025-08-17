"use strict";

import {
  createSingleDetailsTable,
  createMasterTable,
  createElement,
  createTableUI,
  createButton,
  show
} from "../dom.js";
import {
  createInputForHeaderData,
  createCustomizationTable,
  applyChanges
} from "../customization.js";
import { createPickedDetailsDialog } from "./picked.js"

export function setupDetailView() {
  createPickedDetailsDialog();
}

export function createTableUIWithCustomizationButton(tableComponents, type) {
  const button = createButton({
    innerText: "Customize",
    disabled: true,
  });
  button.addEventListener("click", function () {
    show(createTableUI(createCustomizationTable(tableComponents.table, type), { beforePageSwitch: applyChanges }), applyChanges);
  })

  return createTableUI(tableComponents, {
    bottomChildren: [button],
    beforePageSwitch: applyChanges,
    afterRowSelection(evt) {
      button.disabled = !tableComponents.table.TOX_allSelectorState && tableComponents.table.TOX_selectedRows.size === 0;
    }
  });
}

function multiViewMenuListener({ target }) {
  for (const content of target.closest("section").querySelector("section").children) {
    if (!content.hidden) {
      applyChanges(content);
    }
    content.hidden = content.getAttribute("menu-name") !== target.textContent;
  }
  for (const tab of target.closest("section").querySelector("menu").children) {
    tab.classList.toggle("active", tab.textContent === target.textContent);
  }
}

export function createMultiView(contents) {
  const menu = createElement("menu", {classes: ["tabs"]});
  const contentBody = createElement("section");
  for (const [menuName, content] of Object.entries(contents)) {
    const menuItem = createElement("li", {
      textContent: menuName,
      classes: ["clickable"]
    });
    menuItem.addEventListener("click", multiViewMenuListener)
    menu.appendChild(menuItem);

    content.hidden = true;
    content.setAttribute("menu-name", menuName);
    contentBody.appendChild(content);
  }

  if (contentBody.firstChild !== undefined) {
    contentBody.firstChild.hidden = false;
    menu.firstChild.classList.add("active");
  }
  return createElement("section", {
    children: [
      menu,
      contentBody
    ]
  });
}

function createCellLinkElement(value, linkContent) {
  const a = createElement("a", {
    textContent: value,
    classes: ["clickable"]
  });
  a.addEventListener("click", evt => {
    evt.preventDefault();
    applyChanges(evt.target.closest("table"));
    show(linkContent(), applyChanges);
  });
  return a;
}

export function getDetailsTableDataMap(...types) {
  const headers = {};

  const tissues = dataHandler.tissues;
  const links = {
    family: {
      title: "Family",
      data(geneData, familyIdx, geneIdx) {
        return createCellLinkElement(geneData.family, () => createTableUI(createSingleDetailsTable(geneData, familyIdx, undefined, headers.Family), {}));
      }
    },
    gene: {
      title: "Gene",
      data(geneData, familyIdx, geneIdx) {
        return createCellLinkElement(geneData.genes, () => createTableUI(createSingleDetailsTable(geneData, familyIdx, geneIdx, [
          { title: "Identifier", data() {return geneData.genes } },
          links.family,
          { title: "Type", data(geneData) {return geneData.is_outlier ? "Outlier" : "Inlier"} },
          { title: "Species", data() {return geneData.species} },
          { title: "Description", data() {return "..."} },
          ...tissues.map((tissue, i) => {
            return { title: tissue, data() {return geneData.coordinates[i]} }
          })
        ]), {}));
      }
    }
  }
  function tissueRelatedHeader(key) {
    return {
      get title() {
        return createElement("span", {
          classes: [key],
          innerText: config.get(key)
        });
      },
      data(geneData) {
        return createElement("span", {
          classes: [key, "data"],
          innerText: geneData.coordinates[tissues.indexOf(config.get(key))].toFixed(3)
        });
      }
    };
  }
  const tissueRelated = [
    tissueRelatedHeader("tissueX"),
    tissueRelatedHeader("tissueY"),
    tissueRelatedHeader("tissueZ")
  ];

  headers.Gene = [
    links.gene,
    links.family,
    { title: "Type", data(geneData) {return geneData.is_outlier ? "Outlier" : "Inlier"} },
    ...tissueRelated
  ];

  headers.Family = [
    { title: "Identifier", data(geneData) {return geneData.family} },
    {
      title: "Genes",
      data(geneData, familyIdx) {
        return createCellLinkElement(`Inspect ${dataHandler.getGeneCount(familyIdx)} members`, () => createTableUIWithCustomizationButton(createMasterTable(
          { elements: dataHandler.genes(familyIdx).map(gene => ({family: familyIdx, gene})) },
          (family, gene) => dataHandler.getGeneData(family, gene),
          headers.Gene
        ), "Gene"))
      }
    },
    { title: "Visibility", data: createInputForHeaderData("Visible", "boolean") },
    { title: "Description", data() {return "..."}},
  ];

  const dataMap = {};

  for (const type of types) {
    switch (type) {
      case "Gene": {
        dataMap.Gene = headers.Gene;
        break;
      }
      case "ShiftVector": {
        dataMap.ShiftVector = [
          links.gene,
          links.family,
          { title: "Visibility", data: createInputForHeaderData("ShiftVector", "boolean") }
        ];
        break;
      }
      case "Centroid": {
        dataMap.Centroid = [
          links.family,
          { title: "Visibility", data: createInputForHeaderData("Centroid", "boolean") },
          ...tissueRelated
        ];
        break;
      }
      case "Family": {
        dataMap.Family = headers.Family;
      }
    }
  }
  return dataMap;
}

export function createDetailsDialog(options) {
  const dialog = createElement("dialog", options);
  dialog.addEventListener("close", () => { applyChanges(dialog); config.update(); document.getElementById("view")?.focus() });
  document.getElementById("UI")?.appendChild(dialog);
}
