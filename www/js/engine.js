/* MIBLOX 3D engine — blocky third-person worlds on Three.js (UMD build) */
(function () {
  'use strict';

  const HW = 0.45;      // player half width / depth
  const PH = 2.25;      // player height
  const SPEED = 6.4;
  const JUMP_V = 9.6;
  const GRAVITY = 26;
  const MAX_STEP = 1 / 30;

  const PALETTE = {
    skyTop: '#1a1038', skyBottom: '#07060f', fog: '#160e2b'
  };

  /* ------------------------------------------------------------------ levels */
  function spiral() {
    const plats = [], coins = [];
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const a = i * 0.58;
      const r = 6.6;
      const y = 2 + i * 1.15;
      const x = Math.cos(a) * r, z = Math.sin(a) * r - 2;
      plats.push([x, y, z, 3.0, 0.9, 3.0, i % 2 ? '#2c1f56' : '#3b2a70']);
      if (i > 0) coins.push([x, y + 1.5, z]);
    }
    const topY = 2 + steps * 1.15;
    plats.push([0, topY, -2, 6, 1, 6, '#6d4bd8']);
    return { plats, coins, spawn: [6.6, 2.05, -2] };
  }

  const LEVELS = {
    'sky-obby': {
      name: 'Sky Obby', tag: 'Obby',
      sky: ['#1b1038', '#07060f'], fog: '#160e2b', ground: '#2a1f4d',
      spawn: [0, 3.05, 8],
      plats: [
        [0, 3, 8, 6, 1, 6, '#3b2d63'],
        [0, 3.6, 1, 4, 1, 4, '#463575'],
        [3.5, 4.4, -4.5, 3, 1, 3, '#4b3a7d'],
        [-1.5, 5.2, -10, 3.5, 1, 3.5, '#463575'],
        [2.5, 6.2, -15.5, 3, 1, 3, '#4b3a7d'],
        [6.5, 7.2, -20, 3, 1, 3, '#463575'],
        [2.5, 8.4, -25.5, 3.5, 1, 3.5, '#4b3a7d'],
        [-1, 9.6, -31, 4, 1, 4, '#463575'],
        [1.5, 10.8, -37, 7, 1, 7, '#ffb547']
      ],
      coins: [
        [0, 4.4, 5], [0, 5, 1], [3.5, 5.8, -4.5], [-1.5, 6.6, -10],
        [2.5, 7.6, -15.5], [6.5, 8.6, -20], [2.5, 9.8, -25.5],
        [-1, 11, -31], [1.5, 12.2, -37], [0, 12.2, -39]
      ]
    },
    'coin-rush': {
      name: 'Coin Rush', tag: 'Collect',
      sky: ['#062a2b', '#07070a'], fog: '#0a2226', ground: '#0f3d3a',
      spawn: [0, 2.05, 0],
      plats: [
        [0, 2, 0, 10, 1, 10, '#115e56'],
        [9, 2.7, 0, 4, 1, 4, '#0f766e'],
        [0, 2.7, -9, 4, 1, 4, '#0f766e'],
        [-9, 2.7, 0, 4, 1, 4, '#0f766e'],
        [0, 2.7, 9, 4, 1, 4, '#0f766e'],
        [6.4, 3.9, 6.4, 3, 1, 3, '#14b8a6'],
        [6.4, 3.9, -6.4, 3, 1, 3, '#14b8a6'],
        [-6.4, 3.9, 6.4, 3, 1, 3, '#14b8a6'],
        [-6.4, 3.9, -6.4, 3, 1, 3, '#14b8a6']
      ],
      coins: [
        [0, 3.4, 3], [0, 3.4, -3], [3, 3.4, 0], [-3, 3.4, 0],
        [9, 4.1, 0], [0, 4.1, -9], [-9, 4.1, 0], [0, 4.1, 9],
        [6.4, 5.3, 6.4], [6.4, 5.3, -6.4], [-6.4, 5.3, 6.4], [-6.4, 5.3, -6.4],
        [4.5, 3.4, 4.5], [-4.5, 3.4, -4.5], [4.5, 3.4, -4.5], [-4.5, 3.4, 4.5]
      ]
    },
    'neon-tower': (() => {
      const s = spiral();
      return {
        name: 'Neon Tower', tag: 'Tower',
        sky: ['#160a33', '#07060d'], fog: '#150d2b', ground: '#1d1140',
        spawn: s.spawn, plats: s.plats, coins: s.coins,
        pillar: [0, 2, 9, 2, 2]
      };
    })(),
    'lava-run': {
      name: 'Lava Run', tag: 'Hard',
      sky: ['#2e0904', '#0b0507'], fog: '#280702', ground: '#3a0d06',
      spawn: [0, 3.05, 6],
      plats: [
        [0, 3, 6, 4, 1, 4, '#4a2020'],
        [4, 3.9, -1, 3.5, 1, 3.5, '#5a2828'],
        [-1, 4.8, -7, 3.5, 1, 3.5, '#4a2020'],
        [4, 5.7, -13, 3.5, 1, 3.5, '#5a2828'],
        [-1, 6.6, -19, 3.5, 1, 3.5, '#4a2020'],
        [4, 7.5, -25, 3.5, 1, 3.5, '#5a2828'],
        [0, 8.4, -31, 6, 1, 6, '#ff8a3d']
      ],
      coins: [
        [0, 4.4, 4.6], [4, 5.3, -1], [-1, 6.2, -7], [4, 7.1, -13],
        [-1, 8, -19], [4, 8.9, -25], [0, 9.8, -31], [0, 9.8, -33]
      ],
      lava: true
    }
  };
  Object.assign(LEVELS['sky-obby'], { skyTop: PALETTE.skyTop, skyBottom: PALETTE.skyBottom });

  /* --------------------------------------------------------------- avatar */
  function block(w, h, d, color, x, y, z) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: color, roughness: 0.72, metalness: 0.06 })
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function buildAvatar(look) {
    const g = new THREE.Group();
    const skin = look.skin || '#f2c9a0';
    const shirt = look.shirt || '#ff6900';
    const pants = look.pants || '#2b2f4a';

    const legs = [];
    [-0.235, 0.235].forEach((x) => {
      const leg = block(0.36, 0.82, 0.38, pants, x, 0.41, 0);
      g.add(leg); legs.push(leg);
    });
    const torso = block(0.92, 0.95, 0.52, shirt, 0, 1.3, 0);
    g.add(torso);
    const arms = [];
    [-0.62, 0.62].forEach((x) => {
      const arm = block(0.3, 0.88, 0.34, shirt, x, 1.32, 0);
      g.add(arm); arms.push(arm);
    });
    const head = block(0.66, 0.62, 0.62, skin, 0, 2.09, 0);
    g.add(head);

    // face — tiny dark blocks so it reads as a character
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#1a1a22', roughness: 0.5 });
    [-0.15, 0.15].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04), eyeMat);
      eye.position.set(x, 2.13, 0.32);
      g.add(eye);
    });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.04), eyeMat);
    mouth.position.set(0, 1.97, 0.32);
    g.add(mouth);

    g.userData = { legs: legs, arms: arms, head: head, torso: torso };
    return g;
  }

  /* ------------------------------------------------------------ main factory */
  function createGame(canvas, opts) {
    opts = opts || {};
    const lvl = LEVELS[opts.levelId] || LEVELS['sky-obby'];
    const onCoin = opts.onCoin || function () {};
    const onWin = opts.onWin || function () {};
    const onFall = opts.onFall || function () {};

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(new THREE.Color(lvl.fog), 34, 92);

    const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 260);
    camera.position.set(0, 10, 16);

    const hemi = new THREE.HemisphereLight(0xbfd4ff, new THREE.Color(lvl.ground), 1.15);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2e0, 2.1);
    sun.position.set(14, 26, 12);
    sun.castShadow = !!opts.shadows;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.bias = -0.0012;
    scene.add(sun);
    scene.add(sun.target);

    const world = new THREE.Group();
    scene.add(world);
    const solids = [];

    lvl.plats.forEach(function (p, idx) {
      const x = p[0], y = p[1], z = p[2], w = p[3], h = p[4], d = p[5], color = p[6];
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.86, metalness: 0.04 })
      );
      mesh.position.set(x, y - h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      world.add(mesh);
      solids.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, yTop: y, yBot: y - h });

      if (idx === lvl.plats.length - 1) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.5, 0.11, 8, 40),
          new THREE.MeshStandardMaterial({ color: '#9ffff0', emissive: new THREE.Color('#22d3ee'), emissiveIntensity: 1.6, roughness: 0.3 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, y + 1.7, z);
        world.add(ring);
        world.userData.finishRing = ring;
      }
    });

    if (lvl.pillar) {
      const pl = lvl.pillar;
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(pl[3] / 2, pl[3] / 2, 30, 12),
        new THREE.MeshStandardMaterial({ color: '#241748', roughness: 0.9 })
      );
      pillar.position.set(pl[0], 15, pl[1]);
      world.add(pillar);
    }

    if (lvl.lava) {
      const lava = new THREE.Mesh(
        new THREE.PlaneGeometry(160, 160),
        new THREE.MeshBasicMaterial({ color: '#ff3d00' })
      );
      lava.rotation.x = -Math.PI / 2;
      lava.position.set(0, -7, -14);
      scene.add(lava);
      const glow = new THREE.PointLight(0xff4a00, 60, 60);
      glow.position.set(0, -2, -14);
      scene.add(glow);
    }

    // coins
    const coinGeo = new THREE.TorusGeometry(0.34, 0.115, 8, 18);
    const coinMat = new THREE.MeshStandardMaterial({
      color: '#ffc93c', emissive: new THREE.Color('#c47a00'), emissiveIntensity: 0.55,
      metalness: 0.75, roughness: 0.25
    });
    const coins = lvl.coins.map(function (c, i) {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.position.set(c[0], c[1], c[2]);
      m.castShadow = true;
      world.add(m);
      return { mesh: m, x: c[0], y: c[1], z: c[2], taken: false, phase: i * 0.7 };
    });

    // player
    const avatar = buildAvatar(opts.look || {});
    scene.add(avatar);

    const pos = new THREE.Vector3(lvl.spawn[0], lvl.spawn[1], lvl.spawn[2]);
    const spawn = pos.clone();
    const vel = new THREE.Vector3();
    let yaw = 0, pitch = 0.42, dist = 9.4;
    let grounded = false, coyote = 0, jumpBuffer = 0, walk = 0, elapsed = 0;
    let collected = 0, won = false, running = false, last = 0;
    let axisX = 0, axisZ = 0;
    const camTarget = new THREE.Vector3();
    const camPos = new THREE.Vector3();

    function resize() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function solidAt(px, py, pz) {
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        if (px + HW > s.minX && px - HW < s.maxX &&
            pz + HW > s.minZ && pz - HW < s.maxZ &&
            py + PH > s.yBot && py < s.yTop) return s;
      }
      return null;
    }

    function moveAxis(axis, amount) {
      pos[axis] += amount;
      const hit = solidAt(pos.x, pos.y, pos.z);
      if (!hit) return false;
      if (axis === 'y') {
        if (amount < 0) {
          pos.y = hit.yTop; grounded = true;
        } else {
          pos.y = hit.yBot - PH;
        }
        vel.y = 0;
      } else if (axis === 'x') {
        pos.x = amount > 0 ? hit.minX - HW - 0.001 : hit.maxX + HW + 0.001;
        vel.x = 0;
      } else {
        pos.z = amount > 0 ? hit.minZ - HW - 0.001 : hit.maxZ + HW + 0.001;
        vel.z = 0;
      }
      return true;
    }

    function respawn(silent) {
      pos.copy(spawn);
      vel.set(0, 0, 0);
      grounded = true;
      coyote = 0;
      if (!silent) onFall();
    }

    function update(dt) {
      elapsed += dt;

      // horizontal input in camera space
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      let dx = fx * axisZ + rx * axisX;
      let dz = fz * axisZ + rz * axisX;
      const len = Math.hypot(dx, dz);
      if (len > 1) { dx /= len; dz /= len; }
      const accel = grounded ? 14 : 5;
      vel.x += (dx * SPEED - vel.x) * Math.min(1, dt * accel);
      vel.z += (dz * SPEED - vel.z) * Math.min(1, dt * accel);

      if (jumpBuffer > 0 && (grounded || coyote > 0)) {
        vel.y = JUMP_V;
        grounded = false;
        coyote = 0;
        jumpBuffer = 0;
      }
      vel.y -= GRAVITY * dt;
      if (vel.y < -40) vel.y = -40;

      grounded = false;
      // sub-step to avoid tunnelling
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(vel.x), Math.abs(vel.z), Math.abs(vel.y)) * dt / 0.18));
      const sdt = dt / steps;
      for (let s = 0; s < steps; s++) {
        moveAxis('x', vel.x * sdt);
        moveAxis('z', vel.z * sdt);
        moveAxis('y', vel.y * sdt);
      }

      if (grounded) coyote = 0.12; else coyote = Math.max(0, coyote - dt);
      jumpBuffer = Math.max(0, jumpBuffer - dt);

      if (pos.y < -24) respawn(false);

      // avatar transform + walk cycle
      avatar.position.set(pos.x, pos.y, pos.z);
      const sp = Math.hypot(vel.x, vel.z);
      if (sp > 0.4) {
        const targetRot = Math.atan2(vel.x, vel.z);
        let diff = targetRot - avatar.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        avatar.rotation.y += diff * Math.min(1, dt * 12);
      }
      walk += dt * sp * 1.9;
      const swing = Math.min(1, sp / SPEED);
      const ud = avatar.userData;
      if (grounded) {
        ud.legs[0].rotation.x = Math.sin(walk) * 0.55 * swing;
        ud.legs[1].rotation.x = -Math.sin(walk) * 0.55 * swing;
        ud.arms[0].rotation.x = -Math.sin(walk) * 0.5 * swing;
        ud.arms[1].rotation.x = Math.sin(walk) * 0.5 * swing;
      } else {
        ud.legs[0].rotation.x = -0.32;
        ud.legs[1].rotation.x = 0.22;
        ud.arms[0].rotation.x = -1.5;
        ud.arms[1].rotation.x = -1.5;
      }
      ud.head.position.y = 2.09 + Math.sin(elapsed * 3.1) * 0.012;

      // coins
      for (let i = 0; i < coins.length; i++) {
        const c = coins[i];
        if (c.taken) continue;
        c.mesh.rotation.y = elapsed * 2.4 + c.phase;
        c.mesh.position.y = c.y + Math.sin(elapsed * 2 + c.phase) * 0.12;
        const d = Math.hypot(c.x - pos.x, (c.y - (pos.y + 1.05)), c.z - pos.z);
        if (d < 1.15) {
          c.taken = true;
          c.mesh.visible = false;
          collected++;
          onCoin(collected, coins.length);
          if (collected === coins.length && !won) {
            won = true;
            setTimeout(function () { onWin({ coins: collected, time: elapsed }); }, 320);
          }
        }
      }

      const ring = world.userData.finishRing;
      if (ring) {
        ring.rotation.z = elapsed * 0.6;
        ring.position.y += Math.sin(elapsed * 1.6) * 0.0015;
      }

      // camera follow
      camTarget.set(pos.x, pos.y + 1.55, pos.z);
      const cp = Math.cos(pitch), sp2 = Math.sin(pitch);
      camPos.set(
        camTarget.x + Math.sin(yaw) * cp * dist,
        camTarget.y + sp2 * dist,
        camTarget.z + Math.cos(yaw) * cp * dist
      );
      if (camPos.y < camTarget.y - 2) camPos.y = camTarget.y - 2;
      camera.position.lerp(camPos, Math.min(1, dt * 8));
      camera.lookAt(camTarget);

      sun.position.set(camTarget.x + 14, camTarget.y + 26, camTarget.z + 12);
      sun.target.position.copy(camTarget);
    }

    function frame() {
      if (!running) return;
      const now = performance.now();
      let dt = (now - last) / 1000;
      if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
      if (dt > MAX_STEP) dt = MAX_STEP;
      last = now;
      update(dt);
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      resize();
      avatar.position.copy(pos);
      const home = (function () {
        // snap camera behind the spawn immediately
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        return new THREE.Vector3(
          pos.x + Math.sin(yaw) * cp * dist,
          pos.y + 1.55 + sp * dist,
          pos.z + Math.cos(yaw) * cp * dist
        );
      })();
      camera.position.copy(home);
      requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      renderer.dispose();
      scene.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); });
          else o.material.dispose();
        }
      });
    }

    return {
      start: start,
      stop: stop,
      resize: resize,
      setAxis: function (x, z) { axisX = x; axisZ = z; },
      jump: function () { jumpBuffer = 0.16; },
      orbit: function (dx, dy) {
        yaw -= dx * 0.006;
        pitch = Math.max(0.06, Math.min(1.15, pitch + dy * 0.005));
      },
      respawn: function () { respawn(true); },
      state: function () {
        return {
          coins: collected, total: coins.length, time: elapsed, won: won,
          pos: { x: pos.x, y: pos.y, z: pos.z }, grounded: grounded,
          platforms: solids.length
        };
      },
      level: lvl
    };
  }

  /* -------------------------------------------------- avatar preview scene */
  function createAvatarPreview(canvas, look) {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(0, 2.4, 7.2);
    camera.lookAt(0, 1.3, 0);

    scene.add(new THREE.HemisphereLight(0xc9d8ff, 0x2a1f4d, 1.5));
    const key = new THREE.DirectionalLight(0xffd9b0, 2.4);
    key.position.set(3.5, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8b5cf6, 1.6);
    rim.position.set(-4, 3, -4);
    scene.add(rim);

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 1.9, 0.14, 48),
      new THREE.MeshStandardMaterial({ color: '#1d1b2a', roughness: 0.9 })
    );
    disc.position.y = -0.07;
    scene.add(disc);

    let avatar = buildAvatar(look || {});
    scene.add(avatar);
    let raf = 0, t = 0, alive = true;

    function resize() {
      const w = canvas.clientWidth || 300, h = canvas.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function loop() {
      if (!alive) return;
      t += 0.016;
      avatar.rotation.y = Math.sin(t * 0.55) * 0.7;
      avatar.userData.head.rotation.z = Math.sin(t * 0.9) * 0.05;
      avatar.userData.arms[0].rotation.x = Math.sin(t * 1.4) * 0.06;
      avatar.userData.arms[1].rotation.x = -Math.sin(t * 1.4) * 0.06;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    }

    resize();
    loop();
    window.addEventListener('resize', resize);

    return {
      resize: resize,
      setLook: function (next) {
        scene.remove(avatar);
        avatar.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        avatar = buildAvatar(next || {});
        scene.add(avatar);
      },
      dispose: function () {
        alive = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        renderer.dispose();
      }
    };
  }

  window.MIBLOX_ENGINE = {
    LEVELS: LEVELS,
    createGame: createGame,
    createAvatarPreview: createAvatarPreview
  };
})();
