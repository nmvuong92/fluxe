// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
export interface GreetData { hello: string; desc: string }
export function Greet({ data }: { data: GreetData }) {
  return (<div className="card"><h1>{data.hello}</h1><p className="muted">{data.desc}</p></div>);
}
export default Greet;
