import fs from "node:fs";

const positions = [];
const normals = [];
const indices = [];
const faces = [
  [[1,0,0], [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]]],
  [[-1,0,0], [[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]]],
  [[0,1,0], [[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]]],
  [[0,-1,0], [[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]]],
  [[0,0,1], [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],
  [[0,0,-1], [[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]],
];
for (const [normal, corners] of faces) {
  const start = positions.length / 3;
  for (const corner of corners) { positions.push(...corner); normals.push(...normal); }
  indices.push(start,start+1,start+2,start,start+2,start+3);
}
const chunks = [];
const views = [];
let length = 0;
function append(buffer, target) {
  const pad = (4 - length % 4) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
  const index = views.length;
  views.push({ buffer: 0, byteOffset: length, byteLength: buffer.length, ...(target ? { target } : {}) });
  chunks.push(buffer); length += buffer.length;
  return index;
}
const positionView = append(Buffer.from(new Float32Array(positions).buffer), 34962);
const normalView = append(Buffer.from(new Float32Array(normals).buffer), 34962);
const indexView = append(Buffer.from(new Uint16Array(indices).buffer), 34963);
const timeView = append(Buffer.from(new Float32Array([0,0.5,1]).buffer));
const quat = (deg) => [0,0,Math.sin(deg*Math.PI/360),Math.cos(deg*Math.PI/360)];
const idleView = append(Buffer.from(new Float32Array([...quat(0),...quat(8),...quat(0)]).buffer));
const attackView = append(Buffer.from(new Float32Array([...quat(0),...quat(-65),...quat(0)]).buffer));
const victoryView = append(Buffer.from(new Float32Array([...quat(0),...quat(45),...quat(0)]).buffer));
const buffer = Buffer.concat(chunks);
const nodes = [
  { name:"Sentinel", children:[1,2,3,4,5,6,7,8] },
  { name:"Torso", mesh:0, translation:[0,1.25,0], scale:[.85,1.15,.52] },
  { name:"Head", mesh:1, translation:[0,2.18,0], scale:[.62,.45,.55] },
  { name:"Visor", mesh:2, translation:[0,2.2,.3], scale:[.47,.13,.07] },
  { name:"LeftArm", mesh:0, translation:[-.62,1.35,0], scale:[.22,.85,.25] },
  { name:"RightArm", mesh:0, translation:[.62,1.35,0], scale:[.22,.85,.25] },
  { name:"LeftLeg", mesh:1, translation:[-.25,.4,0], scale:[.25,.8,.28] },
  { name:"RightLeg", mesh:1, translation:[.25,.4,0], scale:[.25,.8,.28] },
  { name:"Core", mesh:2, translation:[0,1.37,.31], scale:[.25,.25,.07] },
];
const animations = [
  ["idle",idleView,2], ["attack_1",attackView,5], ["victory",victoryView,2],
].map(([name,view,node]) => ({ name, samplers:[{ input:3, output:view === idleView ? 4 : view === attackView ? 5 : 6, interpolation:"LINEAR" }], channels:[{ sampler:0, target:{ node, path:"rotation" } }] }));
const asset = {
  asset:{ version:"2.0", generator:"SIMVERSE original Phase 5 geometric sentinel" },
  scenes:[{ nodes:[0] }], scene:0, nodes,
  meshes:[0,1,2].map((material) => ({ primitives:[{ attributes:{ POSITION:0,NORMAL:1 }, indices:2, material }] })),
  materials:[
    { pbrMetallicRoughness:{ baseColorFactor:[.13,.73,.86,1], metallicFactor:.65, roughnessFactor:.3 } },
    { pbrMetallicRoughness:{ baseColorFactor:[.06,.1,.2,1], metallicFactor:.75, roughnessFactor:.35 } },
    { pbrMetallicRoughness:{ baseColorFactor:[.44,.94,1,1], metallicFactor:.4, roughnessFactor:.2 } },
  ],
  buffers:[{ uri:`data:application/octet-stream;base64,${buffer.toString("base64")}`, byteLength:buffer.length }],
  bufferViews:views,
  accessors:[
    { bufferView:positionView, componentType:5126, count:24, type:"VEC3", min:[-.5,-.5,-.5], max:[.5,.5,.5] },
    { bufferView:normalView, componentType:5126, count:24, type:"VEC3" },
    { bufferView:indexView, componentType:5123, count:36, type:"SCALAR" },
    { bufferView:timeView, componentType:5126, count:3, type:"SCALAR", min:[0], max:[1] },
    ...[idleView,attackView,victoryView].map((bufferView) => ({ bufferView, componentType:5126, count:3, type:"VEC4" })),
  ],
  animations,
};
fs.mkdirSync("public/models", { recursive:true });
fs.writeFileSync("public/models/simverse-sentinel.gltf", JSON.stringify(asset));
