# Tool Inventory

Total: 160+ tools across 11 Google Workspace API domains.

This fork extends the upstream `@a-bonus/google-docs-mcp` with full coverage across Gmail, Drive lifecycle, Sheets power features, Slides, Forms, Tasks, Apps Script, and People (Contacts).

## Domain Breakdown

| Domain      | Tool Count                              | Notes                                                                                                                                                                        |
| ----------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs        | 19 + Comments (6) + Formatting (2) = 27 | Doc CRUD, structure, find/replace, bookmarks, TOC, header/footer, image-from-URL                                                                                             |
| Sheets      | 50                                      | Includes Tables (6), Named Ranges CRUD, Protected Ranges CRUD, sort/findReplace/visibility/merge, Charts, Pivot Tables, borders, row heights, conditional-format list/delete |
| Drive       | 30                                      | File CRUD, permissions full lifecycle (share/list/update/remove), trash, export, convert, star, revisions, watch, about                                                      |
| Gmail       | 20                                      | Send, drafts, forward, search, read, attachments, labels CRUD, mark read/unread, archive, star, trash                                                                        |
| Calendar    | 12                                      | Events CRUD, free/busy, quick-add, move, ACL, Meet links                                                                                                                     |
| Slides      | 8                                       | Create, list, get, add slide, duplicate, replace placeholder text, replace image, export                                                                                     |
| Forms       | 4                                       | Create form, get form, list responses, add question                                                                                                                          |
| Tasks       | 6                                       | Lists CRUD, tasks CRUD, complete                                                                                                                                             |
| People      | 4                                       | List/search/create/update contacts                                                                                                                                           |
| Apps Script | 3                                       | Execute, list projects, get project metadata                                                                                                                                 |
| Utils       | 2                                       | Markdown round-trip                                                                                                                                                          |

## OAuth Scopes Required

`auth.ts` requests the following scopes (re-authorize via `node dist/index.js auth` if upgrading):

| Scope                                            | API Domain                 |
| ------------------------------------------------ | -------------------------- |
| `documents`                                      | Docs                       |
| `drive`                                          | Drive                      |
| `spreadsheets`                                   | Sheets                     |
| `script.external_request`                        | Apps Script (execute only) |
| `calendar.readonly` + `calendar.events`          | Calendar                   |
| `gmail.readonly` + `gmail.modify` + `gmail.send` | Gmail                      |
| `presentations`                                  | Slides                     |
| `forms.body` + `forms.responses.readonly`        | Forms                      |
| `tasks`                                          | Tasks                      |
| `contacts`                                       | People                     |

## Notes & Limitations

- **Apps Script CRUD** is limited to project listing + execute. Full project content read/write requires the `script.projects` scope which is intentionally NOT in the default scope list (reduces consent friction). Add it if needed.
- **TOC insertion** uses a placeholder workaround — the Docs API doesn't expose a direct `addTableOfContents` request. Open in the editor and use Insert → Table of contents to populate.
- **createPivotTable** covers the common case (group by N rows, aggregate). Complex multi-axis pivots may need manual `updateCells` with a hand-crafted `pivotTable` definition via `batchWrite`.
- **Sheets formatting** got richer: `formatCells` now also supports `fontFamily`, `verticalAlignment` and `wrapStrategy` (WRAP/CLIP/OVERFLOW_CELL); `setBorders` applies per-side borders; `setRowHeights` mirrors `setColumnWidths` for rows. To edit conditional formatting, run `listConditionalFormatRules` to find a rule's 0-based index, then `deleteConditionalFormatting` with that index (re-list between deletes, since indices shift).
- **scheduleEmail** intentionally not implemented — Gmail API does not support server-side scheduling. Use `createDraft` + a separate cron/reminder.
- **watchFile** requires the webhook domain to be verified in Google Cloud Console (Drive push notifications).
- **supportsAllDrives** is set on every Drive tool that accepts the flag. Tools targeting Revisions/About/EmptyTrash APIs don't accept it (and don't need it for Shared Drive support — those APIs are inherently scoped).

## Versioning

This fork builds atop upstream `@a-bonus/google-docs-mcp@1.2.0`. All additions are tracked in commits on the `main` branch of `tososchill/google-docs-mcp`.
