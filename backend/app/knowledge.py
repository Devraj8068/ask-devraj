"""Loads the Markdown knowledge base and splits it into one chunk per `##` section."""

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Chunk:
    id: str
    doc: str  # document title, e.g. "Skills"
    section: str  # section heading, e.g. "Cloud and AI services"
    text: str
    url: str  # anchor on the portfolio site

    @property
    def title(self) -> str:
        return f"{self.doc} › {self.section}"

    def as_context(self) -> str:
        return f"{self.title}\n{self.text}"


def load_chunks(knowledge_dir: Path) -> list[Chunk]:
    chunks: list[Chunk] = []
    for path in sorted(knowledge_dir.glob("*.md")):
        doc, url, section, buf = path.stem, "#", None, []

        def flush() -> None:
            if section and buf:
                text = " ".join(line.strip() for line in buf if line.strip())
                chunks.append(Chunk(f"{path.stem}#{len(chunks)}", doc, section, text, url))

        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("# "):
                doc = line[2:].strip()
            elif line.startswith("url:"):
                url = line[4:].strip()
            elif line.startswith("## "):
                flush()
                section, buf = line[3:].strip(), []
            else:
                buf.append(line)
        flush()
    if not chunks:
        raise RuntimeError(f"No knowledge chunks found in {knowledge_dir}")
    return chunks
