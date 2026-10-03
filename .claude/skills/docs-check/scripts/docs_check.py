"""docs の機械的な点検を行い、Markdown のレポートを標準出力に出す。

リポジトリのルートで実行する:
    python .claude/skills/docs-check/scripts/docs_check.py [--since REF] [--path PATH] [--record]

点検:
  A. 相対リンクの実在とアンカー（GitHub 形式の見出しスラッグ）
  B. 目次: docs/ と各サブフォルダに README.md があり、同じフォルダの .md をすべて載せているか
  C. 画面の網羅: 画面系コンポーネント（*Modal / *Page / *Dialog）が画面仕様のどこにも出てこないか、
     *WindowManager.ts と直下の *.html が docs のどこにも出てこないか
  D. コードへの参照: docs に書かれた `src/...` などのパスと `npm run X` が実在するか
  E. 前回の点検（--since か docs/.docs-check.json）以降に変わったコードと、それに触れている文書
  F. 長い文書（行数の多いもの）の一覧
  G. 参照方向: features から screens、architecture から features・screens へのリンク（逆向き）
  H. 見出し番号: 「## N.」の下の「### M.」の M が N と合わない見出し

ファイルは書き換えない。--record を付けたときだけ docs/.docs-check.json に HEAD を記録する。
"""

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from datetime import date
from pathlib import Path
from urllib.parse import unquote

ROOT = Path.cwd()
STATE = ROOT / "docs" / ".docs-check.json"
LONG_DOC_LINES = 800
CODE_REF_PREFIXES = ("src/", "tests/", "scripts/", "assets/", ".github/", "docs/", ".claude/")
# テンプレートやパターンとして書かれたパスは実在を問わない
PLACEHOLDER = re.compile(r"[*?{}<>]|Xxx|xxx|\[.*\]|path/to/")
# 画面系コンポーネントのうち、画面ではないもの（必要に応じて足す）
SCREEN_IGNORE = set()


def md_files():
    files = list(ROOT.glob("docs/**/*.md")) + list(ROOT.glob(".claude/**/*.md")) + list(ROOT.glob("tests/**/README.md"))
    for extra in ("README.md", "CLAUDE.md", "scripts/README.md", "src/test/manual/README.md", "assets/config-readme.md"):
        if (ROOT / extra).exists():
            files.append(ROOT / extra)
    return sorted({f for f in files if ".temp" not in f.parts and "node_modules" not in f.parts})


def rel(p):
    return p.relative_to(ROOT).as_posix()


def strip_code(text):
    text = re.sub(r"````.*?````", "", text, flags=re.S)
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    return re.sub(r"<!--.*?-->", "", text, flags=re.S)


def slug(heading):
    heading = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", heading).strip().lower().replace("`", "")
    out = []
    for ch in heading:
        cat = unicodedata.category(ch)
        if ch in "-_ " or cat[0] in "LN" or cat == "Mn":
            out.append(ch)
    return "".join(out).replace(" ", "-")


_anchor_cache = {}


def anchors(path):
    if path not in _anchor_cache:
        text = strip_code(path.read_text(encoding="utf-8"))
        seen, res = {}, set()
        for m in re.finditer(r"^#{1,6}\s+(.+?)\s*#*$", text, flags=re.M):
            a = slug(m.group(1))
            n = seen.get(a, 0)
            res.add(a if n == 0 else f"{a}-{n}")
            seen[a] = n + 1
        _anchor_cache[path] = res
    return _anchor_cache[path]


def in_scope(path, scope):
    return scope is None or rel(path).startswith(scope)


def check_links(files, scope):
    problems = []
    for f in files:
        if not in_scope(f, scope):
            continue
        body = strip_code(f.read_text(encoding="utf-8"))
        for m in re.finditer(r"\]\(([^)\s]+)\)", body):
            target = m.group(1)
            if target.startswith(("http://", "https://", "mailto:", "file:")):
                continue
            path, _, frag = target.partition("#")
            dest = f if path == "" else (f.parent / unquote(path))
            if not dest.exists():
                problems.append(f"`{rel(f)}`: リンク先がない `{target}`")
            elif frag and dest.is_file() and dest.suffix == ".md" and unquote(frag).lower() not in anchors(dest):
                problems.append(f"`{rel(f)}`: アンカーが見出しと合わない `{target}`")
    return problems


def check_indexes(scope):
    problems = []
    docs = ROOT / "docs"
    folders = [docs] + sorted(p for p in docs.rglob("*") if p.is_dir())
    for d in folders:
        if not in_scope(d, scope) and not in_scope(d / "x", scope):
            continue
        mds = sorted(p for p in d.glob("*.md") if p.name != "README.md")
        readme = d / "README.md"
        if not readme.exists():
            if mds:
                problems.append(f"`{rel(d)}/`: 目次（README.md）がない")
            continue
        text = readme.read_text(encoding="utf-8")
        linked = {unquote(m.group(1).split("#")[0]).lstrip("./") for m in re.finditer(r"\]\(([^)\s]+)\)", text)}
        for md in mds:
            if md.name not in linked and f"./{md.name}" not in linked:
                problems.append(f"`{rel(readme)}`: 同じフォルダの `{md.name}` が目次に載っていない")
        if d == docs:
            for sub in sorted(p for p in docs.iterdir() if p.is_dir() and (p / "README.md").exists()):
                if not any(l.startswith(sub.name + "/") or l == sub.name for l in linked):
                    problems.append(f"`docs/README.md`: `{sub.name}/` の目次へのリンクがない")
    return problems


def check_screens():
    problems = []
    screen_text = "\n".join(p.read_text(encoding="utf-8") for p in (ROOT / "docs" / "screens").glob("*.md"))
    all_docs = "\n".join(p.read_text(encoding="utf-8") for p in (ROOT / "docs").rglob("*.md"))
    comps = sorted({p.stem for p in (ROOT / "src" / "renderer").rglob("*.tsx")
                    if re.search(r"(Modal|Page|Dialog)$", p.stem) and "test" not in p.name})
    for c in comps:
        if c not in SCREEN_IGNORE and c not in screen_text:
            where = "docs のどこにも" if c not in all_docs else "画面仕様（docs/screens/）に"
            problems.append(f"画面系コンポーネント `{c}` が{where}出てこない")
    for p in sorted((ROOT / "src" / "main").glob("*WindowManager.ts")):
        if p.stem not in all_docs:
            problems.append(f"ウィンドウ `src/main/{p.name}` が docs のどこにも出てこない")
    for p in sorted(ROOT.glob("*.html")):
        if p.name not in all_docs and p.stem not in screen_text:
            problems.append(f"ウィンドウの HTML `{p.name}` が docs のどこにも出てこない")
    return problems


def ignored(path):
    """git の管理外（実行時に作られる一時フォルダなど）なら True。"""
    return subprocess.run(["git", "check-ignore", "-q", path], capture_output=True).returncode == 0


def check_code_refs(files, scope):
    problems = []
    skill_dir = Path(__file__).resolve().parent.parent
    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    scripts = set(pkg.get("scripts", {}))
    for f in files:
        if not in_scope(f, scope) or skill_dir in f.resolve().parents:
            continue  # このスキル自身の手順書は、例や実行時に作るファイルを書いているので対象外
        text = f.read_text(encoding="utf-8")
        for m in re.finditer(r"`([^`\s]+)`", text):
            ref = re.sub(r":\d+(-\d+)?$", "", m.group(1).rstrip(".,:;）)"))  # 行番号は外す
            if ref.startswith(CODE_REF_PREFIXES) and not PLACEHOLDER.search(ref):
                target = ref.split("#")[0]
                if not (ROOT / target).exists() and not ignored(target):
                    problems.append(f"`{rel(f)}`: 書かれたパスが実在しない `{ref}`")
        for m in re.finditer(r"npm run ([A-Za-z0-9:_-]+)", text):
            if m.group(1) not in scripts and len(m.group(1)) > 1:  # 1 文字は例として書いた仮の名前
                problems.append(f"`{rel(f)}`: package.json にない `npm run {m.group(1)}`")
    return sorted(set(problems))


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8").stdout


def changes_since(ref):
    if not ref:
        return None, []
    if not git("rev-parse", "--verify", "--quiet", ref + "^{commit}").strip():
        return f"起点 `{ref}` が見つからない", []
    changed = [l for l in git("diff", "--name-only", f"{ref}..HEAD").splitlines() if l]
    code = [c for c in changed if c.startswith(("src/", ".github/")) or c == "package.json"]
    docs = [p for p in (ROOT / "docs").rglob("*.md")]
    texts = {d: d.read_text(encoding="utf-8") for d in docs}
    hits = []
    for c in code:
        name = Path(c).name
        if ".test." in name or name.endswith(".disabled"):
            continue
        stem = Path(c).stem
        if stem in ("index", "types", "constants", "utils"):
            # どこにでもある名前は、親フォルダつき（例 types/index.ts）で照合する
            name = "/".join(Path(c).parts[-2:])
        # ファイル名（拡張子つき）か、識別子らしい名前（大文字を含む）だけで照合する。main・settings のような短い一般語は拡張子つきでしか当てない
        pats = [re.escape(name)] + ([r"(?<![A-Za-z0-9])" + re.escape(stem) + r"(?![A-Za-z0-9])"] if re.search(r"[A-Z]", stem) else [])
        rx = re.compile("|".join(pats))
        related = [rel(d) for d, t in texts.items() if rx.search(t)]
        hits.append((c, related))
    changed_docs = [c for c in changed if c.startswith("docs/")]
    note = f"起点 `{ref}` から HEAD までに変わったファイル {len(changed)} 件（コード {len(code)} 件、docs {len(changed_docs)} 件）"
    return note, hits


# 参照してはいけない向き（参照元のフォルダ → 参照先のフォルダ）。docs/README.md の「参照方向」に合わせる
REVERSE = {"features": ("screens",), "architecture": ("features", "screens")}


def check_direction(scope):
    problems = []
    docs = ROOT / "docs"
    for f in sorted(docs.rglob("*.md")):
        if not in_scope(f, scope):
            continue
        parts = f.relative_to(docs).parts
        banned = REVERSE.get(parts[0]) if len(parts) > 1 else None
        if not banned:
            continue
        body = strip_code(f.read_text(encoding="utf-8"))
        for m in re.finditer(r"\]\(([^)\s#]+\.md)(#[^)\s]*)?\)", body):
            dest = (f.parent / unquote(m.group(1))).resolve()
            try:
                dparts = dest.relative_to(docs.resolve()).parts
            except ValueError:
                continue
            if len(dparts) > 1 and dparts[0] in banned:
                problems.append(f"`{rel(f)}`: 逆向きの参照 `{m.group(1)}`（{parts[0]} → {dparts[0]}）")
    return problems


def check_heading_numbers(scope):
    problems = []
    for f in sorted((ROOT / "docs").rglob("*.md")):
        if not in_scope(f, scope):
            continue
        chapter, bad = None, []
        for m in re.finditer(r"^(##|###) (\d+)\.(.*)$", strip_code(f.read_text(encoding="utf-8")), flags=re.M):
            if m.group(1) == "##":
                chapter = m.group(2)
            elif chapter and m.group(2) != chapter:
                bad.append(f"## {chapter}. の下の ### {m.group(2)}.{m.group(3)[:20].rstrip()}")
        if bad:
            problems.append(f"`{rel(f)}`: 章番号と合わない小見出し {len(bad)} 件（最初の例: {bad[0]}）")
    return problems


def long_docs():
    out = []
    for p in sorted((ROOT / "docs").rglob("*.md")):
        n = sum(1 for _ in p.open(encoding="utf-8"))
        if n >= LONG_DOC_LINES:
            out.append((rel(p), n))
    return out


def section(title, items, empty="問題なし"):
    print(f"\n## {title}\n")
    if not items:
        print(f"- {empty}")
    for it in items:
        print(f"- {it}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", help="変更を見る起点（タグやコミット）。省略時は docs/.docs-check.json の前回の点検")
    ap.add_argument("--path", help="点検を絞るパス（例: docs/screens/）")
    ap.add_argument("--record", action="store_true", help="docs/.docs-check.json に HEAD を記録する")
    a = ap.parse_args()

    if not (ROOT / "docs").is_dir() or not (ROOT / "package.json").exists():
        sys.exit("リポジトリのルートで実行してください")
    since = a.since
    state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
    if not since:
        since = state.get("last_checked_commit")
    scope = a.path.replace("\\", "/") if a.path else None
    files = md_files()

    head = git("rev-parse", "--short", "HEAD").strip()
    print(f"# docs-check レポート（HEAD {head}{'、対象 ' + scope if scope else ''}）")
    section("A. リンクとアンカー", check_links(files, scope))
    section("B. 目次", check_indexes(scope))
    section("C. 画面の網羅", [] if scope and not scope.startswith("docs/screens") and scope != "docs/" else check_screens())
    section("D. コードへの参照（パス・npm スクリプト）", check_code_refs(files, scope))
    note, hits = changes_since(since)
    print("\n## E. 前回の点検以降に変わったコード\n")
    if note is None:
        print("- 起点がない（初回。--since で指定するか、点検後に --record で記録する）")
    else:
        print(f"- {note}")
        for code, related in hits:
            print(f"- `{code}` → " + ("、".join(f"`{r}`" for r in related) if related else "触れている文書なし"))
    section("F. 長い文書（" + str(LONG_DOC_LINES) + " 行以上）", [f"`{p}`（{n} 行）" for p, n in long_docs()], empty="なし")
    section("G. 参照方向", check_direction(scope))
    section("H. 見出し番号", check_heading_numbers(scope))

    if a.record:
        STATE.write_text(json.dumps({"last_checked_commit": git("rev-parse", "HEAD").strip(), "date": date.today().isoformat()},
                                    ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        print(f"\n（docs/.docs-check.json に HEAD を記録した）")


if __name__ == "__main__":
    main()
