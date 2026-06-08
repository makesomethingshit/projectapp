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

const STAR_LAYERS = [
  {
    name: "space-stars-far",
    count: 360,
    spread: [1260, 880, 1060],
    color: 0x8fa4c8,
    size: 0.62,
    opacity: 0.3,
    drift: 0.0008
  },
  {
    name: "space-stars-near",
    count: 520,
    spread: [960, 680, 820],
    color: 0xdbe8ff,
    size: 1.04,
    opacity: 0.56,
    drift: -0.0014
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
  if (node.active) return "selected core";
  if (node.graphDistance === 1) return "direct relation";
  if (node.graphDistance === 2) return "2 steps away";
  if (Number.isFinite(Number(node.graphDistance)) && Number(node.graphDistance) < 4) {
    return `${Number(node.graphDistance)} steps away`;
  }
  return "wider reference";
}

function hashString(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
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

function layoutNodes(nodes, links) {
  const context = buildGraphContext(nodes, links);
  const bandCounts = new Map();
  return nodes.map((node, index) => {
    const distance = context.distance.get(node.id) ?? 4;
    const band = node.active ? 0 : distance === 1 ? 1 : distance === 2 ? 2 : 3;
    const bandIndex = bandCounts.get(band) || 0;
    bandCounts.set(band, bandIndex + 1);
    const hash = hashString(node.id || node.label || index);
    const angle = (bandIndex * 2.399963 + (hash % 41) * 0.013) % (Math.PI * 2);
    const ringBase = band === 0 ? 0 : band === 1 ? 62 : band === 2 ? 132 : 218;
    const ringJitter = band === 0 ? 0 : (bandIndex % (band === 1 ? 3 : 6)) * (band === 1 ? 16 : 22);
    const ring = ringBase + ringJitter + Math.min(18, Number(node.score || 0) * 0.11);
    const zSpread = band === 1 ? 32 : band === 2 ? 58 : 92;
    const z = node.active ? 0 : ((hash % 101) - 50) * (zSpread / 50);
    return {
      ...node,
      degree: context.degree.get(node.id) || 0,
      graphDistance: distance,
      connectedToActive: distance === 1,
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

function createHalo(node) {
  const baseRadius = nodeRadius(node);
  const glowRadius = baseRadius + (node.active ? 6.2 : node.connectedToActive ? 4.1 : 2.7);
  const geometry = new THREE.SphereGeometry(glowRadius, 28, 14);
  const material = new THREE.MeshBasicMaterial({
    color: node.active ? CONSTELLATION_WARM : 0x9fc5ff,
    transparent: true,
    opacity: node.active ? 0.24 : node.connectedToActive ? 0.15 : 0.07,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const halo = new THREE.Mesh(geometry, material);
  halo.position.set(node.x, node.y, node.z);
  return halo;
}

function createStarLayer({ name, count, spread, color, size, opacity }) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const [spreadX, spreadY, spreadZ] = spread;
  for (let index = 0; index < count; index += 1) {
    const hash = hashString(`${name}-${index}`);
    positions.push(
      ((hash % 1000) / 1000 - 0.5) * spreadX,
      (((hash >> 3) % 1000) / 1000 - 0.5) * spreadY,
      (((hash >> 5) % 1000) / 1000 - 0.5) * spreadZ
    );
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  points.name = name;
  points.userData.baseOpacity = opacity;
  return points;
}

function edgeColor(type) {
  if (type === "link") return 0xe9c46a;
  if (type === "similarity") return 0xb58cff;
  if (type === "topic") return 0x8bc4ff;
  return 0x98a2ad;
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
  const nodes = layoutNodes(Array.isArray(payload.nodes) ? payload.nodes : [], links);

  if (activeGraph?.dispose) activeGraph.dispose();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SPACE_BACKGROUND);
  scene.fog = new THREE.FogExp2(SPACE_FOG, 0.0017);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
  camera.position.set(0, 0, 260);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  canvasHost.replaceChildren(renderer.domElement);
  renderer.domElement.className = "archive-graph-3d-renderer";

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.minDistance = 44;
  controls.maxDistance = 900;
  controls.rotateSpeed = 0.68;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.7;

  const ambient = new THREE.AmbientLight(0xf4f8ff, 1.62);
  scene.add(ambient);
  const glow = new THREE.PointLight(0x9fc5ff, 1.7, 520);
  glow.position.set(0, 0, 120);
  scene.add(glow);

  const nebulaGlow = new THREE.PointLight(0xb58cff, 0.52, 780);
  nebulaGlow.position.set(-220, 140, -180);
  scene.add(nebulaGlow);

  const starLayers = STAR_LAYERS.map((config) => createStarLayer(config));
  starLayers.forEach((layer) => scene.add(layer));

  const dustGeometry = new THREE.BufferGeometry();
  const dustPositions = [];
  for (let index = 0; index < 190; index += 1) {
    const hash = hashString(`space-dust-${index}`);
    dustPositions.push(
      -180 + ((hash % 1000) / 1000) * 360,
      -120 + (((hash >> 4) % 1000) / 1000) * 260,
      -260 + (((hash >> 7) % 1000) / 1000) * 180
    );
  }
  dustGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dustPositions, 3));
  scene.add(new THREE.Points(dustGeometry, new THREE.PointsMaterial({
    color: 0x6d79b8,
    size: 2.8,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })));

  const nodeById = new Map();
  const selectable = [];
  const haloMeshes = [];
  nodes.forEach((node) => {
    const geometry = new THREE.SphereGeometry(nodeRadius(node), 20, 20);
    const material = new THREE.MeshStandardMaterial({
      color: colorForKind(node.kind),
      emissive: colorForKind(node.kind),
      emissiveIntensity: nodeEmissiveIntensity(node),
      roughness: 0.58,
      metalness: 0.04
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(node.x, node.y, node.z);
    mesh.userData.node = node;
    scene.add(mesh);
    nodeById.set(node.id, { node, mesh });
    selectable.push(mesh);

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
    const material = new THREE.LineBasicMaterial({
      color: edgeColor(link.type),
      transparent: true,
      opacity: touchesActive
        ? Math.max(0.46, Math.min(0.82, Number(link.score || 30) / 120))
        : Math.max(0.12, Math.min(0.4, Number(link.score || 30) / 190)),
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const line = new THREE.Line(geometry, material);
    line.userData.link = link;
    scene.add(line);
    constellationLines.push({
      material,
      baseOpacity: material.opacity,
      phase: (hashString(`${link.source || link.from}-${link.target || link.to}`) % 628) / 100
    });

    const glowMaterial = new THREE.LineBasicMaterial({
      color: touchesActive ? CONSTELLATION_WARM : CONSTELLATION_GLOW,
      transparent: true,
      opacity: touchesActive ? 0.2 : 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const glowLine = new THREE.Line(geometry.clone(), glowMaterial);
    glowLine.name = "constellation-line-glow";
    scene.add(glowLine);
    constellationLines.push({
      material: glowMaterial,
      baseOpacity: glowMaterial.opacity,
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
      hovered.material.emissiveIntensity = nodeEmissiveIntensity(hovered.userData.node);
      clearHoverLabel();
    }
    hovered = hit;
    if (hovered) {
      hovered.material.emissiveIntensity = 0.72;
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
    if (hovered) hovered.material.emissiveIntensity = nodeEmissiveIntensity(hovered.userData.node);
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
    haloMeshes.forEach((halo) => {
      const baseOpacity = halo.userData.baseOpacity || 0.08;
      halo.material.opacity = baseOpacity + Math.sin(elapsed * 0.92 + halo.userData.phase) * baseOpacity * 0.22;
    });
    constellationLines.forEach((entry) => {
      entry.material.opacity = Math.max(0.04, entry.baseOpacity + Math.sin(elapsed * 0.78 + entry.phase) * 0.025);
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
