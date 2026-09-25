"""Turn a plain-text email body (with blank-line paragraphs and single-line
breaks) into HTML for Graph's `body.content`.

This is the piece that fixes the browser-automation problem: OWA's rich editor
mangled programmatically typed line breaks, so drafts came out as one block.
Graph accepts real HTML, so paragraphs and the contact lines render exactly.
"""

import html


def text_to_html(text: str) -> str:
    """Blank line -> new <p>; single newline -> <br>. Everything is escaped."""
    paragraphs = (text or "").replace("\r\n", "\n").split("\n\n")
    blocks = []
    for para in paragraphs:
        lines = [html.escape(line) for line in para.split("\n")]
        blocks.append("<p>" + "<br>".join(lines) + "</p>")
    return "\n".join(blocks)
