const ARCHIVE_GRAPH_SELECTOR = "[data-archive-graph-view]";

function readArchiveGraphPayload(root) {
  const payloadEl = root.querySelector("[data-archive-graph-payload]");
  if (!payloadEl) return { nodes: [], links: [] };
  try {
    const payload = JSON.parse(payloadEl.textContent || "{}");
    return {
      nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
      links: Array.isArray(payload.links) ? payload.links : []
    };
  } catch {
    return { nodes: [], links: [] };
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function initArchiveGraphD3() {
  const d3 = window.d3;
  const root = document.querySelector(ARCHIVE_GRAPH_SELECTOR);
  if (!root || !d3) return;

  const canvas = root.querySelector(".archive-graph-view-canvas");
  const panLayer = root.querySelector("[data-archive-graph-pan-layer]");
  const svg = root.querySelector(".archive-graph-view-svg");
  if (!canvas || !panLayer || !svg) return;

  root.__archiveGraphSimulation?.stop?.();

  const payload = readArchiveGraphPayload(root);
  const nodes = payload.nodes.map((node) => ({ ...node }));
  const links = payload.links.map((link) => ({ ...link }));
  if (!nodes.length) return;

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeEls = new Map(
    [...canvas.querySelectorAll("[data-archive-graph-node]")]
      .map((nodeEl) => [nodeEl.dataset.archiveGraphNode, nodeEl])
  );
  const width = Math.max(320, canvas.clientWidth || 900);
  const height = Math.max(320, canvas.clientHeight || 620);
  const centerX = width / 2;
  const centerY = height / 2;

  nodes.forEach((node) => {
    node.x = Number.isFinite(node.x) ? (node.x / 100) * width : centerX;
    node.y = Number.isFinite(node.y) ? (node.y / 100) * height : centerY;
    const degreeBoost = Math.min(22, (Number(node.degree) || 0) * 5);
    node.radius = (node.type === "source" ? 120 : node.type === "collection" ? 96 : node.type === "topic" || node.type === "tag" ? 72 : node.type === "file" || node.type === "resource" || node.type === "link" ? 86 : 76) + degreeBoost;
    if (node.active) {
      node.fx = centerX;
      node.fy = centerY;
    }
  });

  const svgSelection = d3.select(svg)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const linkKey = function linkKey(link) {
    if (!link) {
      return this?.getAttribute?.("data-archive-graph-edge")
        || this?.getAttribute?.("data-archive-graph-edge-label")
        || "";
    }
    if (link.relationEdgeKey) return link.relationEdgeKey;
    return `${link.from || link.source}->${link.to || link.target}:${link.type || "link"}`;
  };
  const relationLinkClass = (link) => [
    link.type || "link",
    ["strong", "medium", "weak"].includes(link.relationStrength) ? link.relationStrength : "",
    link.relationStatus === "suggested" ? "review" : "",
    link.relationEdgeKey ? "relation-review" : ""
  ].filter(Boolean).join(" ");
  const applyRelationAttrs = (selection, attrName) => selection
    .attr(attrName, (link) => link.relationEdgeKey || linkKey(link))
    .attr("data-archive-review-edge", (link) => link.relationEdgeKey || null)
    .attr("data-resource-id", (link) => link.resourceId || null)
    .attr("data-target-type", (link) => link.targetType || null)
    .attr("data-target-id", (link) => link.targetId || null);
  const linkSelection = svgSelection.selectAll("line.archive-graph-view-edge")
    .data(links, linkKey)
    .join("line")
    .attr("class", (link) => `archive-graph-view-edge ${relationLinkClass(link)}`)
    .attr("marker-end", (link) => `url(#archive-graph-arrow-${link.type || "link"})`);
  applyRelationAttrs(linkSelection, "data-archive-graph-edge");
  const labelSelection = svgSelection.selectAll("text.archive-graph-view-edge-label")
    .data(links, linkKey)
    .join("text")
    .attr("class", (link) => `archive-graph-view-edge-label ${relationLinkClass(link)}`)
    .text((link) => link.label || link.type || "links");
  applyRelationAttrs(labelSelection, "data-archive-graph-edge-label");

  const sourceNode = (link) => nodeById.get(link.source?.id || link.source) || nodeById.get(link.from);
  const targetNode = (link) => nodeById.get(link.target?.id || link.target) || nodeById.get(link.to);
  const placeArchiveGraphLinks = () => {
    linkSelection
      .attr("x1", (link) => sourceNode(link)?.x || 0)
      .attr("y1", (link) => sourceNode(link)?.y || 0)
      .attr("x2", (link) => targetNode(link)?.x || 0)
      .attr("y2", (link) => targetNode(link)?.y || 0);

    labelSelection
      .attr("x", (link) => ((sourceNode(link)?.x || 0) + (targetNode(link)?.x || 0)) / 2)
      .attr("y", (link) => ((sourceNode(link)?.y || 0) + (targetNode(link)?.y || 0)) / 2);
  };
  placeArchiveGraphLinks();

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((node) => node.id).distance((link) => {
      if (link.type === "similarity") return 132;
      if (link.type === "related") return 118;
      if (link.type === "tag") return 150;
      return 210;
    }).strength((link) => {
      if (link.type === "similarity") return 0.64;
      if (link.type === "related") return 0.72;
      if (link.type === "tag") return 0.46;
      return 0.54;
    }))
    .force("charge", d3.forceManyBody().strength((node) => node.active ? -900 : node.type === "source" ? -820 : node.type === "collection" ? -650 : node.type === "topic" || node.type === "tag" ? -420 : -620))
    .force("center", d3.forceCenter(centerX, centerY))
    .force("collision", d3.forceCollide().radius((node) => node.radius + 18).strength(0.92))
    .force("x", d3.forceX((node) => {
      if (node.active) return centerX;
      if (node.type === "source") return width * 0.12;
      if (node.type === "collection") return width * 0.34;
      if (node.type === "topic" || node.type === "tag") return width * 0.58;
      if (node.type === "file" || node.type === "resource" || node.type === "link") return width * 0.76;
      if (node.type === "project" || node.type === "task") return width * 0.9;
      return width * 0.5;
    }).strength((node) => node.active ? 0.3 : 0.065))
    .force("y", d3.forceY((node) => node.active ? centerY : centerY).strength((node) => node.active ? 0.3 : 0.045))
    .alpha(0.9)
    .alphaDecay(0.035);

  const drag = d3.drag()
    .on("start", (event, node) => {
      if (!event.active) simulation.alphaTarget(0.22).restart();
      node.fx = node.x;
      node.fy = node.y;
      nodeEls.get(node.id)?.classList.add("dragging");
    })
    .on("drag", (event, node) => {
      node.fx = clamp(event.x, 40, width - 40);
      node.fy = clamp(event.y, 40, height - 40);
    })
    .on("end", (event, node) => {
      if (!event.active) simulation.alphaTarget(0);
      if (!node.active) {
        node.fx = null;
        node.fy = null;
      }
      nodeEls.get(node.id)?.classList.remove("dragging");
    });

  d3.selectAll([...nodeEls.values()]).call(drag);

  simulation.on("tick", () => {
    nodes.forEach((node) => {
      node.x = clamp(node.x, 48, width - 48);
      node.y = clamp(node.y, 48, height - 48);
    });

    placeArchiveGraphLinks();

    nodes.forEach((node) => {
      const nodeEl = nodeEls.get(node.id);
      if (!nodeEl) return;
      nodeEl.style.left = `${node.x}px`;
      nodeEl.style.top = `${node.y}px`;
    });
  });

  root.__archiveGraphSimulation = simulation;
}
