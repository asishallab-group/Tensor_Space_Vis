"use strict";

import { createPickedDetailsDialog } from "./details/picked.js";
import { createGlobalView } from "./details/globalView.js";

export function setupDetailView() {
  createPickedDetailsDialog();
  createGlobalView();
}
