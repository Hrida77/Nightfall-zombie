import * as THREE from 'three';

const randomRange = (min, max) => min + Math.random() * (max - min);
const ZOMBIE_STATS = {
  normal: { health: 100, speed: 0.95, damage: 9, scale: 1, skin: 0x718c64, shirt: 0x4c3738 },
  fast: { health: 48, speed: 2.15, damage: 6, scale: 0.82, skin: 0x9c7658, shirt: 0x624337 },
  tank: { health: 260, speed: 0.58, damage: 18, scale: 1.35, skin: 0x657786, shirt: 0x35424b },
};

export class Zombie {
  constructor(scene, position, wave, type = 'normal') {
    this.scene = scene;
    this.group = new THREE.Group();
    this.buildModel();
    scene.add(this.group);
    this.activate(position, wave, type);
  }

  activate(position, wave, type) {
    this.type = Object.prototype.hasOwnProperty.call(ZOMBIE_STATS, type) ? type : 'normal';
    const stats = ZOMBIE_STATS[this.type];
    const waveBonus = Math.max(0, wave - 1);
    this.health = stats.health + waveBonus * (this.type === 'tank' ? 42 : this.type === 'fast' ? 9 : 18);
    this.speed = stats.speed + Math.min(waveBonus * 0.035, 0.75) + randomRange(-0.1, 0.1);
    this.attackDamage = stats.damage + Math.floor(waveBonus * 0.65);
    this.attackCooldown = randomRange(0.2, 0.8);
    this.groanCooldown = randomRange(2.5, 5);
    this.dead = false;
    this.deathTimer = 0;
    this.flashTimer = 0;
    this.group.position.copy(position);
    this.group.rotation.set(0, 0, 0);
    this.group.scale.setScalar(stats.scale);
    this.group.visible = true;
    this.skinMaterial.color.setHex(stats.skin);
    this.shirtMaterial.color.setHex(stats.shirt);
    this.skinMaterial.emissive.setHex(0x000000);
    this.skinMaterial.emissiveIntensity = 0;
  }

  buildModel() {
    const skin = new THREE.MeshStandardMaterial({ color: 0x718c64, roughness: 0.94 });
    const darkSkin = new THREE.MeshStandardMaterial({ color: 0x485a42, roughness: 1 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x4c3738, roughness: 1 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x343b3c, roughness: 1 });
    const eye = new THREE.MeshStandardMaterial({ color: 0xe7bd66, emissive: 0x8c3513, emissiveIntensity: 1.6 });
    this.skinMaterial = skin;
    this.shirtMaterial = shirt;
    const body = (geometry, material, x, y, z) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.userData.zombie = this;
      this.group.add(mesh);
      return mesh;
    };
    body(new THREE.BoxGeometry(0.68, 0.78, 0.38), shirt, 0, 1.12, 0).castShadow = true;
    body(new THREE.SphereGeometry(0.29, 10, 8), skin, 0, 1.78, 0).castShadow = true;
    body(new THREE.BoxGeometry(0.23, 0.62, 0.24), pants, -0.19, 0.38, 0);
    body(new THREE.BoxGeometry(0.23, 0.62, 0.24), pants, 0.19, 0.38, 0);
    body(new THREE.BoxGeometry(0.2, 0.65, 0.22), darkSkin, -0.46, 1.1, 0);
    body(new THREE.BoxGeometry(0.2, 0.65, 0.22), skin, 0.46, 1.1, 0);
    for (const x of [-0.105, 0.105]) {
      const mesh = body(new THREE.SphereGeometry(0.045, 6, 6), eye, x, 1.83, -0.25);
      mesh.castShadow = false;
    }
    const teeth = body(new THREE.BoxGeometry(0.18, 0.055, 0.04), darkSkin, 0, 1.62, -0.27);
    teeth.castShadow = false;
  }

  update(delta, player, onAttack, onGroan) {
    if (this.dead) {
      this.deathTimer += delta;
      this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, Math.PI / 2, Math.min(delta * 5, 1));
      this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, -0.52, Math.min(delta * 3, 1));
      return this.deathTimer > 0.9;
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      const flash = this.skinMaterial;
      flash.emissive.setHex(0x9b2820);
      flash.emissiveIntensity = 1.3;
    } else {
      this.skinMaterial.emissive.setHex(0x000000);
      this.skinMaterial.emissiveIntensity = 0;
    }

    const dx = player.position.x - this.group.position.x;
    const dz = player.position.z - this.group.position.z;
    const distance = Math.hypot(dx, dz);
    this.group.rotation.y = Math.atan2(-dx, -dz);
    this.groanCooldown -= delta;
    if (this.groanCooldown <= 0 && distance < 32) {
      onGroan?.();
      this.groanCooldown = randomRange(4, 8);
    }
    if (distance > 1.32) {
      const step = Math.min(this.speed * delta, distance - 1.15);
      this.group.position.x += (dx / distance) * step;
      this.group.position.z += (dz / distance) * step;
    } else {
      this.attackCooldown -= delta;
      if (this.attackCooldown <= 0) {
        onAttack(this.attackDamage);
        this.attackCooldown = this.type === 'fast' ? 0.78 : this.type === 'tank' ? 1.45 : 1.05;
      }
    }
    return false;
  }

  hit(damage) {
    if (this.dead) return false;
    this.health -= damage;
    this.flashTimer = 0.12;
    if (this.health <= 0) {
      this.dead = true;
      this.deathTimer = 0;
      return true;
    }
    return false;
  }

  raycastObjects() {
    return this.group.children;
  }

  dispose() {
    this.deactivate();
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (object.isMesh) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
  }

  deactivate() {
    this.dead = true;
    this.flashTimer = 0;
    this.skinMaterial.emissive.setHex(0x000000);
    this.skinMaterial.emissiveIntensity = 0;
    this.group.visible = false;
  }
}
