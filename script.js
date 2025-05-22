const button = document.getElementById('ButtonMenu');
const menu = document.getElementById('menu-list');

button.addEventListener('click', () => {
  if (menu.classList.contains('active')) {
    menu.classList.add('closing');
    menu.addEventListener('animationend', () => {
        menu.classList.remove('active', 'closing');
        menu.style.display = 'none';
    }, {once: true});
  } else {
    menu.style.display = 'flex';
    requestAnimationFrame(() => menu.classList.add('active'));
  }
});

// Сцена и камера
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 40;

// Рендерер
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// Контролы
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.enablePan = false;
controls.minDistance = 15;
controls.maxDistance = 40;

// Параметры Солнца
const sphereRadius = 12;
const sphereGeo = new THREE.SphereGeometry(sphereRadius, 128, 128);
const sunMat = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        uColor: { value: new THREE.Color(1, 0.4, 0) }
    },
    vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        void main() {
            vPosition = position;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec3 uColor;
        varying vec3 vPosition;
        varying vec3 vNormal;
        float hash(float n) { return fract(sin(n) * 43758.5453123); }
        float noise(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float n = dot(i, vec3(1.0,57.0,21.0));
            return mix(
                mix(mix(hash(n), hash(n+1.0), f.x), mix(hash(n+57.0), hash(n+58.0), f.x), f.y),
                mix(mix(hash(n+21.0), hash(n+22.0), f.x), mix(hash(n+78.0), hash(n+79.0), f.x), f.y),
                f.z
            );
        }
        float fbm(vec3 p) {
            float v = 0.0;
            v += 0.5 * noise(p);
            v += 0.25 * noise(p * 2.0);
            v += 0.125 * noise(p * 4.0);
            v += 0.0625 * noise(p * 8.0);
            return v;
        }
        void main() {
            float n = fbm(vPosition * 2.5 + time * 0.4);
            vec3 base = mix(vec3(0.6,0.1,0), vec3(1.0,1.0,0.2), smoothstep(0.2,0.7,n));
            vec3 color = mix(base, uColor, 0.5);
            vec3 lightDir = normalize(vec3(0.0, 0.0, 1.0));
            float diff = max(dot(vNormal, lightDir), 0.0);
            color *= diff * 0.7 + 0.3;
            float rim = pow(1.0 - dot(vNormal, lightDir), 6.0);
            color += rim * uColor * 0.5;
            gl_FragColor = vec4(color, 1.0);
        }
    `,
    side: THREE.FrontSide
});

// Группа Солнца
const sun = new THREE.Mesh(sphereGeo, sunMat);
const sunGroup = new THREE.Group();
sunGroup.add(sun);
scene.add(sunGroup);

// Glow-эффект
const glowGeo = new THREE.SphereGeometry(sphereRadius + 0.5, 128, 128);
const glowMat = new THREE.MeshBasicMaterial({
    color: sunMat.uniforms.uColor.value.clone(),
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
const glowMesh = new THREE.Mesh(glowGeo, glowMat);
sunGroup.add(glowMesh);

// Вспышки
const flares = [];
const flareTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/lensflare/lensflare0.png');
function createFlare() {
    const scale = sunGroup.scale.x + 0.025;
    if (Math.random() > 0.6 * scale) return;
    const spriteMat = new THREE.SpriteMaterial({
        map: flareTexture,
        color: new THREE.Color(sunMat.uniforms.uColor.value),
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    // Вычисляем радиус точно на поверхности Солнца
    const radius = sphereRadius * scale;
    sprite.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
    );
    sprite.scale.set(0.75 * scale, 0.75 * scale, 1.0 * scale);
    sunGroup.add(sprite);
    flares.push(sprite);
    gsap.to(sprite.material, {
        opacity: 1,
        duration: 0.2,
        onComplete: () => {
            gsap.to(sprite.material, {
                opacity: 0,
                duration: 1.0,
                onComplete: () => {
                    sunGroup.remove(sprite);
                    const idx = flares.indexOf(sprite);
                    if (idx !== -1) flares.splice(idx, 1);
                }
            });
        }
    });
}

// Звёздный фон
function createStarField() {
    const starCount = 26000;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        const r = THREE.MathUtils.randFloat(40, 60);
        const theta = Math.random() * Math.PI * 10;
        const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
        positions.set([
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        ], i * 3);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.35,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        sizeAttenuation: true,
        map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/circle.png'),
        blending: THREE.AdditiveBlending
    });
    scene.add(new THREE.Points(geom, mat));
}
createStarField();

// Анимация
function animate() {
    requestAnimationFrame(animate);
    sunMat.uniforms.time.value = performance.now() * 0.005;
    controls.update();
    sunGroup.rotation.y += 0.005;
    createFlare();
    renderer.render(scene, camera);
}
animate();


// Управление

document.getElementById('colorPicker').addEventListener('input', e => {
    const c = new THREE.Color(e.target.value);
    sunMat.uniforms.uColor.value.copy(c);
    glowMat.color.copy(c);
});