# TODO
- Implement some join date sorting order?
- Underline users as we hover over them in ORBAT to show they are clickable?
- Remove the extra 1px margin on the inside of nodes, between the top border and the list of names? If it is there still.
- Implement member count.
- Implement ORBAT light theme.

## Configuration
- `orbat_enabled` toggles the plugin on or off from the admin panel.
- `orbat_admin_only` limits the ORBAT page and data endpoint to admins.
- Within the `orbat_json` configuration, the `rankPriority` array controls rank ordering (highest first), and the `groupPriority` array defines fallback ordering for non-ranked groups. Both can be edited from the plugin settings UI.
- Top level nodes can be split into custom sections by adding `display.rootSections` inside the JSON configuration. Each section entry accepts a `prefixes` array (matching the first segment of the `code`, for example `"1"` or `"2"`), optional `title`/`subtitle` text, and an optional `layout` hash (for example `{ "type": "row" }`). Any nodes whose prefixes are not listed fall back to a final catch-all section, so new structures appear automatically below existing sections.
