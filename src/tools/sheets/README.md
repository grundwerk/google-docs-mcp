# Sheets

Tools for reading, writing, and managing Google Spreadsheets, including cell data operations, formatting, validation, sheet/tab management, and spreadsheet creation.

## Data

| Tool               | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `readSpreadsheet`  | Reads data from a range in a spreadsheet                 |
| `writeSpreadsheet` | Writes data to a range, overwriting existing values      |
| `appendRows`       | Appends rows to the end of a sheet                       |
| `clearRange`       | Clears all cell values in a range without deleting cells |

## Formatting & Validation

| Tool                          | Description                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `formatCells`                 | Applies formatting (bold, colors, font family, alignment, vertical alignment, wrap strategy) to a range             |
| `setBorders`                  | Sets borders (top/bottom/left/right/inner) on a range with per-side style and color                                 |
| `setColumnWidths`             | Sets the pixel width of one or more columns                                                                         |
| `setRowHeights`               | Sets the pixel height of one or more row ranges (1-based, inclusive)                                                |
| `freezeRowsAndColumns`        | Pins rows and/or columns so they stay visible when scrolling                                                        |
| `setDropdownValidation`       | Adds a dropdown list to cells, restricting input to specified values                                                |
| `addConditionalFormatting`    | Appends a conditional formatting rule (number/blank/custom-formula conditions) to one or more ranges                |
| `listConditionalFormatRules`  | Lists conditional formatting rules per sheet with their 0-based index (use the index to delete a rule)              |
| `deleteConditionalFormatting` | Deletes a single conditional formatting rule by its 0-based index (find the index via `listConditionalFormatRules`) |

## Management

| Tool                 | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `getSpreadsheetInfo` | Gets metadata about a spreadsheet including all sheets |
| `addSheet`           | Adds a new sheet (tab) to an existing spreadsheet      |
| `createSpreadsheet`  | Creates a new spreadsheet                              |
| `listSpreadsheets`   | Lists spreadsheets in your Drive                       |
