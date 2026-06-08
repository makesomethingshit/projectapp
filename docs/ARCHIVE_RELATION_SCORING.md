# Archive Relation Scoring

This document explains how archive relations are calculated.

The archive is intended to be a rhizomatic Second Brain. Relation strength should come from content and active context, not from storage paths, drives, or file types.

## 1. Content Term Extraction

Source: `archive-model.js`

All relation scoring starts by extracting content terms.

### Archive Resource Terms

Function: `getArchiveContentTerms(resource)`

Inputs:
- `resource.name`
- `resource.desc`
- explicit `resource.tags`

Rules:
- Terms are normalized to lowercase.
- Spaces and underscores become hyphens.
- Duplicate terms are removed.
- Maximum output: 8 terms.
- Management terms are ignored.

Management terms include:
- drive and storage terms: `g-drive`, `d-drive`, `source`, `storage`, `local`, `drive`, `root`
- file/resource terms: `file`, `folder`, `link`, `archive`, `resource`, `doc`, `pdf`, `jpg`, `pptx`
- process terms: `copy`, `draft`, `final`, `scan`, `temp`, `indexed`
- generic glue words: `the`, `and`, `for`, `from`, `with`, `of`

Important implication:

> A tag like `pdf`, `g-drive`, `folder`, or a folder name should not make two materials conceptually related.

### Project Terms

Function: `getProjectContentTerms(project, tasks)`

Inputs:
- `project.name`
- `project.note`
- names and notes of tasks inside that project

Maximum output: 12 terms.

### Task Terms

Function: `getTaskContentTerms(task, projects)`

Inputs:
- `task.name`
- `task.note`
- parent project name
- parent project note

Maximum output: 12 terms.

## 2. Semantic Embedding + Cosine Similarity

Source: `archive-model.js`

To capture meaning rather than just word overlap, documents are converted into dense semantic embeddings using a pre-trained model (e.g., Sentence-Transformers). Cosine Similarity is then used to measure semantic alignment.

### Semantic Embedding

Each document (resource, project, task) is passed through a semantic encoder:

```text
document_embedding = encoder(document_text)
```

- Input: `name` + `desc` + `tags` + `note` (combined text).
- Output: A dense vector (e.g., 768 dimensions) representing the document's meaning.
- Captures context, synonyms, and conceptual relationships.
- Independent of exact word choice ("inflation" ≈ "rising prices").

### Cosine Similarity

Cosine Similarity measures the angle between two semantic embeddings:

```text
cosine_similarity(A, B) = dot(A, B) / (|A| * |B|)

where:
  dot(A, B) = sum of A[i] * B[i] for all i
  |A| = sqrt(sum of A[i]² for all i)
  |B| = sqrt(sum of B[i]² for all i)
```

- Result ranges from 0 (no semantic overlap) to 1 (identical meaning).
- Independent of document length (vector magnitude normalized).
- Captures "meaning alignment" rather than just term count.

### Combined Score

Semantic Cosine Similarity produces a continuous relevance score:

```text
relevance = cosine_similarity(resource_embedding, target_embedding)

score = relevance * 72  // scale to 0-72 range
```

Example:
- 0.8 similarity → 57.6 points (high semantic overlap)
- 0.5 similarity → 36 points (moderate overlap)
- 0.2 similarity → 14.4 points (low overlap)

### Caching

To avoid recomputing embeddings on every scoring pass:
- Embeddings are cached per document.
- Cache invalidates when document content changes.
- Cosine similarity is computed per-pair at query time.

### Limitations

- **Causal relationships**: Embeddings capture semantic proximity, not causal direction ("A causes B" vs "B causes A" may have similar embeddings).
- **Hallucination risk**: Pre-trained models may introduce biases or incorrect associations.
- **Context window**: Only the text provided to the encoder is considered; external context is not included.

## 3. Automatic Archive Links

Source: `archive-model.js`

Automatic links are stored in `archiveResourceLinks`. They connect archive resources to projects or tasks.

### Project Relation Score

Function: `scoreArchiveProjectRelation(resource, project, tasks)`

Formula:

```text
semanticScore = cosine_similarity(resource_embedding, project_embedding)

score = semanticScore * 72

if resource.type === "folder":
  score -= 6

score = clamp(round(score), 0, 72)
```

The function returns:
- `score`
- `semanticScore`
- `sharedTerms`
- `pendingEmbedding`

### Task Relation Score

Function: `scoreArchiveTaskRelation(resource, task, projects)`

Same shape as project scoring, but compares a resource embedding against a task embedding.

Formula:

```text
semanticScore = cosine_similarity(resource_embedding, task_embedding)

score = semanticScore * 72

if resource.type === "folder":
  score -= 6

score = clamp(round(score), 0, 72)
```

### Automatic Link Thresholds

Function: `buildAutomaticArchiveResourceLinks(projects, tasks, resources, existingLinks, options)`

Defaults:

```text
threshold = 40
maxPerProject = 8
maxPerTask = 5
folderCollapseThreshold = 3
```

Candidate rules:
- Candidate score must be at least `threshold`.
- Candidate must have cached embeddings for both sides.
- Existing links are preserved.
- New links are skipped if the same `resourceId + targetType + targetId` already exists.

### Folder Collapse

If 3 or more related file candidates live in the same containing folder:

1. Their individual file IDs are marked as collapsed.
2. If that folder exists as an archive resource, the folder is selected as representative.
3. Folder representative gets:

```text
folderScore = bestFileScore + 10
```

If the folder resource does not exist:
- the model keeps up to 2 file candidates from that folder.

Design intent:

> Many similar files in one folder should usually become one folder-level relation, not dozens of noisy file-level links.

## 4. 3D Graph Model Scores

Source: `archive-graph-model.js`

The 3D graph uses a renderer-neutral graph model from `buildArchiveGraphModel(stateLike, options)`.

Folders are excluded from conceptual graph nodes:

```text
resources = archiveResources where resource.type !== "folder"
```

### Active Context

The selected archive resource is the active context:

```text
selectedResource = resource matching selectedArchiveResourceId
fallback = first non-folder resource
selectedEmbedding = semantic embedding of selectedResource
focusTerms = content terms of selectedResource
```

### Focus Depth

Depth changes graph breadth.

```text
depth 1 => depthScale 0.45
depth 2 => depthScale 1
depth 3 => depthScale 1.45
depth 4 => depthScale 2
```

Visible limits:

```text
nodeLimit = clamp((options.limit or 120) * depthScale, 20, 240)
edgeLimit = clamp((options.edgeLimit or 220) * depthScale, 40, 600)
```

### Material Node Score

Function: `scoreMaterial(resource, selectedResource, selectedEmbedding, linksByResource)`

Formula:

```text
semanticScore = cosine_similarity(resource_embedding, selectedEmbedding)
explicitLinks = number of archiveResourceLinks for this resource

if resource is selected:
  score = 100
else:
  score = 8

score += semanticScore * 72
score += min(18, explicitLinks * 6)

if resource is not selected and semanticScore < 0.3:
  if explicitLinks exist:
    score -= 12
  else:
    score -= 4

score = clamp(round(score), 1, 100)
```

Important behavior:

> An unrelated material with a project/task backlink should not outrank a material that shares the selected context.

### Project Node Score

Function: `scoreProjectNode(project, tasks, selectedEmbedding)`

Formula:

```text
semanticScore = cosine_similarity(project_embedding, selectedEmbedding)

score = 12 + semanticScore * 72
score = clamp(round(score), 1, 84)
```

### Task Node Score

Function: `scoreTaskNode(task, projects, selectedEmbedding)`

Formula:

```text
semanticScore = cosine_similarity(task_embedding, selectedEmbedding)

score = 14 + semanticScore * 74
score = clamp(round(score), 1, 88)
```

### Topic Nodes

Topic nodes are built from visible material terms.

Topic ordering prefers:
1. terms inside the active focus context
2. higher accumulated score
3. alphabetical order

Topic node score:

```text
topicScore = average score of materials using that term
topicScore = clamp(round(topicScore), 12, 90)
```

### Edge Scores

Function: `edgeWeight(type, sourceScore, targetScore, semanticScore)`

Formula:

```text
base =
  76 if type === "link"
  48 if type === "similarity"
  30 otherwise

score = base
      + semanticScore * 18
      + sqrt(sourceScore + targetScore)

score = clamp(round(score), 1, 100)
```

Edge types:
- `topic`: resource to topic
- `link`: resource to project/task backlink
- `similarity`: resource to resource

Similarity edges are created when:

```text
semanticScore >= 0.5
OR
at least one shared term is in focusTerms
```

Each similarity edge keeps up to 4 shared terms as a human-readable explanation.

## 5. Legacy 2D Graph Display Scores

Source: `ui-components.js`

The 2D graph is now a fallback view, but it still has its own local display scoring.

### 2D Visible Resource Ordering

The 2D graph computes a simple `relationScore(resource)`:

```text
if resource is selected:
  relationScore = 4
else if resource has any term matching selectedTerms:
  relationScore = 3
else:
  relationScore = 1
```

Then it:
- excludes folders
- sorts by `relationScore`, then id descending
- keeps first 18 resources

This is not the canonical relation model. It is a fallback display heuristic.

### 2D Strong Relations Score

The right inspector's Strong Relations section scores visible 2D edges:

Base score:

```text
link       => 72
related    => 46
similarity => 34
other      => 12
```

Bonuses:

```text
if edge touches selected node:
  score += 14

score += min(8, ceil(sqrt(fromDegree + toDegree)))

if from or to node is active:
  score += 8
```

Penalties:

```text
if related topic appears 4+ times:
  score -= min(12, frequency * 2)

if similarity topic appears 4+ times:
  score -= min(10, frequency * 2)

if selected context exists and edge does not match selected context:
  score = round(score * 0.42)
```

Caps:

```text
link       => max 92
related    => max 68
similarity => max 56
other      => max 40
```

Final:

```text
score = clamp(score, 1, cap)
```

## 6. Current Test Coverage

Important tests:

- `test_archive_auto_links.mjs`
  - automatic project/task linking
  - folder collapse behavior
  - `semanticScore` and shared-term reporting
  - missing cached embeddings do not invent a relation

- `test_archive_embeddings.mjs`
  - cached semantic embedding generation
  - cache hydration without recomputation
  - relation scores use cached embeddings

- `test_archive_relation_scoring.mjs`
  - selected Levinas context should outrank unrelated typography backlink

- `test_archive_graph_model.mjs`
  - selected context node is active
  - folders are excluded from conceptual graph nodes
  - Levinas context outranks unrelated typography
  - graph limits and focus depth affect visible graph breadth

- `test_archive_graph_3d_markup.mjs`
  - Three.js dependency and import map
  - 3D/2D markup contracts
  - payload JSON is parseable

- `scripts/verify-archive-3d-electron.cjs`
  - real Electron runtime creates a 3D canvas
  - WebGL context exists
  - graph payload has nodes and links

## 7. Known Design Biases

- Content words beat path words.
- Selected context beats unrelated backlinks.
- Folder resources are storage representatives, not conceptual hierarchy nodes.
- Similarity should compress or cluster when there are too many near-duplicates.
- A relation score is not a truth score. It is a navigation priority score.
- Relation scores come from semantic embeddings, not weighted lexical overlap.

## 8. Open Questions For Review

- Should explicit user-authored tags receive more weight than extracted name/description terms?
- Should repeated phrases across many documents be treated like stop words after a frequency threshold?
- Should project/task backlinks created manually get a separate trust bonus from auto-generated backlinks?
- Should folder representative links inherit all shared terms from collapsed files, not only the best candidate's terms?
- Which local embedding model should become the long-term default if the current one is too slow or too large?
