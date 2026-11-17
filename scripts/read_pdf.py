#!/usr/bin/env python3
"""
Token-Efficient PDF Reader CLI (Python Companion)
Extracts, cleans, slices, and chunks PDF text to minimize LLM token consumption.
"""

import sys
import os
import re
import json
import argparse
import subprocess
from typing import List, Dict, Any, Optional, Set

def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, len(text.strip()) // 4)

def get_pdf_metadata(pdf_path: str) -> Dict[str, Any]:
    try:
        out = subprocess.check_output(["pdfinfo", pdf_path], text=True, stderr=subprocess.DEVNULL)
        meta = {"pages": 1, "title": None, "author": None, "file_size": 0}
        for line in out.splitlines():
            if ":" not in line:
                continue
            key, val = line.split(":", 1)
            key = key.strip().lower()
            val = val.strip()
            if key == "pages":
                meta["pages"] = int(val) if val.isdigit() else 1
            elif key == "title" and val:
                meta["title"] = val
            elif key == "author" and val:
                meta["author"] = val
            elif key == "file size":
                match = re.match(r"^(\d+)", val)
                if match:
                    meta["file_size"] = int(match.group(1))
        if not meta["file_size"] and os.path.exists(pdf_path):
            meta["file_size"] = os.path.getsize(pdf_path)
        return meta
    except Exception as e:
        return {"pages": 1, "title": None, "author": None, "file_size": os.path.getsize(pdf_path) if os.path.exists(pdf_path) else 0}

def extract_raw_pages(pdf_path: str, start_page: Optional[int] = None, end_page: Optional[int] = None) -> List[Dict[str, Any]]:
    cmd = ["pdftotext", "-layout", "-enc", "UTF-8"]
    if start_page:
        cmd.extend(["-f", str(start_page)])
    if end_page:
        cmd.extend(["-l", str(end_page)])
    cmd.extend([pdf_path, "-"])

    out = subprocess.check_output(cmd, text=True)
    raw_pages = out.split("\x0c")
    base_page = start_page or 1
    pages = []
    for i, page_str in enumerate(raw_pages):
        if i == len(raw_pages) - 1 and not page_str.strip():
            continue
        pages.append({
            "page": base_page + i,
            "text": page_str
        })
    return pages

def strip_headers_footers(pages: List[Dict[str, Any]], sample_pages: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    ref_pages = sample_pages if sample_pages is not None else pages
    if len(ref_pages) <= 1:
        return pages

    top_lines: Dict[str, int] = {}
    bottom_lines: Dict[str, int] = {}

    for p in ref_pages:
        lines = [l.strip() for l in p["text"].splitlines() if l.strip()]
        for l in lines[:3]:
            norm = re.sub(r"\d+", "#", l).lower()
            top_lines[norm] = top_lines.get(norm, 0) + 1
        for l in lines[-3:]:
            norm = re.sub(r"\d+", "#", l).lower()
            bottom_lines[norm] = bottom_lines.get(norm, 0) + 1

    threshold = max(2, int(len(ref_pages) * 0.4))
    repetitive_headers = {k for k, v in top_lines.items() if v >= threshold}
    repetitive_footers = {k for k, v in bottom_lines.items() if v >= threshold}

    cleaned = []
    for p in pages:
        lines = p["text"].splitlines()
        filtered = []
        for idx, raw_l in enumerate(lines):
            l = raw_l.strip()
            if not l:
                filtered.append("")
                continue
            norm = re.sub(r"\d+", "#", l).lower()
            if idx < 5 and norm in repetitive_headers:
                continue
            if idx >= len(lines) - 5 and norm in repetitive_footers:
                continue
            if (idx < 3 or idx >= len(lines) - 3) and re.match(r"^(page\s+\d+(\s+of\s+\d+)?([•|\-–—/].*)?|-?\s*\d+\s*-?|copyright\s*\(c\).*|.*all rights reserved.*)$", l, re.I):
                continue
            filtered.append(raw_l)
        cleaned.append({"page": p["page"], "text": "\n".join(filtered)})
    return cleaned

def clean_text(text: str) -> str:
    # Fix ligatures
    text = (text.replace("\uFB01", "fi")
                .replace("\uFB02", "fl")
                .replace("\uFB00", "ff")
                .replace("\uFB03", "ffi")
                .replace("\uFB04", "ffl")
                .replace("“", '"').replace("”", '"')
                .replace("‘", "'").replace("’", "'")
                .replace("—", "-").replace("–", "-"))

    # Fix soft hyphens across line breaks
    text = re.sub(r"(\w+)-\s*\n\s*(\w+)", r"\1\2", text)

    # Re-join wrapped sentences within paragraphs
    text = re.sub(r"([^\.\?\!\:\n])\n([a-z0-9])", r"\1 \2", text)

    # Collapse excessive newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def strip_references(text: str) -> (str, int):
    ref_match = re.search(r"\n(?:#+\s*)?(?:[0-9.]+\s*)?(References|Bibliography|Works Cited|Literature Cited)\b[^\n]*\n", text, re.I)
    if ref_match:
        cutoff = ref_match.start()
        stripped_tokens = estimate_tokens(text[cutoff:])
        return text[:cutoff].strip(), stripped_tokens
    return text, 0

def detect_sections(text: str) -> List[Dict[str, Any]]:
    headings = []
    regexes = [
        re.compile(r"^(?:(\d+(?:\.\d+)*)\.?\s+)([A-Z][A-Za-z0-9\s,\-–:]{2,60})$"),
        re.compile(r"^(?:Chapter|CHAPTER)\s+(\d+|[IVXLCDM]+)[\s:.-]+([A-Za-z0-9\s,\-–:]{2,60})$"),
        re.compile(r"^(?:Section|SECTION)\s+(\d+(?:\.\d+)*)[\s:.-]+([A-Za-z0-9\s,\-–:]{2,60})$"),
        re.compile(r"^#{1,3}\s+([A-Za-z0-9\s,\-–:]{2,60})$"),
        re.compile(r"^([A-Z\s]{4,40})$")
    ]
    for line in text.splitlines():
        l = line.strip()
        if not l or len(l) > 70:
            continue
        for r in regexes:
            if r.match(l):
                headings.append({"title": re.sub(r"^#+\s*", "", l)})
                break
    return headings

def parse_page_range(range_str: str, total_pages: int) -> List[int]:
    pages: Set[int] = set()
    for part in range_str.split(","):
        part = part.strip()
        if "-" in part:
            s_str, e_str = part.split("-", 1)
            start = int(s_str) if s_str.isdigit() else 1
            end = int(e_str) if e_str.isdigit() else total_pages
            for p in range(max(1, start), min(total_pages, end) + 1):
                pages.add(p)
        elif part.isdigit():
            p = int(part)
            if 1 <= p <= total_pages:
                pages.add(p)
    return sorted(list(pages))

def main():
    parser = argparse.ArgumentParser(description="Token-Efficient PDF Reader CLI")
    parser.add_argument("file", help="Path to PDF file")
    parser.add_argument("-i", "--inspect", action="store_true", help="Inspect PDF metadata, section outline, and token estimate")
    parser.add_argument("-p", "--pages", help="Page range to extract (e.g. 1-5, 2,4, 10-)")
    parser.add_argument("-s", "--section", help="Extract only a specific section or chapter matching name")
    parser.add_argument("-q", "--query", help="Search PDF and return matching passages with context")
    parser.add_argument("-c", "--context", type=int, default=3, help="Context lines surrounding query hits")
    parser.add_argument("--keep-refs", action="store_true", help="Do not strip References/Bibliography")
    parser.add_argument("--keep-headers", action="store_true", help="Do not strip running headers and footers")
    parser.add_argument("-f", "--format", choices=["md", "json", "text"], default="md", help="Output format")
    parser.add_argument("-o", "--output", help="Output file destination")
    parser.add_argument("--quiet", action="store_true", help="Suppress token savings report")

    args = parser.parse_args()

    if not os.path.exists(args.file):
        sys.stderr.write(f"Error: File not found: {args.file}\n")
        sys.exit(1)

    meta = get_pdf_metadata(args.file)

    if args.inspect:
        print(f"\n======================================================")
        print(f"📄 PDF Inspection: {os.path.basename(args.file)}")
        print(f"======================================================")
        if meta.get("title"):
            print(f"• Title:     {meta['title']}")
        if meta.get("author"):
            print(f"• Author:    {meta['author']}")
        print(f"• Pages:     {meta['pages']}")
        print(f"• File Size: {meta['file_size'] / 1024:.1f} KB")

        raw_pages = extract_raw_pages(args.file, 1, min(meta["pages"], 10))
        sample_text = "\n".join([p["text"] for p in raw_pages])
        sections = detect_sections(sample_text)
        print(f"\nDetected Section Headings (First {len(raw_pages)} Pages):")
        for s in sections:
            print(f"  • {s['title']}")
        est = estimate_tokens(sample_text) * max(1, meta["pages"] // len(raw_pages))
        print(f"\nEstimated Document Tokens: ~{est:,}")
        return

    pages = parse_page_range(args.pages, meta["pages"]) if args.pages else list(range(1, meta["pages"] + 1))
    extracted = extract_raw_pages(args.file, pages[0], pages[-1])
    selected = [p for p in extracted if p["page"] in pages]

    if not args.keep_headers:
        sample_pages = selected
        if len(selected) < 3 and meta["pages"] >= 2:
            sample_pages = extract_raw_pages(args.file, 1, min(meta["pages"], 4))
        selected = strip_headers_footers(selected, sample_pages)

    raw_total_tokens = sum(estimate_tokens(p["text"]) for p in selected)

    cleaned_pages = []
    for p in selected:
        ct = clean_text(p["text"])
        cleaned_pages.append({"page": p["page"], "text": ct})

    combined = "\n\n".join([f"## Page {p['page']}\n\n{p['text']}" for p in cleaned_pages])

    stripped_tokens = 0
    if not args.keep_refs:
        combined, stripped_tokens = strip_references(combined)

    if args.section:
        match = re.search(rf"(?:^|\n)(?:#+\s*)?(?:\d+(?:\.\d+)*\.?\s*)?({re.escape(args.section)}[^\n]*)", combined, re.I)
        if match:
            start = match.start()
            next_heading = re.search(r"\n(?:#+\s*|\d+\.\s+)[A-Z]", combined[start + len(match.group(0)):])
            end = (start + len(match.group(0)) + next_heading.start()) if next_heading else len(combined)
            combined = combined[start:end].strip()
        else:
            sys.stderr.write(f"⚠️ Warning: Section '{args.section}' not found.\n")

    if args.query:
        print(f"Query search for: '{args.query}'")
        for p in cleaned_pages:
            lines = p["text"].splitlines()
            for idx, l in enumerate(lines):
                if re.search(re.escape(args.query), l, re.I):
                    start = max(0, idx - args.context)
                    end = min(len(lines), idx + args.context + 1)
                    print(f"\n--- [Page {p['page']}, line {idx + 1}] ---")
                    print("\n".join(lines[start:end]))
        return

    out_payload = ""
    if args.format == "json":
        out_payload = json.dumps({
            "file": os.path.basename(args.file),
            "pages": pages,
            "tokens": estimate_tokens(combined),
            "stripped_ref_tokens": stripped_tokens,
            "content": combined
        }, indent=2)
    elif args.format == "text":
        out_payload = re.sub(r"^#+.*$", "", combined, flags=re.M).strip()
    else:
        out_payload = combined

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out_payload)
        print(f"Saved extracted content to {args.output}")
    else:
        print(out_payload)

    if not args.quiet and not args.output:
        final_tokens = estimate_tokens(out_payload)
        saved = max(0, raw_total_tokens - final_tokens)
        pct = int((saved / raw_total_tokens) * 100) if raw_total_tokens else 0
        sys.stderr.write(f"\n--------------------------------------------------\n")
        sys.stderr.write(f"📊 Token Optimization Summary:\n")
        sys.stderr.write(f"• Raw PDF Tokens:   ~{raw_total_tokens:,}\n")
        sys.stderr.write(f"• Extracted Tokens: ~{final_tokens:,}\n")
        if stripped_tokens:
            sys.stderr.write(f"• Refs Stripped:    ~{stripped_tokens:,} tokens\n")
        sys.stderr.write(f"• Context Saved:    {pct}% ({saved:,} tokens prevented)\n")
        sys.stderr.write(f"--------------------------------------------------\n")

if __name__ == "__main__":
    main()
