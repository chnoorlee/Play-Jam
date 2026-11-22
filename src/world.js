import * as THREE from 'three';
import PF from 'pathfinding';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { t } from './i18n.js';

const TAU = Math.PI * 2;
const ANCHORS = {
  keeper: { name: '守夜人', x: 0, z: 2.5, icon: '◇' },
  letter: { name: '未寄出的信', x: -8, z: -3.8, icon: '✉' },
  clock: { name: '潮汐钟', x: -11, z: -2.4, icon: 'Ⅰ' },
  'seed-note': { name: '园丁的手记', x: 7.6, z: -5.5, icon: '✉' },
  greenhouse: { name: '玻璃温室', x: 10, z: -2.8, icon: 'Ⅱ' },
  platform: { name: '末班站台', x: 3, z: 9.5, icon: 'Ⅲ' },
  'present-stamp': { name: '此刻的邮戳', x: 7, z: 11, icon: '◇', phase: 'present' },
  'echo-stamp': { name: '回声的邮戳', x: -1, z: 11, icon: '◇', phase: 'echo' },
  final: { name: '最后的投递', x: 0, z: -0.1, icon: '✉' },
};

export function createWorld(container, callbacks = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#518f8b');
  scene.fog = new THREE.Fog('#518f8b', 55, 120);
  const camera = new THREE.OrthographicCamera(-23, 23, 15, -15, 0.1, 200);
  const viewTarget = new THREE.Vector3(0, 0, 1.5);
  camera.position.set(30, 33, 36);
  camera.lookAt(viewTarget);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    const fallback = document.createElement('p');
    fallback.className = 'webgl-fallback';
    fallback.textContent = '无法开启图形画面。请启用浏览器硬件加速后重新打开《余信》。';
    container.append(fallback);
    throw error;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute('aria-label', '余信：潮水中的邮局、钟楼、温室与旧站台');
  renderer.domElement.setAttribute('tabindex', '0');
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.append(renderer.domElement);

  const hemi = new THREE.HemisphereLight('#f6f3e6', '#506264', 1.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d4', 2.85);
  sun.position.set(-12, 25, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 25, bottom: -24, near: 0.5, far: 80 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 4;
  scene.add(sun);

  const palette = {
    stone: '#cfb993', pale: '#f3dfb9', side: '#717f70', line: '#c5ae8b',
    sand: '#ad9f79', ochreStone: '#c6a276', wetStone: '#405b59',
    slate: '#677b76', mossStone: '#7c8962', mortar: '#746e5c',
    roof: '#b7553e', roofDark: '#71382d', coral: '#b95843', coralShade: '#904437',
    gold: '#cf9850', dark: '#293b3d', navy: '#293c49', roofBlue: '#344d56',
    wood: '#9d6949', woodLight: '#b78055', woodDark: '#684e3e',
    green: '#3c6353', olive: '#728359', teal: '#326863', leaf: '#688053',
    light: '#fff0bb', brick: '#996756', white: '#fff0d2',
  };
  const mats = {};
  function material(key, options = {}) {
    if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial({ color: palette[key] || key, roughness: 0.84, ...options });
    return mats[key];
  }
  function mesh(geometry, mat, x = 0, y = 0, z = 0, parent = scene) {
    const m = new THREE.Mesh(geometry, typeof mat === 'string' ? material(mat) : mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeo = new THREE.SphereGeometry(1, 12, 8);
  const leafGeo = new THREE.DodecahedronGeometry(1, 1);
  const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
  function box(w, h, d, mat, x, y, z, parent) {
    const m = mesh(boxGeo, mat, x, y, z, parent); m.scale.set(w, h, d); return m;
  }
  function sphere(r, mat, x, y, z, parent) {
    const m = mesh(sphereGeo, mat, x, y, z, parent); m.scale.setScalar(r); return m;
  }
  function cylinder(r1, r2, h, mat, x, y, z, parent = scene, segments = 12) {
    return mesh(new THREE.CylinderGeometry(r1, r2, h, segments), mat, x, y, z, parent);
  }
  function beam(from, to, thickness, mat, parent = scene) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const m = mesh(cylinderGeo, mat, 0, 0, 0, parent);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.scale.set(thickness, a.distanceTo(b), thickness);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    return m;
  }
  function roundedSlab(w, d, h, mat, x, y, z) {
    const r = 0.45, s = new THREE.Shape();
    s.moveTo(-w/2+r, -d/2); s.lineTo(w/2-r, -d/2);
    s.quadraticCurveTo(w/2, -d/2, w/2, -d/2+r); s.lineTo(w/2, d/2-r);
    s.quadraticCurveTo(w/2, d/2, w/2-r, d/2); s.lineTo(-w/2+r, d/2);
    s.quadraticCurveTo(-w/2, d/2, -w/2, d/2-r); s.lineTo(-w/2, -d/2+r);
    s.quadraticCurveTo(-w/2, -d/2, -w/2+r, -d/2);
    const geometry = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2, steps: 1 });
    geometry.rotateX(-Math.PI/2);
    return mesh(geometry, mat, x, y, z);
  }
  let seed = 1023;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  const seaUniforms = {
    time: { value: 0 },
    deep: { value: new THREE.Color('#2b6370') },
    shallow: { value: new THREE.Color('#79b2a1') },
    foam: { value: new THREE.Color('#c0d8b8') },
  };
  const seaMaterial = new THREE.ShaderMaterial({
    uniforms: seaUniforms,
    vertexShader: `varying vec3 p; uniform float time;
      void main(){p=position; vec3 v=position; v.z+=sin(v.x*.45+time*.5)*.025+cos(v.y*.65+time*.4)*.02;gl_Position=projectionMatrix*modelViewMatrix*vec4(v,1.);}`,
    fragmentShader: `varying vec3 p; uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform vec3 foam;
      float shore(vec2 q,vec2 origin,vec2 halfSize) {
        vec2 d=abs(q-origin)-halfSize+vec2(.62);
        return length(max(d,0.))+min(max(d.x,d.y),0.)-.62;
      }
      void main(){
        vec2 q=vec2(p.x,-p.y);
        float coast=min(min(shore(q,vec2(0.),vec2(5.)),
          shore(q,vec2(-10.5,-3.5),vec2(3.75))),
          min(shore(q,vec2(10.3,-4.8),vec2(3.8,4.15)),shore(q,vec2(3.,10.6),vec2(6.25,2.75))));
        float broad=sin(q.x*.35+q.y*.17+sin(q.y*.25)*.8+time*.12);
        float wash=1.-smoothstep(0.,5.5,coast);
        vec3 col=mix(deep,shallow,.10+.14*(broad*.5+.5)+wash*.53);
        float shift=sin(q.x*1.3+q.y*.96+time*.42)*.105;
        float nearFoam=1.-smoothstep(.028,.12,abs(coast-.53+shift));
        float farFoam=(1.-smoothstep(.025,.09,abs(coast-1.04+shift*.6)))
          *smoothstep(.15,.68,sin(q.x*1.77+q.y*2.1));
        float crest=smoothstep(.977,.999,sin(q.y*3.6+q.x*.66+sin(q.x*.41)*1.6+time*.45))
          *smoothstep(.52,.98,sin(q.x*1.57-q.y*.34+sin(q.y*.87)))
          *(sin(q.y*.42-q.x*.28)*.35+.65);
        float grain=fract(sin(dot(floor(q*102.),vec2(12.9898,78.233)))*43758.5453)-.5;
        col=mix(col,foam,nearFoam*.57+farFoam*.26+crest*.23);
        gl_FragColor=vec4(col+grain*.014,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const sea = mesh(new THREE.PlaneGeometry(230, 230, 32, 32), seaMaterial, 0, -0.93, 0);
  sea.rotation.x = -Math.PI/2; sea.castShadow = false;

  const rectangles = [
    { x: 0, z: 0, w: 10, d: 10 },
    { x: -10.5, z: -3.5, w: 7.5, d: 7.5 },
    { x: 10.3, z: -4.8, w: 7.6, d: 8.3 },
    { x: 3, z: 10.6, w: 12.5, d: 5.5 },
  ];
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const shoreTiles = ['stone', 'line', 'ochreStone', 'sand'];
  const wallStones = ['slate', 'side', 'mossStone', 'sand'];
  for (const [index, r] of rectangles.entries()) {
    roundedSlab(r.w + 1.06, r.d + 1.06, 0.19, 'wetStone', r.x, -1.01, r.z);
    roundedSlab(r.w + 0.69, r.d + 0.69, 0.24, 'slate', r.x, -0.88, r.z);
    roundedSlab(r.w + 0.26, r.d + 0.26, 0.62, 'mortar', r.x, -0.66, r.z);
    roundedSlab(r.w + 0.16, r.d + 0.16, 0.12, 'stone', r.x, -0.07, r.z);
    roundedSlab(r.w - 0.22, r.d - 0.22, 0.08, index === 2 ? 'sand' : 'line', r.x, -0.01, r.z);

    const columns = Math.ceil((r.w - 0.75) / 1.18);
    const rows = Math.ceil((r.d - 0.75) / 0.96);
    const tileW = (r.w - 0.75) / columns;
    const tileD = (r.d - 0.75) / rows;
    for (let iz = 0; iz < rows; iz++) {
      for (let ix = 0; ix < columns; ix++) {
        const x = r.x - (r.w - 0.75) / 2 + (ix + 0.5) * tileW;
        const z = r.z - (r.d - 0.75) / 2 + (iz + 0.5) * tileD;
        const color = shoreTiles[Math.floor(random() * shoreTiles.length)];
        const tile = box(tileW - 0.047, 0.026, tileD - 0.044, color, x, 0.19, z);
        tile.castShadow = false;
      }
    }

    for (const edge of ['x', 'z']) {
      const alongX = edge === 'x';
      const length = alongX ? r.w : r.d;
      const offset = (alongX ? r.d : r.w) / 2;
      const count = Math.ceil((length - 0.9) / 0.86);
      const spacing = (length - 0.9) / count;
      for (const side of [-1, 1]) {
        for (let row = 0; row < 2; row++) {
          for (let i = 0; i < count - row; i++) {
            const distance = -length / 2 + 0.45 + (i + 0.5 + row * 0.5) * spacing;
            const x = r.x + (alongX ? distance : side * (offset + 0.13));
            const z = r.z + (alongX ? side * (offset + 0.13) : distance);
            const color = wallStones[Math.floor(random() * wallStones.length)];
            const stone = mesh(rockGeo, color, x, -0.62 + row * 0.32, z);
            stone.scale.set(alongX ? spacing * 0.57 : 0.19, 0.23, alongX ? 0.19 : spacing * 0.57);
          }
        }
        for (let i = 0; i < Math.ceil(length / 2); i++) {
          const distance = (random() - 0.5) * (length - 0.7);
          const x = r.x + (alongX ? distance : side * (offset + 0.45));
          const z = r.z + (alongX ? side * (offset + 0.45) : distance);
          const rock = mesh(rockGeo, i % 2 ? 'wetStone' : 'slate', x, -0.88, z);
          rock.scale.set(0.23 + random() * 0.48, 0.18 + random() * 0.19, 0.31 + random() * 0.27);
          rock.rotation.y = random() * TAU;
        }
      }
    }
  }
  const bridges = [
    { x: -5.8, z: -1.6, w: 4, d: 2.1, alongX: true },
    { x: 5.8, z: -2.5, w: 4.1, d: 2.1, alongX: true },
    { x: 1, z: 6.55, w: 2.1, d: 4.5, alongX: false },
  ];
  for (const b of bridges) {
    const length = b.alongX ? b.w : b.d;
    const width = b.alongX ? b.d : b.w;
    const count = Math.ceil(length/0.25);
    const position = (distance, edge, y) => [
      b.x + (b.alongX ? distance : edge), y, b.z + (b.alongX ? edge : distance),
    ];
    for (const side of [-1, 1]) {
      box(b.alongX ? length : 0.18, 0.24, b.alongX ? 0.18 : length, 'woodDark',
        ...position(0, side * (width / 2 - 0.13), -0.035));
    }
    for (let i=0;i<count;i++) {
      const offset=-length/2+(i+0.5)*length/count;
      const wood = ['wood', 'woodLight', 'wood', 'woodDark'][i % 4];
      const slat = length / count - 0.022;
      box(b.alongX ? slat : width, 0.12, b.alongX ? width : slat, wood, ...position(offset, 0, 0.15));
    }
    for (const side of [-1,1]) {
      const edge = side * (width / 2 - 0.05);
      const reach = length / 2 - 0.13;
      for (let i=0;i<3;i++) {
        const distance = (i - 1) * reach;
        box(0.16, 1.92, 0.16, 'woodDark', ...position(distance, edge, -0.05));
        box(0.19, 0.075, 0.19, 'pale', ...position(distance, edge, 0.91));
      }
      for (const direction of [-1, 1]) {
        beam(position(0, edge, 0.73), position(direction * reach / 2, edge, 0.60), 0.035, 'gold');
        beam(position(direction * reach / 2, edge, 0.60), position(direction * reach, edge, 0.73), 0.035, 'gold');
      }
    }
  }

  function roof(w,d,h,x,y,z,mat='roof',trim='roofDark',parent=scene) {
    const s=new THREE.Shape(); s.moveTo(-w/2,0); s.lineTo(0,h); s.lineTo(w/2,0); s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false});
    mesh(g,mat,x,y,z-d/2,parent);
    box(w+0.1,0.15,d+0.11,trim,x,y-0.035,z,parent);
    for(let i=0;i<=8;i++) {
      const tz=z-d/2+i*d/8;
      const radius = i === 0 || i === 8 ? 0.05 : 0.023;
      beam([x-w/2,y+0.03,tz],[x,y+h+0.03,tz],radius,trim,parent);
      beam([x,y+h+0.03,tz],[x+w/2,y+0.03,tz],radius,trim,parent);
    }
    beam([x,y+h+0.04,z-d/2-0.05],[x,y+h+0.04,z+d/2+0.05],0.075,trim,parent);
  }
  const paintedSigns = [];
  function sign(text, width, height, x,y,z, color='#f4efe0',ink='#2e5653') {
    const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=192;
    const ctx=canvas.getContext('2d');
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    const m=mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture}),x,y,z);
    m.castShadow=false;
    m.userData.setText=source=>{
      m.userData.caption=source;
      const caption=t(source);
      ctx.fillStyle=color;ctx.fillRect(0,0,512,192);
      ctx.strokeStyle=ink;ctx.lineWidth=5;ctx.strokeRect(13,13,486,166);
      ctx.lineWidth=1.5;ctx.strokeRect(24,24,464,144);
      ctx.fillStyle=ink;ctx.font='600 65px "Microsoft YaHei", sans-serif';
      const fontSize=Math.min(65,Math.floor(65*437/ctx.measureText(caption).width));
      ctx.font=`600 ${fontSize}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(caption,256,100);
      texture.needsUpdate=true;
    };
    m.userData.setText(text);
    paintedSigns.push(m);
    return m;
  }
  function arch(width,height,depth,mat,x,y,z,parent=scene) {
    const s=new THREE.Shape(); s.moveTo(-width/2,0);s.lineTo(-width/2,height-width/2);
    s.absarc(0,height-width/2,width/2,Math.PI,0,true);s.lineTo(width/2,0);s.closePath();
    return mesh(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:16}),mat,x,y,z,parent);
  }
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: '#6c857a', emissive: '#f8a845', emissiveIntensity: 0, roughness: 0.47,
  });
  const lanternMaterial = new THREE.MeshStandardMaterial({
    color: '#c8a15c', emissive: '#ffc05d', emissiveIntensity: 0.16, roughness: 0.44,
  });
  function windowBay(x, z, bottom, rotation) {
    const group = new THREE.Group();
    group.position.set(x, bottom, z);
    group.rotation.y = rotation;
    scene.add(group);
    arch(0.91,1.38,0.07,'pale',0,0,0,group);
    arch(0.66,1.16,0.05,windowMaterial,0,0.09,0.08,group);
    box(0.05,1.1,0.06,'navy',0,0.64,0.14,group);
    box(0.69,0.05,0.06,'navy',0,0.60,0.14,group);
    box(1.02,0.12,0.24,'pale',0,0.03,0.13,group);
    for (const side of [-1,1]) {
      box(0.18,0.83,0.06,'coralShade',side*0.53,0.49,0.04,group);
      for (let i=0;i<5;i++) box(0.145,0.023,0.023,'roof',side*0.53,0.19+i*0.15,0.08,group);
    }
  }

  // Post office with painted masonry, cornice brackets, and facing stone.
  box(5.6,2.84,3.3,'coral',-0.7,1.66,-2.7);
  box(5.86,0.30,3.53,'mossStone',-0.7,0.36,-2.7);
  box(5.89,0.16,3.60,'pale',-0.7,0.53,-2.7);
  box(5.92,0.27,3.58,'coralShade',-0.7,2.94,-2.7);
  box(6.04,0.10,3.74,'pale',-0.7,3.13,-2.7);
  roof(6.35,3.99,1.47,-0.7,3.24,-2.7,'roofBlue','navy');
  for (let i=0;i<9;i++) box(0.12,0.16,0.14,'pale',-3.08+i*0.59,2.85,-0.89);
  for (const x of [-3.47,2.07]) {
    for (let i=0;i<7;i++) box(i%2 ? 0.22 : 0.34,0.19,0.11,'stone',x,0.77+i*0.28,-1.025);
  }
  for (let i=0;i<7;i++) box(0.11,0.19,i%2 ? 0.22 : 0.34,'stone',2.115,0.77+i*0.28,-4.22);
  arch(1.53,2.29,0.09,'pale',-0.43,0.24,-1.00);
  arch(1.21,2.04,0.10,'navy',-0.43,0.30,-0.88);
  arch(0.95,1.52,0.04,windowMaterial,-0.43,0.78,-0.755);
  box(1.10,1.16,0.04,'navy',-0.43,0.99,-0.69);
  box(0.06,1.88,0.08,'gold',-0.43,1.28,-0.66);
  sphere(0.047,'gold',-0.25,1.03,-0.59);
  windowBay(-2.35,-1.01,0.99,0);
  windowBay(1.30,-1.01,0.99,0);
  windowBay(2.15,-2.17,0.99,Math.PI/2);
  windowBay(2.15,-3.64,0.99,Math.PI/2);
  box(2.44,0.72,0.13,'coralShade',-0.70,2.83,-0.98);
  sign('潮 汐 邮 局',2.34,0.61,-0.70,2.83,-0.895,'#efdbb2','#743525');
  box(0.37,1.53,0.42,'brick',1.21,3.95,-3.32);
  box(0.54,0.14,0.59,'stone',1.21,4.74,-3.32);
  box(0.26,0.045,0.30,'dark',1.21,4.81,-3.32);
  for(let i=0;i<3;i++) box(2.8-i*0.22,0.12,0.37,i%2?'stone':'pale',-0.43,0.21+i*0.065,-0.13-i*0.26);
  const flag = new THREE.Group();
  flag.position.set(-3.28,3.32,-1.90);
  scene.add(flag);
  box(0.92,0.51,0.042,'roof',-0.46,0,0,flag);
  box(0.89,0.075,0.044,'pale',-0.45,-0.13,0,flag);
  box(0.22,0.15,0.047,'gold',-0.29,0.075,0,flag);
  beam([-3.28,0.29,-1.90],[-3.28,3.75,-1.90],0.034,'gold');
  sphere(0.079,'gold',-3.28,3.77,-1.90);

  // A faceted, striped tidal tower with an octagonal lantern gallery.
  const towerX=-11.7;
  const towerZ=-5;
  function towerRing(top,bottom,height,color,y) {
    const ring=cylinder(top,bottom,height,color,towerX,y,towerZ,scene,8);
    ring.rotation.y=Math.PI/8;
    return ring;
  }
  towerRing(1.42,1.49,0.27,'slate',0.36);
  towerRing(1.30,1.39,0.18,'stone',0.56);
  towerRing(1.20,1.31,1.05,'roof',1.17);
  towerRing(1.04,1.20,1.42,'pale',2.41);
  towerRing(0.98,1.04,1.5,'roof',3.87);
  towerRing(1.24,1.04,0.18,'stone',4.69);
  towerRing(1.28,1.26,0.11,'navy',4.84);
  towerRing(0.69,0.73,0.93,lanternMaterial,5.38);
  towerRing(0.80,0.83,0.14,'navy',5.88);
  towerRing(0.12,1.02,0.87,'roof',6.38);
  towerRing(0.083,0.14,0.28,'navy',6.92);
  sphere(0.115,'gold',towerX,7.11,towerZ);
  for(let i=0;i<8;i++) {
    const a=i*TAU/8+Math.PI/8;
    const next=a+TAU/8;
    const gallery=(angle,y)=>[towerX+Math.sin(angle)*1.17,y,towerZ+Math.cos(angle)*1.17];
    beam(gallery(a,4.90),gallery(a,5.31),0.032,'navy');
    beam(gallery(a,5.29),gallery(next,5.29),0.033,'navy');
    beam([towerX+Math.sin(a)*0.74,4.93,towerZ+Math.cos(a)*0.74],
      [towerX+Math.sin(a)*0.72,5.84,towerZ+Math.cos(a)*0.72],0.048,'navy');
    beam([towerX+Math.sin(a)*0.98,5.96,towerZ+Math.cos(a)*0.98],
      [towerX+Math.sin(a)*0.13,6.83,towerZ+Math.cos(a)*0.13],0.032,'roofDark');
  }
  const clockBack=cylinder(0.94,0.94,0.21,'navy',towerX,3.86,-3.985,scene,32);
  clockBack.rotation.x=Math.PI/2;
  const clockRim=cylinder(0.87,0.87,0.12,'gold',towerX,3.86,-3.85,scene,32);
  clockRim.rotation.x=Math.PI/2;
  const clockFaceMaterial=new THREE.MeshStandardMaterial({color:palette.pale,emissive:'#ffc56d',emissiveIntensity:0,roughness:.8});
  const clockFace=mesh(new THREE.CircleGeometry(0.77,32),clockFaceMaterial,towerX,3.86,-3.78);
  for(let i=0;i<12;i++) {
    const a=i*TAU/12;
    const tick=box(0.045,i%3===0?0.16:0.085,0.035,'dark',towerX+Math.sin(a)*0.61,3.86+Math.cos(a)*0.61,-3.75);
    tick.rotation.z=-a;
  }
  const clockHands=new THREE.Group();clockHands.position.set(towerX,3.86,-3.70);scene.add(clockHands);
  const minute=box(0.045,0.56,0.04,'dark',0,0.24,0,clockHands);minute.rotation.z=-0.4;
  const hour=box(0.055,0.39,0.05,'roof',-0.12,0.1,0.01,clockHands);hour.rotation.z=0.85;
  sphere(0.075,'gold',0,0,0.04,clockHands);
  arch(0.87,1.49,0.10,'stone',towerX,0.48,-3.85);
  arch(0.68,1.29,0.055,'navy',towerX,0.55,-3.73);
  box(1.16,0.11,0.48,'stone',towerX,0.39,-3.69);
  sphere(0.041,'gold',towerX+0.21,1.04,-3.65);
  box(1.1,0.1,0.7,'wood',-8.2,0.9,-4.15);
  for(const x of [-8.6,-7.8])box(0.09,0.72,0.09,'gold',x,0.51,-4.15);
  const letterModel=box(0.44,0.025,0.32,'white',-8.2,0.97,-4.15);letterModel.rotation.y=0.2;
  const seal=sphere(0.065,'roof',-8.2,1.005,-4.15);seal.scale.y=0.12;
  for(let i=0;i<4;i++)box(0.07,0.055,1.05,'roof',-13.38,0.27,-5.5+i*0.58);

  // The conservatory's pale stone skirt and painted ribs frame a visible nursery.
  const glass=new THREE.MeshStandardMaterial({color:'#90bdab',transparent:true,opacity:0.24,roughness:0.23,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});
  box(4.75,0.30,4.05,'olive',10.4,0.35,-5.9);
  box(4.81,0.10,4.1,'stone',10.4,0.51,-5.9);
  box(4.62,0.08,3.93,'sand',10.4,0.55,-5.9);
  for(const x of [8.2,9.3,10.4,11.5,12.6]) {
    for(const z of [-7.8,-4.0]) {
      box(0.10,2.25,0.10,'green',x,1.68,z);
      box(0.16,0.19,0.15,'olive',x,0.67,z);
      box(0.17,0.12,0.15,'gold',x,2.75,z);
    }
    beam([x,2.8,-7.8],[x,3.85,-5.9],0.057,'green');
    beam([x,3.85,-5.9],[x,2.8,-4],0.057,'green');
    for(const z of [-7.78,-4.02]) {
      const upperZ=z+Math.sign(-5.9-z)*0.65;
      beam([x,2.48,z],[x,3.13,upperZ],0.026,'olive');
    }
  }
  for(const z of [-7.8,-4.0])for(const y of [0.6,1.62,2.8])beam([8.08,y,z],[12.72,y,z],0.045,'green');
  for(const x of [8.2,12.6]) {
    for(const y of [.6,1.62,2.8])beam([x,y,-7.87],[x,y,-3.93],0.044,'green');
    for(const z of [-6.85,-5.9,-4.95])box(0.07,2.22,0.07,'green',x,1.7,z);
    beam([x,2.8,-5.9],[x,3.85,-5.9],0.045,'green');
    beam([x,3.32,-6.85],[x,3.32,-4.95],0.038,'olive');
    sphere(0.105,'gold',x,3.96,-5.9);
  }
  beam([8.08,3.86,-5.9],[12.72,3.86,-5.9],0.066,'gold');
  for(const z of [-6.85,-4.95])beam([8.18,3.32,z],[12.62,3.32,z],0.029,'olive');
  for(const x of [8.74,9.84,10.96,12.05]) {
    box(1.04,0.17,0.15,'olive',x,0.72,-4.02);
    box(1.04,0.07,0.07,'gold',x,2.62,-3.98);
  }
  box(4.4,2.2,0.025,glass,10.4,1.7,-7.8);
  box(0.025,2.2,3.8,glass,12.6,1.7,-5.9);
  const roofGlass=mesh(new THREE.PlaneGeometry(4.4,2.16),glass,10.4,3.325,-4.95);roofGlass.rotation.x=-Math.atan2(1.9,1.05);
  const roofGlassBack=mesh(new THREE.PlaneGeometry(4.4,2.16),glass,10.4,3.325,-6.85);roofGlassBack.rotation.x=Math.atan2(1.9,1.05);
  box(4.4,2.2,0.024,glass,10.4,1.70,-4.0);
  arch(1.1,1.92,0.10,'green',10.4,0.60,-3.97);
  arch(0.84,1.65,0.03,windowMaterial,10.4,0.73,-3.86);
  box(0.07,1.55,0.075,'green',10.4,1.52,-3.81);
  box(0.93,0.54,0.04,'olive',10.4,0.91,-3.82);
  box(0.45,0.43,0.07,'green',10.4,1.05,-3.79);
  sign('温 室',1.38,0.47,10.4,2.59,-3.82,'#d9cf9c','#365647');
  const flowerMats=['#c56d57','#d9a84e','#efe0b5','#995861'].map(c=>material(c));
  const bloomParts=[];
  const foliage=[];
  function plant(x,z,scale=1,base=0.22) {
    cylinder(0.18*scale,0.12*scale,0.28*scale,'brick',x,base+0.14*scale,z);
    for(let i=0;i<3;i++) {
      const a=i*2.1,px=x+Math.sin(a)*0.12*scale,pz=z+Math.cos(a)*0.12*scale;
      beam([x,base+0.24*scale,z],[px,base+0.76*scale,pz],0.02*scale,'leaf');
      for(let j=0;j<5;j++) {
        const b=j*TAU/5;
        const p=sphere(0.1*scale,flowerMats[i%4],px+Math.sin(b)*0.08*scale,base+0.76*scale,pz+Math.cos(b)*0.08*scale);p.scale.y*=0.6;
        bloomParts.push(p);
      }
      bloomParts.push(sphere(0.055*scale,'gold',px,base+0.80*scale,pz));
    }
  }
  for (const z of [-7.1,-5.5]) {
    box(3.77,0.25,0.7,'brick',10.35,0.64,z);
    box(3.82,0.09,0.78,'woodDark',10.35,0.77,z);
  }
  for(let i=0;i<8;i++)plant(8.7+(i%4)*1.04,-7.1+Math.floor(i/4)*1.6,0.98+random()*0.30,0.81);
  plant(12.9,-3.3,1.2);plant(7.1,-6.5,0.9);
  box(0.8,0.08,0.64,'wood',7.55,0.88,-5.8);
  const seedNoteModel=box(0.54,0.025,0.38,'white',7.55,0.94,-5.8);
  for(const x of [9,10.2,11.4]) {
    cylinder(0.32,0.4,0.6,'stone',x,0.53,-2.95);
    const angle=(x-9)*0.5;
    box(0.39,0.52,0.12,'gold',x,1.04,-2.95).rotation.y=angle;
    box(0.26,0.38,0.047,'teal',x+Math.sin(angle)*0.071,1.045,-2.95+Math.cos(angle)*0.071).rotation.y=angle;
  }

  // Riveted seafront canopy, a painted warning edge, and rails descending into the tide.
  box(1.88,0.05,5.36,'slate',2.95,0.209,10.6);
  for(const x of [2.5,3.4]) {
    box(0.091,0.096,5.5,'woodDark',x,0.29,10.65);
    box(0.062,0.026,5.5,'gold',x,0.351,10.65);
    beam([x,0.32,13.40],[x,-0.78,15.0],0.05,'woodDark');
    beam([x,-0.78,15.0],[x,-0.95,17.65],0.042,'wetStone');
  }
  for(let z=7.96;z<17.65;z+=0.48) {
    const y=z<13.36 ? 0.244 : Math.max(-0.94,0.24-(z-13.35)*.69);
    box(1.59,0.07,0.13,'wood',2.95,y,z);
  }
  for(const x of [1.93,3.97]) {
    box(0.18,0.10,5.44,'slate',x,0.23,10.6);
    box(0.11,0.022,5.45,'gold',x,0.29,10.6);
  }
  box(9.1,0.18,2.09,'stone',3.05,0.27,9.35);
  for(const x of [-1.15,1.07,5.05,7.27]) {
    const z=8.76;
    box(0.20,2.44,0.20,'navy',x,1.56,z);
    box(0.32,0.39,0.32,'stone',x,0.51,z);
    box(0.26,0.10,0.27,'gold',x,2.69,z);
    beam([x,2.01,z],[x,2.78,9.72],0.047,'navy');
    beam([x,2.78,z],[x,2.78,10.39],0.066,'navy');
    for (const side of [-1,1]) beam([x,2.35,z],[x+side*.43,2.78,z],0.047,'navy');
  }
  const stationCanopy=new THREE.Group();
  stationCanopy.position.set(3.05,0,9.33);
  stationCanopy.rotation.y=Math.PI/2;
  scene.add(stationCanopy);
  roof(2.57,9.55,0.57,0,2.82,0,'roofBlue','navy',stationCanopy);
  box(9.7,0.28,0.11,'gold',3.05,2.79,10.65);
  box(9.72,0.061,0.14,'navy',3.05,2.94,10.64);
  box(9.72,0.064,0.14,'navy',3.05,2.66,10.64);
  for(const x of [-1.22,0.40,1.55,4.55,5.70,7.32]) {
    box(0.056,0.13,0.038,'navy',x,2.80,10.72);
  }
  box(2.94,0.67,0.11,'navy',3.05,2.62,10.77);
  const stationSign=sign('末 班 · 无 人',2.77,0.54,3.05,2.62,10.84,'#e8cc96','#334950');
  const presentStamp=new THREE.Group();presentStamp.position.set(7,0.23,11);scene.add(presentStamp);
  const echoStamp=new THREE.Group();echoStamp.position.set(-1,0.23,11);scene.add(echoStamp);
  for(const [group,c] of [[presentStamp,'gold'],[echoStamp,'#b2b0e4']]) {
    cylinder(0.32,0.42,0.65,'stone',0,0.3,0,group);
    cylinder(0.18,0.24,0.11,c,0,0.69,0,group);
    cylinder(0.06,0.08,0.22,'dark',0,0.84,0,group);
    sphere(0.105,c,0,1.0,0,group);
  }
  echoStamp.visible=false;

  function bench(x,z,rotation=0) {
    const group=new THREE.Group();group.position.set(x,0.22,z);group.rotation.y=rotation;scene.add(group);
    for(let i=0;i<3;i++)box(1.6,0.065,0.16,'wood',0,0.49,-0.22+i*0.18,group);
    for(let i=0;i<2;i++)box(1.6,0.12,0.07,'wood',0,0.81+i*0.18,-0.34,group);
    for(const x of [-0.61,0.61]) {
      beam([x,0,0.2],[x,0.49,0.2],0.035,'green',group);
      beam([x,0,-0.3],[x,1.04,-0.3],0.035,'green',group);
    }
  }
  bench(-2,3.5);bench(-13,-0.9);bench(5.5,12.4,Math.PI);bench(12.9,-5.4,-Math.PI/2);
  const stationLanterns=[];
  function lamp(x,z) {
    cylinder(0.14,0.24,0.25,'dark',x,0.34,z);
    cylinder(0.045,0.065,2.05,'dark',x,1.45,z);
    const lantern=box(0.39,0.46,0.39,new THREE.MeshStandardMaterial({color:palette.light,emissive:palette.light,emissiveIntensity:0.6}),x,2.57,z);
    if(z>7)stationLanterns.push(lantern);
    for(const dx of [-0.21,0.21])for(const dz of [-0.21,0.21])box(0.035,0.55,0.035,'dark',x+dx,2.57,z+dz);
    const top=mesh(new THREE.ConeGeometry(0.38,0.25,4),'dark',x,2.96,z);top.rotation.y=Math.PI/4;
    sphere(0.07,'gold',x,3.13,z);
  }
  for(const [x,z] of [[-4,3.9],[4,-4.2],[-7,-0.9],[7,-2.2],[8.3,12.4],[-2.5,8.6]])lamp(x,z);
  function tree(x,z,size=1) {
    cylinder(0.11*size,0.19*size,1.6*size,'wood',x,0.9*size,z);
    const leafMat=new THREE.MeshStandardMaterial({color:new THREE.Color('#729c80').offsetHSL((random()-.5)*.04,0,(random()-.5)*.05),roughness:0.96});
    foliage.push(leafMat);
    for(let i=0;i<5;i++) {
      const a=i*TAU/5;
      const m=mesh(leafGeo,leafMat,x+Math.sin(a)*0.47*size,(2.0+(i%2)*.37)*size,z+Math.cos(a)*0.43*size);
      m.scale.set((.69+random()*.2)*size,(.8+random()*.22)*size,(.69+random()*.2)*size);
      m.rotation.set(random(),random(),random());
    }
    cylinder(0.66*size,0.73*size,0.22,'stone',x,0.3,z);
  }
  for(const [x,z,s] of [[-4,-3.7,1.2],[3.8,3.6,1.05],[-3.8,1,0.85],[-13.5,-6.3,0.85],[-8.3,-6.5,1.1],[13.2,-7.7,1.15],[7,-7.8,0.8],[-2,12.5,0.9],[8.3,8.2,0.95]])tree(x,z,s);
  // Red postal furniture and scattered blue-grey stone tell the story without a skybox.
  const postbox=new THREE.Group();postbox.position.set(2.7,0.22,0.4);scene.add(postbox);
  cylinder(.37,.37,1.1,'roof',0,.65,0,postbox,24);
  const cap=mesh(new THREE.SphereGeometry(.38,20,12,0,TAU,0,Math.PI/2),'roof',0,1.2,0,postbox);
  box(.4,.09,.035,'dark',0,1.05,.36,postbox);
  box(.32,.28,.035,'pale',0,.68,.36,postbox);
  cylinder(.44,.44,.13,'dark',0,.1,0,postbox);
  for(const [x,z,size] of [[-17,8,1.2],[-16,-9.9,0.85],[-3,-12.4,0.7],[8,-14.1,1.1],[17,-2.2,1.1],[16,16,0.8],[-7,15.6,0.75]]) {
    for(let i=0;i<4;i++) {
      const a=i*TAU/4+random(), radius=size*(0.2+random()*.55);
      const rock=mesh(rockGeo,i%2?'slate':'wetStone',x+Math.sin(a)*radius,-0.96,z+Math.cos(a)*radius);
      rock.scale.set(size*(.45+random()*.29),size*(.18+random()*.31),size*(.40+random()*.50));
      rock.rotation.y=a;
    }
    if(size>1.05){
      cylinder(.113,.19,.53,'roof',x,-.43,z,scene,8);
      cylinder(.16,.135,.08,'pale',x,-.142,z,scene,8);
    }
  }
  const boats=[];
  const sailcloth=new THREE.MeshStandardMaterial({color:'#ead5a0',side:THREE.DoubleSide,roughness:1});
  const hullShape=new THREE.Shape();
  hullShape.moveTo(-.69,0);
  hullShape.quadraticCurveTo(-.39,.26,.15,.24);
  hullShape.quadraticCurveTo(.59,.21,.75,0);
  hullShape.quadraticCurveTo(.59,-.21,.15,-.24);
  hullShape.quadraticCurveTo(-.39,-.26,-.69,0);
  const hullGeo=new THREE.ExtrudeGeometry(hullShape,{depth:.17,bevelEnabled:true,bevelThickness:.045,bevelSize:.047,bevelSegments:1,curveSegments:4});
  hullGeo.rotateX(-Math.PI/2);
  const sailShape=new THREE.Shape();
  sailShape.moveTo(-.54,0);
  sailShape.quadraticCurveTo(-.12,.26,.03,.81);
  sailShape.lineTo(.10,0);
  sailShape.quadraticCurveTo(-.18,-.058,-.54,0);
  const sailGeo=new THREE.ShapeGeometry(sailShape,6);
  function boat(x,z,size,color,heading) {
    const group=new THREE.Group();
    group.position.set(x,-.91,z);
    group.scale.setScalar(size);
    group.rotation.y=heading;
    scene.add(group);
    mesh(hullGeo,color,0,0,0,group);
    mesh(hullGeo,'woodLight',0,.183,0,group).scale.set(.97,.27,.88);
    beam([.075,.16,0],[.075,1.08,0],.028,'woodDark',group);
    mesh(sailGeo,sailcloth,0,.224,.012,group);
    beam([-.61,.218,.015],[.12,.218,.015],.023,'woodDark',group);
    box(.17,.11,.026,color,.148,.963,.015,group);
    boats.push({group,y:group.position.y,offset:random()*TAU});
  }
  boat(-6.7,8.6,1.18,'teal',.31);
  boat(11,3.8,1.21,'roof',-.67);
  boat(-15,-.2,.85,'navy',.72);
  boat(1,-10,1.10,'roof',-.21);

  // Bloom heads share five material batches, keeping their growth independent of the baked stems.
  const gardenBlooms=new THREE.Group();gardenBlooms.position.set(10.4,.25,-5.9);scene.add(gardenBlooms);
  scene.updateMatrixWorld(true);
  for(const mat of [...flowerMats,material('gold')]) {
    const parts=bloomParts.filter(part=>part.material===mat);
    if(!parts.length)continue;
    const pieces=parts.map(part=>{
      const geometry=part.geometry.toNonIndexed();geometry.applyMatrix4(part.matrixWorld);geometry.translate(-10.4,-.25,5.9);return geometry;
    });
    const geometry=mergeGeometries(pieces,false);
    mesh(geometry,mat,0,0,0,gardenBlooms);
    pieces.forEach(piece=>piece.dispose());parts.forEach(part=>part.removeFromParent());
  }
  gardenBlooms.scale.y=.34;

  // Bake static architecture into material batches; animated objects retain their own transforms.
  const animatedObjects=new Set([sea,clockFace,letterModel,seal,seedNoteModel,...stationLanterns]);
  for(const root of [flag,clockHands,gardenBlooms,presentStamp,echoStamp,...boats.map(boat=>boat.group)])root.traverse(object=>animatedObjects.add(object));
  scene.traverse(object=>{if(object.material===glass)object.castShadow=false;});
  animatedObjects.forEach(object=>{if(object.isMesh)object.castShadow=false;});
  const batches=new Map(),staticMeshes=[];
  scene.updateMatrixWorld(true);
  scene.traverse(object=>{
    if(!object.isMesh||animatedObjects.has(object))return;
    const key=`${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    if(!batches.has(key))batches.set(key,{material:object.material,castShadow:object.castShadow,receiveShadow:object.receiveShadow,geometries:[],meshes:[]});
    const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    batches.get(key).geometries.push(geometry);
    batches.get(key).meshes.push(object);
  });
  for(const batch of batches.values()){
    const geometry=mergeGeometries(batch.geometries,false);
    if(geometry){
      const combined=new THREE.Mesh(geometry,batch.material);
      combined.castShadow=batch.castShadow;combined.receiveShadow=batch.receiveShadow;
      combined.name='static-material-batch';scene.add(combined);
      staticMeshes.push(...batch.meshes);
    }
    batch.geometries.forEach(geometry=>geometry.dispose());
  }
  const retainedGeometry=new Set([boxGeo,sphereGeo,leafGeo,cylinderGeo]);
  const obsoleteGeometry=new Set();
  staticMeshes.forEach(object=>{
    object.removeFromParent();
    if(!retainedGeometry.has(object.geometry))obsoleteGeometry.add(object.geometry);
  });
  obsoleteGeometry.forEach(geometry=>geometry.dispose());

  function person({coat, scarf, hatColor, scale=1}) {
    const group=new THREE.Group();group.scale.setScalar(scale);
    const cloak=cylinder(.202,.30,.70,coat,0,.67,0,group);
    cylinder(.306,.309,.051,'woodDark',0,.338,0,group);
    const skin=material('#d7a77f');
    sphere(.201,skin,0,1.19,0,group);
    for(const side of [-1,1]){
      sphere(.055,skin,side*.187,1.165,0,group);
      const sleeve=cylinder(.075,.063,.42,coat,side*.23,.735,0,group);
      sleeve.rotation.z=side*.18;
      sphere(.063,skin,side*.266,.525,.015,group);
      box(.13,.27,.146,'navy',side*.13,.242,0,group);
      sphere(.023,'dark',side*.076,1.19,.177,group);
    }
    const brim=cylinder(.275,.27,.045,hatColor,0,1.33,.043,group,16);
    brim.scale.z=1.12;
    cylinder(.224,.244,.15,hatColor,0,1.411,0,group,16);
    cylinder(.245,.245,.044,'dark',0,1.358,0,group,16);
    box(.143,.07,.025,'gold',0,1.397,.247,group);
    box(.41,.119,.384,scarf,0,1.013,0,group);
    const tail=box(.113,.356,.049,scarf,-.158,.865,-.205,group);
    tail.rotation.z=-.18;
    const strap=box(.054,.65,.041,'woodDark',.03,.723,.24,group);
    strap.rotation.z=-.48;
    box(.26,.244,.197,'woodDark',.268,.541,.034,group);
    box(.275,.119,.206,'woodLight',.268,.616,.038,group);
    box(.056,.061,.021,'gold',.266,.557,.146,group);
    const feet=[box(.14,.139,.23,'dark',-.13,.058,.015,group),box(.14,.139,.23,'dark',.13,.058,.015,group)];
    return {group,feet,cloak,tail};
  }
  const player=person({coat:'#c38b4d',scarf:'roof',hatColor:'navy'});scene.add(player.group);player.group.position.set(0,.23,3.8);
  player.group.traverse(object=>{if(object.isMesh)object.castShadow=false;});
  const keeper=person({coat:'green',scarf:'gold',hatColor:'woodDark',scale:.96});keeper.group.position.set(.35,.23,1.5);keeper.group.rotation.y=.1;scene.add(keeper.group);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=64;shadowCanvas.height=64;
  const shadowContext=shadowCanvas.getContext('2d');
  const shadowGradient=shadowContext.createRadialGradient(32,32,2,32,32,32);
  shadowGradient.addColorStop(0,'rgba(30,53,47,0.35)');shadowGradient.addColorStop(1,'rgba(30,53,47,0)');
  shadowContext.fillStyle=shadowGradient;shadowContext.fillRect(0,0,64,64);
  const playerShadow=mesh(new THREE.PlaneGeometry(1.1,.9),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}),0,.245,3.8);
  playerShadow.rotation.x=-Math.PI/2;playerShadow.castShadow=false;playerShadow.receiveShadow=false;
  const playerHalo=mesh(new THREE.RingGeometry(.36,.40,40),new THREE.MeshBasicMaterial({color:'#fcf1c5',transparent:true,opacity:.6,side:THREE.DoubleSide}),0,.25,3.8);playerHalo.rotation.x=-Math.PI/2;playerHalo.castShadow=false;
  const destination=mesh(new THREE.RingGeometry(.2,.29,32),new THREE.MeshBasicMaterial({color:'#f7edcb',transparent:true,opacity:.8,side:THREE.DoubleSide}),0,.26,0);destination.rotation.x=-Math.PI/2;destination.visible=false;destination.castShadow=false;
  const deliveryEnvelope=new THREE.Group();deliveryEnvelope.visible=false;scene.add(deliveryEnvelope);
  box(.62,.42,.045,'white',0,0,0,deliveryEnvelope);
  const foldGeometry=new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-.29,.19,.027),new THREE.Vector3(0,-.035,.027),
    new THREE.Vector3(0,-.035,.027),new THREE.Vector3(.29,.19,.027),
  ]);
  deliveryEnvelope.add(new THREE.LineSegments(foldGeometry,new THREE.LineBasicMaterial({color:palette.gold})));
  const deliverySeal=sphere(.055,'roof',0,-.035,.04,deliveryEnvelope);deliverySeal.scale.z=.25;
  deliveryEnvelope.quaternion.copy(camera.quaternion);
  deliveryEnvelope.traverse(object=>{object.castShadow=false;object.receiveShadow=false;});
  const sparkMaterial=new THREE.MeshBasicMaterial({color:'#f6d28c',transparent:true,opacity:.8,depthWrite:false});
  const deliverySparks=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.055),sparkMaterial,18);
  deliverySparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);deliverySparks.visible=false;deliverySparks.frustumCulled=false;scene.add(deliverySparks);
  const sparkTransform=new THREE.Object3D();
  let celebration=null;

  const labels=new Map();
  const cameraTools=document.getElementById('camera-tools');
  const markers=new Map();
  const labelStates=new Map();
  function refreshAnchorText(id, completed) {
    const label=labels.get(id);
    const name=t(ANCHORS[id].name);
    labelStates.get(id).name.textContent=name;
    label.setAttribute('aria-label',name);
    label.title=completed ? name+' · '+t(id==='keeper'?'已交谈':progress?.solved?.[id]?'已投递':'已收好') : name;
  }
  const markerMaterial=new THREE.MeshStandardMaterial({color:'#f6d28c',emissive:'#eebd6b',emissiveIntensity:.35});
  const completeMarkerMaterial=new THREE.MeshStandardMaterial({color:'#8cb39a',emissive:'#8cb39a',emissiveIntensity:.12});
  const markerGeometry=new THREE.OctahedronGeometry(.13);
  for(const [id,a] of Object.entries(ANCHORS)) {
    const button=document.createElement('button');button.type='button';button.className=`world-label${id.includes('note')||id==='letter'?' small-label':''}`;button.dataset.id=id;
    button.style.left='0';button.style.top='0';
    const glyph=document.createElement('span');glyph.className='label-glyph';glyph.textContent=a.icon;
    const name=document.createElement('span');name.className='label-name';name.textContent=a.name;
    button.append(glyph,name);button.setAttribute('aria-label',a.name);
    button.addEventListener('pointerdown',event=>event.stopPropagation());
    button.addEventListener('click',event=>{event.stopPropagation();if(!paused)moveTo(id);});
    container.append(button);labels.set(id,button);
    const marker=mesh(markerGeometry,markerMaterial,a.x,1.3,a.z);marker.castShadow=false;markers.set(id,marker);
    labelStates.set(id,{name,glyph,compact:false,completed:false,priority:0});
  }

  // The navigation grid is independent of render meshes; bridges and obstacle footprints share world coordinates.
  const CELL=.35,MIN=-17,COUNT=98;
  const walkRects=[...rectangles,...bridges];
  const obstacles=[
    {x:-.7,z:-2.7,w:5.95,d:3.55},
    {x:-11.7,z:-5,w:2.75,d:2.7},
    {x:10.4,z:-5.9,w:4.8,d:4.0},
    {x:2.7,z:.4,w:1.0,d:1.0},
    ...[[-4,-3.7], [3.8,3.6], [-3.8,1],[-13.5,-6.3],[-8.3,-6.5],[13.2,-7.7],[7,-7.8],[-2,12.5],[8.3,8.2]].map(([x,z])=>({x,z,w:1.25,d:1.25})),
  ];
  function inside(x,z,r,margin=0){return Math.abs(x-r.x)<r.w/2-margin&&Math.abs(z-r.z)<r.d/2-margin;}
  function walkable(x,z) {return walkRects.some(r=>inside(x,z,r,.16))&&!obstacles.some(r=>inside(x,z,r,-.15));}
  const grid=new PF.Grid(COUNT,COUNT);
  for(let z=0;z<COUNT;z++)for(let x=0;x<COUNT;x++)grid.setWalkableAt(x,z,walkable(MIN+x*CELL,MIN+z*CELL));
  const finder=new PF.AStarFinder({allowDiagonal:true,dontCrossCorners:true});
  const toCell=(x,z)=>[Math.max(0,Math.min(COUNT-1,Math.round((x-MIN)/CELL))),Math.max(0,Math.min(COUNT-1,Math.round((z-MIN)/CELL)))];
  function nearestCell(x,z){
    const [cx,cz]=toCell(x,z);if(grid.isWalkableAt(cx,cz))return [cx,cz];
    for(let radius=1;radius<14;radius++) {
      let best=null,distance=Infinity;
      for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++) {
        const nx=cx+dx,nz=cz+dz;if(!grid.isInside(nx,nz)||!grid.isWalkableAt(nx,nz))continue;
        const d=(MIN+nx*CELL-x)**2+(MIN+nz*CELL-z)**2;if(d<distance){best=[nx,nz];distance=d;}
      }
      if(best)return best;
    }
    return null;
  }
  let path=[],pending=null,phase='present',paused=false,disposed=false,frames=0,nearId=null,progress=null;
  let zoom=1,quality=null,reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  let ambientTime=0,phaseInitialized=false,phaseTransition=null,progressSignature='';
  const restorations={clock:0,greenhouse:0,platform:0};
  const restorationTargets={clock:0,greenhouse:0,platform:0};
  const keySet=new Set(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.25),point=new THREE.Vector3();
  function navigate(x,z,id=null) {
    const start=nearestCell(player.group.position.x,player.group.position.z),end=nearestCell(x,z);
    if(!start||!end)return false;
    const result=finder.findPath(...start,...end,grid.clone());
    if(!result.length)return false;
    path=result.slice(1).map(([cx,cz])=>new THREE.Vector3(MIN+cx*CELL,.23,MIN+cz*CELL));
    pending=id;destination.position.set(MIN+end[0]*CELL,.26,MIN+end[1]*CELL);destination.visible=path.length>0;
    callbacks.onMove?.({x,z,id});
    if(!path.length&&id){pending=null;callbacks.onInteract?.(id);}
    return true;
  }
  function moveTo(id) {
    const a=ANCHORS[id];if(!a||paused||a.phase&&a.phase!==phase)return false;
    return navigate(a.x,a.z,id);
  }
  function handlePointer(event) {
    if(paused||event.button>0)return;
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    if(raycaster.ray.intersectPlane(plane,point)) {
      let selected=null,best=.9;
      for(const [id,a]of Object.entries(ANCHORS)) {
        if(!anchorAvailable(id,a))continue;
        const d=Math.hypot(point.x-a.x,point.z-a.z);if(d<best){selected=id;best=d;}
      }
      if(selected)moveTo(selected);else if(walkable(point.x,point.z))navigate(point.x,point.z);
    }
    renderer.domElement.focus({preventScroll:true});
  }
  function keydown(event) {
    if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
    const k=event.key.toLowerCase();
    if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','e'].includes(k)) {
      if(paused)return;event.preventDefault();
      if(k==='e'){if(!event.repeat&&nearId)callbacks.onInteract?.(nearId);return;}
      keySet.add(k);path=[];pending=null;destination.visible=false;
    }
  }
  const keyup=e=>keySet.delete(e.key.toLowerCase());
  const blur=()=>keySet.clear();
  renderer.domElement.addEventListener('pointerdown',handlePointer);
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
  const projected=new THREE.Vector3(),labelPositions=new Map();
  const baseCameraPosition=new THREE.Vector3(),baseFocus=new THREE.Vector3();
  const cameraRight=new THREE.Vector3(),cameraUp=new THREE.Vector3(),cameraOffset=new THREE.Vector3(),cameraGoal=new THREE.Vector3(),cameraPositionGoal=new THREE.Vector3();
  const framingPoints=[];
  const framingBoxes=[
    ...rectangles.map(rect=>({x:rect.x,z:rect.z,w:rect.w+1.5,d:rect.d+1.5,h:4.2})),
    {x:-11.7,z:-5,w:4,d:3.8,h:7.4},
  ];
  for(const box of framingBoxes)for(const x of [-1,1])for(const z of [-1,1])for(const y of [-.9,box.h]) {
    framingPoints.push(new THREE.Vector3(box.x+x*box.w/2,y,box.z+z*box.d/2));
  }
  let framing=null;
  let width=1,height=1,labelsDirty=true;
  function resize() {
    const nextWidth=container.clientWidth||window.innerWidth,nextHeight=container.clientHeight||window.innerHeight;
    if(framing&&width===nextWidth&&height===nextHeight)return;
    width=nextWidth;height=nextHeight;
    renderer.setSize(width,height,false);
    const aspect=width/height;
    camera.position.set(30,33,36);camera.lookAt(viewTarget);camera.updateMatrixWorld(true);
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const point of framingPoints){
      projected.copy(point).applyMatrix4(camera.matrixWorldInverse);
      minX=Math.min(minX,projected.x);maxX=Math.max(maxX,projected.x);
      minY=Math.min(minY,projected.y);maxY=Math.max(maxY,projected.y);
    }
    cameraRight.setFromMatrixColumn(camera.matrixWorld,0);
    cameraUp.setFromMatrixColumn(camera.matrixWorld,1);
    camera.position.addScaledVector(cameraRight,(minX+maxX)/2).addScaledVector(cameraUp,(minY+maxY)/2);
    baseCameraPosition.copy(camera.position);
    baseFocus.copy(viewTarget).addScaledVector(cameraRight,(minX+maxX)/2).addScaledVector(cameraUp,(minY+maxY)/2);
    cameraOffset.set(0,0,0);
    camera.updateMatrixWorld(true);
    const halfHeight=Math.max(15.5,(maxX-minX)*.56/aspect,(maxY-minY)*.59);
    camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;
    camera.zoom=zoom;camera.updateProjectionMatrix();
    updateFraming();
    labelsDirty=true;
  }
  function updateFraming() {
    framing={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
    for(const point of framingPoints){
      projected.copy(point).project(camera);
      const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
      framing.left=Math.min(framing.left,x);framing.right=Math.max(framing.right,x);
      framing.top=Math.min(framing.top,y);framing.bottom=Math.max(framing.bottom,y);
    }
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);resize();
  function updateCamera(delta) {
    const blend=reducedMotion?1:1-Math.exp(-delta*5);
    const nextZoom=THREE.MathUtils.lerp(camera.zoom,zoom,blend);
    const follow=THREE.MathUtils.smoothstep(nextZoom,1,1.8);
    projected.copy(player.group.position).sub(baseFocus);
    cameraGoal.copy(cameraRight).multiplyScalar(projected.dot(cameraRight)*follow);
    cameraGoal.addScaledVector(cameraUp,projected.dot(cameraUp)*follow);
    cameraOffset.lerp(cameraGoal,blend);
    cameraPositionGoal.copy(baseCameraPosition).add(cameraOffset);
    if(Math.abs(camera.zoom-nextZoom)<.00005&&camera.position.distanceToSquared(cameraPositionGoal)<.000001)return;
    camera.zoom=nextZoom;camera.position.copy(baseCameraPosition).add(cameraOffset);
    camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    labelsDirty=true;updateFraming();
  }
  function layoutLabels() {
    const small=width<600;
    const safeTop=height<620?88:small?140:110;
    const safeBottom=height-(height<620?110:small?155:135);
    const placed=[];
    const toolbar=cameraTools?.getBoundingClientRect();
    if(toolbar?.width&&toolbar.height) {
      const bounds=container.getBoundingClientRect();
      placed.push({
        left:toolbar.left-bounds.left-6,right:toolbar.right-bounds.left+6,
        top:toolbar.top-bounds.top-6,bottom:toolbar.bottom-bounds.top+6,
      });
    }
    const candidates=[];
    for(const [id,a]of Object.entries(ANCHORS)) {
      const label=labels.get(id);if(label.hidden)continue;
      projected.set(a.x,1.8,a.z).project(camera);
      const w=label.offsetWidth||85,h=label.offsetHeight||28;
      candidates.push({id,label,w,h,priority:labelStates.get(id).priority,x:THREE.MathUtils.clamp((projected.x*.5+.5)*width,w/2+10,width-w/2-10),y:THREE.MathUtils.clamp((-projected.y*.5+.5)*height,safeTop+h,safeBottom)});
    }
    candidates.sort((a,b)=>b.priority-a.priority||a.y-b.y||a.x-b.x);
    for(const item of candidates) {
      const offsets=[];
      const rowCount=Math.min(9,Math.ceil(Math.max(0,safeBottom-safeTop)/(item.h+7)));
      for(let row=-rowCount;row<=rowCount;row++)for(let column=-1;column<=1;column+=.5) {
        const dx=column*(item.w+7),dy=row*(item.h+7);
        offsets.push({dx,dy,cost:dx*dx+dy*dy*1.1});
      }
      offsets.sort((a,b)=>a.cost-b.cost);
      let chosen=null;
      for(const offset of offsets) {
        const x=THREE.MathUtils.clamp(item.x+offset.dx,item.w/2+10,width-item.w/2-10);
        const y=THREE.MathUtils.clamp(item.y+offset.dy,safeTop+item.h,safeBottom);
        const rect={left:x-item.w/2-3,right:x+item.w/2+3,top:y-item.h-3,bottom:y+3};
        if(!placed.some(other=>rect.left<other.right&&rect.right>other.left&&rect.top<other.bottom&&rect.bottom>other.top)) {
          chosen={x,y,rect};break;
        }
      }
      chosen??={x:item.x,y:item.y,rect:{left:item.x-item.w/2,right:item.x+item.w/2,top:item.y-item.h,bottom:item.y}};
      placed.push(chosen.rect);
      item.label.style.transform=`translate(-50%, -100%) translate(${chosen.x}px,${chosen.y}px)`;
      labelPositions.set(item.id,{x:chosen.x,y:chosen.y-item.h/2});
    }
    labelsDirty=false;
  }
  function anchorAvailable(id,a=ANCHORS[id]) {
    return (!a.phase||a.phase===phase)&&(id!=='final'||Object.values(progress?.solved||{}).filter(Boolean).length===3);
  }
  function anchorComplete(id) {
    if(id==='letter')return progress?.clues?.includes('clock')??false;
    if(id==='seed-note')return progress?.clues?.includes('greenhouse')??false;
    if(id.endsWith('-stamp'))return Boolean(progress?.stamps?.[id.split('-')[0]]);
    if(id==='keeper')return Boolean(progress?.started);
    return Boolean(progress?.solved?.[id]);
  }
  function setZoom(value) {
    const number=Number(value);if(!Number.isFinite(number))return zoom;
    zoom=THREE.MathUtils.clamp(number,1,1.8);labelsDirty=true;
    return zoom;
  }
  function setReducedMotion(value) {
    reducedMotion=Boolean(value);
    if(reducedMotion&&phaseTransition){phaseTransition.colors.forEach(tween=>tween.color.copy(tween.target));phaseTransition=null;scene.fog.color.copy(scene.background);}
    if(reducedMotion){deliverySparks.visible=false;ambientTime=0;}
  }
  function setQuality(value) {
    const next=value==='low'?'low':'high';if(next===quality)return quality;
    quality=next;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,quality==='low'?1:1.6));
    renderer.shadowMap.enabled=quality==='high';
    if(renderer.shadowMap.enabled)renderer.shadowMap.needsUpdate=true;
    sea.geometry.dispose();sea.geometry=new THREE.PlaneGeometry(230,230,quality==='low'?12:32,quality==='low'?12:32);
    scene.traverse(object=>{if(object.material)for(const mat of Array.isArray(object.material)?object.material:[object.material])mat.needsUpdate=true;});
    renderer.setSize(width,height,false);
    return quality;
  }
  function setProgress(state) {
    const first=progress===null;progress=state;
    const signature=JSON.stringify([state?.started,state?.solved,state?.clues,state?.stamps]);
    if(signature===progressSignature)return;
    progressSignature=signature;labelsDirty=true;
    for(const id of Object.keys(restorations)) {
      restorationTargets[id]=Number(Boolean(state?.solved?.[id]));
      if(first)restorations[id]=restorationTargets[id];
    }
    letterModel.visible=seal.visible=!state?.clues?.includes('clock');
    seedNoteModel.visible=!state?.clues?.includes('greenhouse');
    stationSign.userData.setText(state?.solved?.platform?'末 班 · 启 程':'末 班 · 无 人');
  }
  function celebrate(id) {
    const anchor=ANCHORS[id];if(!anchor||disposed)return false;
    celebration={x:anchor.x,z:anchor.z,started:performance.now()};
    deliveryEnvelope.position.set(anchor.x,2.1,anchor.z);deliveryEnvelope.scale.setScalar(1);deliveryEnvelope.visible=true;
    sparkMaterial.color.set(id==='greenhouse'?'#edb4a1':id==='platform'?'#c2e6d1':'#f6d28c');
    deliverySparks.visible=!reducedMotion;
    return true;
  }
  setQuality(width<600||navigator.hardwareConcurrency<=4?'low':'high');
  let previous=performance.now();
  let averageFrameMs=0;
  const vector=new THREE.Vector3();
  function animate(now) {
    if(disposed)return;
    const elapsed=now-previous;previous=now;
    if(document.hidden)return;
    const delta=Math.min(elapsed/1000,.15);frames++;
    averageFrameMs=averageFrameMs?averageFrameMs*.9+elapsed*.1:elapsed;
    if(!reducedMotion)ambientTime+=delta;
    const t=ambientTime;seaUniforms.time.value=t;
    boats.forEach(b=>{b.group.position.y=b.y+Math.sin(t*.7+b.offset)*.045;b.group.rotation.z=Math.sin(t*.6+b.offset)*.04;});
    flag.rotation.y=Math.sin(t*1.5)*.055;
    let moving=false;
    if(!paused&&!document.hidden) {
      let sx=0,sy=0;
      if(keySet.has('w')||keySet.has('arrowup'))sy-=1;
      if(keySet.has('s')||keySet.has('arrowdown'))sy+=1;
      if(keySet.has('a')||keySet.has('arrowleft'))sx-=1;
      if(keySet.has('d')||keySet.has('arrowright'))sx+=1;
      if(sx||sy) {
        vector.set(sx+sy,0,sy-sx).normalize().multiplyScalar(3.1*delta);
        const p=player.group.position;
        const steps=Math.max(1,Math.ceil(vector.length()/.12));vector.divideScalar(steps);
        for(let step=0;step<steps;step++) {
          if(walkable(p.x+vector.x,p.z+vector.z)) {p.add(vector);moving=true;}
          else {
            if(walkable(p.x+vector.x,p.z)){p.x+=vector.x;moving=true;}
            if(walkable(p.x,p.z+vector.z)){p.z+=vector.z;moving=true;}
          }
        }
        if(moving)player.group.rotation.y=Math.atan2(vector.x,vector.z);
      }else if(path.length) {
        let remaining=3.65*delta;
        while(path.length&&remaining>0) {
          vector.copy(path[0]).sub(player.group.position);vector.y=0;
          const distance=vector.length();
          if(distance>0)player.group.rotation.y=Math.atan2(vector.x,vector.z);
          if(distance<=remaining){player.group.position.copy(path.shift());remaining-=distance;}
          else{vector.multiplyScalar(remaining/distance);player.group.position.add(vector);remaining=0;}
        }
        moving=true;
        if(!path.length){destination.visible=false;const id=pending;pending=null;if(id)callbacks.onInteract?.(id);}
      }
    }
    const walk=moving&&!reducedMotion?Math.sin(t*14):0;
    player.feet[0].position.z=.015+walk*.13;player.feet[1].position.z=.015-walk*.13;
    player.cloak.rotation.z=walk*.035;player.tail.rotation.x=reducedMotion?0:Math.sin(t*4)*.07+(moving?.15:0);
    player.group.position.y=.23+(reducedMotion?0:moving?Math.abs(walk)*.035:Math.sin(t*1.7)*.013);
    playerHalo.position.set(player.group.position.x,.25,player.group.position.z);
    playerShadow.position.set(player.group.position.x,.245,player.group.position.z);
    destination.scale.setScalar(1+Math.sin(t*4)*.1);
    updateCamera(delta);
    if(phaseTransition) {
      const amount=Math.min(1,(now-phaseTransition.started)/650),ease=amount*amount*(3-2*amount);
      phaseTransition.colors.forEach(tween=>tween.color.lerpColors(tween.start,tween.target,ease));
      scene.fog.color.copy(scene.background);
      if(amount===1)phaseTransition=null;
    }
    for(const id of Object.keys(restorations)) {
      restorations[id]=THREE.MathUtils.lerp(restorations[id],restorationTargets[id],reducedMotion?1:1-Math.exp(-delta*4));
    }
    const echoLight=phase==='echo' ? 1 : 0;
    const lighting=phaseTransition ? (1-Math.exp(-delta*8)) : 1;
    hemi.intensity=THREE.MathUtils.lerp(hemi.intensity,1.7-echoLight*.27,lighting);
    sun.intensity=THREE.MathUtils.lerp(sun.intensity,2.85-echoLight*1.77,lighting);
    windowMaterial.emissiveIntensity=THREE.MathUtils.lerp(windowMaterial.emissiveIntensity,echoLight*.58,lighting);
    lanternMaterial.emissiveIntensity=THREE.MathUtils.lerp(lanternMaterial.emissiveIntensity,.16+echoLight*.58,lighting);
    clockFaceMaterial.emissiveIntensity=restorations.clock*.55+lanternMaterial.emissiveIntensity*.22;
    gardenBlooms.scale.y=.34+restorations.greenhouse*.66;
    glass.emissive.set('#78b38e');glass.emissiveIntensity=restorations.greenhouse*.14;
    stationLanterns.forEach(lantern=>{lantern.material.emissiveIntensity=.03+restorations.platform*.95+lanternMaterial.emissiveIntensity*.44;});
    minute.rotation.z=THREE.MathUtils.lerp(-.4,-Math.PI/2,restorations.clock);
    hour.rotation.z=THREE.MathUtils.lerp(.85,-Math.PI/6,restorations.clock);
    if(celebration) {
      const age=(now-celebration.started)/1000;
      if(age>=2.3){celebration=null;deliveryEnvelope.visible=false;deliverySparks.visible=false;}
      else {
        deliveryEnvelope.position.y=2.1+(reducedMotion?0:Math.min(age,1.7)*.5);
        deliveryEnvelope.scale.setScalar(age>1.8?Math.max(0,(2.3-age)/.5):1);
        deliveryEnvelope.rotation.z=reducedMotion?0:Math.sin(age*2.4)*.08;
        if(!reducedMotion) {
          for(let i=0;i<deliverySparks.count;i++) {
            const angle=i*2.39996,radius=.3+age*(.25+(i%3)*.07);
            sparkTransform.position.set(celebration.x+Math.cos(angle)*radius,1.2+age*.7+(i%4)*.13,celebration.z+Math.sin(angle)*radius);
            sparkTransform.rotation.set(age+i,angle,age*.5);sparkTransform.scale.setScalar(Math.max(0,1-age/2.3));sparkTransform.updateMatrix();
            deliverySparks.setMatrixAt(i,sparkTransform.matrix);
          }
          deliverySparks.instanceMatrix.needsUpdate=true;
        }
      }
    }
    let nearest=null,best=1.75;
    for(const [id,a]of Object.entries(ANCHORS)) {
      const visible=anchorAvailable(id,a);
      const label=labels.get(id),marker=markers.get(id);
      marker.visible=visible;
      if(!visible){if(!label.hidden)labelsDirty=true;label.hidden=true;continue;}
      const d=Math.hypot(player.group.position.x-a.x,player.group.position.z-a.z);
      if(d<best){best=d;nearest=id;}
      const nearby=d<1.75,targeted=pending===id,completed=anchorComplete(id),state=labelStates.get(id);
      projected.set(a.x,1.8,a.z).project(camera);
      const offscreen=camera.zoom>1.15&&(Math.abs(projected.x)>1.03||Math.abs(projected.y)>.91);
      const labelVisible=!offscreen||nearby||targeted;
      if(label.hidden===labelVisible)labelsDirty=true;label.hidden=!labelVisible;
      const compact=completed&&!nearby&&!targeted;
      const priority=targeted?100:nearby?80:completed?0:40;
      if(state.compact!==compact||state.completed!==completed||state.priority!==priority) {
        state.compact=compact;state.completed=completed;state.priority=priority;
        state.name.style.display=compact?'none':'';
        state.glyph.textContent=completed?'✓':a.icon;
        label.style.padding=compact?'4px':'';label.style.minWidth=compact?'28px':'';
        label.style.borderRadius=compact?'50%':'';label.style.opacity=compact?'.66':'1';
        refreshAnchorText(id,completed);
        label.classList.toggle('delivered',completed);labelsDirty=true;
      }
      marker.material=completed?completeMarkerMaterial:markerMaterial;
      marker.scale.setScalar(targeted?1.35:completed?.68:1);
      marker.position.y=1.35+Math.sin(t*2+a.x)*.08;marker.rotation.y=t*.6;
      label.classList.toggle('near',nearby||targeted);
    }
    if(labelsDirty)layoutLabels();
    if(nearest!==nearId){nearId=nearest;callbacks.onNear?.(nearest?{id:nearest,...ANCHORS[nearest]}:null);}
    clockHands.rotation.z=phase==='echo'&&!progress?.solved?.clock?Math.sin(t*.15)*.2:0;
    if(!container.inert)renderer.render(scene,camera);
  }
  renderer.setAnimationLoop(animate);

  function setPhase(next) {
    const value=next==='echo'?'echo':'present';
    if(phaseInitialized&&value===phase)return;
    phaseInitialized=true;
    labelsDirty=true;
    phase=value;
    const echo=phase==='echo';
    const colors=[
      [seaUniforms.deep.value,echo?'#112e3a':'#2b6370'],
      [seaUniforms.shallow.value,echo?'#3c696e':'#79b2a1'],
      [seaUniforms.foam.value,echo?'#73968c':'#c0d8b8'],
      [scene.background,echo?'#24434b':'#518f8b'],
      [hemi.color,echo?'#c8dce0':'#f6f3e6'],
      [sun.color,echo?'#f3c697':'#fff1d4'],
      ...foliage.map((mat,i)=>[mat.color,echo?(i%2?'#587571':'#537967'):(i%2?'#84966a':'#608369')]),
    ].map(([color,target])=>({color,start:color.clone(),target:new THREE.Color(target)}));
    if(reducedMotion){colors.forEach(tween=>tween.color.copy(tween.target));phaseTransition=null;scene.fog.color.copy(scene.background);}
    else phaseTransition={started:performance.now(),colors};
    presentStamp.visible=!echo;echoStamp.visible=echo;path=[];pending=null;destination.visible=false;
    container.dataset.phase=phase;
  }
  return {
    setPhase,
    refreshLanguage(){
      for(const sign of paintedSigns)sign.userData.setText(sign.userData.caption);
      for(const [id,state] of labelStates)refreshAnchorText(id,state.completed);
      labelsDirty=true;
    },
    setProgress,setZoom,setReducedMotion,setQuality,celebrate,
    setPaused(value){
      const next=Boolean(value);
      if(next!==paused)for(const label of labels.values())label.disabled=next;
      paused=next;
      if(paused){keySet.clear();path=[];pending=null;destination.visible=false;}
    },
    moveTo,
    getDebug(){
      const anchors={};for(const [id,a]of Object.entries(ANCHORS)) {
        projected.set(a.x,1.8,a.z).project(camera);
        anchors[id]={...a,screen:labelPositions.get(id)||{x:(projected.x*.5+.5)*width,y:(-projected.y*.5+.5)*height},reachable:!!nearestCell(a.x,a.z),visible:!labels.get(id).hidden,completed:anchorComplete(id),compact:labelStates.get(id).compact};
      }
      return {phase,paused,frames,player:{x:player.group.position.x,z:player.group.position.z},pathLength:path.length,nearId,anchors,framing,zoom,renderZoom:camera.zoom,quality,reducedMotion,phaseTransitioning:Boolean(phaseTransition),restorations:{...restorations},celebrating:Boolean(celebration),fps:averageFrameMs?Math.round(10000/averageFrameMs)/10:0,pixelRatio:renderer.getPixelRatio(),shadows:renderer.shadowMap.enabled,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
    },
    dispose(){
      disposed=true;renderer.setAnimationLoop(null);resizeObserver.disconnect();
      window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);
      renderer.domElement.removeEventListener('pointerdown',handlePointer);
      labels.forEach(label=>label.remove());
      const geometries=new Set(),materials=new Set(),textures=new Set();
      scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)for(const mat of Array.isArray(object.material)?object.material:[object.material]){materials.add(mat);if(mat.map)textures.add(mat.map);}});
      deliverySparks.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());sun.shadow.dispose();renderer.dispose();renderer.domElement.remove();
    },
  };
}
