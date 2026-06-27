export interface GreetData {
  greeting: string;
  desc: string;
  locale: string;
}

export function Greet({ data }: { data: GreetData }) {
  return (
    <div className="card">
      <h1>{data.greeting}</h1>
      <p>{data.desc}</p>
      <p className="muted">locale: {data.locale}</p>
    </div>
  );
}

export default Greet;
