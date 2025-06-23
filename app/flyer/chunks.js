"use strict";

import { Color, Vector, Mesh } from "./babylon.js";

export function getChunks(scene) {
  const chunks = {
    scene,
    get sight() {
      // you see the chunks that are in range, plus the one you are in -> you always see at least the chunk you are in
      return (this.loadRange + 0.5) * this.diameter
    },
    chunks: new Map(),
    active: [],
    recalculate() {
      // Each key in this object corresponds to a chunk's centroid in string form.
      this.load(false);
      this.chunks.clear();
      this.scale = config.get("scale");
      this.diameter = config.get("chunkDiameter");
      this.loadRange = config.get("chunkLoadRange");
      this.tissues = [config.get("tissueX"), config.get("tissueY"), config.get("tissueZ")]
      this.families = config.get("shownFamilies") ?? dataHandler.families;
      
      const position = this.scene.activeCamera.position.asArray();
      this.currentChunkCentroid = getChunkCentroid(position, this.diameter);

      // Loop through each family available in the data handler.
      // For each family, iterate through the genes for specific tissues
      // and create an instance of the outlier mesh for each data point.
      for (const family of this.families) {
        const geneCount = dataHandler.getGeneCount(family);
        for (let geneIndex = 0; geneIndex < geneCount; geneIndex++) {
          const { coordinates, is_outlier } = dataHandler.getGeneData(family, geneIndex, this.tissues, ["is_outlier"]);
          const scaled = coordinates.map((v) => v*this.scale);

          // Determine the centroid of the chunk this position falls into.
          // getChunkCentroid is assumed to return an array-like coordinate (e.g. [x, y, z])
          // which is also used as a key in the `chunks` object.
          const centroid = getChunkCentroid(scaled, this.diameter).toString();

          if (!this.chunks.has(centroid)) {
            this.chunks.set(centroid, [new Map(), 0, 0, new Map()]);
          }

          const genes = this.chunks.get(centroid)[0];
          if (!genes.has(family)) {
            genes.set(family, [[], []]);
          }
          genes.get(family)[is_outlier ? 1 : 0].push(geneIndex);
          this.chunks.get(centroid)[1] += !is_outlier;
          this.chunks.get(centroid)[2] += is_outlier;
        }
      }

      this.active = calcActiveChunks(this, position);
    },
    load(state=true, centroid) {
      let chunks;
      if (centroid === undefined) {
        chunks = this.active.map(c => [c, this.chunks.get(c)]);
      } else {
        const chunk = this.chunks.get(centroid);
        chunks = [[centroid.toString(), chunk]];
      }
      if (state) {
        for (const [centroid, chunkData] of chunks) {
          if (chunkData === undefined) {
            this.chunks.set(centroid, [new Map(), 0, 0, new Map([ ["grid", create3DGridFromCentroidString(this, centroid)] ])]);
            continue;
          }
          const [genes, inlierCount, outlierCount, meshes] = chunkData;

          for (const [key, mesh] of meshes) {
            mesh.dispose();
            meshes.delete(key);
          }

          meshes.set("grid", create3DGridFromCentroidString(this, centroid));

          // data points -- spheres
          const sphereDimensionsBuffer = new Float32Array(16 * inlierCount); // the translation buffer for one position takes 16 entries (it is a 4x4 rotation matrix)
          const sphereColorBuffer = new Float32Array(4 * inlierCount); // rgba
          if (sphereColorBuffer.length > 0) { // false if all members are outliers
            meshes.set("inliers", Mesh.Sphere(this.scene));
          }

          // outliers -- octahedrons
          const octDimensionsBuffer = new Float32Array(16 * outlierCount); // the translation buffer for one position takes 16 entries (it is a 4x4 rotation matrix)
          const octColorBuffer = new Float32Array(4 * outlierCount); // rgba
          if (outlierCount > 0) {
            const mesh = Mesh.Octahedron(this.scene);
            mesh.enableEdgesRendering();
            mesh.edgesWidth = config.get("defaultDiameter") * 12;
            mesh.edgesColor = Color(0, 0, 0, 1); // Black edges
            mesh.edgesShareWithThinInstances = true;
            meshes.set("outliers", mesh);
          }

          let inlierIndex = 0;
          let outlierIndex = 0;
          for (const [family, [inliers, outliers]] of genes) {
            const familyColor = Color.FromHexString(config.get(`${family}_Color`) ?? dataHandler.getColor(family));
            for (const geneIndex of inliers) {
              const diameter = config.get(`${family}_Diameter`) ?? config.get("defaultDiameter");
              const pointData = dataHandler.getGeneData(family, geneIndex, this.tissues, []);
              fillThinInstanceBuffers(
                sphereDimensionsBuffer, inlierIndex * 16,
                sphereColorBuffer, inlierIndex * 4,
                diameter,
                pointData.coordinates.map(v => v * this.scale),
                familyColor
              );
              inlierIndex++;
            }
            const outlierColorHex = config.get(`${family}_OutlierColor`);
            const outlierColor = outlierColorHex === undefined ? familyColor : Color.FromHexString(outlierColorHex);
            for (const geneIndex of outliers) {
              const pointData = dataHandler.getGeneData(family, geneIndex, this.tissues, []);
              const diameter = config.get(`${family}_OutlierDiameter`) ?? config.get("defaultDiameter");
              fillThinInstanceBuffers(
                octDimensionsBuffer, outlierIndex * 16,
                octColorBuffer, outlierIndex * 4,
                diameter,
                pointData.coordinates.map(v => v * this.scale),
                outlierColor
              );
              outlierIndex++;
            }
          }
          if (inlierIndex !== inlierCount || outlierIndex !== outlierCount) {
            console.error("Misfilled buffers", inlierIndex, inlierCount, outlierIndex, outlierCount);
          }

          meshes.get("inliers")?.thinInstanceSetBuffer("matrix", sphereDimensionsBuffer, 16);
          meshes.get("inliers")?.thinInstanceSetBuffer("color", sphereColorBuffer, 4);
          meshes.get("outliers")?.thinInstanceSetBuffer("matrix", octDimensionsBuffer, 16);
          meshes.get("outliers")?.thinInstanceSetBuffer("color", octColorBuffer, 4);
        }
      } else {
        for (const [centroid, chunkData] of chunks) {
          if (chunkData[0].size > 0) {
            const meshes = chunkData[3];
            for (const [key, mesh] of meshes) {
              mesh.dispose();
              meshes.delete(key);
            }
          } else {
            this.chunks.delete(centroid);
          }
        }
      }
    }
  };

  chunks.recalculate();
  chunks.load();
  registerLoading(chunks)
  return chunks;
}

function calcActiveChunks(chunks, [posX, posY, posZ]) {
  const activeChunks = [];
  const offset = chunks.sight + chunks.diameter / 2;
  for (let x = posX - offset; x <= posX + offset; x+=chunks.diameter) {
    for (let y = posY - offset; y <= posY + offset; y+=chunks.diameter) {
      for (let z = posZ - offset; z <= posZ + offset; z+=chunks.diameter) {
        const centroid = getChunkCentroid([x, y, z], chunks.diameter);
        if (
          Math.abs(centroid[0] - posX) < chunks.sight &&
          Math.abs(centroid[1] - posY) < chunks.sight &&
          Math.abs(centroid[2] - posZ) < chunks.sight
        ) {
          activeChunks.push(centroid.toString());
        }
      }
    }
  }

  if (activeChunks.length !== (chunks.loadRange*2 + 1)**3) {
    console.error(`Number of active chunks does not match, expected ${(chunks.loadRange*2 + 1)**3}, got ${activeChunks.length}`);
  }
  return activeChunks;
}

function registerLoading(chunks) {
  /**
   * Register a callback that fires before every render.
   * This callback compares the current chunk centroid (from config)
   * with the previous one and determines which neighboring chunks need to be loaded/unloaded.
   */
  chunks.scene.registerBeforeRender(() => {
    // Get the current chunk centroid from the config position.
    const newChunkCentroid = getChunkCentroid(
      [ chunks.scene.activeCamera.position.x, chunks.scene.activeCamera.position.y, chunks.scene.activeCamera.position.z ],
      chunks.diameter
    );

    if (!chunks.currentChunkCentroid.every((axis, i) => axis === newChunkCentroid[i])) {
      const newActive = calcActiveChunks(chunks, newChunkCentroid);
      newActive.forEach((centroid) => {
        if (!chunks.active.includes(centroid)) {
          chunks.load(true, centroid);
        }
      });
      chunks.active.forEach((centroid, i) => {
        if (!newActive.includes(centroid)) {
          chunks.load(false, centroid);
        }
      });
      chunks.active = newActive;
      chunks.currentChunkCentroid = newChunkCentroid;
    }
  });
}

function fillThinInstanceBuffers(dimensionsBuffer, dIndex, colorBuffer, cIndex, diameter, [x, y, z], color) {
  dimensionsBuffer[dIndex] = diameter; // set x scale
  dimensionsBuffer[dIndex + 5] = diameter; // set y scale
  dimensionsBuffer[dIndex + 10] = diameter; // set z scale

  dimensionsBuffer[dIndex + 12] = x;
  dimensionsBuffer[dIndex + 13] = y;
  dimensionsBuffer[dIndex + 14] = z;

  dimensionsBuffer[dIndex + 15] = 1;
  // the unchanged indices affect the rotation of the sphere -> zero 

  // setting color
  colorBuffer[cIndex++] = color.r;
  colorBuffer[cIndex++] = color.g;
  colorBuffer[cIndex++] = color.b;
  colorBuffer[cIndex] = color.a;
}

function getChunkCentroid([ x, y, z ], diameter) {
  function trim(a) {
    return Math.floor((a + diameter / 2) / diameter) * diameter;
  }
  return [trim(x), trim(y), trim(z)];
}

function create3DGridFromCentroidString(chunks, centroid) {
  const [chunkX, chunkY, chunkZ] = centroid.split(",").map(Number);
  const chunkRadius = chunks.diameter / 2;
  const gridStep = 10;
  const lines = [];

  const left = chunkX - chunkRadius;
  let firstLineLeft = left < 0 ? left - left % gridStep : left + 10 - left % gridStep;
  const right = chunkX + chunkRadius;
  const bottom = chunkY - chunkRadius;
  let firstLineBottom = bottom < 0 ? bottom - bottom % gridStep : bottom + 10 - bottom % gridStep;
  const top = chunkY + chunkRadius;
  const back = chunkZ - chunkRadius;
  let firstLineBack = back < 0 ? back - back % gridStep : back + 10 - back % gridStep;
  const front = chunkZ + chunkRadius;
  for (let z = firstLineBack; z <= front; z+=gridStep) {
    for (let y = firstLineBottom; y <= top; y+=gridStep) {
      lines.push([Vector(left, y, z), Vector(right, y, z)]);
    }
  }
  for (let z = firstLineBack; z <= front; z+=gridStep) {
    for (let x = firstLineLeft; x <= right; x+=gridStep) {
      lines.push([Vector(x, bottom, z), Vector(x, top, z)]);
    }
  }
  for (let y = firstLineBottom; y <= top; y+=gridStep) {
    for (let x = firstLineLeft; x <= right; x+=gridStep) {
      lines.push([Vector(x, y, back), Vector(x, y, front)]);
    }
  }

  const grid = BABYLON.MeshBuilder.CreateLineSystem(null, { lines }, chunks.scene);
  grid.color = Color(.5, .5, .5);
  return grid;
}