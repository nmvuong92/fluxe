// fluxe backend — service .NET THẬT (minimal API, ASP.NET Core).
// Cùng "hợp đồng" với interface Backend: list / add / toggle todo.
// Chạy: PORT=8085 dotnet run --project app/native/dotnet
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var todos = new List<Todo>();
var seq = 0;
var gate = new object();

app.MapGet("/todos", () => todos);

app.MapPost("/todos", (TitleInput input) =>
{
    lock (gate)
    {
        seq++;
        var t = new Todo($"net{seq}", $"[.NET] {input.title}", false);
        todos.Add(t);
        return Results.Json(t);
    }
});

app.MapPost("/todos/{id}/toggle", (string id) =>
{
    lock (gate)
    {
        for (var i = 0; i < todos.Count; i++)
            if (todos[i].id == id) todos[i] = todos[i] with { done = !todos[i].done };
        return Results.Json(todos);
    }
});

var port = Environment.GetEnvironmentVariable("PORT") ?? "8085";
Console.WriteLine($"[dotnet backend] listening on :{port}");
app.Run($"http://127.0.0.1:{port}");

record Todo(string id, string title, bool done);
record TitleInput(string title);
