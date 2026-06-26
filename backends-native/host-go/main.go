// fluxe Go host — tầng EDGE (theo idea.md §6d: Go làm host, Node là SSR worker).
// Go KHÔNG render React → phục vụ endpoint manifest-native (data thuần) bằng Go,
// và reverse-proxy phần cần JS (cell SSR + API + action) xuống Node tier.
// Chạy: PORT=8090 FLUXE_UPSTREAM=http://127.0.0.1:5180 go run .
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
)

type Manifest struct {
	Profile string `json:"profile"`
	Backend struct {
		Language  string `json:"language"`
		Transport string `json:"transport"`
	} `json:"backend"`
	Cells map[string]struct {
		ID    string `json:"id"`
		Route string `json:"route"`
	} `json:"cells"`
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func main() {
	port := getenv("PORT", "8090")
	upstream := getenv("FLUXE_UPSTREAM", "http://127.0.0.1:5180")
	manifestPath := getenv("FLUXE_MANIFEST", ".fluxe/resolution.json")

	data, err := os.ReadFile(manifestPath)
	if err != nil {
		log.Fatalf("read manifest: %v", err)
	}
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		log.Fatalf("parse manifest: %v", err)
	}

	up, err := url.Parse(upstream)
	if err != nil {
		log.Fatalf("upstream url: %v", err)
	}
	proxy := httputil.NewSingleHostReverseProxy(up)

	// Route tĩnh (bỏ [param]) cho sitemap — đọc từ manifest.
	var staticRoutes []string
	for _, c := range m.Cells {
		if !strings.Contains(c.Route, "[") {
			staticRoutes = append(staticRoutes, c.Route)
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Fluxe-Host", "go") // chứng minh Go đứng trước mọi request
		base := "http://" + r.Host
		switch r.URL.Path {
		case "/healthz":
			w.Header().Set("content-type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"host": "go", "profile": m.Profile, "backend": m.Backend.Language, "upstream": upstream,
			})
		case "/sitemap.xml":
			w.Header().Set("content-type", "application/xml; charset=utf-8")
			fmt.Fprint(w, sitemap(staticRoutes, base))
		case "/robots.txt":
			w.Header().Set("content-type", "text/plain; charset=utf-8")
			fmt.Fprintf(w, "User-agent: *\nAllow: /\nSitemap: %s/sitemap.xml\n", base)
		default:
			// Cell page (SSR React) / API / action / client.js / _fluxe → Node SSR worker.
			proxy.ServeHTTP(w, r)
		}
	})

	log.Printf("[go host] :%s → upstream %s (profile=%s, backend=%s)", port, upstream, m.Profile, m.Backend.Language)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}

func sitemap(routes []string, base string) string {
	var b strings.Builder
	b.WriteString("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n")
	for _, r := range routes {
		fmt.Fprintf(&b, "  <url><loc>%s%s</loc></url>\n", base, r)
	}
	b.WriteString("</urlset>\n")
	return b.String()
}
