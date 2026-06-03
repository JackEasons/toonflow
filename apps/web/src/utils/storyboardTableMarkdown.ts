const STORYBOARD_TABLE_COLUMNS = [
  "序号",
  "画面描述",
  "场景",
  "关联资产名称",
  "时长",
  "景别",
  "运镜",
  "角色动作",
  "朝向",
  "空间关系",
  "情绪",
  "台词",
  "音效",
  "关联资产ID",
] as const;

const STORYBOARD_TABLE_COLUMN_COUNT = STORYBOARD_TABLE_COLUMNS.length;
const ACTION_COLUMN_INDEX = 7;
const SUFFIX_COLUMN_COUNT = STORYBOARD_TABLE_COLUMN_COUNT - ACTION_COLUMN_INDEX - 1;

function isMarkdownTableRow(line: string) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function splitMarkdownRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function isStoryboardHeaderRow(cells: string[]) {
  const normalized = cells.map((cell) => cell.trim());
  return normalized.includes("序号") && normalized.includes("画面描述") && normalized.includes("关联资产ID");
}

function sanitizeCell(cell: string) {
  return cell
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\|/g, "／")
    .trim();
}

function normalizeDataCells(cells: string[]) {
  const sanitizedCells = cells.map(sanitizeCell);

  if (sanitizedCells.length === STORYBOARD_TABLE_COLUMN_COUNT) return sanitizedCells;

  if (sanitizedCells.length < STORYBOARD_TABLE_COLUMN_COUNT) {
    return [...sanitizedCells, ...Array.from({ length: STORYBOARD_TABLE_COLUMN_COUNT - sanitizedCells.length }, () => "—")];
  }

  const prefix = sanitizedCells.slice(0, ACTION_COLUMN_INDEX);
  const suffix = sanitizedCells.slice(sanitizedCells.length - SUFFIX_COLUMN_COUNT);
  const mergedAction = sanitizedCells.slice(ACTION_COLUMN_INDEX, sanitizedCells.length - SUFFIX_COLUMN_COUNT).join("；");

  return [...prefix, mergedAction, ...suffix];
}

function makeMarkdownRow(cells: readonly string[]) {
  return `| ${cells.map((cell) => sanitizeCell(cell) || "—").join(" | ")} |`;
}

const STORYBOARD_TABLE_HEADER_ROW = makeMarkdownRow(STORYBOARD_TABLE_COLUMNS);
const STORYBOARD_TABLE_SEPARATOR_ROW = makeMarkdownRow(STORYBOARD_TABLE_COLUMNS.map(() => "---"));

export function normalizeStoryboardTableMarkdown(value: string) {
  if (!value.trim()) return value;

  const lines = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const output: string[] = [];
  let isInsideStoryboardTable = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (isMarkdownTableRow(line)) {
      const cells = splitMarkdownRow(line);

      if (isStoryboardHeaderRow(cells)) {
        output.push(STORYBOARD_TABLE_HEADER_ROW, STORYBOARD_TABLE_SEPARATOR_ROW);
        isInsideStoryboardTable = true;
        continue;
      }

      if (isInsideStoryboardTable) {
        if (isSeparatorRow(cells)) continue;
        output.push(makeMarkdownRow(normalizeDataCells(cells)));
        continue;
      }
    }

    if (isInsideStoryboardTable && trimmedLine === "") continue;

    if (isInsideStoryboardTable && trimmedLine !== "") {
      isInsideStoryboardTable = false;
    }

    output.push(line);
  }

  return output.join("\n").trim();
}
