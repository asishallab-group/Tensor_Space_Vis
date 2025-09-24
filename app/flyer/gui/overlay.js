"use strict";

import {
  createElement,
  createButton,
  showModal
} from "./dom.js";
import {
  appendDetailRow,
  removeDetailRow
} from "./details/picked.js";

export function createOverlay() {
  createUIdiv();
  setupDetailButton();
  addIcons();
}

function createUIdiv() {
  const flyer = document.getElementById("flyer");
  if (flyer) {
    const canvas = createElement("canvas", { id: "view" });
    flyer.appendChild(canvas);

    document.getElementById("UI")?.remove();
    const UI = createElement("div", { id: "UI" });
    for (const area of ["top-left", "top-mid", "top-right", "mid-right"]) {
      const element = createElement("aside", { id: area });
      UI.appendChild(element);
    }
    flyer.appendChild(UI);
  } else {
    throw new Error('Missing <main id="flyer"></main>');
  }
}

function setupDetailButton() {
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

function createDetailButton() {
  if (!document.getElementById("detailBtn")) {
    const button = createButton({
      id: "detailBtn",
      textContent: "Detail",
    });
    button.addEventListener("click", () => showModal(document.getElementById("pickedDetails")));
    document.getElementById("mid-right")?.appendChild(button);
  }
}

function removeDetailButton() {
  document.getElementById("detailBtn")?.remove();
}

function addIcons() {
  const icons = {
    "top-left": [
      { src: "./images/gear.png", alt: "Settings"},
    ],
    "top-mid": [
      { src: "./images/loupe.png", alt: "Settings", onclick() {showModal(document.getElementById("globalView"))} },
    ]
  }

  for (const [area, areaIcons] of Object.entries(icons)) {
    const areaElement = document.getElementById(area);
    for (const icon of areaIcons) {
      const { onclick, ...rest } = icon;
      const iconElement = createElement("div", {
        children: [createElement("img", {
          height: 1,
          classes: ["icon"],
          ...rest
        })]
      });
      if (typeof onclick === "function") {
        iconElement.firstChild.addEventListener("click", onclick);
        iconElement.firstChild.classList.add("clickable");
      }
      areaElement?.appendChild(iconElement);
    }
  }
}
