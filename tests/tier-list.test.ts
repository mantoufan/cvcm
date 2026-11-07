import { describe, expect, it } from "vitest";
import { MAX_ITEMS, MAX_TIERS, addItems, addTier, applyLabels, boardText, clearPlacements, emptyBoard, itemCount, moveItem, moveTier, parseBoard, parseItems, placeOf, pngLayout, removeItem, removeTier, serializeBoard, textOn, wrapText, type Board } from "../src/shared/tier-list";

function sample(): { board: Board; ids: string[] } {
  const board = emptyBoard(["S", "A", "B"]);
  addItems(board, ["one", "two", "three"].map((text) => ({ text })));
  return { board, ids: [...board.pool] };
}

describe("parseItems", () => {
  it("takes one item a line, trims, drops blanks and repeats", () => {
    expect(parseItems(" a \n\nb\r\na\nc", ["c"])).toEqual(["a", "b"]);
  });
});

describe("moveItem", () => {
  it("moves between lists and appends by default", () => {
    const { board, ids } = sample();
    moveItem(board, ids[0], board.tiers[0].id);
    moveItem(board, ids[1], board.tiers[0].id);
    expect(board.tiers[0].items).toEqual([ids[0], ids[1]]);
    expect(board.pool).toEqual([ids[2]]);
    expect(placeOf(board, ids[1])).toEqual({ tier: board.tiers[0].id, index: 1 });
  });

  it("reads the index as the list looks with the item still in it", () => {
    const { board, ids } = sample();
    moveItem(board, ids[0], null, 2);
    expect(board.pool).toEqual([ids[1], ids[0], ids[2]]);
    moveItem(board, ids[2], null, 0);
    expect(board.pool).toEqual([ids[2], ids[1], ids[0]]);
    moveItem(board, ids[2], null, 1);
    expect(board.pool).toEqual([ids[2], ids[1], ids[0]]);
  });

  it("refuses an unknown item or row", () => {
    const { board, ids } = sample();
    expect(moveItem(board, "nope", null)).toBe(false);
    expect(moveItem(board, ids[0], "nope")).toBe(false);
    expect(board.pool).toHaveLength(3);
  });
});

describe("rows", () => {
  it("returns a removed row's items to the pool and keeps at least one row", () => {
    const { board, ids } = sample();
    moveItem(board, ids[0], board.tiers[1].id);
    removeTier(board, board.tiers[1].id);
    expect(board.tiers.map((tier) => tier.label)).toEqual(["S", "B"]);
    expect(board.pool).toContain(ids[0]);
    removeTier(board, board.tiers[0].id);
    expect(removeTier(board, board.tiers[0].id)).toBe(false);
  });

  it("stops adding at the limit", () => {
    const board = emptyBoard(["S"]);
    for (let i = 1; i < MAX_TIERS; i += 1) expect(addTier(board, "x")).not.toBeNull();
    expect(addTier(board, "x")).toBeNull();
  });

  it("moves within bounds", () => {
    const { board } = sample();
    expect(moveTier(board, board.tiers[0].id, -1)).toBe(false);
    moveTier(board, board.tiers[0].id, 1);
    expect(board.tiers.map((tier) => tier.label)).toEqual(["A", "S", "B"]);
  });

  it("applies a preset keeping placed items, shedding extra rows to the pool", () => {
    const { board, ids } = sample();
    moveItem(board, ids[0], board.tiers[0].id);
    moveItem(board, ids[1], board.tiers[2].id);
    applyLabels(board, ["夯", "拉"]);
    expect(board.tiers.map((tier) => tier.label)).toEqual(["夯", "拉"]);
    expect(board.tiers[0].items).toEqual([ids[0]]);
    expect(board.pool).toContain(ids[1]);
    applyLabels(board, ["1", "2", "3", "4", "5"]);
    expect(board.tiers).toHaveLength(5);
  });

  it("clears every row into the pool", () => {
    const { board, ids } = sample();
    moveItem(board, ids[0], board.tiers[0].id);
    clearPlacements(board);
    expect(board.tiers[0].items).toEqual([]);
    expect(board.pool).toHaveLength(3);
  });
});

describe("items", () => {
  it("caps the board and reports how many fitted", () => {
    const board = emptyBoard(["S"]);
    expect(addItems(board, Array.from({ length: MAX_ITEMS + 5 }, (_, i) => ({ text: String(i) })))).toBe(MAX_ITEMS);
    expect(itemCount(board)).toBe(MAX_ITEMS);
  });

  it("removes from wherever it sits", () => {
    const { board, ids } = sample();
    moveItem(board, ids[0], board.tiers[0].id);
    expect(removeItem(board, ids[0])?.text).toBe("one");
    expect(board.tiers[0].items).toEqual([]);
    expect(removeItem(board, ids[0])).toBeNull();
  });
});

describe("text and storage", () => {
  it("writes the ranking as text, naming unnamed pictures", () => {
    const board = emptyBoard(["S", "A"]);
    board.title = " Snacks ";
    addItems(board, [{ text: "chips" }, { text: "", image: "blob:x" }]);
    const [a, b] = board.pool;
    moveItem(board, a, board.tiers[0].id);
    moveItem(board, b, board.tiers[0].id);
    expect(boardText(board, "Picture")).toBe("Snacks\nS: chips, Picture\nA:");
  });

  it("round-trips text and never stores pictures", () => {
    const board = emptyBoard(["S", "A"]);
    board.title = "T";
    addItems(board, [{ text: "keep" }, { text: "pic", image: "blob:secret" }]);
    moveItem(board, board.pool[0], board.tiers[1].id);
    board.tiers[1].color = "#123456";
    const raw = serializeBoard(board);
    expect(raw).not.toContain("blob:");
    expect(raw).not.toContain("pic");
    const back = parseBoard(raw)!;
    expect(back.title).toBe("T");
    expect(back.tiers[1].color).toBe("#123456");
    expect(back.tiers[1].items.map((id) => back.items[id].text)).toEqual(["keep"]);
    expect(back.pool).toEqual([]);
  });

  it("rejects bad or foreign data", () => {
    for (const raw of [null, "", "not json", "{}", '{"v":2,"tiers":[{}],"pool":[]}', '{"v":1,"tiers":[],"pool":[]}']) expect(parseBoard(raw)).toBeNull();
    const board = parseBoard('{"v":1,"tiers":[{"label":"S","color":"url(x)","items":[1,"ok",""]}],"pool":[]}')!;
    expect(board.tiers[0].color).not.toContain("url");
    expect(board.tiers[0].items.map((id) => board.items[id].text)).toEqual(["ok"]);
  });
});

describe("png layout", () => {
  it("wraps cells and grows the row without overlap", () => {
    const board = emptyBoard(["S", "A"]);
    addItems(board, Array.from({ length: 20 }, (_, i) => ({ text: String(i) })));
    for (const id of [...board.pool]) moveItem(board, id, board.tiers[0].id);
    const layout = pngLayout(board);
    const [first, second] = layout.rows;
    expect(first.height).toBeGreaterThan(second.height);
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    expect(Math.max(...first.cells.map((cell) => cell.x + 96))).toBeLessThanOrEqual(layout.width);
    expect(layout.height).toBe(second.y + second.height);
  });

  it("makes room for a title only when there is one", () => {
    const board = emptyBoard(["S"]);
    expect(pngLayout(board).titleHeight).toBe(0);
    board.title = "x";
    expect(pngLayout(board).rows[0].y).toBeGreaterThan(0);
  });
});

describe("wrapText", () => {
  const fits = (limit: number) => (line: string) => Array.from(line).length <= limit;
  it("breaks at spaces, and inside words with no spaces", () => {
    expect(wrapText("hello big world", fits(9), 3)).toEqual(["hello big", "world"]);
    expect(wrapText("超长的中文内容", fits(3), 4)).toEqual(["超长的", "中文内", "容"]);
  });
  it("ends with an ellipsis when it runs out of lines", () => {
    const lines = wrapText("超长的中文内容还有更多文字", fits(3), 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(Array.from(lines[1]).length).toBeLessThanOrEqual(3);
  });
});

describe("textOn", () => {
  it("picks readable text", () => {
    expect(textOn("#ffffff")).toBe("#1a1a1a");
    expect(textOn("#102040")).toBe("#ffffff");
  });
});
