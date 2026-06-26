// PoC tầng realtime theo mô hình BEAM/OTP, dựng bằng Go (quyết định: Go-actors mặc
// định, không lấy BEAM làm core). Mỗi "room" = 1 actor = 1 goroutine giữ state LOCAL
// (share-nothing), xử lý message TUẦN TỰ qua mailbox (channel) → không lock, không race.
// Supervisor route message + "let it crash": actor panic → restart trên cùng mailbox.
package main

import (
	"log"
	"sync"
)

type Message struct {
	Kind  string
	Text  string
	Reply chan int // dùng cho query (members/count)
}

type Supervisor struct {
	mu    sync.Mutex
	rooms map[string]chan Message
}

func NewSupervisor() *Supervisor {
	return &Supervisor{rooms: map[string]chan Message{}}
}

// Send: định tuyến tới actor của room (spawn nếu chưa có). An toàn gọi đồng thời.
func (s *Supervisor) Send(room string, msg Message) {
	s.mu.Lock()
	ch, ok := s.rooms[room]
	if !ok {
		ch = make(chan Message, 256)
		s.rooms[room] = ch
		go s.run(room, ch)
	}
	s.mu.Unlock()
	ch <- msg // mailbox (có buffer → backpressure khi đầy)
}

// Query: gửi message có Reply rồi chờ kết quả.
func (s *Supervisor) Query(room, kind string) int {
	reply := make(chan int, 1)
	s.Send(room, Message{Kind: kind, Reply: reply})
	return <-reply
}

// run = vòng đời 1 actor. State (members,count) là biến LOCAL của goroutine → không
// chia sẻ → không cần lock. Panic → supervisor recover & restart trên CÙNG mailbox
// (message giữ lại, state reset) — đúng tinh thần "let it crash".
func (s *Supervisor) run(room string, ch chan Message) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[supervisor] room %q crashed: %v → restart", room, r)
			go s.run(room, ch)
		}
	}()
	members := map[string]bool{}
	count := 0
	for msg := range ch {
		switch msg.Kind {
		case "join":
			members[msg.Text] = true
		case "inc":
			count++
		case "crash":
			panic("lỗi cố ý trong actor")
		case "members":
			msg.Reply <- len(members)
		case "count":
			msg.Reply <- count
		}
	}
}
