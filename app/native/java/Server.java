// fluxe backend — service Java THẬT (chỉ JDK, không Maven/Gradle).
// Cùng "hợp đồng" với interface Backend: list / add / toggle todo.
// Chạy (Java 11+): PORT=8086 java app/native/java/Server.java
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class Server {
    static final List<Map<String, Object>> todos = new ArrayList<>();
    static int seq = 0;

    static synchronized Map<String, Object> add(String title) {
        seq++;
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("id", "jv" + seq);
        t.put("title", "[Java] " + title);
        t.put("done", false);
        todos.add(t);
        return t;
    }

    static synchronized List<Map<String, Object>> toggle(String id) {
        for (Map<String, Object> t : todos)
            if (id.equals(t.get("id"))) t.put("done", !(Boolean) t.get("done"));
        return todos;
    }

    // JSON tối giản (đủ cho hợp đồng Todo)
    @SuppressWarnings("unchecked")
    static String json(Object o) {
        if (o instanceof Map) {
            StringBuilder b = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<String, Object> e : ((Map<String, Object>) o).entrySet()) {
                if (!first) b.append(",");
                b.append(json(e.getKey())).append(":").append(json(e.getValue()));
                first = false;
            }
            return b.append("}").toString();
        }
        if (o instanceof List) {
            StringBuilder b = new StringBuilder("[");
            boolean first = true;
            for (Object x : (List<Object>) o) {
                if (!first) b.append(",");
                b.append(json(x));
                first = false;
            }
            return b.append("]").toString();
        }
        if (o instanceof Boolean || o instanceof Number) return o.toString();
        return "\"" + o.toString().replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    // Trích field "title" từ body JSON một cách tối giản.
    static String field(String body, String key) {
        int i = body.indexOf("\"" + key + "\"");
        if (i < 0) return "";
        int c = body.indexOf(":", i), q1 = body.indexOf("\"", c + 1);
        int q2 = q1 < 0 ? -1 : body.indexOf("\"", q1 + 1);
        return (q1 < 0 || q2 < 0) ? "" : body.substring(q1 + 1, q2);
    }

    static void send(HttpExchange ex, int code, String body) throws IOException {
        byte[] b = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json");
        ex.sendResponseHeaders(code, b.length);
        ex.getResponseBody().write(b);
        ex.close();
    }

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8086"));
        HttpServer s = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        s.createContext("/todos", ex -> {
            String path = ex.getRequestURI().getPath(), method = ex.getRequestMethod();
            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            if (method.equals("GET") && path.equals("/todos")) send(ex, 200, json(todos));
            else if (method.equals("POST") && path.equals("/todos")) send(ex, 200, json(add(field(body, "title"))));
            else if (method.equals("POST") && path.endsWith("/toggle")) {
                String id = path.substring("/todos/".length(), path.length() - "/toggle".length());
                send(ex, 200, json(toggle(id)));
            } else send(ex, 404, "{\"error\":\"not found\"}");
        });
        s.start();
        System.out.println("[java backend] listening on :" + port);
    }
}
