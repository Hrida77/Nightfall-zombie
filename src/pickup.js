import * as THREE from 'three';

export class Pickup {
  constructor(scene, type, position) {
    this.scene = scene;
    this.type = type;
    this.position = position.clone();
    this.elapsed = Math.random() * Math.PI * 2;
    this.life = 30;
    this.collected = false;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.position.y = 0.55;

    const color = type === 'health' ? 0x72d48c : 0xd8b45f;
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.65,
      roughness: 0.35,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), material);
    this.group.add(box);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.12, 0.52),
      new THREE.MeshBasicMaterial({ color: 0xf2eee0 }),
    );
    this.group.add(band);
    if (type === 'health') {
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.34, 0.54),
        new THREE.MeshBasicMaterial({ color: 0xf2eee0 }),
      );
      this.group.add(cross);
    }

    scene.add(this.group);
  }

  update(delta, player, onCollect) {
    this.elapsed += delta;
    this.life -= delta;
    this.group.rotation.y += delta * 1.4;
    this.group.position.y = 0.55 + Math.sin(this.elapsed * 2.4) * 0.11;
    if (this.life <= 0) {
      this.dispose();
      return true;
    }
    const distance = Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z);
    if (distance < 1.45) {
      this.collected = true;
      onCollect(this.type);
      this.dispose();
      return true;
    }
    return false;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (object.isMesh) {
        object.geometry.dispose();
        object.material.dispose();
      } else if (object.isPointLight) {
        object.dispose?.();
      }
    });
  }
}

export class BloodEffects {
  constructor(scene) {
    this.scene = scene;
    this.geometry = new THREE.SphereGeometry(0.045, 5, 4);
    this.material = new THREE.MeshBasicMaterial({ color: 0x9b211b });
    this.particles = Array.from({ length: 140 }, () => {
      const mesh = new THREE.Mesh(this.geometry, this.material);
      mesh.visible = false;
      this.scene.add(mesh);
      return { mesh, velocity: new THREE.Vector3(), life: 0, active: false };
    });
    this.nextParticle = 0;
  }

  burst(position) {
    for (let i = 0; i < 7; i++) {
      let particle = null;
      for (let index = 0; index < this.particles.length; index++) {
        const candidateIndex = (this.nextParticle + index) % this.particles.length;
        if (!this.particles[candidateIndex].active) {
          particle = this.particles[candidateIndex];
          this.nextParticle = (candidateIndex + 1) % this.particles.length;
          break;
        }
      }
      if (!particle) return;
      const { mesh } = particle;
      mesh.position.copy(position);
      particle.velocity.set(
        (Math.random() - 0.5) * 4.2,
        Math.random() * 3.2 + 0.4,
        (Math.random() - 0.5) * 4.2,
      );
      particle.life = 0.45 + Math.random() * 0.35;
      particle.active = true;
      mesh.visible = true;
    }
  }

  update(delta) {
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.life -= delta;
      particle.velocity.y -= 9 * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      if (particle.mesh.position.y < 0.04) {
        particle.mesh.position.y = 0.04;
        particle.velocity.y *= -0.22;
        particle.velocity.x *= 0.7;
        particle.velocity.z *= 0.7;
      }
      if (particle.life <= 0) {
        particle.active = false;
        particle.mesh.visible = false;
      }
    }
  }

  dispose() {
    for (const particle of this.particles) {
      this.scene.remove(particle.mesh);
    }
    this.particles = [];
    this.geometry.dispose();
    this.material.dispose();
  }
}
