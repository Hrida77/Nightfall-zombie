import * as THREE from 'three';

const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.42;

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.position = new THREE.Vector3(0, 0, 8);
    this.velocityY = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.yaw = 0;
    this.pitch = 0;
    this.isLocked = false;
    this.keys = new Set();
    this.touchMove = { x: 0, y: 0 };
    this.touchJump = false;
    this.touchDevice = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
    this.colliders = [];
    this.forwardVector = new THREE.Vector3();
    this.rightVector = new THREE.Vector3();
    this.movementVector = new THREE.Vector3();
    this.collisionProbe = new THREE.Vector3();

    this.camera.position.copy(this.position).y += PLAYER_HEIGHT;
    this.camera.rotation.order = 'YXZ';

    this.onKeyDown = (event) => {
      this.keys.add(event.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
      }
    };
    this.onKeyUp = (event) => this.keys.delete(event.code);
    this.onMouseMove = (event) => {
      if (!this.isLocked) return;
      this.yaw -= event.movementX * 0.0022;
      this.pitch -= event.movementY * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.03, Math.PI / 2 - 0.03);
      this.camera.rotation.set(this.pitch, this.yaw, 0);
    };
    this.onPointerLockChange = () => {
      if (this.touchDevice) return;
      this.isLocked = document.pointerLockElement === this.domElement;
      this.keys.clear();
      window.dispatchEvent(new CustomEvent('game:lockchange', { detail: this.isLocked }));
    };
    this.onTouchMove = (event) => {
      this.touchMove.x = event.detail.x;
      this.touchMove.y = event.detail.y;
    };
    this.onTouchLook = (event) => {
      if (!this.isLocked || !this.touchDevice) return;
      this.yaw -= event.detail.x * 0.003;
      this.pitch -= event.detail.y * 0.003;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.03, Math.PI / 2 - 0.03);
      this.camera.rotation.set(this.pitch, this.yaw, 0);
    };
    this.onTouchJump = () => { this.touchJump = true; };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    window.addEventListener('game:move', this.onTouchMove);
    window.addEventListener('game:look', this.onTouchLook);
    window.addEventListener('game:jump', this.onTouchJump);
  }

  async requestLock() {
    if (this.touchDevice) {
      this.isLocked = true;
      window.dispatchEvent(new CustomEvent('game:lockchange', { detail: true }));
      return;
    }
    if (typeof this.domElement.requestPointerLock !== 'function') {
      throw new Error('Pointer lock is not available in this browser context.');
    }
    await this.domElement.requestPointerLock();
  }

  setColliders(colliders) {
    this.colliders = colliders;
  }

  update(delta) {
    const forwardInput = THREE.MathUtils.clamp(
      Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')) - this.touchMove.y, -1, 1,
    );
    const sideInput = THREE.MathUtils.clamp(
      Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')) + this.touchMove.x, -1, 1,
    );
    const inputLength = Math.hypot(forwardInput, sideInput);

    if (inputLength > 0) {
      const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 8.6 : 5.4;
      this.forwardVector.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.rightVector.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      this.movementVector.copy(this.forwardVector).multiplyScalar(forwardInput)
        .addScaledVector(this.rightVector, sideInput).normalize().multiplyScalar(speed * delta);
      this.moveAxis('x', this.movementVector.x);
      this.moveAxis('z', this.movementVector.z);
    }

    if ((this.keys.has('Space') || this.touchJump) && this.position.y <= 0.001) {
      this.velocityY = 6.4;
    }
    this.touchJump = false;
    this.velocityY -= 18 * delta;
    this.position.y = Math.max(0, this.position.y + this.velocityY * delta);
    if (this.position.y === 0) this.velocityY = 0;

    this.camera.position.set(this.position.x, this.position.y + PLAYER_HEIGHT, this.position.z);
  }

  moveAxis(axis, amount) {
    const next = this.position[axis] + amount;
    const probe = this.collisionProbe.set(
      axis === 'x' ? next : this.position.x,
      0,
      axis === 'z' ? next : this.position.z,
    );
    if (Math.abs(next) > 90) return;
    for (const collider of this.colliders) {
      const dx = Math.max(Math.abs(probe.x - collider.x) - collider.halfX, 0);
      const dz = Math.max(Math.abs(probe.z - collider.z) - collider.halfZ, 0);
      if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) return;
    }
    this.position[axis] = next;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health;
  }

  reset() {
    this.position.set(0, 0, 8);
    this.velocityY = 0;
    this.health = this.maxHealth;
    this.yaw = 0;
    this.pitch = 0;
    this.camera.rotation.set(0, 0, 0);
    this.camera.position.set(this.position.x, PLAYER_HEIGHT, this.position.z);
    this.keys.clear();
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.touchJump = false;
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('game:move', this.onTouchMove);
    window.removeEventListener('game:look', this.onTouchLook);
    window.removeEventListener('game:jump', this.onTouchJump);
  }
}
