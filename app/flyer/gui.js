"use strict";

export function setupGUI() {
  createUIdiv();
  createPickedDetailsDialog();
  switchToDetails("gene");

  let pickedCount = 0;
  document.addEventListener("pick", evt => {
    if (pickedCount === 0) {
      createDetailButton();
    }
    appendDetailRow(evt.detail);
    pickedCount++;
  });

  document.addEventListener("unpick", evt => {
    pickedCount--;
    removeDetailRow(evt.detail);
    if (pickedCount === 0) {
      removeDetailButton();
    }
  });
}

function appendDetailRow({ family, gene, type }) {
  const id = `${family}.${gene}.${type}`;
  const data = dataHandler.getGeneData(family, gene);
  const table = document.getElementById(type + "DetailsTable");
  const row = document.createElement("tr");
  row.id = id;

  const dataMap = getDetailsTableDataMap();
  for (const cell of dataMap[type]) {
    const td = document.createElement("td");
    td.textContent = cell.data(data);
    row.appendChild(td);
  }
  table.tBodies[0].appendChild(row);
}

function switchToDetails(type) {
  for (const table of document.getElementsByClassName("detailsTable")) {
    table.hidden = table.id !== type + "DetailsTable";
  }
}

function removeDetailRow({ family, gene, type }) {
  document.getElementById(`${family}.${gene}.${type}`)?.remove();
}

function createPickedDetailsDialog() {
  if (!document.getElementById("pickedDetails")) {
    {
      const pickedDetails = document.createElement("dialog");
      pickedDetails.id = "pickedDetails";
      const menu = document.createElement("menu");
      menu.id = "pickedDetailsMenu";
      const tables = document.createElement("section");
      tables.id = "pickedDetailsTables";

      const tableHeaders = getDetailsTableDataMap();

      for (const [pickType, headers] of Object.entries(tableHeaders)) {
        const menuItem = document.createElement("li");
        menuItem.id = pickType + "Details";
        menuItem.textContent = pickType + "s";
        menuItem.addEventListener("click", () => {
          switchToDetails(pickType);
        })
        menu.appendChild(menuItem);

        const table = document.createElement("table");
        table.id = pickType + "DetailsTable";
        table.classList.add("detailsTable");
        const tHead = document.createElement("thead");
        const tr = document.createElement("tr");
        tr.id = pickType + "DetailsHeader";
        for (const header of headers) {
          const th = document.createElement("th");
          if (header.configKey) {
            th.textContent = config.get(header.configKey);
          } else {
            th.textContent = header.title;
          }
          tr.appendChild(th);
        }
        tHead.appendChild(tr);
        table.appendChild(tHead);
        const tBody = document.createElement("tbody");
        table.hidden = true;
        table.appendChild(tBody);
        tables.appendChild(table);
      }
      pickedDetails.appendChild(menu);
      pickedDetails.appendChild(tables);
      document.getElementById("UI")?.appendChild(pickedDetails);
    }

    document.addEventListener("chunkReload", evt => {
      const dataMap = getDetailsTableDataMap();
      for (const table of document.getElementsByName("detailsTable")) {
        const [type] = table.id.split("DetailsTable");
        const headers = table.tHead.firstChild.children;
        dataMap[type].forEach(({ configKey }, i) => {
          if (configKey !== undefined) {
            headers[i].textContent = config.get(configKey);
          }
        })

        for (const row of table.tBody.children) {
          const [family, gene, type] = row.id.split(".");
          const geneData = dataHandler.getGeneData(Number(family), Number(gene));
          dataMap[type].forEach(({ data }, i) => {
            row[i].textContent = data(geneData);
          })
        }
      }
    })
  }
}

function getDetailsTableDataMap() {
  const tissues = dataHandler.tissues;
  function getTissueData(geneData) {
    return geneData.coordinates[tissues.indexOf(config.get(this.configKey))];
  }
  return {
    "gene": [
      { title: "Identifier", data(geneData) {return geneData["genes"]} },
      { title: "Family", data(geneData) {return geneData["family"]} },
      { configKey: "tissueX", data: getTissueData},
      { configKey: "tissueY", data: getTissueData},
      { configKey: "tissueZ", data: getTissueData}
    ],
    "shift vector": [
      { title: "Gene", data(geneData) {return geneData["genes"]} },
      { title: "Family", data(geneData) {return geneData["family"]} }
    ],
    "centroid": [
      { title: "Family", data(geneData) {return geneData["family"]} },
      { configKey: "tissueX", data: getTissueData},
      { configKey: "tissueY", data: getTissueData},
      { configKey: "tissueZ", data: getTissueData}
    ]
  };
}

function createUIdiv() {
  const flyer = document.getElementById("flyer");
  if (flyer) {
    const canvas = document.createElement("canvas");
    canvas.id = "view";
    flyer.appendChild(canvas);

    document.getElementById("UI")?.remove();
    const UI = document.createElement("div");
    UI.id = "UI";
    for (const area of ["top-left", "top-right", "mid-right"]) {
      const element = document.createElement("aside");
      element.id = area;
      UI.appendChild(element);
    }
    flyer.appendChild(UI);
  } else {
    throw new Error('Missing <main id="flyer"></main>');
  }
}

function createDetailButton() {
  if (!document.getElementById("detailBtn")) {
    const button = document.createElement("button");
    button.id = "detailBtn";
    button.innerHTML = "Detail";
    button.addEventListener("click", () => document.getElementById("pickedDetails")?.showModal());
    document.getElementById("mid-right")?.appendChild(button);
  }
}

function removeDetailButton() {
  document.getElementById("detailBtn")?.remove();
}

export function createTooltip(x, y, text) {
  let tooltip = document.getElementById("tooltip");
  if (tooltip === null) {
    tooltip = document.createElement("aside");
    tooltip.id = "tooltip";
    tooltip.classList.add("tooltip");
    document.getElementById("UI")?.appendChild(tooltip);
  }
  tooltip.style.top = y + 10 + "px";
  tooltip.style.left = x + 10 + "px";
  tooltip.innerHTML = text;
}

export function removeTooltip() {
  document.getElementById("tooltip")?.remove();
}
window.addEventListener("resize", () => {
  removeTooltip();
})