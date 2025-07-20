"use strict";

import { Color, Vector, Mesh, fillThinInstanceBuffers, getInstanceMatrix, decomposeMatrix } from "../babylon.js";

export function getChunks(scene) {
  const chunks = {
    scene,
    get sight() {
      // you see the chunks that are in range, plus the one you are in -> you always see at least the chunk you are in
      return (this.loadRange + 0.5) * this.diameter
    },
    chunks: new Map(),
    active: [],
    initChunk(centroid) {
      if (!this.chunks.has(centroid)) {
        this.chunks.set(centroid, [new Map(), {inliers: 0, outliers: 0, centroids: 0}, new Map()]);
      }
    },
    recalculate() {
      // Each key in this object corresponds to a chunk's centroid in string form.
      this.load(false);
      this.chunks.clear();
      this.scale = config.get("scale");
      this.diameter = config.get("chunkDiameter");
      this.loadRange = config.get("chunkLoadRange");
      this.tissues = [config.get("tissueX"), config.get("tissueY"), config.get("tissueZ")]
      this.families = config.get("shownFamilies");
      
      const position = this.scene.activeCamera.position.asArray();
      this.currentChunkCentroid = getChunkCentroid(position, this.diameter);

      const handleMember = (family, coordinates, memberType, geneIndex) => {
        const scaled = coordinates.map((v) => v*this.scale);

        // Determine the centroid of the chunk this position falls into.
        // getChunkCentroid is assumed to return an array-like coordinate (e.g. [x, y, z])
        // which is also used as a key in the `chunks` object.
        const centroid = getChunkCentroid(scaled, this.diameter).toString();

        this.initChunk(centroid);

        const [genes, counts] = this.chunks.get(centroid);
        if (!genes.has(family)) {
          genes.set(family, {});
        }
        const members = genes.get(family);
        if (geneIndex !== undefined) {
          members[memberType] ??= [];
          members[memberType].push(geneIndex);
        } else {
          members[memberType] = true;
        }
        counts[memberType]++;
      }

      // Loop through each family available in the data handler.
      // For each family, iterate through the genes for specific tissues
      // and create an instance of the outlier mesh for each data point.
      for (const family of this.families) {
        for (const geneIndex of dataHandler.genes(family)) {
          const { coordinates, is_outlier } = dataHandler.getGeneData(family, geneIndex, this.tissues, ["is_outlier"]);
          const memberType = is_outlier ? "outliers" : "inliers";
          handleMember(family, coordinates, memberType, geneIndex);
        }
        const familyCentroid = dataHandler.getFamilyData(family, ...this.tissues).centroid;
        handleMember(family, familyCentroid, "centroids");
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
          const [genes, counts, meshes] = chunkData;
          for (const [key, mesh] of meshes) {
            mesh.dispose();
            meshes.delete(key);
          }

          meshes.set("grid", create3DGridFromCentroidString(this, centroid));
          if (genes.size === 0) {
            continue;
          }

          const ctx = {};

          // data points -- spheres
          if (counts.inliers > 0) {
            ctx.inliers = {
              dimensionBuffer: new Float32Array(16 * counts.inliers), // the translation buffer for one position takes 16 entries (it is a 4x4 rotation matrix)
              colorBuffer: new Float32Array(4 * counts.inliers), // rgba
              bufferIndex: 0
            }
            meshes.set("inliers", Mesh.Sphere(this.scene));
          }

          if (counts.centroids > 0) {
            ctx.centroids = {
              dimensionBuffer: new Float32Array(16 * counts.centroids), // the translation buffer for one position takes 16 entries (it is a 4x4 rotation matrix)
              colorBuffer: new Float32Array(4 * counts.centroids), // rgba
              bufferIndex: 0
            }
            meshes.set("centroids", Mesh.Sphere(this.scene));
          }

          // outliers -- octahedrons
          if (counts.outliers > 0) {
            ctx.outliers = {
              dimensionBuffer: new Float32Array(16 * counts.outliers), // the translation buffer for one position takes 16 entries (it is a 4x4 rotation matrix)
              colorBuffer: new Float32Array(4 * counts.outliers), // rgba
              bufferIndex: 0
            }
            const mesh = Mesh.Octahedron(this.scene);
            mesh.enableEdgesRendering();
            mesh.edgesWidth = 3;
            mesh.edgesColor = Color(0, 0, 0, 1); // Black edges
            mesh.edgesShareWithThinInstances = true;
            meshes.set("outliers", mesh);
          }

          for (const [family, members] of genes) {

            for (const [memberType, geneIndices] of Object.entries(members)) {
              const memberCtx = ctx[memberType];

              const addInstance = (coordinates, diameter, color) => {
                const position = Vector(...coordinates.map(v => v * this.scale));
                const scaling = Vector(diameter, diameter, diameter);
                const instanceMatrix = getInstanceMatrix(
                  position,
                  scaling
                );
                fillThinInstanceBuffers(
                  memberCtx.dimensionBuffer, memberCtx.bufferIndex * 16,
                  instanceMatrix,
                  memberCtx.colorBuffer, memberCtx.bufferIndex * 4,
                  color
                );
                memberCtx.bufferIndex++;
              }

              if (memberType !== "centroids") {
                for (const geneIndex of geneIndices) {
                  const { coordinates } = dataHandler.getGeneData(family, geneIndex, this.tissues, []);
                  const color = Color.FromHexString(config.familyGet(family, "Color", geneIndex));
                  const diameter = config.familyGet(family, "Diameter", geneIndex);
                  addInstance(coordinates, diameter, color);
                }
              } else {
                const show = config.familyGet(family, "Centroid");
                if (show) {
                  const coordinates = dataHandler.getFamilyData(family, ...this.tissues).centroid;
                  let color = Color.FromHexString(config.familyGet(family, "Color"));
                  color = color.scale(2);
                  color.a /= 2;
                  const diameter = config.familyGet(family, "Diameter");
                  addInstance(coordinates, diameter * 4, color);
                } else {
                  memberCtx.bufferIndex++;
                }
              }
            }
          }

          for (const [memberType, memberCtx] of Object.entries(ctx)) {
            if (memberCtx.bufferIndex !== counts[memberType]) {
              console.error(`Misfilled buffers: Expected ${counts[memberType]} ${memberType}, got ${memberCtx.bufferIndex}`);
            }
            const mesh = meshes.get(memberType);
            mesh.thinInstanceSetBuffer("matrix", memberCtx.dimensionBuffer, 16);
            mesh.thinInstanceSetBuffer("color", memberCtx.colorBuffer, 4);
          }
        }
      } else {
        for (const [centroid, [genes, , meshes]] of chunks) {
          if (genes.size > 0) {
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

  const recalculate = chunks.recalculate.bind(chunks);
  const reload = chunks.load.bind(chunks);
  function setFog() {
    scene.fogEnd = chunks.loadRange * chunks.diameter;
    scene.fogStart = 0.5 * chunks.diameter;
  }

  const needsRecalculation = ["tissueX", "tissueY", "tissueZ", "scale", "shownFamilies"];
  const needsReload = ["shownFamilies", "Centroid", "Diameter", "Color", "darkMode"];
  const needsRecalculationAndSetsFog = ["chunkDiameter", "chunkLoadRange"];

  for (const setting of needsRecalculationAndSetsFog) {
    config.onChange(setting, setFog);
  }
  for (const setting of [...needsReload, ...needsRecalculation, ...needsRecalculationAndSetsFog]) {
    config.onChange(setting, reload);
  }

  // has higher priority on update -> first recalculate, then do anything else
  for (const setting of [...needsRecalculation, ...needsRecalculationAndSetsFog]) {
    config.onChange(setting, recalculate, Infinity);
  }

  registerLoading(chunks);

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
          chunks.initChunk(centroid.toString());
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
  grid.freezeWorldMatrix();
  grid.isPickable = false; 
  return grid;
}