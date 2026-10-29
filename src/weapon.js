import * as THREE from 'three';

export class Weapon {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.upVector = new THREE.Vector3(0, 1, 0);
    this.center = new THREE.Vector2(0, 0);
    this.targetObjects = [];
    this.intersections = [];
    this.shotResult = { hit: false, killed: false, zombie: null, point: null };
    this.aimDirection = new THREE.Vector3();
    this.aimOffset = new THREE.Vector3();
    this.ammo = 12;
    this.magazineSize = 12;
    this.reserve = 96;
    this.fireCooldown = 0;
    this.reloadTimer = 0;
    this.reloading = false;
    this.muzzleTimer = 0;
    this.onShot = null;
    this.bulletGeometry = new THREE.CylinderGeometry(0.012, 0.012, 1, 5);
    this.bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffdf9a, transparent: true, opacity: 0.82 });
    this.bullets = Array.from({ length: 20 }, () => {
      const mesh = new THREE.Mesh(this.bulletGeometry, this.bulletMaterial);
      mesh.visible = false;
      this.scene.add(mesh);
      return {
        mesh,
        active: false,
        elapsed: 0,
        duration: 0.075,
        distance: 0,
        origin: new THREE.Vector3(),
        direction: new THREE.Vector3(),
      };
    });
    this.createViewModel();
  }

  createViewModel() {
    const gun = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x252a29, roughness: 0.42, metalness: 0.72 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x48332a, roughness: 0.9 });
    const addPart = (geometry, material, position) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      gun.add(mesh);
    };
    addPart(new THREE.BoxGeometry(0.2, 0.16, 0.42), metal, [0, 0, 0]);
    addPart(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), metal, [0, 0.035, -0.34]);
    addPart(new THREE.BoxGeometry(0.12, 0.24, 0.15), grip, [0, -0.18, 0.08]);
    addPart(new THREE.BoxGeometry(0.14, 0.055, 0.13), metal, [0, 0.11, -0.06]);
    gun.position.set(0.31, -0.29, -0.58);
    gun.rotation.x = -0.04;
    this.camera.add(gun);
    this.gun = gun;

    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffc15c, transparent: true, opacity: 0 });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), flashMaterial);
    flash.position.set(0, 0.035, -0.56);
    gun.add(flash);
    this.muzzleFlash = flash;
  }

  shoot(zombies, enabled = true, autoAim = false) {
    if (!enabled || this.reloading || this.fireCooldown > 0 || this.ammo <= 0) return null;
    this.ammo -= 1;
    this.fireCooldown = 0.22;
    this.muzzleTimer = 0.055;
    this.muzzleFlash.material.opacity = 1;
    this.gun.position.z = -0.5;

    this.camera.updateWorldMatrix(true, false);
    this.targetObjects.length = 0;
    for (const candidate of zombies) {
      if (candidate.dead) continue;
      candidate.group.updateMatrixWorld(true);
      this.targetObjects.push(...candidate.raycastObjects());
    }
    this.intersections.length = 0;
    this.raycaster.setFromCamera(this.center, this.camera);
    if (autoAim) this.applyAimAssist(zombies);
    const hit = this.raycaster.intersectObjects(this.targetObjects, false, this.intersections)[0];
    let killed = false;
    const zombie = hit?.object.userData.zombie ?? null;
    if (hit) {
      if (zombie) killed = zombie.hit(50);
    }
    const bulletDistance = hit ? this.raycaster.ray.origin.distanceTo(hit.point) : 65;
    this.launchBullet(this.raycaster.ray.origin, this.raycaster.ray.direction, bulletDistance);
    this.shotResult.hit = Boolean(zombie);
    this.shotResult.killed = killed;
    this.shotResult.zombie = zombie;
    this.shotResult.point = hit?.point ?? null;
    this.onShot?.(this.shotResult);
  }

  applyAimAssist(zombies) {
    const origin = this.raycaster.ray.origin;
    const forward = this.raycaster.ray.direction;
    let bestDot = Math.cos(0.16);
    let target = null;
    for (const zombie of zombies) {
      if (zombie.dead) continue;
      this.aimDirection.set(
        zombie.group.position.x - origin.x,
        zombie.group.position.y + 1.15 - origin.y,
        zombie.group.position.z - origin.z,
      ).normalize();
      const dot = forward.dot(this.aimDirection);
      if (dot > bestDot) {
        bestDot = dot;
        target = this.aimDirection;
      }
    }
    if (target) {
      const assist = THREE.MathUtils.clamp((bestDot - Math.cos(0.16)) / (1 - Math.cos(0.16)), 0, 0.72);
      forward.lerp(target, assist).normalize();
    }
  }

  addReserve(amount) {
    const added = Math.min(amount, 180 - this.reserve);
    this.reserve += Math.max(0, added);
    return Math.max(0, added);
  }

  launchBullet(origin, direction, distance) {
    let bullet = this.bullets.find((candidate) => !candidate.active);
    if (!bullet) {
      bullet = this.bullets.reduce((oldest, candidate) => (
        candidate.elapsed > oldest.elapsed ? candidate : oldest
      ));
    }
    bullet.active = true;
    bullet.elapsed = 0;
    bullet.distance = distance;
    bullet.origin.copy(origin).addScaledVector(direction, 0.45);
    bullet.direction.copy(direction);
    bullet.mesh.visible = true;
    bullet.mesh.quaternion.setFromUnitVectors(this.upVector, direction);
    bullet.mesh.scale.set(1, 0.48, 1);
    bullet.mesh.position.copy(bullet.origin);
  }

  reload() {
    if (this.reloading || this.ammo >= this.magazineSize || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadTimer = 1.35;
    this.gun.rotation.x = -0.6;
  }

  update(delta) {
    this.fireCooldown = Math.max(0, this.fireCooldown - delta);
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= delta;
      if (this.muzzleTimer <= 0) this.muzzleFlash.material.opacity = 0;
    }
    this.gun.position.z = THREE.MathUtils.lerp(this.gun.position.z, -0.58, Math.min(delta * 18, 1));
    if (this.reloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        const loaded = Math.min(this.magazineSize - this.ammo, this.reserve);
        this.ammo += loaded;
        this.reserve -= loaded;
        this.reloading = false;
        this.gun.rotation.x = -0.04;
      }
    }
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      bullet.elapsed += delta;
      const progress = Math.min(bullet.elapsed / bullet.duration, 1);
      bullet.mesh.position.copy(bullet.origin).addScaledVector(
        bullet.direction,
        Math.max(0, progress * bullet.distance - 0.24),
      );
      if (progress === 1) {
        bullet.active = false;
        bullet.mesh.visible = false;
      }
    }
  }

  reset() {
    this.ammo = this.magazineSize;
    this.reserve = 96;
    this.fireCooldown = 0;
    this.reloadTimer = 0;
    this.reloading = false;
    this.muzzleTimer = 0;
    this.gun.rotation.x = -0.04;
    this.muzzleFlash.material.opacity = 0;
    for (const bullet of this.bullets) {
      bullet.active = false;
      bullet.mesh.visible = false;
    }
  }

  dispose() {
    this.camera.remove(this.gun);
    this.gun.traverse((object) => {
      if (object.isMesh) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
    for (const bullet of this.bullets) this.scene.remove(bullet.mesh);
    this.bulletGeometry.dispose();
    this.bulletMaterial.dispose();
  }
}
