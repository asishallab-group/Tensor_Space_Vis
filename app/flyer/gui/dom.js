"use strict";

export function createButton(options) {
  return createElement("button", {
    type: "button",
    ...options,
    classes: ["clickable", ...(options.classes ?? [])],
  });
}

export function createDataTable(options) {
  return createElement("table", { ...options, classes: ["datatable", "textselect", ...(options.classes ?? [])] });
}

export function createToggle(checkboxOptions) {
  const checkbox = createElement("input", {
    ...checkboxOptions,
    type: "checkbox"
  });
  const slider = createElement("span", {
    classes: ["slider", "clickable"]
  });
  
  return createElement("label", {
    children: [checkbox, slider],
    classes: ["toggle"]
  });
}

export function createElement(tag, options={}) {
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

export function show(content, onClose) {
  const dialog = createElement("dialog", { children: [content] });
  document.getElementById("UI")?.appendChild(dialog);
  showModal(dialog, () => {
    onClose?.call(content, content);
    dialog.remove();
  });
}

export function showModal(dialog, onClose) {
  dialog.addEventListener("close", () => {
    onClose?.call(dialog, dialog);
  });
  dialog?.showModal();
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

export function createRowSelector(selectAll, family, gene, type) {
  const checkbox = createElement("input", { type: "checkbox", classes: ["clickable"] });
  if (selectAll) {
    checkbox.id = "selectAll";
    checkbox.addEventListener("change", allSelectorListener);
  } else {
    checkbox.classList.add("row-selector");
    checkbox.addEventListener("change", rowSelectorListener);
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

function rowSelectorListener(evt) {
  const tr = evt.target.closest("tr");
  tr.classList.toggle("selected", evt.target.checked);
}

function allSelectorListener(evt) {
  const table = evt.target.closest("table");
  for (const checkbox of table.getElementsByClassName("row-selector")) {
    if (checkbox.checked !== evt.target.checked) {
      checkbox.checked = evt.target.checked;
      rowSelectorListener({ target: checkbox });
    }
  }
}

export function getNumericAttribute(htmlElement, attribute) {
  const value = htmlElement.getAttribute(attribute);
  return value === "undefined" ? undefined : Number(value);
}

export function createMasterTable({ elements, familyOnly, parentTable }, getData, headerMap, bodyOnly=false) {
  const tbody = createElement("tbody");

  if (parentTable !== undefined) {
    if (elements !== undefined) {
      elements = elements.filter(({ family, gene }) => parentTable.TOX_isSelected(family, gene));
    } else if (!parentTable.TOX_allSelectorState) {
      elements = [...parentTable.TOX_selectedRows].sort().map(id => {
        let [family, gene] = id.split("_");
        family = Number(family);
        gene = gene === "undefined" ? undefined : Number(gene);
        return { family, gene }
      });
    }
  }

  const paginationStep = 10;
  if (familyOnly) {
    generateMasterTableRows(tbody, elements, -1, undefined, getData, headerMap, { firstAfter: paginationStep }, parentTable);
  } else {
    generateMasterTableRows(tbody, elements, -1, -1, getData, headerMap, { firstAfter: paginationStep }, parentTable);
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
    Object.defineProperty(table, "TOX_elementCount", {
      get() {
        return this.TOX_elements?.length ?? Infinity;
      }
    });
    table.TOX_rowID = (family, gene) => `${family}_${gene}`;
    table.TOX_isSelected = function (family, gene) {
      return this.TOX_allSelectorState !== this.TOX_selectedRows.has(this.TOX_rowID(family, gene));
    }

    const result = {
      table,
      next(checkOnly=false) {
        const lastFamily = getNumericAttribute(tbody.lastChild, "tox-family");
        if (familyOnly) {
          if (lastFamily < dataHandler.getFamilyCount()) {
            generateMasterTableRows(tbody, elements, lastFamily, undefined, getData, headerMap, { firstAfter: paginationStep }, parentTable);
          }
        } else {
          const lastGene = getNumericAttribute(tbody.lastChild, "tox-gene");
          if (lastGene + 1 < dataHandler.getGeneCount(lastFamily) || lastFamily + 1 < dataHandler.getFamilyCount()) {
            generateMasterTableRows(tbody, elements, lastFamily, lastGene, getData, headerMap, { firstAfter: paginationStep }, parentTable);
          }
        }
      },
      previous(checkOnly=false) {
        const firstFamily = getNumericAttribute(tbody.firstChild, "tox-family");
        if (familyOnly) {
          if (firstFamily > 0) {
            generateMasterTableRows(tbody, elements, firstFamily, undefined, getData, headerMap, { lastBefore: paginationStep }, parentTable);
          }
        } else {
          const firstGene = getNumericAttribute(tbody.firstChild, "tox-gene");
          if (firstGene > 0 || firstFamily > 0) {
            generateMasterTableRows(tbody, elements, firstFamily, firstGene, getData, headerMap, { lastBefore: paginationStep }, parentTable);
          }
        }
      }
    }
    return result;
  }
}

function generateMasterTableRows(tbody, elements, familyCursor, geneCursor, getData, headerMap, { lastBefore, firstAfter }, parentTable) {
  if (elements === undefined) {
    elements = [];

    if (firstAfter !== undefined) {
      const familyCount = dataHandler.getFamilyCount();
      if (geneCursor === undefined) {
        for (let family = familyCursor + 1; (family < familyCount) && (elements.length < firstAfter); family++) {
          if (parentTable === undefined || parentTable.TOX_isSelected(family)) {
            elements.push({ family });
          }
        }
      } else {
        let geneCount = dataHandler.getGeneCount(familyCursor);
        geneCursor++;
        while ((elements.length < firstAfter) && (familyCursor < familyCount)) {
          if (geneCursor < geneCount) {
            if (parentTable === undefined || parentTable.TOX_isSelected(familyCursor, geneCursor)) {
              elements.push({ family: familyCursor, gene: geneCursor });
            }
            geneCursor++;
          } else {
            familyCursor++;
            geneCursor = 0;
            geneCount = dataHandler.getGeneCount(familyCursor);
          }
        }
      }
    } else {
      if (geneCursor === undefined) {
        for (let family = familyCursor - 1; (family >= 0) && (elements.length < lastBefore); family--) {
          if (parentTable === undefined || parentTable.TOX_isSelected(family)) {
            elements.unshift({ family });
          }
        }
      } else {
        while (elements.length < lastBefore) {
          geneCursor--;
          if (geneCursor >= 0) {
            if (parentTable === undefined || parentTable.TOX_isSelected(familyCursor, geneCursor)) {
              elements.unshift({ family: familyCursor, gene: geneCursor });
            }
          } else {
            familyCursor--;
            if (familyCursor === -1) break;
            geneCursor = dataHandler.getGeneCount(familyCursor);
          }
        }
      }
    }
  } else {
    const lastElement = elements.findIndex(({ family, gene }) => ((family == familyCursor) && (gene == geneCursor)));
    if (firstAfter !== undefined) {
      elements = elements.slice(lastElement + 1, lastElement + firstAfter + 1 );
    } else {
      if (lastElement > -1) {
        elements = elements.slice(lastElement - lastBefore, lastElement);
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

export function createSingleDetailsTable(geneData, familyIdx, geneIdx, headerMap) {
  const tBody = createElement("tbody");
  for (const header of headerMap) {
    const tr = createElement("tr", {
      "tox-family": familyIdx,
      "tox-gene": geneIdx,
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

export function createTableUI({ table, next, previous }, { bottomChildren, afterRowSelection, beforePageSwitch }) {
  if (typeof afterRowSelection === "function") {
    table.addEventListener("change", evt => {
      selectorHandler(evt);
      afterRowSelection(table, evt);
    });
  } else {
    table.addEventListener("change", selectorHandler);
  }

  bottomChildren ??= [];

  const doneButton = createButton({ innerText: "Done" });
  doneButton.addEventListener("click", function () {this.closest("dialog")?.close()});
  bottomChildren.push(doneButton);

  if ((typeof next === "function") && (typeof previous === "function")) {
    const nextBtn = createButton({
      innerHTML: "&#8594;", // right arrow
    });
    const previousBtn = createButton({
      innerHTML: "&#8592;", // left arrow
    });

    if (typeof beforePageSwitch === "function") {
      nextBtn.addEventListener("click", evt => {
        beforePageSwitch(table, evt);
        next(evt);
      });
      previousBtn.addEventListener("click", evt => {
        beforePageSwitch(table, evt);
        previous(evt);
      });
    } else {
      nextBtn.addEventListener("click", next);
      previousBtn.addEventListener("click", previous);
    }
    bottomChildren.push(nextBtn);
    bottomChildren.unshift(previousBtn);
  }

  const bottom = createElement("center", {
    children: bottomChildren
  });
  return createElement("section", { children: [table, bottom] });
}

function selectorHandler({ target }) {
  const table = target.closest("table");
  if (target.id === "selectAll") {
    table.TOX_selectedRows.clear();
    table.TOX_allSelectorState = target.checked;
  } else {
    const row = target.closest("tr");
    if (target.classList.contains("row-selector")) {
      const rowID = table.TOX_rowID(getNumericAttribute(row, "tox-family"), getNumericAttribute(row, "tox-gene"));
      if (target.checked !== table.TOX_allSelectorState) {
        table.TOX_selectedRows.add(rowID);
        if (table.TOX_elementCount === table.TOX_selectedRows.size) {
          table.TOX_selectedRows.clear();
          table.TOX_allSelectorState = !table.TOX_allSelectorState;
          table.querySelector("#selectAll").checked = table.TOX_allSelectorState;
        } else {
          table.querySelector("#selectAll").checked = false;
        }
      } else {
        table.TOX_selectedRows.delete(rowID);
        if (table.TOX_selectedRows.size === 0) {
          table.querySelector("#selectAll").checked = table.TOX_allSelectorState;
        }
      }
    }
  }
}
