// fluxe backend #4 — service Rust THẬT (HTTP, chỉ dùng std, không cargo deps).
// Cùng "hợp đồng" với interface Backend: list / add / toggle todo.
// Chạy: rustc -O main.rs -o server && PORT=8082 ./server
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
struct Todo {
    id: String,
    title: String,
    done: bool,
}

struct Store {
    todos: Vec<Todo>,
    seq: u32,
}

impl Store {
    fn list(&self) -> Vec<Todo> {
        self.todos.clone()
    }
    fn add(&mut self, title: &str) -> Todo {
        self.seq += 1;
        let t = Todo {
            id: format!("rs{}", self.seq),
            title: format!("[Rust] {}", title),
            done: false,
        };
        self.todos.push(t.clone());
        t
    }
    fn toggle(&mut self, id: &str) -> Vec<Todo> {
        for t in self.todos.iter_mut() {
            if t.id == id {
                t.done = !t.done;
            }
        }
        self.todos.clone()
    }
}

// --- JSON tối giản (đủ cho hợp đồng Todo) ---
fn esc(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}
fn todo_json(t: &Todo) -> String {
    format!(
        "{{\"id\":\"{}\",\"title\":\"{}\",\"done\":{}}}",
        esc(&t.id),
        esc(&t.title),
        t.done
    )
}
fn list_json(ts: &[Todo]) -> String {
    let items: Vec<String> = ts.iter().map(todo_json).collect();
    format!("[{}]", items.join(","))
}
// Trích field "title" từ body JSON một cách tối giản.
fn extract_title(body: &str) -> String {
    let key = "\"title\"";
    if let Some(k) = body.find(key) {
        let after = &body[k + key.len()..];
        if let Some(q1) = after.find('"') {
            let rest = &after[q1 + 1..];
            let mut out = String::new();
            let mut chars = rest.chars();
            while let Some(c) = chars.next() {
                match c {
                    '\\' => {
                        if let Some(n) = chars.next() {
                            out.push(n);
                        }
                    }
                    '"' => break,
                    _ => out.push(c),
                }
            }
            return out;
        }
    }
    String::new()
}

fn respond(stream: &mut TcpStream, body: &str) {
    let res = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.as_bytes().len(),
        body
    );
    let _ = stream.write_all(res.as_bytes());
}
fn respond_404(stream: &mut TcpStream) {
    let _ = stream.write_all(
        b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
    );
}

fn handle(mut stream: TcpStream, store: Arc<Mutex<Store>>) {
    let peer = stream.try_clone().expect("clone");
    let mut reader = BufReader::new(peer);

    // Dòng request: "METHOD PATH HTTP/1.1"
    let mut request_line = String::new();
    if reader.read_line(&mut request_line).is_err() {
        return;
    }
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let path = parts.next().unwrap_or("").to_string();

    // Đọc headers, lấy Content-Length
    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).is_err() {
            break;
        }
        if line == "\r\n" || line.is_empty() {
            break;
        }
        let lower = line.to_ascii_lowercase();
        if let Some(v) = lower.strip_prefix("content-length:") {
            content_length = v.trim().parse().unwrap_or(0);
        }
    }
    // Đọc body
    let mut body = vec![0u8; content_length];
    if content_length > 0 {
        let _ = reader.read_exact(&mut body);
    }
    let body = String::from_utf8_lossy(&body).to_string();

    // Định tuyến — cùng hợp đồng với Go/memory
    if method == "GET" && path == "/todos" {
        let s = store.lock().unwrap();
        respond(&mut stream, &list_json(&s.list()));
    } else if method == "POST" && path == "/todos" {
        let title = extract_title(&body);
        let mut s = store.lock().unwrap();
        respond(&mut stream, &todo_json(&s.add(&title)));
    } else if method == "POST" && path.starts_with("/todos/") && path.ends_with("/toggle") {
        let id = &path["/todos/".len()..path.len() - "/toggle".len()];
        let mut s = store.lock().unwrap();
        respond(&mut stream, &list_json(&s.toggle(id)));
    } else if method == "GET" && path == "/health" {
        respond(&mut stream, "{\"backend\":\"rust\",\"status\":\"ok\"}");
    } else {
        respond_404(&mut stream);
    }
}

fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8082".to_string());
    let store = Arc::new(Mutex::new(Store {
        todos: vec![
            Todo { id: "rs1".into(), title: "[Rust] Đơn hàng #2001".into(), done: false },
            Todo { id: "rs2".into(), title: "[Rust] Đơn hàng #2002".into(), done: true },
        ],
        seq: 2,
    }));

    let listener = TcpListener::bind(format!("0.0.0.0:{}", port)).expect("bind");
    println!("[rust backend] listening on :{}", port);
    for stream in listener.incoming() {
        if let Ok(stream) = stream {
            let store = Arc::clone(&store);
            std::thread::spawn(move || handle(stream, store));
        }
    }
}
