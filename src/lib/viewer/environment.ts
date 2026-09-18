import {
  AmbientLight, CircleGeometry, Color, CylinderGeometry, DirectionalLight, FogExp2, Group,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PointLight, RingGeometry, TorusGeometry, type Scene,
} from "three";

export interface ViewerEnvironment {
  id: string;
  spawnRadius: number;
  cameraDistance: number;
  create(scene: Scene): Group;
}

function flat(radius: number, inner: number, color: number, y: number, opacity = 1) {
  const material = new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, side: 2 });
  const mesh = new Mesh(new RingGeometry(inner, radius, 96), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

/** Original SIMVERSE chamber. It is one replaceable environment provider, not a World Editor. */
export const simverseArena: ViewerEnvironment = {
  id: "simverse-arena-v1", spawnRadius: 5.1, cameraDistance: 16,
  create(scene) {
    scene.background = new Color("#070d1b");
    scene.fog = new FogExp2("#080f22", 0.028);
    const group = new Group();
    const foundation = new Mesh(new CylinderGeometry(8.4, 8.7, 0.62, 96), new MeshStandardMaterial({ color: "#18233b", metalness: 0.55, roughness: 0.5 }));
    foundation.position.y = -0.44; foundation.receiveShadow = true; group.add(foundation);
    const floor = new Mesh(new CircleGeometry(8.18, 96), new MeshStandardMaterial({ color: "#142138", metalness: 0.42, roughness: 0.52 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.1; floor.receiveShadow = true; group.add(floor);
    for (const [radius, thickness, color, opacity] of [[7.95, 0.07, 0x46dbf0, 0.9], [6.9, 0.025, 0x4d88ce, 0.36], [5.35, 0.025, 0x77a4fc, 0.25], [2.3, 0.016, 0x58d6ea, 0.24]] as const) {
      group.add(flat(radius, radius - thickness, color, -0.073, opacity));
    }
    for (let i = 0; i < 24; i += 1) {
      const angle = i * Math.PI * 2 / 24;
      const marker = new Mesh(new CylinderGeometry(0.075, 0.11, 0.26, 6), new MeshStandardMaterial({ color: "#154864", emissive: "#2ab8db", emissiveIntensity: 0.8, metalness: 0.5 }));
      marker.position.set(Math.cos(angle) * 8.05, 0.04, Math.sin(angle) * 8.05);
      group.add(marker);
    }
    for (const x of [-6.5, -3.4, 3.4, 6.5]) {
      const pillar = new Mesh(new CylinderGeometry(0.12, 0.24, 2.9, 8), new MeshStandardMaterial({ color: "#1c3754", metalness: 0.6, roughness: 0.35 }));
      pillar.position.set(x, 1.15, -6.2); pillar.castShadow = true; group.add(pillar);
      const beacon = new Mesh(new CylinderGeometry(0.16, 0.16, 0.09, 12), new MeshBasicMaterial({ color: "#53d9ed" }));
      beacon.position.set(x, 2.6, -6.2); group.add(beacon);
    }
    const horizon = new Mesh(new TorusGeometry(5.4, 0.035, 8, 96), new MeshBasicMaterial({ color: "#3986b3", transparent: true, opacity: 0.28, depthWrite: false }));
    horizon.position.set(0, 4.8, -8.4); group.add(horizon);
    const plinth = new Mesh(new CylinderGeometry(0.58, 0.75, 0.08, 32), new MeshStandardMaterial({ color: "#31516c", metalness: 0.8, roughness: 0.3 }));
    plinth.position.y = -0.025; group.add(plinth);
    const core = new Mesh(new CylinderGeometry(0.3, 0.3, 0.02, 32), new MeshBasicMaterial({ color: "#55d9ed" }));
    core.position.y = 0.021; group.add(core);
    const ambient = new AmbientLight("#9ebde8", 1.15); group.add(ambient);
    const key = new DirectionalLight("#dcefff", 3.2);
    key.position.set(-5, 11, 7); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -10; key.shadow.camera.right = 10;
    key.shadow.camera.top = 10; key.shadow.camera.bottom = -10;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 30;
    key.shadow.bias = -0.0005; group.add(key);
    const rim = new DirectionalLight("#637aff", 1.9); rim.position.set(5, 6, -5); group.add(rim);
    const cyan = new PointLight("#25d9f2", 28, 14); cyan.position.set(-6, 2.6, 0); group.add(cyan);
    const violet = new PointLight("#8d69f1", 22, 14); violet.position.set(6, 3, 0); group.add(violet);
    scene.add(group);
    return group;
  },
};
