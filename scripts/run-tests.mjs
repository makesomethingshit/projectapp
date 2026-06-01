import { spawnSync } from "node:child_process";

const assertionTests = [
  "test_archive_model.mjs",
  "test_archive_resource_update.mjs",
  "test_archive_attach_detach.mjs",
  "test_archive_detail_panel.mjs",
  "test_archive_edit_controls.mjs",
  "test_archive_project_port_markup.mjs",
  "test_archive_search.mjs",
  "test_archive_topic_grouping.mjs",
  "test_archive_view_attach_controls.mjs",
  "test_archive_view_modes.mjs",
  "test_bottleneck_alert_design.mjs",
  "test_bottleneck_hierarchy_direction.mjs",
  "test_project_progress_rollup_contract.mjs",
  "test_rollup_explanation.mjs",
  "test_rollup_explanation_markup.mjs",
  "test_encoding_integrity.mjs",
  "test_detail_bottleneck_navigation.mjs",
  "test_graph_navigation.mjs",
  "test_graph_port_labels.mjs",
  "test_graph_selection.mjs",
  "test_local_file_bridge.mjs"
];

const diagnosticScripts = [
  "test_build_data.js"
];

function runNodeScript(script) {
  const result = spawnSync(process.execPath, [script], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const script of assertionTests) {
  runNodeScript(script);
}

for (const script of diagnosticScripts) {
  runNodeScript(script);
}

console.log("all reliability checks passed");
