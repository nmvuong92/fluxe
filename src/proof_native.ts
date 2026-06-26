/* PROOF: cùng interface Backend → chạy y hệt trên memory (TS), Go, Rust.
 * Không import react/npm → chạy được bằng `node src/proof_native.ts` (Node ≥ 23).
 * Yêu cầu: service Go đang chạy ở GO_URL, Rust ở RUST_URL (xem run-native.sh). */
import type { Backend } from "./backends/types.ts";
import { createMemoryBackend } from "./backends/memory.ts";
import { createHttpBackend } from "./backends/http.ts";

// Logic NGHIỆP VỤ chỉ phụ thuộc interface Backend — không biết đằng sau là gì.
async function exercise(backend: Backend) {
  console.log(`\n══════════ Backend = ${backend.name} ══════════`);
  const before = await backend.listTodos();
  console.log(`  list()    → ${before.length} todo:`, before.map((t) => t.title).join(" | "));

  const created = await backend.addTodo("Việc test từ cùng một frontend");
  console.log(`  add()     → tạo:`, JSON.stringify(created.title), `(id=${created.id})`);

  const afterAdd = await backend.listTodos();
  const has = afterAdd.some((t) => t.id === created.id);
  console.log(`  persist?  → todo mới có trong list:`, has, `(giờ ${afterAdd.length} todo)`);

  const target = before[0];
  const toggled = await backend.toggleTodo(target.id);
  const now = toggled.find((t) => t.id === target.id)!;
  console.log(`  toggle()  → "${target.title}" done: ${target.done} → ${now.done}`);

  return has && now.done !== target.done;
}

async function main() {
  const targets: Backend[] = [
    createMemoryBackend(),
    createHttpBackend("go", process.env.GO_URL ?? "http://127.0.0.1:8081"),
    createHttpBackend("rust", process.env.RUST_URL ?? "http://127.0.0.1:8082"),
  ];

  let allOk = true;
  for (const b of targets) {
    try {
      const ok = await exercise(b);
      allOk &&= ok;
    } catch (e) {
      allOk = false;
      console.log(`  ✗ LỖI với backend ${b.name}:`, (e as Error).message);
    }
  }

  console.log(
    "\n→ Cùng một hàm exercise() chạy qua interface Backend trên 3 service" +
      " (TS in-memory, Go HTTP, Rust HTTP). Frontend/cell KHÔNG đổi dòng nào."
  );
  console.log(allOk ? "✓ TẤT CẢ PASS" : "✗ CÓ BACKEND FAIL");
  process.exit(allOk ? 0 : 1);
}
main();
