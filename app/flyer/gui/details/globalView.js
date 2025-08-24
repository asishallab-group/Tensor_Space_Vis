"use strict";

import {
  createTableUIWithCustomizationButton,
  getDetailsTableDataMap,
  createDetailsDialog,
  createMultiView
} from "./tables.js";
import {
  createMasterTable
} from "../dom.js";

export function createGlobalView() {
  const { Gene, Family } = getDetailsTableDataMap("Gene", "Family");
  createDetailsDialog({
    id: "globalView",
    children: [
      createMultiView({
        Genes: createTableUIWithCustomizationButton(createMasterTable({}, (family, gene) => dataHandler.getGeneData(family, gene), Gene), "Gene"),
        Families: createTableUIWithCustomizationButton(createMasterTable({ familyOnly: true }, family => dataHandler.getFamilyData(family), Family), "Family"),
      })
    ]
  });
}