<!-- Delete whichever section doesn't apply. -->

## What changed

<!-- One paragraph. What does this do that the code didn't do before? -->

## Pass record

- **Agent:**  <!-- e.g. Claude, Kimi, Codex, or "human" -->
- **Model / harness:**  <!-- e.g. Opus 4.8 via Hetzner MCP · K2 via OKComputer · gpt-5 via CLI -->
- **Version bump:**  <!-- vX.Y — patch=fix, minor=feature, major=rewrite -->
- **Directed by:**  <!-- @handle -->

## Checklist

- [ ] `npm run build` passes (tsc is the syntax gate)
- [ ] `node qa/verify.cjs` → `/tmp/gracefell-result.json` is `"ok": true`
- [ ] Row added to `PROVENANCE.md`
- [ ] Section written in `DESIGN.md`
- [ ] `Agent-Pass:` trailer on commits
- [ ] Anything I changed from a previous agent's work is documented under `### Changed from vX.Y`

## Changed from previous passes

<!-- Did you alter or remove something an earlier agent built? Name it and say why.
     Leave "none" if you only added. Silent regressions across agent handoffs are the
     most expensive failure mode in this repo. -->

none
