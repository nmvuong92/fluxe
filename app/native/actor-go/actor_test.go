package main

import (
	"sync"
	"testing"
	"time"
)

// Mỗi room là một actor độc lập — state KHÔNG lẫn nhau.
func TestIsolation(t *testing.T) {
	s := NewSupervisor()
	s.Send("a", Message{Kind: "join", Text: "alice"})
	s.Send("a", Message{Kind: "join", Text: "bob"})
	s.Send("b", Message{Kind: "join", Text: "carol"})
	if got := s.Query("a", "members"); got != 2 {
		t.Fatalf("room a members = %d, want 2", got)
	}
	if got := s.Query("b", "members"); got != 1 {
		t.Fatalf("room b members = %d, want 1 (phải cô lập)", got)
	}
}

// 1000 message đồng thời tới CÙNG actor → xử lý tuần tự → count chính xác 1000.
// Nếu có data race / mất update thì go test -race + con số sẽ phát hiện.
func TestSerialNoRace(t *testing.T) {
	s := NewSupervisor()
	var wg sync.WaitGroup
	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); s.Send("x", Message{Kind: "inc"}) }()
	}
	wg.Wait()
	if got := s.Query("x", "count"); got != 1000 {
		t.Fatalf("count = %d, want 1000 (mất update = race)", got)
	}
}

// Actor panic → supervisor restart → actor vẫn sống & xử lý tiếp (state reset).
func TestSupervisionRestart(t *testing.T) {
	s := NewSupervisor()
	s.Send("c", Message{Kind: "join", Text: "x"})
	s.Send("c", Message{Kind: "crash"}) // actor panic
	time.Sleep(50 * time.Millisecond)   // chờ supervisor restart
	s.Send("c", Message{Kind: "join", Text: "y"})
	if got := s.Query("c", "members"); got != 1 {
		t.Fatalf("sau crash+restart members = %d, want 1 (actor phải sống lại, state reset)", got)
	}
}
