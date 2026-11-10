"use client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ZERO_USAGE, addUsage } from "@/lib/studio/api";
import { fmtInt } from "@wxy/massing";
import { useStudio } from "@/lib/store/studio";

export function DevDrawer() {
  const runs = useStudio((s) => s.usageRuns);
  const ai = useStudio((s) => s.aiStatus);
  const total = runs.filter((r) => r.counted).reduce((a, r) => addUsage(a, r.usage), ZERO_USAGE);
  return (
    <section id="dev-drawer" aria-label="Usage" className="max-h-56 overflow-y-auto border-t border-rule bg-sheet px-4 py-2">
      <p className="py-1" data-testid="ai-connection">
        <span className="font-medium">Connection: </span>
        {ai === null
          ? "AI status not checked yet."
          : ai.ai
            ? "AI is connected."
            : "AI is off. No Anthropic API key on the server. Add ANTHROPIC_API_KEY to .env.local and restart; built-in strategies are used until then."}
      </p>
      <p className="text-ink-3">Token and cost totals as reported by the server for the last runs (per-option rows are already inside the run total). Not used in any metric.</p>
      {runs.length === 0 ? (
        <p className="py-2">No AI runs yet.</p>
      ) : (
        <Table className="num text-xs">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="h-7">Run</TableHead>
              <TableHead scope="col" className="h-7 text-right">Tokens in</TableHead>
              <TableHead scope="col" className="h-7 text-right">out</TableHead>
              <TableHead scope="col" className="h-7 text-right">Cache read</TableHead>
              <TableHead scope="col" className="h-7 text-right">Cache write</TableHead>
              <TableHead scope="col" className="h-7 text-right">Cost</TableHead>
              <TableHead scope="col" className="h-7 text-right">Latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...runs.map((r) => ({ label: r.label, u: r.usage })), { label: "Total", u: total }].map((r, i) => (
              <TableRow key={i} className={r.label === "Total" ? "font-medium" : ""}>
                <TableHead scope="row" className="h-auto py-1 font-normal">{r.label}</TableHead>
                <TableCell className="py-1 text-right">{fmtInt(r.u.input)}</TableCell>
                <TableCell className="py-1 text-right">{fmtInt(r.u.output)}</TableCell>
                <TableCell className="py-1 text-right">{fmtInt(r.u.cacheRead)}</TableCell>
                <TableCell className="py-1 text-right">{fmtInt(r.u.cacheWrite)}</TableCell>
                <TableCell className="py-1 text-right">${r.u.usd.toFixed(4)}</TableCell>
                <TableCell className="py-1 text-right">{r.u.ms ? `${fmtInt(r.u.ms)} ms` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
