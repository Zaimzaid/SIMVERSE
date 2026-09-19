import fs from "node:fs";

// Original SIMVERSE Phase 6 test asset. A deliberately small skinned proxy
// validates skeleton cloning and standard clip mapping without third-party art.
const positions = [];
const normals = [];
const indices = [];
const faces = [
  [[1,0,0], [[.5,-1,-.35],[.5,1,-.35],[.5,1,.35],[.5,-1,.35]]],
  [[-1,0,0], [[-.5,-1,.35],[-.5,1,.35],[-.5,1,-.35],[-.5,-1,-.35]]],
  [[0,1,0], [[-.5,1,-.35],[-.5,1,.35],[.5,1,.35],[.5,1,-.35]]],
  [[0,-1,0], [[-.5,-1,.35],[-.5,-1,-.35],[.5,-1,-.35],[.5,-1,.35]]],
  [[0,0,1], [[-.5,-1,.35],[.5,-1,.35],[.5,1,.35],[-.5,1,.35]]],
  [[0,0,-1], [[.5,-1,-.35],[-.5,-1,-.35],[-.5,1,-.35],[.5,1,-.35]]],
];
for (const [normal, corners] of faces) {
  const start = positions.length / 3;
  for (const corner of corners) { positions.push(...corner); normals.push(...normal); }
  indices.push(start,start+1,start+2,start,start+2,start+3);
}
const vertexCount = positions.length / 3;
const joints = new Uint16Array(vertexCount * 4);
const weights = new Float32Array(vertexCount * 4);
for (let index = 0; index < vertexCount; index += 1) {
  joints[index * 4] = positions[index * 3 + 1] > 0 ? 1 : 0;
  weights[index * 4] = 1;
}

const chunks = [];
const views = [];
let length = 0;
function append(buffer, target) {
  const pad = (4 - length % 4) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
  const view = views.length;
  views.push({ buffer:0, byteOffset:length, byteLength:buffer.length, ...(target ? { target } : {}) });
  chunks.push(buffer); length += buffer.length;
  return view;
}
const positionView = append(Buffer.from(new Float32Array(positions).buffer), 34962);
const normalView = append(Buffer.from(new Float32Array(normals).buffer), 34962);
const jointView = append(Buffer.from(joints.buffer), 34962);
const weightView = append(Buffer.from(weights.buffer), 34962);
const indexView = append(Buffer.from(new Uint16Array(indices).buffer), 34963);
const inverseBindView = append(Buffer.from(new Float32Array([
  1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1,
  1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1,
]).buffer));
const timeView = append(Buffer.from(new Float32Array([0,.5,1]).buffer));
const quat = (x, y, z) => {
  const ax=x*Math.PI/360, ay=y*Math.PI/360, az=z*Math.PI/360;
  const sx=Math.sin(ax), cx=Math.cos(ax), sy=Math.sin(ay), cy=Math.cos(ay), sz=Math.sin(az), cz=Math.cos(az);
  return [sx*cy*cz-cx*sy*sz, cx*sy*cz+sx*cy*sz, cx*cy*sz-sx*sy*cz, cx*cy*cz+sx*sy*sz];
};
const clipValues = {
  idle: [quat(0,0,0),quat(0,0,4),quat(0,0,0)],
  run: [quat(-12,0,-8),quat(12,0,8),quat(-12,0,-8)],
  attack_primary: [quat(0,0,0),quat(-42,0,-38),quat(0,0,0)],
  hit_light: [quat(0,0,0),quat(18,0,16),quat(0,0,0)],
  defeated: [quat(0,0,0),quat(0,0,48),quat(0,0,90)],
  victory: [quat(0,0,0),quat(-18,0,20),quat(0,0,0)],
};
const outputViews = Object.fromEntries(Object.entries(clipValues).map(([name, values]) =>
  [name, append(Buffer.from(new Float32Array(values.flat()).buffer))]));
const buffer = Buffer.concat(chunks);
const accessors = [
  { bufferView:positionView, componentType:5126, count:vertexCount, type:"VEC3", min:[-.5,-1,-.35], max:[.5,1,.35] },
  { bufferView:normalView, componentType:5126, count:vertexCount, type:"VEC3" },
  { bufferView:jointView, componentType:5123, count:vertexCount, type:"VEC4" },
  { bufferView:weightView, componentType:5126, count:vertexCount, type:"VEC4" },
  { bufferView:indexView, componentType:5123, count:indices.length, type:"SCALAR" },
  { bufferView:inverseBindView, componentType:5126, count:2, type:"MAT4" },
  { bufferView:timeView, componentType:5126, count:3, type:"SCALAR", min:[0], max:[1] },
];
const outputAccessors = Object.fromEntries(Object.entries(outputViews).map(([name, bufferView]) => {
  const index = accessors.length;
  accessors.push({ bufferView, componentType:5126, count:3, type:"VEC4" });
  return [name, index];
}));
const animations = Object.entries(outputAccessors).map(([name, output]) => ({
  name,
  samplers:[{ input:6, output, interpolation:"LINEAR" }],
  channels:[{ sampler:0, target:{ node:2, path:"rotation" } }],
}));
const asset = {
  asset:{ version:"2.0", generator:"SIMVERSE original Phase 6 rigged proxy" },
  scenes:[{ nodes:[0] }], scene:0,
  nodes:[
    { name:"RiggedProxy", children:[1,3] },
    { name:"RootBone", children:[2] },
    { name:"UpperBone" },
    { name:"SkinnedBody", mesh:0, skin:0, translation:[0,1.02,0] },
  ],
  skins:[{ inverseBindMatrices:5, skeleton:1, joints:[1,2] }],
  meshes:[{ primitives:[{ attributes:{ POSITION:0,NORMAL:1,JOINTS_0:2,WEIGHTS_0:3 }, indices:4, material:0 }] }],
  materials:[{ pbrMetallicRoughness:{ baseColorFactor:[.13,.73,.86,1], metallicFactor:.5, roughnessFactor:.32 } }],
  buffers:[{ uri:`data:application/octet-stream;base64,${buffer.toString("base64")}`, byteLength:buffer.length }],
  bufferViews:views,
  accessors,
  animations,
};
fs.mkdirSync("public/models", { recursive:true });
fs.writeFileSync("public/models/simverse-rigged-proxy.gltf", JSON.stringify(asset));
