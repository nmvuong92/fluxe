// fluxe backend #3 — service Go THẬT (HTTP, chỉ dùng stdlib).
// Cùng "hợp đồng" với interface Backend: list / add / toggle todo.
// Chạy: go run . (đọc PORT từ env, mặc định 8081)
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
)

type Todo struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Done  bool   `json:"done"`
}

type Store struct {
	mu    sync.Mutex
	todos []Todo
	seq   int
}

func (s *Store) list() []Todo {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Todo, len(s.todos))
	copy(out, s.todos)
	return out
}

func (s *Store) add(title string) Todo {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.seq++
	t := Todo{ID: "g" + strconv.Itoa(s.seq), Title: "[Go] " + title, Done: false}
	s.todos = append(s.todos, t)
	return t
}

func (s *Store) toggle(id string) []Todo {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.todos {
		if s.todos[i].ID == id {
			s.todos[i].Done = !s.todos[i].Done
		}
	}
	out := make([]Todo, len(s.todos))
	copy(out, s.todos)
	return out
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("content-type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	store := &Store{
		todos: []Todo{
			{ID: "g1", Title: "[Go] Đơn hàng #1001", Done: false},
			{ID: "g2", Title: "[Go] Đơn hàng #1002", Done: true},
		},
		seq: 2,
	}

	mux := http.NewServeMux()

	// GET /todos  → danh sách ; POST /todos {title} → tạo
	mux.HandleFunc("/todos", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			writeJSON(w, store.list())
		case http.MethodPost:
			var body struct {
				Title string `json:"title"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			writeJSON(w, store.add(body.Title))
		default:
			http.Error(w, "method", http.StatusMethodNotAllowed)
		}
	})

	// POST /todos/{id}/toggle → trả danh sách mới
	mux.HandleFunc("/todos/", func(w http.ResponseWriter, r *http.Request) {
		rest := strings.TrimPrefix(r.URL.Path, "/todos/")
		if id, ok := strings.CutSuffix(rest, "/toggle"); ok && r.Method == http.MethodPost {
			writeJSON(w, store.toggle(id))
			return
		}
		http.NotFound(w, r)
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]string{"backend": "go", "status": "ok"})
	})

	log.Printf("[go backend] listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
