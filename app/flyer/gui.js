"use strict";

export function setupGUI() {
  createUIdiv();
  createPickedDetailsDialog();
  switchToDetails("Gene");

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
  let data;
  if (type === "Centroid") {
    const familyData = dataHandler.getFamilyData(family, ...dataHandler.tissues);
    data = { coordinates: familyData.centroid, family: familyData.family };
  } else {
    data = dataHandler.getGeneData(family, gene);
  }
  const table = document.getElementById(type + "DetailsTable");
  const row = createElement("tr", { id });
  row.appendChild(createRowSelector());

  const dataMap = getDetailsTableDataMap();
  for (const cell of dataMap[type]) {
    const td = createElement("td", {
      children: [cell.data(data, family, gene)]
    });
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

        const tr = createElement("tr", { id: pickType + "DetailsHeader" });
        tr.appendChild(createRowSelector(true));

        for (const header of headers) {
          const th = createElement("th", {
            children: [header.title]
          });
          tr.appendChild(th);
        }
        const table = createElement("table", {
          id: pickType + "DetailsTable",
          hidden: true,
          children: [
            createElement("thead", { children: [tr] }),
            createElement("tbody")
          ],
          classes: [
            "detailsTable",
            "datatable",
            "textselect"
          ]
        });
        tables.appendChild(table);
      }
      const pickedDetails = createElement("dialog", {
        id: "pickedDetails",
        children: [
          menu,
          tables
        ]
      });
      document.getElementById("UI")?.appendChild(pickedDetails);
    }
  }
}

function createRowSelector(selectAll=false) {
  const checkbox = createElement("input", { type: "checkbox", classes: ["clickable"] });
  if (selectAll) {
    checkbox.addEventListener("change", evt => {
      const table = evt.target.closest("table");
      const changeEvent = new Event("change");
      for (const checkbox of table.getElementsByClassName("row-selector")) {
        checkbox.checked = evt.target.checked;
        checkbox.dispatchEvent(changeEvent);
      }
    })
  } else {
    checkbox.classList.add("row-selector");
    checkbox.addEventListener("change", evt => {
      const tr = evt.target.closest("tr");
      tr.classList.toggle("selected", evt.target.checked);
    })
  }
  return createElement(selectAll ? "th": "td", {
    children: [checkbox],
    classes: ["center"]
  })
}

function getDetailsTableDataMap() {
  const tissues = dataHandler.tissues;
  const links = {
    family: {
      title: "Family",
      data(geneData, familyIdx, geneIdx) {
        return showSingleDetails(geneData, geneData["family"], [
          { title: "Identifier", data() {return geneData["family"]}},
          { title: "Gene Count", data() {return dataHandler.getGeneCount(familyIdx)}},
          { title: "Description", data() {return "..."}},
        ]);
      }
    },
    gene: { 
      title: "Gene",
      data(geneData, familyIdx, geneIdx) {
        return showSingleDetails(geneData, geneData["genes"], [
          { title: "Identifier", data() {return geneData["genes"]} },
          links.family,
          { title: "Species", data() {return geneData["species"]} },
          { title: "Description", data() {return "..."} },
          ...tissues.map((tissue, i) => {
            return { title: tissue, data() {return geneData.coordinates[i]} }
          })
        ]);
      } 
    }
  }
  function tissueRelatedHeader(key) {
    function createValueElement(tissueData) {
      const valueElement = createElement("span");
      valueElement.innerText = tissueData[tissues.indexOf(config.get(key))].toFixed(3);
      config.onChange(key, function ({ value }) {
        valueElement.innerText = tissueData[tissues.indexOf(value)].toFixed(3);
      });
      return valueElement;
    }
    return {
      get title() {
        const title = createElement("span");
        title.innerText = config.get(key);
        config.onChange(key, ({ value }) => title.innerText = value);
        return title;
      },
      data(geneData) {
        return createValueElement(geneData.coordinates);
      }
    };
  }
  const tissueRelated = [
    tissueRelatedHeader("tissueX"),
    tissueRelatedHeader("tissueY"),
    tissueRelatedHeader("tissueZ")
  ]
  return {
    Gene: [
      links.gene,
      links.family,
      ...tissueRelated
    ],
    ShiftVector: [
      links.gene,
      links.family
    ],
    Centroid: [
      links.family,
      ...tissueRelated
    ]
  };
}

function showSingleDetails(geneData, value, headerMap) {
  const a = createElement("a", {
    textContent: value,
    classes: ["clickable"]
  });
  a.addEventListener("click", evt => {
    evt.preventDefault();
    const table = createElement("table", { classes: ["datatable", "textselect"] });
    const tBody = createElement("tbody");
    for (const header of headerMap) {
      const tr = createElement("tr", {
        children: [
          createElement("td", { children: [header.title] }),
          createElement("td", { children: [header.data(geneData)] })
        ]
      });
      tBody.appendChild(tr);
    }
    table.appendChild(tBody);
    const dialog = createElement("dialog", { children: [table] });
    dialog.addEventListener("close", () => dialog.remove());
    document.getElementById("UI")?.appendChild(dialog);
    dialog.showModal();
  });
  return a;
}

function createUIdiv() {
  const flyer = document.getElementById("flyer");
  if (flyer) {
    const canvas = createElement("canvas", { id: "view" });
    flyer.appendChild(canvas);

    document.getElementById("UI")?.remove();
    const UI = createElement("div", { id: "UI" });
    for (const area of ["top-left", "top-right", "mid-right"]) {
      const element = createElement("aside", { id: area });
      UI.appendChild(element);
    }
    flyer.appendChild(UI);
  } else {
    throw new Error('Missing <main id="flyer"></main>');
  }
}

function createDetailButton() {
  if (!document.getElementById("detailBtn")) {
    const button = createElement("button", {
      id: "detailBtn",
      textContent: "Detail",
      classes: ["clickable"]
    });
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
    tooltip = createElement("aside", {
      id: "tooltip",
      classes: ["tooltip"]
    });
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

function createElement(tag, options={}) {
  const element = document.createElement(tag);
  const { children, classes, ...attributes } = options;
  if (children) {
    element.append(...children);
  }
  if (classes) {
    element.classList.add(...classes);
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (element[key] === undefined) {
      element.setAttribute(key, value);
    } else {
      element[key] = value;
    }
  }
  return element;
}