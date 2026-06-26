/* fx CLI — registry lệnh thuần (testable). bin/fx.ts dispatch + spawn. */

export interface Command {
  desc: string;
  shell: (args: string[]) => string;
}

const ESBUILD = "esbuild src/client.tsx --bundle --format=esm --outfile=dist/client.js --jsx=automatic --loader:.tsx=tsx";
const p = (a: string[]) => a[0] ?? "dev"; // profile mặc định

export const COMMANDS: Record<string, Command> = {
  resolve: {
    desc: "Sinh .fluxe/resolution.json từ profile",
    shell: (a) => `tsx scripts/resolve.ts ${p(a)}`,
  },
  prerender: {
    desc: "Prerender cell static → .fluxe/static.json",
    shell: (a) => `tsx scripts/prerender.ts ${p(a)}`,
  },
  build: {
    desc: "Build đầy đủ: resolve + prerender + client bundle",
    shell: (a) => `tsx scripts/resolve.ts ${p(a)} && tsx scripts/prerender.ts ${p(a)} && ${ESBUILD}`,
  },
  dev: {
    desc: "Resolve + build client + chạy server",
    shell: (a) => `tsx scripts/resolve.ts ${p(a)} && ${ESBUILD} && tsx src/server.tsx`,
  },
  test: {
    desc: "Chạy unit + integration",
    shell: () => `node --import tsx --test 'src/**/*.test.ts' && tsx src/selftest2.ts`,
  },
};

export function renderUsage(): string {
  const lines = Object.entries(COMMANDS).map(([n, c]) => `  fx ${n.padEnd(10)} ${c.desc}`);
  return `fluxe CLI\n\nLệnh:\n${lines.join("\n")}\n`;
}
