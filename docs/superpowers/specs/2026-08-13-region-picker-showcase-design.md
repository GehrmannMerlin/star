# Region Picker Showcase Design

## Goal

Replace the full-institution page's multi-region expansion controls with a single-target province/city/county cascade. Derive the task level from the deepest selected region while preserving the existing page shell and task API contract.

## Non-goals

- No backend, crawler, database, Skill, Pi Agent, or contract redesign.
- No town/street selection, new region data, framework, or broad UI redesign.
- No changes to targeted-institution business fields.

## Current UI

`RegionPicker` loads provinces and children through `ApiClient`, multi-selects cities, then calls `expandRegions` with a user-selected `COUNTY` or `TOWN_STREET` level. It also offers upload/validation and a level radio group. `TaskForm` blocks full-institution submission when the expanded `codes` array is empty. `buildCreateRequest` submits `codes[0]`, `names[0]`, all expanded `regionCodes`, and the selected `expandLevel`.

## Target UI

Keep the existing card, mode switch, page layout, colors, and submit button. Inside the collection scope card show three single selects labelled 省份, 地市, 区县, with city and county disabled until their parent is selected. Show the selected path and derived task level as helper text.

## Cascade Rules

- Province is enabled initially; city and county are disabled.
- Province selection loads only direct children and clears city/county.
- City selection loads only direct children and clears county.
- Clearing a parent clears all descendants.
- Load failures clear the affected selections/options and retain an error message.
- State stores one selected code per level, preventing parent/child mismatches.

## Derived Level Rules

- Province only: `PROVINCE` / 省级.
- Province + city: `PREFECTURE` / 地市级.
- Province + city + county: `COUNTY` / 区县级.
- No separate mutable selected-level state.

## Backend Compatibility

The request remains `CreateTaskRequest`. `regionCode` and `regionName` use the deepest selected node; `regionCodes` contains that final code for full-institution mode. `expandLevel` remains `COUNTY` as a legacy compatibility value only because the existing backend contract accepts it; it is no longer user-controlled or used to define the cascade. Targeted mode remains unchanged.

## Files To Change

- `apps/web/src/components/RegionPicker.tsx`
- `apps/web/src/components/TaskForm.tsx`
- `apps/web/src/app.tsx`
- `apps/web/src/app.css`
- `apps/web/src/components/RegionPicker.test.tsx`
- `apps/web/src/app.test.tsx`

## Acceptance Criteria

The three selects cascade and reset descendants correctly, derived level text is accurate, province-only submission is enabled and uses the province code, legacy upload/expand controls are absent, both institution modes remain available, and web tests/typecheck/build pass without backend-related file changes.
