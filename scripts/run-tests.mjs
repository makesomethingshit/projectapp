import { spawnSync } from "node:child_process";

const assertionTests = [
  "test_archive_model.mjs",
  "test_archive_auto_links.mjs",
  "test_archive_embeddings.mjs",
  "test_archive_graph_model.mjs",
  "test_archive_relation_ui_contract.mjs",
  "test_archive_graph_2d_review_desk.mjs",
  "test_archive_graph_2d_line_visibility.mjs",
  "test_archive_graph_3d_layout.mjs",
  "test_archive_graph_3d_markup.mjs",
  "test_archive_resource_update.mjs",
  "test_archive_attach_detach.mjs",
  "test_archive_detail_panel.mjs",
  "test_archive_edit_controls.mjs",
  "test_archive_project_port_markup.mjs",
  "test_archive_search.mjs",
  "test_archive_topic_grouping.mjs",
  "test_archive_relation_scoring.mjs",
  "test_archive_view_attach_controls.mjs",
  "test_archive_view_modes.mjs",
  "test_task_launcher_markup.mjs",
  "test_task_launcher_modal_auto_link.mjs",
  "test_task_launcher_modal_scroll_css.mjs",
  "test_ui_finish_css.mjs",
  "test_space_dark_mode_css.mjs",
  "test_typography_hierarchy_css.mjs",
  "test_spacing_hierarchy_css.mjs",
  "test_korean_ui_layout_contract.mjs",
  "test_project_list_expansion.mjs",
  "test_test_harness_output.mjs",
  "test_bottleneck_alert_design.mjs",
  "test_bottleneck_recommendations.mjs",
  "test_bottleneck_recommendation_markup.mjs",
  "test_bottleneck_hierarchy_direction.mjs",
  "test_project_progress_rollup_contract.mjs",
  "test_rollup_explanation.mjs",
  "test_rollup_explanation_markup.mjs",
  "test_encoding_integrity.mjs",
  "test_detail_bottleneck_navigation.mjs",
  "test_graph_navigation.mjs",
  "test_graph_port_labels.mjs",
  "test_graph_custom_ports.mjs",
  "test_graph_selection.mjs",
  "test_local_file_bridge.mjs"
];

const diagnosticScripts = [
  "test_build_data.js"
];

function runNodeScript(script) {
  const nodeOptions = [
    process.env.NODE_OPTIONS,
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"
  ].filter(Boolean).join(" ");
  const result = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions
    }
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
