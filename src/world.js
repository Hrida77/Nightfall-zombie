import * as THREE from 'three';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.lights = [];
    this.trunkGeometry = new THREE.CylinderGeometry(0.18, 0.3, 4.2, 6);
    this.trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x352c24, roughness: 1 });
    this.crownGeometries = [0, 1, 2].map((index) => new THREE.ConeGeometry(1.6 - index * 0.2, 2.7, 7));
    this.crownMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x304033, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x26372c, roughness: 1 }),
    ];
    this.postGeometry = new THREE.CylinderGeometry(0.08, 0.1, 1.3, 6);
    this.postMaterial = new THREE.MeshStandardMaterial({ color: 0x474037, roughness: 1 });
    this.group = new THREE.Group();
    scene.add(this.group);
    this.build();
  }

  build() {
    this.scene.background = new THREE.Color(0x080d11);
    this.scene.fog = new THREE.FogExp2(0x080d11, 0.009);

    const ambient = new THREE.HemisphereLight(0x728294, 0x17130f, 1.05);
    this.scene.add(ambient);
    this.lights.push(ambient);
    const moon = new THREE.DirectionalLight(0xa6c1dc, 1.65);
    moon.position.set(-25, 45, 18);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -80;
    moon.shadow.camera.right = 80;
    moon.shadow.camera.top = 80;
    moon.shadow.camera.bottom = -80;
    this.scene.add(moon);
    this.lights.push(moon);
    const moonGlow = new THREE.PointLight(0x41678e, 22, 38, 2);
    moonGlow.position.set(-12, 15, -20);
    this.scene.add(moonGlow);
    this.lights.push(moonGlow);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshStandardMaterial({ color: 0x242823, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 180),
      new THREE.MeshStandardMaterial({ color: 0x1b1d1b, roughness: 1 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.012;
    road.receiveShadow = true;
    this.group.add(road);

    this.addBuilding(-24, -23, 12, 10, 8, 0x333333);
    this.addBuilding(25, -19, 13, 12, 10, 0x3a3530);
    this.addBuilding(-27, 21, 10, 13, 7, 0x353a38);
    this.addBuilding(29, 28, 15, 11, 9, 0x403833);
    this.addBuilding(-6, -45, 12, 9, 8, 0x363638);
    this.addBuilding(18, 52, 16, 12, 10, 0x353b38);

    for (const [x, z] of [
      [-17, -8], [-32, -4], [-19, 17], [-36, 32], [-13, 37],
      [18, -1], [36, -4], [17, 15], [38, 16], [11, 38],
      [-40, -34], [39, -37], [-41, 47], [42, 49], [-10, -63], [11, 68],
    ]) this.addTree(x, z);

    for (let i = 0; i < 22; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -62 + i * 5.8;
      const post = new THREE.Mesh(this.postGeometry, this.postMaterial);
      post.position.set(side * 7.5, 0.65, z);
      post.castShadow = true;
      this.group.add(post);
    }
  }

  addBuilding(x, z, width, depth, height, color) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.94 });
    const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    this.group.add(building);
    this.colliders.push({ x, z, halfX: width / 2, halfZ: depth / 2 });

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.4, 0.35, depth + 0.4),
      new THREE.MeshStandardMaterial({ color: 0x242626, roughness: 1 }),
    );
    roof.position.set(x, height + 0.12, z);
    roof.castShadow = true;
    this.group.add(roof);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 2.4, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x171817, roughness: 1 }),
    );
    door.position.set(x, 1.2, z + depth / 2 + 0.045);
    this.group.add(door);

    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xb77a3b });
    for (const side of [-1, 1]) {
      const window = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.2), windowMaterial);
      window.position.set(x + side * width * 0.28, height * 0.62, z + depth / 2 + 0.052);
      this.group.add(window);
    }
  }

  addTree(x, z) {
    const trunk = new THREE.Mesh(this.trunkGeometry, this.trunkMaterial);
    trunk.position.set(x, 2.1, z);
    trunk.castShadow = true;
    this.group.add(trunk);
    for (let i = 0; i < 3; i++) {
      const crown = new THREE.Mesh(this.crownGeometries[i], this.crownMaterials[i % 2]);
      crown.position.set(x, 3.5 + i * 1.05, z);
      crown.castShadow = true;
      this.group.add(crown);
    }
    this.colliders.push({ x, z, halfX: 0.42, halfZ: 0.42 });
  }

  randomSpawnPosition(playerPosition) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 25 + Math.random() * 18;
    return new THREE.Vector3(
      THREE.MathUtils.clamp(playerPosition.x + Math.cos(angle) * distance, -82, 82),
      0,
      THREE.MathUtils.clamp(playerPosition.z + Math.sin(angle) * distance, -82, 82),
    );
  }

  dispose() {
    this.scene.remove(this.group);
    for (const light of this.lights) this.scene.remove(light);
    const geometries = new Set();
    const materials = new Set();
    this.group.traverse((object) => {
      if (object.isMesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
        }
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }
}
