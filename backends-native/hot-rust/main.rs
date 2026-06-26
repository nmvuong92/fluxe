// fluxe hot-path #1 — compute nặng bằng RUST (theo §6d: Rust cho hot path CPU-bound).
// Nằm SAU một biên riêng (không phải Backend CRUD): nhận danh sách text + query,
// trả ranking theo số lần khớp. Std-only (rustc -O main.rs), không cargo deps.
// Chạy: PORT=8083 ./server
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};

fn esc(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

// Đếm số lần `needle` xuất hiện trong `hay` (không chồng lấp), không phân biệt hoa thường.
fn score(hay: &str, needle: &str) -> usize {
    if needle.is_empty() {
        return 0;
    }
    let h = hay.to_lowercase();
    let n = needle.to_lowercase();
    let mut count = 0;
    let mut from = 0;
    while let Some(i) = h[from..].find(&n) {
        count += 1;
        from += i + n.len();
    }
    count
}

fn handle(mut stream: TcpStream) {
    let peer = stream.try_clone().expect("clone");
    let mut reader = BufReader::new(peer);

    let mut request_line = String::new();
    if reader.read_line(&mut request_line).is_err() {
        return;
    }
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let target = parts.next().unwrap_or("").to_string();

    // query string ?q=
    let mut query = String::new();
    if let Some(qpos) = target.find("?q=") {
        let raw = &target[qpos + 3..];
        query = urldecode(raw);
    }

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
    let mut body = vec![0u8; content_length];
    if content_length > 0 {
        let _ = reader.read_exact(&mut body);
    }
    let body = String::from_utf8_lossy(&body).to_string();

    if method == "GET" && target.starts_with("/health") {
        respond(&mut stream, "{\"hot\":\"rust\",\"status\":\"ok\"}");
        return;
    }

    if method == "POST" && target.starts_with("/search") {
        // body = các item, mỗi dòng một item
        let mut hits: Vec<(String, usize)> = body
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| (l.to_string(), score(l, &query)))
            .filter(|(_, s)| *s > 0)
            .collect();
        // rank: score desc, rồi item ngắn hơn trước
        hits.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.len().cmp(&b.0.len())));
        let items: Vec<String> = hits
            .iter()
            .map(|(item, s)| format!("{{\"item\":\"{}\",\"score\":{}}}", esc(item), s))
            .collect();
        respond(&mut stream, &format!("[{}]", items.join(",")));
        return;
    }

    let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
}

fn urldecode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                if let Ok(b) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                    out.push(b);
                    i += 3;
                    continue;
                }
                out.push(bytes[i]);
                i += 1;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            c => {
                out.push(c);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).to_string()
}

fn respond(stream: &mut TcpStream, body: &str) {
    let res = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.as_bytes().len(),
        body
    );
    let _ = stream.write_all(res.as_bytes());
}

fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8083".to_string());
    let listener = TcpListener::bind(format!("0.0.0.0:{}", port)).expect("bind");
    println!("[rust hot-path] search service on :{}", port);
    for stream in listener.incoming() {
        if let Ok(stream) = stream {
            std::thread::spawn(move || handle(stream));
        }
    }
}
