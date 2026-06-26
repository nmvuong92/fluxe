/* Test không spawn subprocess: start server trong CÙNG process, gọi qua http localhost, rồi đóng. */
import http from "node:http";

function req(port: number, method: string, path: string, headers: any = {}, body?: any): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const r = http.request({ host: "127.0.0.1", port, path, method,
      headers: { ...headers, ...(data ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {}) } },
      (res) => { let b = ""; res.on("data", c => b += c); res.on("end", () => resolve({ status: res.statusCode!, body: b })); });
    r.on("error", reject); if (data) r.write(data); r.end();
  });
}

async function run(backendEnv: string, label: string, port: number) {
  const { makeServer } = await import("./server_factory.js");
  const srv = makeServer(backendEnv).listen(port);
  await new Promise(r => setTimeout(r, 200));
  try {
    console.log(`\n══════════ BACKEND = ${label} ══════════`);
    const homePage = await req(port, "GET", "/");
    console.log("[static /]      gửi client.js?", homePage.body.includes("/client.js"), "(false=0 JS)  | tên backend hiển thị?", homePage.body.includes(backendEnv === "remote" ? "remote-go" : "memory"));
    const todosPage = await req(port, "GET", "/todos");
    console.log("[island /todos] gửi client.js?", todosPage.body.includes("/client.js"), "(true=hydrate) | SSR sẵn <ul>?", todosPage.body.includes("<ul"));
    const api = JSON.parse((await req(port, "GET", "/todos?json=1")).body);
    console.log("[API ?json=1]   cell:", api.cell, "| số todo:", api.data.todos.length);
    const spa = await req(port, "GET", "/todos", { "x-fluxe": "1" });
    console.log("[SPA x-fluxe]   trả props JSON (không HTML)?", spa.body.startsWith("{"));
    const added = JSON.parse((await req(port, "POST", "/__action/todos/add", {}, { title: "test " + label })).body);
    console.log("[action add]    tạo todo:", JSON.stringify(added.title));
    const after = JSON.parse((await req(port, "GET", "/todos?json=1")).body);
    console.log("[lưu backend]   todo mới có trong list?", after.data.todos.some((t: any) => t.title.includes("test " + label)));
  } finally {
    srv.close();
    await new Promise(r => setTimeout(r, 100));
  }
}

async function main() {
  await run("memory", "memory (TS thuần)", 5190);
  await run("remote", "remote-go (giả lập Go)", 5191);
  console.log("\n→ Đổi backend qua 1 tham số. Cùng cell + frontend, không sửa dòng nào.");
  process.exit(0);
}
main();
