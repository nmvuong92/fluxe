/* Nested layouts — phần thuần: giải chuỗi layout từ cell lên root.
 * Trả về thứ tự INNER→OUTER để render bọc dần (outermost cuối cùng bọc ngoài). */

export interface LayoutMeta {
  id: string;
  parent?: string;
}

export function layoutChain(
  layoutId: string | undefined,
  layouts: Record<string, LayoutMeta>,
): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cur = layoutId;
  while (cur) {
    if (seen.has(cur)) throw new Error(`layout vòng lặp: ${cur}`);
    if (!layouts[cur]) throw new Error(`layout không tồn tại: ${cur}`);
    seen.add(cur);
    chain.push(cur);       // inner trước
    cur = layouts[cur].parent;
  }
  return chain;            // [inner, …, outer]
}
