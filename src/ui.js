export class UI {
  constructor(root, touchDevice = false) {
    this.root = root;
    this.touchDevice = touchDevice;
    root.classList.toggle('touch-device', touchDevice);
    root.insertAdjacentHTML('beforeend', `
      <div class="vignette"></div>
      <section class="hud" aria-live="polite">
        <div class="topline">
          <div class="brand"><span class="brand-mark">✦</span><span>NIGHTFALL <small>UNDEAD SURVIVAL</small></span></div>
          <div class="wave-card"><span>WAVE</span><strong id="wave">1</strong></div>
          <div class="performance-readout"><b id="fps">60</b> FPS</div>
        </div>
        <div class="crosshair"><i></i><i></i><i></i><i></i><b></b></div>
        <div class="minimap">
          <canvas id="minimap-canvas" width="160" height="160" aria-label="Nearby enemies and pickups"></canvas>
          <span>NORTH · LIVE</span>
        </div>
        <div class="orientation-hint">ROTATE YOUR DEVICE TO LANDSCAPE</div>
        ${touchDevice ? `
          <div class="look-zone" id="look-zone" aria-label="Drag to look"></div>
          <div class="touch-controls">
            <div class="joystick" id="joystick" aria-label="Movement joystick">
              <div class="joystick-base"><div class="joystick-knob" id="joystick-knob"></div></div>
            </div>
            <div class="touch-actions">
              <button class="touch-button pause-button" id="touch-pause" aria-label="Pause">Ⅱ</button>
              <button class="touch-button reload-button" id="touch-reload">RELOAD</button>
              <button class="touch-button jump-button" id="touch-jump">JUMP</button>
              <button class="touch-button fire-button" id="touch-fire">FIRE</button>
            </div>
          </div>
          <button class="fullscreen-button" id="fullscreen-button" aria-label="Toggle fullscreen">⛶</button>
        ` : ''}
        <div class="bottomline">
          <div class="health-panel">
            <div class="panel-label"><span>VITALS</span><strong id="health-value">100</strong></div>
            <div class="health-track"><div id="health-fill"></div></div>
          </div>
          <div class="score-panel"><span>ELIMINATED</span><strong id="score">0000</strong></div>
          <div class="ammo-panel"><span>AMMO <b id="reload-label"></b></span><strong><b id="ammo">12</b><small> / <span id="reserve">96</span></small></strong></div>
        </div>
        <div class="toast" id="toast"></div>
        <div class="damage-flash" id="damage-flash"></div>
      </section>
      <div class="overlay" id="overlay">
        <div class="overlay-card">
          <div class="eyebrow" id="overlay-eyebrow">THEY ARE COMING</div>
          <h1 class="title" id="overlay-title">SURVIVE<br><span>THE NIGHT</span></h1>
          <p id="overlay-copy">The dead are restless. Make every round count.</p>
          <div class="controls">${touchDevice
            ? '<span>LEFT STICK — MOVE</span><span>DRAG RIGHT — LOOK</span><span>FIRE — SHOOT</span><span>JUMP — VAULT</span><span>RELOAD — REFILL</span><span>Ⅱ — PAUSE</span>'
            : '<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> MOVE</span><span><kbd>MOUSE</kbd> AIM</span><span><kbd>CLICK</kbd> FIRE</span><span><kbd>R</kbd> RELOAD</span><span><kbd>SPACE</kbd> JUMP</span><span><kbd>SHIFT</kbd> SPRINT</span>'}
          </div>
          <button id="start-button">ENTER THE DARK <span>→</span></button>
          <button id="menu-button">RETURN TO MAIN MENU</button>
          <div class="overlay-note" id="overlay-note">CLICK TO LOCK MOUSE · ESC TO PAUSE</div>
        </div>
      </div>
      <div class="hit-marker" id="hit-marker">×</div>
    `);
    this.elements = {
      wave: root.querySelector('#wave'),
      healthValue: root.querySelector('#health-value'),
      healthFill: root.querySelector('#health-fill'),
      score: root.querySelector('#score'),
      ammo: root.querySelector('#ammo'),
      reserve: root.querySelector('#reserve'),
      reloadLabel: root.querySelector('#reload-label'),
      toast: root.querySelector('#toast'),
      damageFlash: root.querySelector('#damage-flash'),
      overlay: root.querySelector('#overlay'),
      overlayEyebrow: root.querySelector('#overlay-eyebrow'),
      overlayTitle: root.querySelector('#overlay-title'),
      overlayCopy: root.querySelector('#overlay-copy'),
      overlayNote: root.querySelector('#overlay-note'),
      startButton: root.querySelector('#start-button'),
      menuButton: root.querySelector('#menu-button'),
      hitMarker: root.querySelector('#hit-marker'),
      minimap: root.querySelector('#minimap-canvas'),
      fps: root.querySelector('#fps'),
      joystick: root.querySelector('#joystick'),
      joystickKnob: root.querySelector('#joystick-knob'),
      lookZone: root.querySelector('#look-zone'),
      fireButton: root.querySelector('#touch-fire'),
      reloadButton: root.querySelector('#touch-reload'),
      jumpButton: root.querySelector('#touch-jump'),
      pauseButton: root.querySelector('#touch-pause'),
      fullscreenButton: root.querySelector('#fullscreen-button'),
    };
    this.minimapContext = this.elements.minimap.getContext('2d');
    this.toastTimer = 0;
    this.hitMarkerTimer = 0;
    this.flashTimer = 0;
    this.minimapElapsed = 0;
    this.elements.startButton.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:start'));
    });
    this.elements.menuButton.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:menu'));
    });
    if (touchDevice) this.setupTouchControls();
  }

  setupTouchControls() {
    let joystickPointer = null;
    let lookPointer = null;
    let lookPoint = { x: 0, y: 0 };

    const updateJoystick = (event) => {
      const rect = this.elements.joystick.getBoundingClientRect();
      const radius = rect.width * 0.34;
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const length = Math.hypot(dx, dy);
      const scale = length > radius ? radius / length : 1;
      const x = dx * scale / radius;
      const y = dy * scale / radius;
      this.elements.joystickKnob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
      window.dispatchEvent(new CustomEvent('game:move', { detail: { x, y } }));
    };
    const releaseJoystick = (event) => {
      if (event.pointerId !== joystickPointer) return;
      joystickPointer = null;
      this.elements.joystick.classList.remove('active');
      this.elements.joystickKnob.style.transform = 'translate(0, 0)';
      window.dispatchEvent(new CustomEvent('game:move', { detail: { x: 0, y: 0 } }));
    };
    this.elements.joystick.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      joystickPointer = event.pointerId;
      this.elements.joystick.setPointerCapture(event.pointerId);
      this.elements.joystick.classList.add('active');
      updateJoystick(event);
    });
    this.elements.joystick.addEventListener('pointermove', (event) => {
      if (event.pointerId === joystickPointer) updateJoystick(event);
    });
    this.elements.joystick.addEventListener('pointerup', releaseJoystick);
    this.elements.joystick.addEventListener('pointercancel', releaseJoystick);

    this.elements.lookZone.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch') return;
      event.preventDefault();
      lookPointer = event.pointerId;
      lookPoint = { x: event.clientX, y: event.clientY };
      this.elements.lookZone.setPointerCapture(event.pointerId);
    });
    this.elements.lookZone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== lookPointer) return;
      event.preventDefault();
      const deltaX = event.clientX - lookPoint.x;
      const deltaY = event.clientY - lookPoint.y;
      lookPoint = { x: event.clientX, y: event.clientY };
      window.dispatchEvent(new CustomEvent('game:look', { detail: { x: deltaX, y: deltaY } }));
    });
    const releaseLook = (event) => {
      if (event.pointerId === lookPointer) lookPointer = null;
    };
    this.elements.lookZone.addEventListener('pointerup', releaseLook);
    this.elements.lookZone.addEventListener('pointercancel', releaseLook);

    this.elements.fireButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.elements.fireButton.setPointerCapture(event.pointerId);
      window.dispatchEvent(new CustomEvent('game:fire', { detail: true }));
    });
    const releaseFire = () => window.dispatchEvent(new CustomEvent('game:fire', { detail: false }));
    this.elements.fireButton.addEventListener('pointerup', releaseFire);
    this.elements.fireButton.addEventListener('pointercancel', releaseFire);
    this.elements.fireButton.addEventListener('lostpointercapture', releaseFire);
    this.elements.reloadButton.addEventListener('click', () => window.dispatchEvent(new Event('game:reload')));
    this.elements.jumpButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      window.dispatchEvent(new Event('game:jump'));
    });
    this.elements.pauseButton.addEventListener('click', () => window.dispatchEvent(new Event('game:pause')));
    this.elements.fullscreenButton.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await this.root.requestFullscreen();
      } catch (error) {
        console.error('Unable to toggle fullscreen:', error);
      }
    });
  }

  update({ health, maxHealth, score, wave, ammo, reserve, reloading, player, zombies = [], pickups = [], fps = 60 }, delta) {
    const values = [
      [this.elements.wave, String(Math.max(1, wave)).padStart(2, '0')],
      [this.elements.healthValue, String(Math.ceil(health))],
      [this.elements.score, String(score).padStart(4, '0')],
      [this.elements.ammo, String(ammo).padStart(2, '0')],
      [this.elements.reserve, String(reserve).padStart(2, '0')],
      [this.elements.reloadLabel, reloading ? '· RELOADING' : ''],
      [this.elements.fps, String(Math.round(fps))],
    ];
    for (const [element, value] of values) {
      if (element.textContent !== value) element.textContent = value;
    }
    const healthWidth = `${Math.max(0, health / maxHealth * 100)}%`;
    if (this.elements.healthFill.style.width !== healthWidth) this.elements.healthFill.style.width = healthWidth;
    const lowHealth = health <= 30;
    if (this.elements.healthFill.classList.contains('low') !== lowHealth) {
      this.elements.healthFill.classList.toggle('low', lowHealth);
    }
    this.minimapElapsed += delta;
    if (this.minimapElapsed >= 0.05) {
      this.minimapElapsed %= 0.05;
      this.drawMinimap(player, zombies, pickups);
    }

    this.toastTimer = Math.max(0, this.toastTimer - delta);
    if (!this.toastTimer) this.elements.toast.classList.remove('visible');
    this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - delta);
    this.elements.hitMarker.classList.toggle('visible', this.hitMarkerTimer > 0);
    this.flashTimer = Math.max(0, this.flashTimer - delta);
    this.elements.damageFlash.style.opacity = String(this.flashTimer * 2.4);
  }

  drawMinimap(player, zombies, pickups) {
    const context = this.minimapContext;
    const { width, height } = this.elements.minimap;
    const center = width / 2;
    const radius = 68;
    const scale = 1.35;
    context.clearRect(0, 0, width, height);
    context.save();
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = 'rgba(9, 14, 14, 0.86)';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(207, 194, 160, 0.12)';
    context.lineWidth = 1;
    for (let offset = -60; offset <= 60; offset += 20) {
      context.beginPath();
      context.moveTo(center + offset, center - radius);
      context.lineTo(center + offset, center + radius);
      context.moveTo(center - radius, center + offset);
      context.lineTo(center + radius, center + offset);
      context.stroke();
    }
    if (player) {
      for (const zombie of zombies) {
        if (zombie.dead) continue;
        const x = center + (zombie.group.position.x - player.position.x) * scale;
        const y = center + (zombie.group.position.z - player.position.z) * scale;
        context.fillStyle = zombie.type === 'tank' ? '#b77add' : zombie.type === 'fast' ? '#ef9d59' : '#db5a4d';
        context.beginPath();
        context.arc(x, y, zombie.type === 'tank' ? 4.5 : 3, 0, Math.PI * 2);
        context.fill();
      }
      for (const pickup of pickups) {
        const x = center + (pickup.position.x - player.position.x) * scale;
        const y = center + (pickup.position.z - player.position.z) * scale;
        context.fillStyle = pickup.type === 'health' ? '#72d48c' : '#e1c66c';
        context.fillRect(x - 2.5, y - 2.5, 5, 5);
      }
      context.save();
      context.translate(center, center);
      context.rotate(player.yaw);
      context.fillStyle = '#eee4c9';
      context.beginPath();
      context.moveTo(0, -8);
      context.lineTo(5.5, 6);
      context.lineTo(0, 3.5);
      context.lineTo(-5.5, 6);
      context.closePath();
      context.fill();
      context.restore();
    }
    context.restore();
    context.strokeStyle = 'rgba(213, 173, 104, 0.62)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.stroke();
  }

  showToast(message, duration = 2.4) {
    this.elements.toast.textContent = message;
    this.elements.toast.classList.add('visible');
    this.toastTimer = duration;
  }

  showHitMarker() {
    this.hitMarkerTimer = 0.14;
  }

  showDamage() {
    this.flashTimer = 0.42;
  }

  showOverlay(mode) {
    this.elements.overlay.classList.add('visible');
    this.elements.menuButton.classList.toggle('visible', mode === 'pause');
    this.elements.overlayNote.textContent = this.touchDevice
      ? 'TAP TO CONTINUE'
      : 'CLICK TO LOCK MOUSE · ESC TO PAUSE';
    if (mode === 'gameover') {
      this.elements.overlayEyebrow.textContent = 'SIGNAL LOST';
      this.elements.overlayTitle.innerHTML = 'YOU DIDN’T<br><span>MAKE IT</span>';
      this.elements.overlayCopy.textContent = 'The night has claimed another survivor.';
      this.elements.startButton.innerHTML = 'TRY AGAIN <span>→</span>';
      this.elements.overlayNote.textContent = this.touchDevice
        ? `YOUR SCORE: ${this.elements.score.textContent} · TAP TO CONTINUE`
        : 'YOUR SCORE: ' + this.elements.score.textContent;
    } else if (mode === 'pause') {
      this.elements.overlayEyebrow.textContent = 'TAKE A BREATH';
      this.elements.overlayTitle.innerHTML = 'THE NIGHT<br><span>IS WAITING</span>';
      this.elements.overlayCopy.textContent = 'Steady your aim. They are still out there.';
      this.elements.startButton.innerHTML = 'RESUME SURVIVAL <span>→</span>';
      this.elements.overlayCopy.textContent = this.touchDevice
        ? 'Left stick to move. Drag the right side to aim.'
        : 'Steady your aim. They are still out there.';
    } else if (mode === 'lockerror') {
      this.elements.overlayEyebrow.textContent = 'INPUT UNAVAILABLE';
      this.elements.overlayTitle.innerHTML = 'MOUSE LOCK<br><span>WAS BLOCKED</span>';
      this.elements.overlayCopy.textContent = 'Allow pointer lock in your browser, then try again.';
      this.elements.startButton.innerHTML = 'RETRY POINTER LOCK <span>→</span>';
      this.elements.overlayNote.textContent = 'POINTER LOCK IS REQUIRED TO PLAY';
    } else if (mode === 'menu') {
      this.elements.overlayEyebrow.textContent = 'THEY ARE COMING';
      this.elements.overlayTitle.innerHTML = 'SURVIVE<br><span>THE NIGHT</span>';
      this.elements.overlayCopy.textContent = 'The dead are restless. Make every round count.';
      this.elements.startButton.innerHTML = 'ENTER THE DARK <span>→</span>';
      this.elements.overlayNote.textContent = 'CLICK TO LOCK MOUSE · ESC TO PAUSE';
    } else {
      this.elements.overlayEyebrow.textContent = 'THEY ARE COMING';
      this.elements.overlayTitle.innerHTML = 'SURVIVE<br><span>THE NIGHT</span>';
      this.elements.overlayCopy.textContent = 'The dead are restless. Make every round count.';
      this.elements.startButton.innerHTML = 'ENTER THE DARK <span>→</span>';
      this.elements.overlayNote.textContent = 'CLICK TO LOCK MOUSE · ESC TO PAUSE';
    }
  }

  hideOverlay() {
    this.elements.overlay.classList.remove('visible');
  }
}
