export interface HomeData { title: string; backend: string; static: string; cta: string }

export function Home({ data }: { data: HomeData }) {
  return (
    <div className="card">
      <h1>{data.title}</h1>
      <p className="muted">{data.backend}</p>
      <p>{data.static}</p>
      <a href="/todos" className="btn">{data.cta}</a>
    </div>
  );
}

export default Home;
