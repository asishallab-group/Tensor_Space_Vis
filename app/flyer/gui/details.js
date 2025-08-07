"use strict";

import {
  createSingleDetailsTable,
  createMasterTable,
  createRowSelector,
  createElement,
  createTableUI,
  createButton,
  show
} from "./dom.js";
import {
  createInputForHeaderData,
  createCustomizationTable,
  applyChanges
} from "./customization.js";

export function setupDetailView() {
  createPickedDetailsDialog();
  switchToDetails("Gene");
}

function createTableUIWithCustomizationButton(tableComponents) {
  const button = createButton({
    innerText: "Customize",
    disabled: true,
  });
  button.addEventListener("click", function () {
    show(createTableUI(createCustomizationTable(tableComponents.table), { beforePageSwitch: applyChanges }), applyChanges);
  })

  return createTableUI(tableComponents, {
    bottomChildren: [button],
    beforePageSwitch: applyChanges,
    afterRowSelection(evt) {
      button.disabled = !tableComponents.table.TOX_allSelectorState && tableComponents.table.TOX_selectedRows.size === 0;
    }
  });
}

function createPickedDetailsDialog() {
  if (!document.getElementById("pickedDetails")) {
    {
      const menu = createElement("menu", { id: "pickedDetailsMenu" });
      const tables = createElement("section", { id: "pickedDetailsTables" });

      const tableHeaders = getDetailsTableDataMap();

      for (const [pickType, headers] of Object.entries(tableHeaders)) {
        const menuItem = createElement("li", {
          id: pickType + "Details",
          textContent: pickType + "s",
          classes: ["clickable"]
        });
        menuItem.addEventListener("click", () => {
          switchToDetails(pickType);
        })
        menu.appendChild(menuItem);

        const { table } = createMasterTable({ elements: [] }, null, headers);
        table.id = pickType + "DetailsTable";

        let tableUI;
        if (pickType === "Gene") {
          tableUI = createTableUIWithCustomizationButton({ table });
        } else {
          tableUI = createTableUI({ table }, { beforePageSwitch: applyChanges });
        }
        tableUI.hidden = true;
        tableUI.classList.add("detailsTable");
        tables.appendChild(tableUI);
      }
      const pickedDetails = createElement("dialog", {
        id: "pickedDetails",
        children: [
          menu,
          tables
        ]
      });
      pickedDetails.addEventListener("close", () => { applyChanges(pickedDetails); config.update() });
      document.getElementById("UI")?.appendChild(pickedDetails);
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

    const dataMap = getDetailsTableDataMap();
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

function switchToDetails(type) {
  for (const tableUI of document.getElementsByClassName("detailsTable")) {
    if (!tableUI.hidden) {
      applyChanges(tableUI);
    }
    tableUI.hidden = tableUI.querySelector("#" + type + "DetailsTable") === null;
  }
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

function createCellLinkElement(value, linkContent) {
  const a = createElement("a", {
    textContent: value,
    classes: ["clickable"]
  });
  a.addEventListener("click", evt => {
    evt.preventDefault();
    applyChanges(evt.target.closest("table"));
    show(linkContent());
  });
  return a;
}

function getDetailsTableDataMap() {
  const dataMap = {};

  const tissues = dataHandler.tissues;
  const links = {
    family: {
      title: "Family",
      data(geneData, familyIdx, geneIdx) {
        return createCellLinkElement(geneData.family, () => createTableUI(createSingleDetailsTable(geneData, familyIdx, geneIdx, [
          { title: "Identifier", data() {return geneData.family} },
          {
            title: "Genes",
            data() {
              return createCellLinkElement(`Inspect ${dataHandler.getGeneCount(familyIdx)} members`, () => createTableUIWithCustomizationButton(createMasterTable(
                { elements: dataHandler.genes(familyIdx).map(gene => ({family: familyIdx, gene})) },
                (family, gene) => dataHandler.getGeneData(family, gene),
                dataMap.Gene
              )))
            }
          },
          { title: "Description", data() {return "..."}},
        ]), {}));
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

  dataMap.Gene = [
    links.gene,
    links.family,
    { title: "Type", data(geneData) {return geneData.is_outlier ? "Outlier" : "Inlier"} },
    ...tissueRelated
  ];
  dataMap.ShiftVector = [
    links.gene,
    links.family,
    { title: "Visibility", data: createInputForHeaderData("ShiftVector", "boolean") }
  ];
  dataMap.Centroid = [
    links.family,
    { title: "Visibility", data: createInputForHeaderData("Centroid", "boolean") },
    ...tissueRelated
  ];
  return dataMap;
}
