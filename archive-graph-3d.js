import * as THREE from "./node_modules/three/build/three.module.js";
import { OrbitControls } from "./node_modules/three/examples/jsm/controls/OrbitControls.js";

let activeGraph = null;

const NODE_COLORS = {
  file: 0xbad7ff,
  link: 0xb9f6c8,
  topic: 0xf6d78b,
  project: 0xc8f29d,
  task: 0xeab6ff,
  material: 0xbad7ff
};

const SPACE_BACKGROUND = 0x060914;
const SPACE_FOG = 0x080c18;
const CONSTELLATION_GLOW = 0xcfe2ff;
const CONSTELLATION_WARM = 0xffe7a8;
const RELATION_DISTANCE_RINGS = {
  0: { radius: 0, jitter: 0, ringLift: 0 },
  1: { radius: 72, jitter: 16, ringLift: 8 },
  2: { radius: 148, jitter: 22, ringLift: 18 },
  3: { radius: 232, jitter: 28, ringLift: 30 }
};
const SPATIAL_PRIORITY_LAYERS = [
  { min: 78, baseZ: 176, jitter: 28, spreadLift: 0 },
  { min: 55, baseZ: 76, jitter: 34, spreadLift: 4 },
  { min: 25, baseZ: -104, jitter: 46, spreadLift: 10 },
  { min: 0, baseZ: -236, jitter: 64, spreadLift: 18 }
];

const STAR_LAYERS = [
  {
    name: "space-stars-far",
    count: 820,
    spread: [1760, 1160, 1560],
    color: 0x7486b8,
    size: 0.5,
    opacity: 0.28,
    drift: 0.0006
  },
  {
    name: "space-stars-near",
    count: 760,
    spread: [1180, 820, 1040],
    color: 0xdbe8ff,
    size: 0.94,
    opacity: 0.52,
    drift: -0.0014
  },
  {
    name: "space-stars-core",
    count: 260,
    spread: [720, 460, 560],
    color: 0xfff1bd,
    size: 1.5,
    opacity: 0.42,
    drift: 0.0019
  }
];

const NEBULA_CLOUDS = [
  {
    name: "space-nebula-violet",
    colorA: "rgba(116, 91, 255, 0.34)",
    colorB: "rgba(63, 155, 255, 0.20)",
    colorC: "rgba(255, 232, 168, 0.10)",
    position: [-260, 138, -360],
    scale: [520, 260, 1],
    rotation: -0.32,
    opacity: 0.58,
    drift: 0.0022
  },
  {
    name: "space-nebula-gold",
    colorA: "rgba(255, 222, 142, 0.26)",
    colorB: "rgba(104, 194, 255, 0.16)",
    colorC: "rgba(198, 112, 255, 0.10)",
    position: [260, -120, -420],
    scale: [460, 220, 1],
    rotation: 0.38,
    opacity: 0.46,
    drift: -0.0016
  },
  {
    name: "space-nebula-rift",
    colorA: "rgba(194, 215, 255, 0.16)",
    colorB: "rgba(86, 100, 180, 0.22)",
    colorC: "rgba(255, 255, 255, 0.07)",
    position: [12, 12, -520],
    scale: [760, 170, 1],
    rotation: -0.72,
    opacity: 0.38,
    drift: 0.001
  }
];

function safeParsePayload(payloadEl) {
  if (!payloadEl) return { nodes: [], links: [], meta: {} };
  try {
    return JSON.parse(payloadEl.textContent || "{}");
  } catch (error) {
    console.warn("Archive 3D graph payload could not be parsed", error);
    return { nodes: [], links: [], meta: {} };
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return `${Math.round(number * 100)}% semantic`;
}

function formatGraphDistance(node) {
  if (node.active) return "\uc120\ud0dd \uc790\ub8cc";
  if (node.graphDistance === 1) return "\uc9c1\uc811 \uc5f0\uacb0";
  if (node.graphDistance === 2) return "\ud55c \ubc88 \ub354 \ud655\uc7a5";
  if (Number.isFinite(Number(node.graphDistance)) && Number(node.graphDistance) < 4) {
    return `${Number(node.graphDistance)}\ub2e8\uacc4 \uac70\ub9ac`;
  }
  return "\ub113\uc740 \ucc38\uace0";
}

function hashString(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function seededUnit(seed) {
  const value = Math.sin(Number(seed || 1) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function seededRange(seed, min, max) {
  return min + seededUnit(seed) * (max - min);
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildGraphContext(nodes, links) {
  const ids = new Set(nodes.map((node) => node.id));
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  const activeId = nodes.find((node) => node.active)?.id || nodes[0]?.id || null;

  links.forEach((link) => {
    const source = link.source || link.from;
    const target = link.target || link.to;
    if (!ids.has(source) || !ids.has(target)) return;
    adjacency.get(source)?.add(target);
    adjacency.get(target)?.add(source);
    degree.set(source, (degree.get(source) || 0) + 1);
    degree.set(target, (degree.get(target) || 0) + 1);
  });

  const distance = new Map();
  if (activeId) {
    const queue = [activeId];
    distance.set(activeId, 0);
    for (let index = 0; index < queue.length; index += 1) {
      const id = queue[index];
      const nextDistance = (distance.get(id) || 0) + 1;
      adjacency.get(id)?.forEach((neighborId) => {
        if (distance.has(neighborId)) return;
        distance.set(neighborId, nextDistance);
        queue.push(neighborId);
      });
    }
  }

  return { activeId, degree, distance };
}

function nodeRadius(node) {
  if (node.active) return 6.8;
  const score = Number(node.score || 0);
  const degree = Number(node.degree || node.count || 0);
  return Math.max(2.8, Math.min(6.6, 2.8 + score / 34 + Math.sqrt(degree) * 0.42));
}

function colorForKind(kind) {
  return NODE_COLORS[kind] || NODE_COLORS.material;
}

function nodeEmissiveIntensity(node) {
  if (node.active) return 0.68;
  if (node.connectedToActive) return 0.32;
  return 0.22;
}

function spatialPriorityScore(node) {
  if (node.active) return 100;
  const lane = node.relationLane || "unverified";
  const explicitRelationScore = Number(node.relationScore);
  let priority = Number.isFinite(explicitRelationScore)
    ? explicitRelationScore
    : lane === "first"
      ? 88
      : lane === "middle"
        ? 64
        : lane === "low"
          ? 34
          : 18;

  const distance = Number(node.graphDistance);
  if (node.connectedToActive || distance === 1) priority += 10;
  else if (distance === 2) priority -= 4;
  else if (Number.isFinite(distance)) priority -= 12;

  if (node.hasRelationMemo) priority += 6;

  const quality = Number(node.materialQualityScore);
  if (Number.isFinite(quality)) {
    priority += clampNumber((quality - 50) * 0.16, -6, 8);
  }

  return clampNumber(priority, 0, 100);
}

function priorityDepth(node, spatialPriority, angle, hash) {
  if (node.active) return 92;
  const layer = SPATIAL_PRIORITY_LAYERS.find((candidate) => spatialPriority >= candidate.min)
    || SPATIAL_PRIORITY_LAYERS[SPATIAL_PRIORITY_LAYERS.length - 1];
  const localTilt = Math.sin(angle * 1.7 + seededRange(hash + 71, -0.8, 0.8)) * layer.jitter * 0.18;
  return layer.baseZ + seededRange(hash + 59, -layer.jitter, layer.jitter) + localTilt;
}

function ringSlotCount(band) {
  if (band === 1) return 5;
  if (band === 2) return 7;
  return 8;
}

function antiClumpDepthOffset(band, bandIndex, hash) {
  if (band === 0) return 0;
  const slotCount = ringSlotCount(band);
  const orbitLayer = Math.floor(bandIndex / slotCount) % 3;
  return (orbitLayer - 1) * 18 + seededRange(hash + 83, -4, 4);
}

export function layoutArchiveGraphNodes(nodes, links) {
  const context = buildGraphContext(nodes, links);
  const bandCounts = new Map();
  return nodes.map((node, index) => {
    const distance = context.distance.get(node.id) ?? 4;
    const band = node.active ? 0 : distance === 1 ? 1 : distance === 2 ? 2 : 3;
    const bandIndex = bandCounts.get(band) || 0;
    bandCounts.set(band, bandIndex + 1);
    const hash = hashString(node.id || node.label || index);
    const angle = (bandIndex * 2.399963 + (hash % 41) * 0.013) % (Math.PI * 2);
    const ringSpec = RELATION_DISTANCE_RINGS[band] || RELATION_DISTANCE_RINGS[3];
    const spatialNode = {
      ...node,
      graphDistance: distance,
      connectedToActive: distance === 1
    };
    const spatialPriority = spatialPriorityScore(spatialNode);
    const ringJitter = band === 0 ? 0 : (bandIndex % ringSlotCount(band)) * ringSpec.jitter;
    const layer = SPATIAL_PRIORITY_LAYERS.find((candidate) => spatialPriority >= candidate.min)
      || SPATIAL_PRIORITY_LAYERS[SPATIAL_PRIORITY_LAYERS.length - 1];
    const z = band === 0 ? 92 : priorityDepth(spatialNode, spatialPriority, angle, hash) + antiClumpDepthOffset(band, bandIndex, hash);
    const prioritySpread = band === 0 ? 0 : layer.spreadLift + (100 - spatialPriority) * 0.04;
    const ring = ringSpec.radius + ringJitter + ringSpec.ringLift + prioritySpread + Math.min(18, Number(node.score || 0) * 0.11);
    return {
      ...node,
      degree: context.degree.get(node.id) || 0,
      graphDistance: distance,
      connectedToActive: distance === 1,
      spatialPriority,
      x: Math.cos(angle) * ring,
      y: Math.sin(angle) * ring,
      z
    };
  });
}

function shouldLabelNode(node) {
  return node.active;
}

function createLabelTexture(text, active = false) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const label = String(text || "Untitled").slice(0, 44);
  const fontSize = active ? 34 : 28;
  context.font = `700 ${fontSize}px Georgia, serif`;
  const metrics = context.measureText(label);
  canvas.width = Math.ceil(metrics.width + 44);
  canvas.height = active ? 62 : 54;
  context.font = `700 ${fontSize}px Georgia, serif`;
  context.fillStyle = active ? "rgba(11, 18, 26, 0.84)" : "rgba(13, 18, 24, 0.68)";
  context.strokeStyle = active ? "rgba(255, 233, 172, 0.85)" : "rgba(214, 224, 236, 0.38)";
  context.lineWidth = 2;
  const radius = 14;
  const width = canvas.width - 4;
  const height = canvas.height - 4;
  context.beginPath();
  context.moveTo(2 + radius, 2);
  context.lineTo(width - radius, 2);
  context.quadraticCurveTo(width, 2, width, 2 + radius);
  context.lineTo(width, height - radius);
  context.quadraticCurveTo(width, height, width - radius, height);
  context.lineTo(2 + radius, height);
  context.quadraticCurveTo(2, height, 2, height - radius);
  context.lineTo(2, 2 + radius);
  context.quadraticCurveTo(2, 2, 2 + radius, 2);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = active ? "#fff0b6" : "#e6edf5";
  context.textBaseline = "middle";
  context.fillText(label, 22, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

function createLabelSprite(node) {
  const texture = createLabelTexture(node.label, node.active);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  const scale = node.active ? 26 : 18;
  sprite.scale.set(scale * Math.max(1.7, String(node.label || "").length / 10), scale, 1);
  sprite.position.set(node.x, node.y + nodeRadius(node) + 8, node.z);
  sprite.userData.texture = texture;
  return sprite;
}

function hexToRgb(hex) {
  const color = new THREE.Color(hex);
  return {
    r: Math.round(color.r * 255),
    g: Math.round(color.g * 255),
    b: Math.round(color.b * 255)
  };
}

function createStarCoreTexture(node) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  const center = canvas.width / 2;
  const tint = hexToRgb(node.active ? CONSTELLATION_WARM : colorForKind(node.kind));

  context.clearRect(0, 0, canvas.width, canvas.height);
  const glow = context.createRadialGradient(center, center, 0, center, center, center);
  glow.addColorStop(0, "rgba(255, 255, 255, 1)");
  glow.addColorStop(0.12, `rgba(${tint.r}, ${tint.g}, ${tint.b}, 0.92)`);
  glow.addColorStop(0.34, `rgba(${tint.r}, ${tint.g}, ${tint.b}, 0.36)`);
  glow.addColorStop(0.72, `rgba(${tint.r}, ${tint.g}, ${tint.b}, 0.08)`);
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const rayLength = node.active ? 72 : node.connectedToActive ? 54 : 42;
  context.save();
  context.translate(center, center);
  context.strokeStyle = `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${node.active ? 0.9 : 0.58})`;
  context.lineCap = "round";
  [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].forEach((angle, index) => {
    context.save();
    context.rotate(angle);
    const width = index < 2 ? 2.2 : 1.1;
    const length = index < 2 ? rayLength : rayLength * 0.52;
    const ray = context.createLinearGradient(-length, 0, length, 0);
    ray.addColorStop(0, "rgba(255, 255, 255, 0)");
    ray.addColorStop(0.44, `rgba(${tint.r}, ${tint.g}, ${tint.b}, 0.44)`);
    ray.addColorStop(0.5, "rgba(255, 255, 255, 0.96)");
    ray.addColorStop(0.56, `rgba(${tint.r}, ${tint.g}, ${tint.b}, 0.44)`);
    ray.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.strokeStyle = ray;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(-length, 0);
    context.lineTo(length, 0);
    context.stroke();
    context.restore();
  });
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

function createNodeStar(node) {
  const baseRadius = nodeRadius(node);
  const texture = createStarCoreTexture(node);
  const group = new THREE.Group();
  group.name = "archive-graph-star";
  group.position.set(node.x, node.y, node.z);
  group.userData.phase = (hashString(`star-${node.id}`) % 628) / 100;

  const coreMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: node.active ? 0.98 : node.connectedToActive ? 0.78 : 0.58,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const core = new THREE.Sprite(coreMaterial);
  core.name = "archive-graph-star-core";
  const coreScale = baseRadius * (node.active ? 5.7 : node.connectedToActive ? 4.9 : 4.2);
  core.scale.set(coreScale, coreScale, 1);
  core.userData.baseOpacity = coreMaterial.opacity;
  core.userData.texture = texture;
  group.add(core);

  const flareMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: node.active ? 0.44 : node.connectedToActive ? 0.26 : 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    rotation: Math.PI / 4
  });
  const flare = new THREE.Sprite(flareMaterial);
  flare.name = "archive-graph-star-flare";
  const flareScale = baseRadius * (node.active ? 10.2 : node.connectedToActive ? 7.4 : 5.8);
  flare.scale.set(flareScale, flareScale, 1);
  flare.userData.baseOpacity = flareMaterial.opacity;
  group.add(flare);

  return group;
}

function createHalo(node) {
  const baseRadius = nodeRadius(node);
  const texture = createStarCoreTexture({ ...node, active: false });
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: node.active ? CONSTELLATION_WARM : 0x9fc5ff,
    transparent: true,
    opacity: node.active ? 0.24 : node.connectedToActive ? 0.14 : 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const halo = new THREE.Sprite(material);
  halo.name = "archive-graph-star-corona";
  const glowRadius = baseRadius * (node.active ? 8.6 : node.connectedToActive ? 6.6 : 4.8);
  halo.scale.set(glowRadius, glowRadius, 1);
  halo.position.set(node.x, node.y, node.z);
  halo.userData.texture = texture;
  return halo;
}

function createPointStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  const center = canvas.width / 2;
  const glow = context.createRadialGradient(center, center, 0, center, center, center);
  glow.addColorStop(0, "rgba(255, 255, 255, 1)");
  glow.addColorStop(0.18, "rgba(235, 244, 255, 0.82)");
  glow.addColorStop(0.46, "rgba(180, 205, 255, 0.24)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

function createStarLayer({ name, count, spread, color, size, opacity }) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const [spreadX, spreadY, spreadZ] = spread;
  const baseColor = new THREE.Color(color);
  const warmColor = new THREE.Color(0xffe5ad);
  const coolColor = new THREE.Color(0x9fc5ff);
  for (let index = 0; index < count; index += 1) {
    const hash = hashString(`${name}-${index}`);
    const cluster = seededUnit(hash + 17);
    const bandBias = Math.pow(seededUnit(hash + 23), 2.6);
    const x = (seededUnit(hash + 31) - 0.5) * spreadX;
    const y = ((seededUnit(hash + 37) - 0.5) * spreadY * (cluster > 0.68 ? 0.42 : 1))
      + (bandBias - 0.5) * spreadY * 0.18;
    const z = (seededUnit(hash + 43) - 0.5) * spreadZ;
    const tint = baseColor.clone().lerp(cluster > 0.84 ? warmColor : coolColor, cluster > 0.84 ? 0.32 : 0.18);
    positions.push(
      x,
      y,
      z
    );
    colors.push(tint.r, tint.g, tint.b);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    color,
    map: createPointStarTexture(),
    vertexColors: true,
    size,
    transparent: true,
    opacity,
    alphaTest: 0.02,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  }));
  points.name = name;
  points.userData.baseOpacity = opacity;
  points.userData.texture = points.material.map;
  return points;
}

function createMilkyWayParticleField() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const cool = new THREE.Color(0x8ba8ff);
  const milk = new THREE.Color(0xf1f6ff);
  const amber = new THREE.Color(0xffdf9b);

  for (let index = 0; index < 2600; index += 1) {
    const hash = hashString(`milky-way-particle-field-${index}`);
    const lane = seededRange(hash + 1, -1, 1);
    const width = Math.pow(seededUnit(hash + 3), 2.8);
    const x = lane * 620;
    const y = lane * 118 + seededRange(hash + 5, -92, 92) * width;
    const z = -460 + seededRange(hash + 7, -120, 150);
    positions.push(x, y, z);

    const color = milk.clone()
      .lerp(cool, seededUnit(hash + 11) * 0.45)
      .lerp(amber, seededUnit(hash + 13) > 0.9 ? 0.34 : 0);
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: createPointStarTexture(),
    vertexColors: true,
    size: 1.65,
    transparent: true,
    opacity: 0.34,
    alphaTest: 0.02,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  const field = new THREE.Points(geometry, material);
  field.name = "space-milky-way-particle-field";
  field.rotation.z = -0.2;
  field.userData.baseOpacity = material.opacity;
  field.userData.texture = material.map;
  return field;
}

function createDistantGalaxyTexture(index) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(centerX, centerY);
  context.rotate(seededRange(hashString(`galaxy-angle-${index}`), -0.42, 0.42));
  context.scale(1, seededRange(hashString(`galaxy-flat-${index}`), 0.18, 0.34));
  const core = context.createRadialGradient(0, 0, 0, 0, 0, 92);
  core.addColorStop(0, "rgba(255, 245, 216, 0.72)");
  core.addColorStop(0.22, "rgba(184, 205, 255, 0.34)");
  core.addColorStop(0.58, "rgba(92, 116, 202, 0.14)");
  core.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, 92, 0, Math.PI * 2);
  context.fill();

  context.globalCompositeOperation = "screen";
  for (let arm = 0; arm < 2; arm += 1) {
    context.rotate(Math.PI);
    context.strokeStyle = "rgba(223, 233, 255, 0.16)";
    context.lineWidth = 8;
    context.beginPath();
    for (let step = 0; step < 74; step += 1) {
      const t = step / 73;
      const angle = t * Math.PI * 1.4;
      const radius = t * 94;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.44;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

function createDistantGalaxySprites() {
  return Array.from({ length: 7 }, (_, index) => {
    const hash = hashString(`deep-space-galaxy-smudge-${index}`);
    const texture = createDistantGalaxyTexture(index);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: seededRange(hash + 2, 0.12, 0.24),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      rotation: seededRange(hash + 4, -0.5, 0.5)
    });
    const sprite = new THREE.Sprite(material);
    sprite.name = "deep-space-galaxy-smudge";
    sprite.position.set(
      seededRange(hash + 6, -560, 560),
      seededRange(hash + 8, -300, 300),
      seededRange(hash + 10, -720, -560)
    );
    const scale = seededRange(hash + 12, 58, 126);
    sprite.scale.set(scale * seededRange(hash + 14, 1.4, 2.4), scale, 1);
    sprite.userData.texture = texture;
    sprite.userData.baseOpacity = material.opacity;
    sprite.userData.phase = seededRange(hash + 16, 0, Math.PI * 2);
    return sprite;
  });
}

function createNebulaTexture({ colorA, colorB, colorC }) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  const main = context.createRadialGradient(210, 126, 8, 250, 130, 256);
  main.addColorStop(0, colorA);
  main.addColorStop(0.34, colorB);
  main.addColorStop(0.72, colorC);
  main.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = main;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 52; index += 1) {
    const hash = hashString(`${colorA}-${index}`);
    const x = (hash % canvas.width);
    const y = ((hash >> 4) % canvas.height);
    const radius = 14 + ((hash >> 7) % 52);
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, "rgba(255, 255, 255, 0.10)");
    glow.addColorStop(0.42, colorC);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

function createNebulaCloud(config) {
  const texture = createNebulaTexture(config);
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity: config.opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = config.name;
  sprite.position.set(...config.position);
  sprite.scale.set(...config.scale);
  sprite.material.rotation = config.rotation;
  sprite.userData.texture = texture;
  sprite.userData.baseOpacity = config.opacity;
  sprite.userData.drift = config.drift;
  sprite.userData.baseRotation = config.rotation;
  return sprite;
}

const SPACE_BACKDROP_VERTEX_SHADER = `
  varying vec3 vDirection;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vDirection = normalize(worldPosition.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SPACE_BACKDROP_FRAGMENT_SHADER = `
  precision highp float;

  uniform float time;
  varying vec3 vDirection;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 5; octave += 1) {
      value += noise(p) * amplitude;
      p = p * 2.08 + vec3(11.7, 7.3, 3.9);
      amplitude *= 0.48;
    }
    return value;
  }

  // space-photographic-grain
  float photographicGrain(vec2 position) {
    return fract(sin(dot(position, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    vec3 d = normalize(vDirection);
    float sweep = d.y * 1.72 + d.x * 0.42 + sin(d.z * 1.6) * 0.08;
    float galacticBand = exp(-pow((sweep + 0.04) / 0.23, 2.0));
    float galacticCore = exp(-pow((sweep + 0.015) / 0.07, 2.0));
    float dustLaneA = exp(-pow((sweep - 0.075) / 0.026, 2.0));
    float dustLaneB = exp(-pow((sweep + 0.105) / 0.036, 2.0));

    float broadNoise = fbm(d * 3.2 + vec3(time * 0.04, 0.0, 0.0));
    float softNoise = fbm(d * 8.5 + vec3(0.0, time * 0.03, 0.0));
    float dust = smoothstep(0.42, 0.9, broadNoise) * galacticBand;
    float voids = smoothstep(0.50, 0.82, fbm(d * 5.1 + vec3(4.7, 0.0, 2.1)));

    vec3 deepSpace = vec3(0.003, 0.006, 0.018);
    vec3 blueHaze = vec3(0.12, 0.20, 0.48);
    vec3 milk = vec3(0.68, 0.76, 0.94);
    vec3 warmCore = vec3(0.88, 0.65, 0.34);

    vec3 color = deepSpace;
    color += blueHaze * galacticBand * (0.18 + broadNoise * 0.24);
    color += milk * galacticBand * softNoise * 0.34;
    color += warmCore * galacticCore * (0.16 + softNoise * 0.16);
    color -= vec3(0.12, 0.13, 0.18) * (dustLaneA * 0.84 + dustLaneB * 0.58);
    color -= vec3(0.08, 0.09, 0.13) * voids * (0.12 + dust * 0.42);

    float blueCloud = exp(-dot(d.xy - vec2(-0.34, 0.18), d.xy - vec2(-0.34, 0.18)) / 0.18);
    float goldCloud = exp(-dot(d.xy - vec2(0.28, -0.14), d.xy - vec2(0.28, -0.14)) / 0.13);
    color += vec3(0.10, 0.18, 0.44) * blueCloud * 0.18;
    color += vec3(0.42, 0.26, 0.11) * goldCloud * 0.13;

    float vignette = smoothstep(0.58, 1.08, length(d.xy));
    color *= 1.0 - vignette * 0.42;
    color = max(color, vec3(0.0));
    color = pow(color, vec3(0.92));
    color += (photographicGrain(gl_FragCoord.xy + time * 11.0) - 0.5) / 384.0;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function createSpaceBackdropMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }
    },
    vertexShader: SPACE_BACKDROP_VERTEX_SHADER,
    fragmentShader: SPACE_BACKDROP_FRAGMENT_SHADER,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
    depthTest: false
  });
}

function createSpaceBackdrop() {
  const geometry = new THREE.SphereGeometry(1380, 64, 32);
  const material = createSpaceBackdropMaterial();
  const sphere = new THREE.Mesh(geometry, material);
  sphere.name = "space-photographic-backdrop";
  sphere.rotation.set(0.08, -0.36, 0.1);
  return sphere;
}

function edgeColor(type) {
  if (type === "link") return 0xe9c46a;
  if (type === "similarity") return 0xb58cff;
  if (type === "topic") return 0x8bc4ff;
  return 0x98a2ad;
}

function relationScore(link) {
  const explicitScore = Number(link?.relationScore);
  if (Number.isFinite(explicitScore)) return Math.max(0, Math.min(100, explicitScore));
  const score = Number(link?.score);
  if (Number.isFinite(score)) return Math.max(0, Math.min(100, score));
  return 35;
}

function relationIntensity(link) {
  return Math.pow(relationScore(link) / 100, 1.45);
}

function relationLineColor(link) {
  const color = new THREE.Color(edgeColor(link.type));
  return color.lerp(new THREE.Color(0xffffff), relationIntensity(link) * 0.42);
}

function relationLineOpacity(link, touchesActive = false) {
  const intensity = relationIntensity(link);
  return touchesActive
    ? 0.16 + intensity * 0.78
    : 0.028 + intensity * 0.50;
}

function relationGlowOpacity(link, touchesActive = false) {
  const intensity = relationIntensity(link);
  return touchesActive
    ? 0.02 + intensity * 0.38
    : 0.006 + intensity * 0.19;
}

function relationPulseAmount(link) {
  return 0.004 + relationIntensity(link) * 0.044;
}

function relationLineWidth(link) {
  return 0.65 + relationIntensity(link) * 2.2;
}

function summarizeNode(node) {
  const parts = [
    node.kind || "material",
    formatGraphDistance(node),
    `${node.degree || 0} links`,
    `score ${Math.round(node.score || 0)}`
  ];
  const semantic = formatPercent(node.semanticScore);
  if (semantic) parts.push(semantic);
  return parts.join(" - ");
}

function summarizeBacklink(link) {
  const relation = [
    link.relationStrength || "medium",
    link.relationType || "reference",
    Number.isFinite(Number(link.relationScore)) ? `score ${Number(link.relationScore)}` : ""
  ].filter(Boolean).join(" - ");
  return `${relation} - ${link.targetType}: ${link.label}`;
}

function formatTooltip(node) {
  const terms = (Array.isArray(node.terms) ? node.terms : []).slice(0, 4);
  const backlinks = (Array.isArray(node.backlinks) ? node.backlinks : []).slice(0, 3);
  return `
    <strong>${escapeHtml(node.label || node.id)}</strong>
    <span>${escapeHtml(summarizeNode(node))}</span>
    ${terms.length ? `<em>${terms.map((term) => `#${escapeHtml(term)}`).join(" ")}</em>` : ""}
    ${backlinks.length ? `<small>${backlinks.map((link) => escapeHtml(summarizeBacklink(link))).join("<br>")}</small>` : ""}
  `;
}

function resizeRenderer(host, renderer, camera) {
  const rect = host.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width || host.clientWidth || 720));
  const height = Math.max(260, Math.floor(rect.height || host.clientHeight || 520));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose?.());
    } else {
      child.material?.dispose?.();
    }
    child.userData?.texture?.dispose?.();
  });
}

export function initArchiveGraph3D(root = document) {
  const container = root.querySelector("[data-archive-graph-3d]");
  if (!container) return null;
  const canvasHost = container.querySelector("[data-archive-graph-3d-canvas]");
  if (!canvasHost) return null;
  const payload = safeParsePayload(container.querySelector("[data-archive-graph-3d-payload]"));
  const links = Array.isArray(payload.links) ? payload.links : [];
  const nodes = layoutArchiveGraphNodes(Array.isArray(payload.nodes) ? payload.nodes : [], links);

  if (activeGraph?.dispose) activeGraph.dispose();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SPACE_BACKGROUND);
  scene.fog = new THREE.FogExp2(SPACE_FOG, 0.00135);

  const camera = new THREE.PerspectiveCamera(57, 1, 0.1, 3400);
  camera.position.set(78, -46, 390);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  canvasHost.replaceChildren(renderer.domElement);
  renderer.domElement.className = "archive-graph-3d-renderer";

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.minDistance = 44;
  controls.maxDistance = 1120;
  controls.rotateSpeed = 0.68;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.7;
  controls.target.set(0, 0, 0);

  const ambient = new THREE.AmbientLight(0xf4f8ff, 1.62);
  scene.add(ambient);
  const glow = new THREE.PointLight(0x9fc5ff, 1.7, 520);
  glow.position.set(0, 0, 120);
  scene.add(glow);

  const nebulaGlow = new THREE.PointLight(0xb58cff, 0.52, 780);
  nebulaGlow.position.set(-220, 140, -180);
  scene.add(nebulaGlow);

  const warmNebulaGlow = new THREE.PointLight(0xffe7a8, 0.34, 640);
  warmNebulaGlow.position.set(230, -160, -220);
  scene.add(warmNebulaGlow);

  const spaceBackdrop = createSpaceBackdrop();
  scene.add(spaceBackdrop);

  const nebulaClouds = NEBULA_CLOUDS.map((config) => createNebulaCloud(config));
  nebulaClouds.forEach((cloud) => scene.add(cloud));

  const milkyWayParticleField = createMilkyWayParticleField();
  scene.add(milkyWayParticleField);

  const distantGalaxies = createDistantGalaxySprites();
  distantGalaxies.forEach((galaxy) => scene.add(galaxy));

  const starLayers = STAR_LAYERS.map((config) => createStarLayer(config));
  starLayers.forEach((layer) => scene.add(layer));

  const dustGeometry = new THREE.BufferGeometry();
  const dustPositions = [];
  const dustColors = [];
  for (let index = 0; index < 360; index += 1) {
    const hash = hashString(`space-dust-${index}`);
    const color = new THREE.Color(0x8290d8).lerp(new THREE.Color(0xffe7a8), seededUnit(hash + 9) * 0.18);
    dustPositions.push(
      seededRange(hash + 1, -280, 280),
      seededRange(hash + 3, -180, 200),
      seededRange(hash + 5, -360, -100)
    );
    dustColors.push(color.r, color.g, color.b);
  }
  dustGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute("color", new THREE.Float32BufferAttribute(dustColors, 3));
  const dustMaterial = new THREE.PointsMaterial({
    color: 0x8290d8,
    map: createPointStarTexture(),
    vertexColors: true,
    size: 2.2,
    transparent: true,
    opacity: 0.16,
    alphaTest: 0.02,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  const dustField = new THREE.Points(dustGeometry, dustMaterial);
  dustField.name = "space-dust-lens-particles";
  dustField.userData.baseOpacity = dustMaterial.opacity;
  dustField.userData.texture = dustMaterial.map;
  scene.add(dustField);

  const nodeById = new Map();
  const selectable = [];
  const haloMeshes = [];
  const starGroups = [];
  nodes.forEach((node) => {
    const geometry = new THREE.SphereGeometry(nodeRadius(node) * (node.active ? 0.52 : 0.42), 20, 20);
    const material = new THREE.MeshStandardMaterial({
      color: node.active ? 0xffffff : colorForKind(node.kind),
      emissive: colorForKind(node.kind),
      emissiveIntensity: nodeEmissiveIntensity(node) + (node.active ? 0.42 : 0.24),
      roughness: 0.18,
      metalness: 0.02,
      transparent: true,
      opacity: node.active ? 0.96 : 0.76
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(node.x, node.y, node.z);
    mesh.userData.node = node;
    scene.add(mesh);
    nodeById.set(node.id, { node, mesh });
    selectable.push(mesh);

    const star = createNodeStar(node);
    starGroups.push(star);
    scene.add(star);

    const halo = createHalo(node);
    halo.userData.baseOpacity = halo.material.opacity;
    halo.userData.phase = (hashString(node.id) % 628) / 100;
    haloMeshes.push(halo);
    scene.add(halo);

    if (shouldLabelNode(node)) {
      scene.add(createLabelSprite(node));
    }
  });

  const constellationLines = [];
  links.forEach((link) => {
    const from = nodeById.get(link.source || link.from);
    const to = nodeById.get(link.target || link.to);
    if (!from || !to) return;
    const touchesActive = Boolean(from.node.active || to.node.active);
    const geometry = new THREE.BufferGeometry().setFromPoints([
      from.mesh.position,
      to.mesh.position
    ]);
    const lineOpacity = relationLineOpacity(link, touchesActive);
    const glowOpacity = relationGlowOpacity(link, touchesActive);
    const pulseAmount = relationPulseAmount(link);
    const material = new THREE.LineBasicMaterial({
      color: relationLineColor(link),
      transparent: true,
      opacity: lineOpacity,
      linewidth: relationLineWidth(link),
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const line = new THREE.Line(geometry, material);
    line.userData.link = link;
    line.userData.lineWidth = relationLineWidth(link);
    scene.add(line);
    constellationLines.push({
      material,
      baseOpacity: material.opacity,
      pulseAmount,
      phase: (hashString(`${link.source || link.from}-${link.target || link.to}`) % 628) / 100
    });

    const glowMaterial = new THREE.LineBasicMaterial({
      color: touchesActive ? CONSTELLATION_WARM : CONSTELLATION_GLOW,
      transparent: true,
      opacity: glowOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const glowLine = new THREE.Line(geometry.clone(), glowMaterial);
    glowLine.name = "constellation-line-glow";
    scene.add(glowLine);
    constellationLines.push({
      material: glowMaterial,
      baseOpacity: glowMaterial.opacity,
      pulseAmount: pulseAmount * 1.25,
      phase: (hashString(`glow-${link.source || link.from}-${link.target || link.to}`) % 628) / 100
    });
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let hoverLabel = null;
  let frameId = 0;

  const tooltip = document.createElement("div");
  tooltip.className = "archive-graph-3d-tooltip";
  tooltip.hidden = true;
  container.appendChild(tooltip);

  const setPointer = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
  };

  const clearHoverLabel = () => {
    if (!hoverLabel) return;
    scene.remove(hoverLabel);
    disposeObject(hoverLabel);
    hoverLabel = null;
  };

  const updateHover = (event) => {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(selectable, false)[0]?.object || null;
    if (hovered && hovered !== hit) {
      hovered.material.emissiveIntensity = nodeEmissiveIntensity(hovered.userData.node) + (hovered.userData.node.active ? 0.42 : 0.24);
      clearHoverLabel();
    }
    hovered = hit;
    if (hovered) {
      hovered.material.emissiveIntensity = 1.08;
      const node = hovered.userData.node;
      if (!node.active && !hoverLabel) {
        hoverLabel = createLabelSprite({ ...node, active: false });
        scene.add(hoverLabel);
      }
      tooltip.hidden = false;
      tooltip.style.left = `${event.offsetX + 14}px`;
      tooltip.style.top = `${event.offsetY + 14}px`;
      tooltip.innerHTML = formatTooltip(node);
    } else {
      tooltip.hidden = true;
    }
  };

  const selectHovered = () => {
    if (!hovered) return;
    container.dispatchEvent(new CustomEvent("archive-graph-3d-select", {
      bubbles: true,
      detail: { node: hovered.userData.node }
    }));
  };

  const handlePointerLeave = () => {
    if (hovered) hovered.material.emissiveIntensity = nodeEmissiveIntensity(hovered.userData.node) + (hovered.userData.node.active ? 0.42 : 0.24);
    hovered = null;
    clearHoverLabel();
    tooltip.hidden = true;
  };

  renderer.domElement.addEventListener("pointermove", updateHover);
  renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
  renderer.domElement.addEventListener("click", selectHovered);

  const resizeObserver = new ResizeObserver(() => resizeRenderer(canvasHost, renderer, camera));
  resizeObserver.observe(canvasHost);
  resizeRenderer(canvasHost, renderer, camera);
  const clock = new THREE.Clock();

  const animate = () => {
    const elapsed = clock.getElapsedTime();
    starLayers.forEach((layer, index) => {
      layer.rotation.z = elapsed * (STAR_LAYERS[index]?.drift || 0);
      layer.material.opacity = Math.max(0.18, layer.userData.baseOpacity + Math.sin(elapsed * 0.5 + index) * 0.035);
    });
    nebulaClouds.forEach((cloud, index) => {
      cloud.material.opacity = Math.max(0.12, cloud.userData.baseOpacity + Math.sin(elapsed * 0.24 + index) * 0.045);
      cloud.material.rotation = cloud.userData.baseRotation + Math.sin(elapsed * 0.08 + index) * 0.025;
      cloud.position.x += Math.sin(elapsed * 0.11 + index) * cloud.userData.drift;
      cloud.position.y += Math.cos(elapsed * 0.09 + index) * cloud.userData.drift;
    });
    milkyWayParticleField.rotation.z = -0.2 + Math.sin(elapsed * 0.035) * 0.012;
    milkyWayParticleField.material.opacity = milkyWayParticleField.userData.baseOpacity + Math.sin(elapsed * 0.18) * 0.025;
    dustField.rotation.z = Math.sin(elapsed * 0.06) * 0.018;
    dustField.material.opacity = dustField.userData.baseOpacity + Math.sin(elapsed * 0.28) * 0.02;
    distantGalaxies.forEach((galaxy, index) => {
      galaxy.material.opacity = Math.max(0.06, galaxy.userData.baseOpacity + Math.sin(elapsed * 0.16 + galaxy.userData.phase) * 0.025);
      galaxy.material.rotation += index % 2 === 0 ? 0.00008 : -0.00006;
    });
    spaceBackdrop.material.uniforms.time.value = elapsed;
    spaceBackdrop.rotation.y += 0.00008;
    spaceBackdrop.rotation.z += 0.000025;
    haloMeshes.forEach((halo) => {
      const baseOpacity = halo.userData.baseOpacity || 0.08;
      halo.material.opacity = baseOpacity + Math.sin(elapsed * 0.92 + halo.userData.phase) * baseOpacity * 0.22;
    });
    starGroups.forEach((star) => {
      const pulse = Math.sin(elapsed * 1.12 + star.userData.phase);
      star.children.forEach((sprite, index) => {
        const baseOpacity = sprite.userData.baseOpacity || 0.32;
        sprite.material.opacity = Math.max(0.08, baseOpacity + pulse * baseOpacity * (index === 0 ? 0.18 : 0.34));
        sprite.material.rotation += index === 0 ? 0.0007 : -0.0011;
      });
    });
    constellationLines.forEach((entry) => {
      entry.material.opacity = Math.max(0.01, entry.baseOpacity + Math.sin(elapsed * 0.78 + entry.phase) * (entry.pulseAmount || 0.012));
    });
    controls.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  };
  animate();

  activeGraph = {
    dispose() {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", updateHover);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("click", selectHovered);
      clearHoverLabel();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      tooltip.remove();
      if (renderer.domElement.parentNode === canvasHost) {
        canvasHost.replaceChildren();
      }
    }
  };

  return activeGraph;
}
