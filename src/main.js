import * as THREE from 'three';
import { Player } from './player.js';
import { Zombie } from './zombie.js';
import { Weapon } from './weapon.js';
import { World } from './world.js';
import { UI } from './ui.js';
import { GameAudio } from './audio.js';
import { Pickup, BloodEffects } from './pickup.js';
import './style.css';

const root = document.querySelector('#game');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 180);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const maxPixelRatio = Math.min(window.devicePixelRatio, 1.5);
let renderPixelRatio = maxPixelRatio;
renderer.setPixelRatio(renderPixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.domElement.id = 'game-canvas';
root.appendChild(renderer.domElement);

const world = new World(scene);
const player = new Player(camera, renderer.domElement);
player.setColliders(world.colliders);
const weapon = new Weapon(camera, scene);
const ui = new UI(root);
const audio = new GameAudio();
const bloodEffects = new BloodEffects(scene);
const clock = new THREE.Clock();
let zombies = [];
const zombiePool = [];
let pickups = [];
let score = 0;
let wave = 0;
let state = 'menu';
let spawnRemaining = 0;
let spawnTimer = 0;
let waveBreak = 0;
let shotHeld = false;
let previousHealth = player.health;
let fpsSampleStart = performance.now();
let fpsSampleFrames = 0;
let smoothFps = 60;
let stableFpsSeconds = 0;

const startWave = () => {
  wave += 1;
  spawnRemaining = 5 + Math.min(wave * 2, 31);
  spawnTimer = 0.5;
  ui.showToast(`WAVE ${String(wave).padStart(2, '0')} — ${spawnRemaining} HOSTILES`, 2.6);
};

const dropPickup = (type, position) => {
  if (pickups.length >= 24) pickups.shift().dispose();
  pickups.push(new Pickup(scene, type, position));
};

const resetGame = () => {
  for (const zombie of zombies) {
    zombie.deactivate();
    zombiePool.push(zombie);
  }
  for (const pickup of pickups) pickup.dispose();
  zombies = [];
  pickups = [];
  for (const particle of bloodEffects.particles) {
    particle.active = false;
    particle.mesh.visible = false;
  }
  player.reset();
  weapon.reset();
  score = 0;
  wave = 0;
  spawnRemaining = 0;
  spawnTimer = 0;
  waveBreak = 0;
  previousHealth = player.health;
  state = 'playing';
  startWave();
};

const beginGame = async () => {
  void audio.unlock().catch((error) => console.error('Unable to start game audio:', error));
  if (state === 'gameover' || state === 'menu') resetGame();
  else if (state === 'paused') state = 'playing';
  try {
    await player.requestLock();
  } catch (error) {
    console.error('Unable to acquire pointer lock:', error);
    state = 'paused';
    ui.showOverlay('lockerror');
  }
};

window.addEventListener('game:start', beginGame);
window.addEventListener('game:menu', () => {
  shotHeld = false;
  player.keys.clear();
  state = 'menu';
  if (document.pointerLockElement) document.exitPointerLock();
  ui.showOverlay('menu');
});
window.addEventListener('game:lockchange', (event) => {
  if (event.detail) {
    if (state !== 'gameover') {
      state = 'playing';
      ui.hideOverlay();
    }
  } else if (state === 'playing') {
    state = 'paused';
    shotHeld = false;
    ui.showOverlay('pause');
  }
});

renderer.domElement.addEventListener('mousedown', (event) => {
  if (event.button !== 0 || state !== 'playing') return;
  shotHeld = true;
});
window.addEventListener('mouseup', (event) => {
  if (event.button === 0) shotHeld = false;
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyR' && state === 'playing' && player.isLocked) weapon.reload();
});
weapon.onShot = ({ hit, killed, zombie, point }) => {
  audio.playGunshot();
  if (hit && point) bloodEffects.burst(point);
  if (hit) ui.showHitMarker();
  if (killed && zombie) {
    score += zombie.type === 'tank' ? 250 : zombie.type === 'fast' ? 150 : 100;
    const roll = Math.random();
    const dropChance = zombie.type === 'tank' ? 0.78 : 0.58;
    if (roll < dropChance) {
      const dropType = roll < dropChance * 0.4 ? 'health' : 'ammo';
      dropPickup(dropType, zombie.group.position);
    }
  }
};

const resize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(renderPixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', resize);

const spawnZombie = () => {
  const tankChance = Math.min(0.07 + wave * 0.018, 0.3);
  const fastChance = Math.min(0.2 + wave * 0.025, 0.42);
  const roll = Math.random();
  const type = roll < tankChance ? 'tank' : roll < tankChance + fastChance ? 'fast' : 'normal';
  const position = world.randomSpawnPosition(player.position);
  const zombie = zombiePool.pop();
  if (zombie) zombie.activate(position, wave, type);
  else zombies.push(new Zombie(scene, position, wave, type));
  if (zombie) zombies.push(zombie);
};

function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  if (state === 'playing' && player.isLocked) {
    weapon.update(delta);
    player.update(delta);

    if (shotHeld) {
      weapon.shoot(zombies, true);
    }

    for (let i = zombies.length - 1; i >= 0; i--) {
      const zombie = zombies[i];
      const shouldRemove = zombie.update(delta, player, (damage) => {
        player.damage(damage);
      }, () => {
        audio.playGroan();
      });
      if (shouldRemove) {
        zombie.deactivate();
        zombiePool.push(zombie);
        zombies.splice(i, 1);
      }
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
      const pickup = pickups[i];
      const collected = pickup.update(delta, player, (type) => {
        if (type === 'health') {
          const restored = Math.min(35, player.maxHealth - player.health);
          player.health += restored;
          ui.showToast(restored > 0 ? `FIRST AID +${restored} HP` : 'FIRST AID — HEALTH FULL');
        } else {
          const added = weapon.addReserve(24);
          ui.showToast(added > 0 ? `AMMO +${added}` : 'AMMO — RESERVE FULL');
        }
      });
      if (collected) pickups.splice(i, 1);
    }

    if (player.health < previousHealth) {
      audio.playHurt();
      ui.showDamage();
    }
    previousHealth = player.health;

    if (player.health <= 0) {
      state = 'gameover';
      shotHeld = false;
      document.exitPointerLock();
      ui.showOverlay('gameover');
    }

    if (spawnRemaining > 0) {
      spawnTimer -= delta;
      if (spawnTimer <= 0) {
        spawnZombie();
        spawnRemaining -= 1;
        spawnTimer = Math.max(0.42, 1.35 - wave * 0.035);
      }
    } else if (zombies.length === 0) {
      waveBreak += delta;
      if (waveBreak >= 3.5) {
        waveBreak = 0;
        startWave();
      }
    }
  }

  bloodEffects.update(delta);
  ui.update({
    health: player.health,
    maxHealth: player.maxHealth,
    score,
    wave,
    ammo: weapon.ammo,
    reserve: weapon.reserve,
    reloading: weapon.reloading,
    player,
    zombies,
    pickups,
    fps: smoothFps,
  }, delta);
  renderer.render(scene, camera);

  fpsSampleFrames += 1;
  const sampleDuration = now - fpsSampleStart;
  if (sampleDuration >= 1000) {
    const fps = fpsSampleFrames * 1000 / sampleDuration;
    smoothFps = smoothFps * 0.65 + fps * 0.35;
    if (smoothFps < 55 && renderPixelRatio > 0.75) {
      renderPixelRatio = Math.max(0.75, renderPixelRatio - 0.15);
      renderer.setPixelRatio(renderPixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      stableFpsSeconds = 0;
    } else if (smoothFps > 59 && renderPixelRatio < maxPixelRatio) {
      stableFpsSeconds += sampleDuration / 1000;
      if (stableFpsSeconds >= 4) {
        renderPixelRatio = Math.min(maxPixelRatio, renderPixelRatio + 0.05);
        renderer.setPixelRatio(renderPixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        stableFpsSeconds = 0;
      }
    } else {
      stableFpsSeconds = 0;
    }
    fpsSampleStart = now;
    fpsSampleFrames = 0;
  }
}

ui.showOverlay('start');
animate();
