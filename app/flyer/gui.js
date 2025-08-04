"use strict";

export function setupGUI() {
  createUIdiv();
  addIcons();
  createPickedDetailsDialog();
  switchToDetails("Gene");
  setupConfigCallbacks();

  let pickedCount = 0;
  for (const type of ["Gene", "ShiftVector", "Centroid"]) {
    config.onChange("Picked" + type, ({ family, gene, value }) => {
      if (value) {
        if (pickedCount === 0) {
          createDetailButton();
        }
        pickedCount += appendDetailRow({ family, gene, type });
      } else {
        pickedCount -= removeDetailRow({ family, gene, type });
        if (pickedCount === 0) {
          removeDetailButton();
        }
      }
    }, null);
  }
}

function addIcons() {
  const icons = {
    "top-left": [
      { src: "./images/gear.png", alt: "Settings" },
    ]
  }

  for (const [area, areaIcons] of Object.entries(icons)) {
    const areaElement = document.getElementById(area);
    for (const icon of areaIcons) {
      areaElement?.appendChild(createElement("img", {
        height: 1,
        classes: ["icon"],
        ...icon
      }));
    }
  }
}

function setupConfigCallbacks() {
  function setText(cell, value) {
    if (typeof value === "boolean") {
      cell.innerText = value ? "Visible" : "Hidden";
    } else {
      cell.innerText = value;
    }
  }

  for (const familyRelated of ["ShiftVector", "Centroid", "Hull", "Color", "Diameter", "PickedGene", "PickedShiftVector", "PickedCentroid"]) {
    config.onChange(familyRelated, ({ family, gene, value }) => {
      for (const cell of document.getElementsByClassName(familyRelated)) {
        const tr = cell.closest("tr");
        if (tr.getAttribute("tox-family") == family && tr.getAttribute("tox-gene") == gene) {
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
          const family = tr.getAttribute("tox-family");
          const gene = tr.getAttribute("tox-gene");
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

  for (const nonFamilyRelated of ["orbitMode", "darkMode", "x", "y", "z", "rotationX", "rotationY", "orbitModeTargetDistance", "mouseSensibility", "movementSpeed", "scale", "chunkDiameter", "chunkLoadRange", "shownFamilies", "selectedDataPointColor", "backgroundColor", "xAxisColor", "yAxisColor", "zAxisColor"]) {
    config.onChange(nonFamilyRelated, ({ value }) => {
      for (const cell of document.getElementsByClassName(nonFamilyRelated)) {
        cell.innerText = value;
      }
    }, null);
  }
}

function appendDetailRow({ family, gene, type }) {
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
    tableUI.hidden = tableUI.querySelector("#" + type + "DetailsTable") === null;
  }
}

function removeDetailRow({ family, gene, type }) {
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

        const tableUI = createTableUI({ table }, pickType === "Gene" ? "Details" : undefined);
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
      pickedDetails.addEventListener("close", () => config.update());
      document.getElementById("UI")?.appendChild(pickedDetails);
    }
  }
}

function createRowSelector(selectAll, family, gene, type) {
  const checkbox = createElement("input", { type: "checkbox", classes: ["clickable"] });
  if (selectAll) {
    checkbox.id = "selectAll";
    checkbox.addEventListener("change", evt => {
      const table = evt.target.closest("table");
      const changeEvent = new Event("change", {bubbles: true});
      for (const checkbox of table.getElementsByClassName("row-selector")) {
        if (checkbox.checked !== evt.target.checked) {
          checkbox.checked = evt.target.checked;
          checkbox.dispatchEvent(changeEvent);
        }
      }
    })
  } else {
    checkbox.classList.add("row-selector");
    checkbox.addEventListener("change", evt => {
      const tr = evt.target.closest("tr");
      tr.classList.toggle("selected", evt.target.checked);
      if (!evt.target.checked) {
        evt.target.closest("table").querySelector("#selectAll").checked = false;
      }
    })
  }
  const element = createElement(selectAll ? "th": "td", {
    children: [checkbox],
    classes: ["center", "clickable"]
  });

  element.addEventListener("click", function (evt) {
    if (evt.target === this) {
      this.firstChild.click();
    }
  });

  return element;
}

function createCustomizationTable(table) {
  function dataFunc(key) {
    return function (geneData, familyIdx, geneIdx) {
      return createElement("span", { classes: [key], innerText: config.familyGet(familyIdx, key, geneIdx)});
    }
  }

  function booleanInput(key) {
    return function(geneData, familyIdx, geneIdx) {
      const content = createButton({
        key,
        classes: [key],
        innerText: config.familyGet(familyIdx, key, geneIdx) ? "Visible" : "Hidden"
      });
      content.addEventListener("click", evt => {
        config.familySet(familyIdx, key, !config.familyGet(familyIdx, key, geneIdx), geneIdx, false);
      });
      return content;
    }
  }

  function input(key, type) {
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

  const headers = [
    { title: "Gene", data(geneData) {return geneData.genes} },
    { title: "Family", data(geneData) {return geneData.family} },
    { title: "Type", data(geneData) {return geneData.is_outlier ? "Outlier" : "Inlier"} },
    { title: "Shift Vector", data: booleanInput("ShiftVector") },
    // { title: "Centroid", data: dataFunc("Centroid")},
    // { title: "Hull", data: dataFunc("Hull")},
    { title: "Color", data: input("Color", "color")},
    { title: "Diameter", data: input("Diameter", "number")},
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

function createTableUI({ table, next, previous }, type) {
  const bottomChildren = [];
  function applyChanges() {
    for (const input of this.querySelectorAll("input[key]")) {
      const tr = input.closest("tr");
      const family = tr.getAttribute("tox-family");
      const gene = tr.getAttribute("tox-gene");
      switch (input.type) {
        case "number": {
          config.familySet(family, input.getAttribute("key"), Number(input.value), gene, false);
          break;
        }
        default: {
          config.familySet(family, input.getAttribute("key"), input.value, gene, false);
          break;
        }
      }
    }
  }

  function selectorHandler(target, callback) {
    if (target.id === "selectAll") {
      table.TOX_selectedRows.clear();
      table.TOX_allSelectorState = target.checked;
    } else {
      const row = target.closest("tr");
      if (target.classList.contains("row-selector")) {
        const rowID = table.TOX_rowID(row.getAttribute("tox-family"), row.getAttribute("tox-gene"));
        if (target.checked !== table.TOX_allSelectorState) {
          table.TOX_selectedRows.add(rowID);
        } else {
          table.TOX_selectedRows.delete(rowID);
        }
      }
    }
    callback?.();
  }

  switch (type) {
    case "Details": {
      const customizationButton = createButton({
        innerText: "Customize",
        disabled: true,
      });
      customizationButton.addEventListener("click", function () {
        show(createTableUI(createCustomizationTable(table), "Customize"), applyChanges);
      })

      table.addEventListener("change", evt => selectorHandler(evt.target, () => {
        customizationButton.disabled = !table.TOX_allSelectorState && table.TOX_selectedRows.size === 0;
      }));
      
      bottomChildren.push(customizationButton);
      break;
    }
    case "Customize": {
      table.addEventListener("change", evt => selectorHandler(evt.target));
    }
    case "SingleDetails":
    default: {}
  }
  const doneButton = createButton({ innerText: "Done" });
  doneButton.addEventListener("click", function () {this.closest("dialog").close()});
  bottomChildren.push(doneButton);

  if ((typeof next === "function") && (typeof previous === "function")) {
    const nextBtn = createButton({
      innerHTML: "&#8594;", // right arrow
    });
    nextBtn.addEventListener("click", function () { applyChanges.call(table); next(); });
    bottomChildren.push(nextBtn);

    const previousBtn = createButton({
      innerHTML: "&#8592;", // left arrow
    });
    previousBtn.addEventListener("click", function () { applyChanges.call(table); previous(); });
    bottomChildren.unshift(previousBtn);
  }

  const bottom = createElement("center", { children: bottomChildren });
  return createElement("section", { children: [table, bottom] });
}

function getDetailsTableDataMap() {
  const dataMap = {};

  const tissues = dataHandler.tissues;
  const links = {
    family: {
      title: "Family",
      data(geneData, familyIdx, geneIdx) {
        return createLinkElement(geneData.family, () => createTableUI(createSingleDetailsTable(geneData, familyIdx, geneIdx, [
          { title: "Identifier", data() {return geneData.family} },
          {
            title: "Genes",
            data() {
              return createLinkElement(`Inspect ${dataHandler.getGeneCount(familyIdx)} members`, () => createTableUI(createMasterTable(
                { elements: dataHandler.genes(familyIdx).map(gene => ({family: familyIdx, gene})) },
                (family, gene) => dataHandler.getGeneData(family, gene),
                dataMap.Gene
              ), "Details"))
            }
          },
          { title: "Description", data() {return "..."}},
        ]), "SingleDetails"));
      }
    },
    gene: {
      title: "Gene",
      data(geneData, familyIdx, geneIdx) {
        return createLinkElement(geneData.genes, () => createTableUI(createSingleDetailsTable(geneData, familyIdx, geneIdx, [
          { title: "Identifier", data() {return geneData.genes } },
          links.family,
          { title: "Type", data(geneData) {return geneData.is_outlier ? "Outlier" : "Inlier"} },
          { title: "Species", data() {return geneData.species} },
          { title: "Description", data() {return "..."} },
          ...tissues.map((tissue, i) => {
            return { title: tissue, data() {return geneData.coordinates[i]} }
          })
        ]), "SingleDetails"));
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
    links.family
  ];
  dataMap.Centroid = [
    links.family,
    ...tissueRelated
  ];
  return dataMap;
}

function createMasterTable({ elements, familyOnly, parentTable }, getData, headerMap, bodyOnly=false) {
  const tbody = createElement("tbody");

  if ((parentTable !== undefined) && (elements !== undefined)) {
    elements = elements.filter(({ family, gene }) => parentTable.TOX_isSelected(family, gene));
  }

  function generateRows(elements, firstFamily, firstGene, { lastBefore, firstAfter }) {
    if (elements === undefined) {
      elements = [];

      if (firstAfter !== undefined) {
        const familyCount = dataHandler.getFamilyCount();
        if (firstGene === undefined) {
          for (let family = firstFamily; (family < familyCount) && (elements.length < firstAfter); family++) {
            elements.push({ family });
          }
        } else {
          let geneCount = dataHandler.getGeneCount(firstFamily);
          while ((elements.length < firstAfter) && (firstFamily < familyCount)) {
            if (firstGene < geneCount) {
              elements.push({ family: firstFamily, gene: firstGene });
              firstGene++;
            } else {
              firstFamily++;
              firstGene = 0;
              geneCount = dataHandler.getGeneCount(firstFamily);
            }
          }
        }
      } else {
        if (firstGene === undefined) {
          for (let family = firstFamily - 1; (family >= 0) && (elements.length < lastBefore); family--) {
            elements.push({ family });
          }
        } else {
          while (elements.length < lastBefore) {
            firstGene--;
            if (firstGene >= 0) {
              elements.push({ family: firstFamily, gene: firstGene });
            } else {
              firstFamily--;
              if (firstFamily === -1) break;
              firstGene = dataHandler.getGeneCount(firstFamily);
            }
          }
        }
      }
    } else {
      const lastElement = elements.findIndex(({ family, gene }) => ((family == firstFamily) && (gene == firstGene)));
      if (firstAfter !== undefined) {
        elements = elements.slice(lastElement + 1, lastElement + paginationStep + 1 );
      } else {
        if (lastElement > -1) {
          elements = elements.slice(lastElement - paginationStep, lastElement);
        } else {
          return;
        }
      }
    }

    if (elements.length > 0) {
      tbody.innerText = "";
      for (const { family, gene } of elements) {
        const row = createElement("tr", { "tox-family": family, "tox-gene": gene });
        const rowSelector = createRowSelector(false, family, gene, "Gene");
        const table = tbody.closest("table");
        if (table !== null) {
          if (table.TOX_isSelected(family, gene)) {
            rowSelector.querySelector(".row-selector").checked = true;
            row.classList.add("selected");
          }
        }
        row.appendChild(rowSelector);

        const data = getData(family, gene);
        for (const cell of headerMap) {
          const td = createElement("td", {
            children: [cell.data(data, family, gene)]
          });
          row.appendChild(td);
        }

        tbody.appendChild(row);
      }
    }
  }

  const paginationStep = 10;
  if (familyOnly) {
    generateRows(elements, -1, undefined, { firstAfter: paginationStep });
  } else {
    generateRows(elements, -1, -1, { firstAfter: paginationStep });
  }

  if (bodyOnly) {
    return tbody;
  } else {
    const headerCells = headerMap.map(({ title }) => createElement("th", { children: [title] }))
    const thead = createElement("thead", {
      children: [createElement("tr", { children: [createRowSelector(true), ...headerCells] })]
    });

    const table = createDataTable({ children: [thead, tbody]});
    table.TOX_elements = elements;
    table.TOX_familyOnly = familyOnly;
    table.TOX_selectedRows = new Set();
    table.TOX_allSelectorState = false;
    table.TOX_rowID = (family, gene) => `${family}_${gene}`;
    table.TOX_isSelected = function (family, gene) {
      return this.TOX_allSelectorState !== this.TOX_selectedRows.has(this.TOX_rowID(family, gene));
    }

    const result = {
      table,
      next(checkOnly=false) {
        const lastFamily = Number(tbody.lastChild.getAttribute("tox-family"));
        if (familyOnly) {
          if (lastFamily < dataHandler.getFamilyCount()) {
            generateRows(elements, lastFamily, undefined, { firstAfter: paginationStep });
          }
        } else {
          const lastGene = Number(tbody.lastChild.getAttribute("tox-gene"));
          if (lastGene + 1 < dataHandler.getGeneCount(lastFamily) || lastFamily + 1 < dataHandler.getFamilyCount()) {
            generateRows(elements, lastFamily, lastGene, { firstAfter: paginationStep });
          }
        }
      },
      previous(checkOnly=false) {
        const firstFamily = Number(tbody.firstChild.getAttribute("tox-family"));
        if (familyOnly) {
          if (firstFamily > 0) {
            generateRows(elements, firstFamily, undefined, { lastBefore: paginationStep });
          }
        } else {
          const firstGene = Number(tbody.firstChild.getAttribute("tox-gene"));
          if (firstGene > 0 || firstFamily > 0) {
            generateRows(elements, firstFamily, firstGene, { lastBefore: paginationStep });
          }
        }
      }
    }
    return result;
  }
}

function createSingleDetailsTable(geneData, familyIdx, geneIdx, headerMap) {
  const tBody = createElement("tbody");
  for (const header of headerMap) {
    const tr = createElement("tr", {
      children: [
        createElement("td", { children: [header.title] }),
        createElement("td", { children: [header.data(geneData, familyIdx, geneIdx)] })
      ]
    });
    tBody.appendChild(tr);
  }

  return {
    table: createDataTable({ children: [tBody]})
  };
}

function createLinkElement(value, linkContent) {
  const a = createElement("a", {
    textContent: value,
    classes: ["clickable"]
  });
  a.addEventListener("click", evt => {
    evt.preventDefault();
    show(linkContent());
  });
  return a;
}

function show(content, onClose) {
  const dialog = createElement("dialog", { children: [content] });
  dialog.addEventListener("close", () => {
    onClose?.call(content);
    dialog.remove();
  });
  document.getElementById("UI")?.appendChild(dialog);
  dialog.showModal();
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
    const button = createButton({
      id: "detailBtn",
      textContent: "Detail",
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
});

function createButton(options) {
  return createElement("button", {
    type: "button",
    ...options,
    classes: ["clickable", ...(options.classes ?? [])],
  });
}

function createDataTable(options) {
  return createElement("table", { ...options, classes: ["datatable", "textselect", ...(options.classes ?? [])] });
}

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