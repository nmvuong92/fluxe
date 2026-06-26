package main

import "fmt"

func main() {
	s := NewSupervisor()

	s.Send("room:1", Message{Kind: "join", Text: "alice"})
	s.Send("room:1", Message{Kind: "join", Text: "bob"})
	s.Send("room:2", Message{Kind: "join", Text: "carol"})
	fmt.Println("room:1 members =", s.Query("room:1", "members"), "(want 2)")
	fmt.Println("room:2 members =", s.Query("room:2", "members"), "(want 1 — cô lập)")

	s.Send("room:1", Message{Kind: "crash"}) // let it crash
	s.Send("room:1", Message{Kind: "join", Text: "dave"})
	fmt.Println("room:1 sau crash+restart members =", s.Query("room:1", "members"),
		"(want 1 — actor sống lại, state reset)")
	fmt.Println("→ 1 room = 1 actor (goroutine + mailbox), tuần tự không lock, supervisor tự restart.")
}
