"use strict"
export const Mesh = {
  Sphere(scene, name, options={}) {
    return BABYLON.MeshBuilder.CreateSphere(name, { diameter: 1, segments: 16, ...options }, scene);
  },
  Octahedron(scene, name) {
    return BABYLON.MeshBuilder.CreatePolyhedron(name, { type: 2, size: 0.5, flat: false }, scene);
  },
  setColor(sphere, color) {
    sphere.material.diffuseColor = typeof color === "string" ? Color.FromHexString(color) : color;
    sphere.material.alpha = sphere.material.diffuseColor.a;
  },
  setSize(sphere, diameter) {
    sphere.scaling = Vector(diameter, diameter, diameter);
  }
};
Object.freeze(Mesh);


export function Vector(x, y, z) {
  return new BABYLON.Vector3(x, y, z);
}

export function OrbitCam(scene, name) {
  const cam = new BABYLON.ArcRotateCamera(name, null, null, 10, Vector(0, 0, 0), scene);
  cam.lowerRadiusLimit = 1;
  return cam;
}

export function UniversalCam(scene, name) {
  return new BABYLON.UniversalCamera(name, Vector(0, 0, 0), scene);
}

export function calcVectorDistance(v1, v2) {
  return BABYLON.Vector3.Distance(v1, v2);
}

export function WebGPUEngine(canvas, options) {
  return new BABYLON.WebGPUEngine(canvas, options);
}

export function WebGLEngine(canvas, options) {
  return new BABYLON.Engine(canvas, options.antialias ?? true, options);
}

export function Scene(engine) {
  return new BABYLON.Scene(engine);
}
Scene.FOGMODE_LINEAR = BABYLON.Scene.FOGMODE_LINEAR;

export function Color(r, g, b, a) {
  if (typeof r === "string") {
    return Color.FromHexString(r);
  } else if (r instanceof BABYLON.Color3 || r instanceof BABYLON.Color4) {
    return r;
  } else if (a === undefined) {
    return new BABYLON.Color3(r, g, b);
  } else {
    return new BABYLON.Color4(r, g, b, a);
  }
}
Color.FromHexString = (hexString) => {
    return BABYLON.Color4.FromHexString(hexString);
}

export function Viewport(left, top, width, height) {
  return new BABYLON.Viewport(left, top, width, height);
}

export function Light(scene, name, direction) {
  return new BABYLON.HemisphericLight(name, direction, scene);
}

export function TransformNode(scene, name) {
  return new BABYLON.TransformNode(name, scene);
}

export function Material(scene, name, color) {
  const material = new BABYLON.StandardMaterial(name, scene);
  if (color) {
    Mesh.setColor({material}, color);
  }
  return material;
}
