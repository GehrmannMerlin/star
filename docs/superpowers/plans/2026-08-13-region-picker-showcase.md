# Region Picker Showcase Implementation Plan

1. Replace `RegionPicker` state and rendering with province/city/county single-select cascade, derived selection metadata, and load-error handling.
2. Update full-institution form gating and request mapping to use the deepest selected region while preserving targeted mode and legacy `expandLevel` compatibility.
3. Adjust only region-picker styles for three-column desktop layout and stacked narrow layout.
4. Replace obsolete component tests and extend app tests for cascade, derivation, submission, removed controls, and mode preservation.
5. Run the web test script, workspace typecheck, web build, and inspect git diff/status for scope compliance.
