/* ============================================================
   Credo Studio — interaction layer
   1. WebGL hero (three.js)   2. Lenis smooth scroll
   3. Scroll reveal           4. Custom cursor + magnetic
   5. Procedural ambient sound
   ============================================================ */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = matchMedia('(pointer:fine)').matches;
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };      // normalized -1..1, t = target
  window.addEventListener('mousemove', function (e) {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  document.addEventListener('DOMContentLoaded', function () {
    initWebGL();
    initLenis();
    initReveal();
    if (finePointer) initCursor();
    initSound();
    initForm();
  });

  /* ============================================================
     0. CONTACT FORM (Netlify Forms — AJAX submit + inline success)
     ============================================================ */
  function initForm() {
    var form = document.getElementById('pform');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = new URLSearchParams(new FormData(form)).toString();
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body })
        .then(function (r) {
          if (!r.ok) throw new Error('bad status');
          var fields = form.querySelector('.fields'), ok = form.querySelector('.ok');
          if (fields) fields.style.display = 'none';
          if (ok) ok.style.display = 'block';
        })
        .catch(function () { form.submit(); });   // fall back to a normal POST
    });
  }

  /* ============================================================
     1. WEBGL HERO — displaced organic form + warm dust
     ============================================================ */
  function initWebGL() {
    var canvas = document.querySelector('.glcanvas');
    var hero = document.querySelector('.hero');
    if (!canvas || !hero || !window.THREE) return;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    } catch (e) { return; }                        // no WebGL → keep CSS blobs
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.z = 4.2;

    // ---- displaced form (custom shader) --------------------
    var uniforms = {
      uTime:  { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uColA:  { value: new THREE.Color(0xe0552b) },  // clay
      uColB:  { value: new THREE.Color(0xf0a06a) },  // warm sand
      uColC:  { value: new THREE.Color(0x2c1c12) }   // deep core
    };
    var SNOISE = [
      'vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}',
      'vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}',
      'vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}',
      'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
      'float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);',
      'vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);',
      'vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);',
      'vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;',
      'i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
      'float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);',
      'vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);',
      'vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));',
      'vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
      'vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);',
      'vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;',
      'vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;',
      'return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}'
    ].join('\n');

    var vert = [
      'uniform float uTime;varying float vDisp;varying vec3 vNormal;varying vec3 vView;',
      SNOISE,
      'void main(){',
      '  float n = snoise(normal*1.15 + uTime*0.22);',
      '  n += 0.5*snoise(normal*2.6 + uTime*0.15);',
      '  vDisp = n;',
      '  vec3 pos = position + normal * n * 0.34;',
      '  vNormal = normalize(normalMatrix * normal);',
      '  vec4 mv = modelViewMatrix * vec4(pos,1.0);',
      '  vView = normalize(-mv.xyz);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n');

    var frag = [
      'uniform vec3 uColA;uniform vec3 uColB;uniform vec3 uColC;',
      'varying float vDisp;varying vec3 vNormal;varying vec3 vView;',
      'void main(){',
      '  float f = clamp(vDisp*0.5+0.5,0.0,1.0);',
      '  vec3 col = mix(uColC, uColA, smoothstep(0.15,0.75,f));',
      '  col = mix(col, uColB, smoothstep(0.62,1.0,f));',
      '  float fres = pow(1.0 - max(dot(vNormal,vView),0.0), 2.4);',   // rim light
      '  col += fres * vec3(1.0,0.72,0.5) * 0.85;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');

    var geo = new THREE.IcosahedronGeometry(1.28, 48);
    var mat = new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: vert, fragmentShader: frag });
    var blob = new THREE.Mesh(geo, mat);
    blob.position.set(1.65, 0.1, -0.4);            // pushed to the right, behind the copy
    scene.add(blob);

    // ---- warm dust particles -------------------------------
    var COUNT = 520, pos = new Float32Array(COUNT * 3);
    for (var i = 0; i < COUNT; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 11;
      pos[i*3+1] = (Math.random() - 0.5) * 7;
      pos[i*3+2] = (Math.random() - 0.5) * 5 - 1;
    }
    var pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var pmat = new THREE.PointsMaterial({
      size: 0.032, color: 0xf0c9a0, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var dust = new THREE.Points(pgeo, pmat);
    scene.add(dust);

    function resize() {
      var w = hero.clientWidth, h = hero.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      // keep the form near the right edge on wide screens, centered on narrow
      blob.position.x = camera.aspect > 1 ? 1.65 : 0.35;
    }
    resize();
    addEventListener('resize', resize, { passive: true });

    hero.classList.add('gl-on');                   // hides CSS blobs, keeps grain

    // pause when hero scrolled away
    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; })
        .observe(hero);
    }

    var t0 = performance.now();
    function loop(now) {
      requestAnimationFrame(loop);
      if (!visible) return;
      var t = (now - t0) / 1000;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      uniforms.uTime.value = reduce ? 0 : t;
      blob.rotation.y = t * (reduce ? 0 : 0.12) + mouse.x * 0.35;
      blob.rotation.x = mouse.y * 0.25;
      dust.rotation.y = t * 0.015 + mouse.x * 0.15;
      dust.position.x = mouse.x * 0.4;
      dust.position.y = -mouse.y * 0.3;
      camera.position.x = mouse.x * 0.3;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
  }

  /* ============================================================
     2. LENIS SMOOTH SCROLL
     ============================================================ */
  var lenis = null;
  function initLenis() {
    if (reduce || !window.Lenis) return;
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
    function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length > 1) {
          var el = document.querySelector(id);
          if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: 0, duration: 1.2 }); }
        }
      });
    });
  }

  /* ============================================================
     3. SCROLL REVEAL
     ============================================================ */
  function initReveal() {
    var sel = ['.sechead', '.ticker', '.studio .split > div', '.svcrow',
               '.team .eyebrow', '.team h2', '.teamimg', '.person',
               '.cta .eyebrow', '.cta h2', '.cta p', '.cta .btn', '.fcol', '.fgrid > div'];
    var els = [];
    document.querySelectorAll(sel.join(',')).forEach(function (el) { els.push(el); });
    document.querySelectorAll('[data-reveal]').forEach(function (el) { els.push(el); });
    els.forEach(function (el) { el.setAttribute('data-reveal', ''); });

    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    // small stagger for siblings sharing a parent
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, sibs = Array.prototype.indexOf.call(el.parentNode.children, el);
        el.style.transitionDelay = Math.min(sibs, 5) * 70 + 'ms';
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ============================================================
     4. CUSTOM CURSOR + MAGNETIC BUTTONS
     ============================================================ */
  function initCursor() {
    var dot = document.querySelector('.cur-dot'),
        ring = document.querySelector('.cur-ring');
    if (!dot || !ring) return;
    document.documentElement.classList.add('cursor-on');
    var rx = 0, ry = 0;
    window.addEventListener('mousemove', function (e) {
      dot.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
    }, { passive: true });
    (function ringLoop() {
      requestAnimationFrame(ringLoop);
      rx += ((mouse.tx + 1) / 2 * innerWidth - rx) * 0.18;
      ry += ((mouse.ty + 1) / 2 * innerHeight - ry) * 0.18;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
    })();

    var hoverSel = 'a, button, .magnetic, .card, .svcrow, .bcard';
    document.querySelectorAll(hoverSel).forEach(function (el) {
      el.addEventListener('mouseenter', function () { document.documentElement.classList.add('cur-hover'); });
      el.addEventListener('mouseleave', function () { document.documentElement.classList.remove('cur-hover'); });
    });

    // magnetic pull
    document.querySelectorAll('.magnetic').forEach(function (el) {
      var strength = 0.32;
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + dx * strength + 'px,' + dy * strength + 'px)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transition = 'transform .45s cubic-bezier(.22,.61,.36,1)';
        el.style.transform = 'translate(0,0)';
        setTimeout(function () { el.style.transition = ''; }, 450);
      });
    });
  }

  /* ============================================================
     5. PROCEDURAL AMBIENT SOUND (Web Audio, no assets)
     ============================================================ */
  function initSound() {
    var btn = document.getElementById('soundToggle');
    if (!btn) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { btn.style.display = 'none'; return; }

    var ctx = null, master = null, voices = [], lfo = null, on = false;
    // warm suspended chord: A2, E3, A3, C#4, E4
    var freqs = [110.0, 164.81, 220.0, 277.18, 329.63];

    function build() {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0;
      var comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);

      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      filter.Q.value = 0.6;
      filter.connect(master);

      // slow filter sweep for movement
      lfo = ctx.createOscillator();
      var lfoGain = ctx.createGain();
      lfo.frequency.value = 0.05; lfoGain.gain.value = 260;
      lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
      lfo.start();

      freqs.forEach(function (f, i) {
        var o = ctx.createOscillator();
        o.type = i < 2 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = (i - 2) * 4;              // subtle spread
        var g = ctx.createGain();
        g.gain.value = (i === 0 ? 0.5 : 0.24) / freqs.length;
        o.connect(g); g.connect(filter);
        o.start();
        voices.push(o);
      });
    }

    // short synthesized UI blip
    var lastTick = 0;
    function blip(freq, dur, vol) {
      if (!on || !ctx) return;
      var now = ctx.currentTime;
      if (now - lastTick < 0.04) return; lastTick = now;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g); g.connect(master);
      o.start(now); o.stop(now + dur + 0.02);
    }

    function fade(to, sec) {
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(to, now + sec);
    }

    btn.addEventListener('click', function () {
      if (!ctx) build();
      if (ctx.state === 'suspended') ctx.resume();
      on = !on;
      btn.classList.toggle('on', on);
      fade(on ? 0.09 : 0, on ? 1.4 : 0.5);
      if (on) blip(523.25, 0.18, 0.12);
    });

    // hook UI blips (only audible when sound is on)
    document.querySelectorAll('.navlinks a, .svcrow, .bcard').forEach(function (el) {
      el.addEventListener('mouseenter', function () { blip(880, 0.09, 0.05); });
    });
    document.querySelectorAll('.btn, button').forEach(function (el) {
      el.addEventListener('mouseenter', function () { blip(660, 0.12, 0.06); });
      el.addEventListener('click', function () { blip(392, 0.22, 0.1); });
    });
  }
})();
