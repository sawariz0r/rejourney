import React from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

/** Minimal Swift highlighting for landing/docs snippets (matches JS palette loosely). */
function highlightSwift(code: string): React.ReactNode[] {
  const lines = code.split('\n');
  const stringRegex = /("(?:[^"\\]|\\.)*")/g;

  const highlightLine = (line: string, lineIndex: number): React.ReactNode => {
    if (line.trim().startsWith('//')) {
      return (
        <span key={lineIndex} className="text-[#94a3b8] italic">
          {line}
        </span>
      );
    }

    const importMatch = line.match(/^(\s*)(import)\s+([\w.]+)\s*$/);
    if (importMatch) {
      return (
        <React.Fragment key={lineIndex}>
          {importMatch[1]}
          <span className="text-[#818cf8]">{importMatch[2]}</span> <span className="text-gray-100">{importMatch[3]}</span>
        </React.Fragment>
      );
    }

    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    const re = new RegExp(stringRegex.source, 'g');
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) {
        parts.push(...highlightSwiftMiddle(line.slice(last, m.index), `${lineIndex}-${last}`));
      }
      parts.push(
        <span key={`${lineIndex}-s-${m.index}`} className="text-[#34d399]">
          {m[1]}
        </span>,
      );
      last = m.index + m[0].length;
    }
    if (last < line.length) {
      parts.push(...highlightSwiftMiddle(line.slice(last), `${lineIndex}-tail`));
    }
    return <React.Fragment key={lineIndex}>{parts}</React.Fragment>;
  };

  const highlightSwiftMiddle = (chunk: string, keyPrefix: string): React.ReactNode[] => {
    if (!chunk) return [];
    const nodes: React.ReactNode[] = [];
    // Highlight Rejourney.* and common Swift keywords in chunk
    const tokens = chunk.split(/(\b(?:@main|struct|class|enum|extension|init|var|let|func|await|Task|some|Scene|App|WindowGroup|ContentView|Bool|body)\b|Rejourney\.\w+)/);
    tokens.forEach((tok, i) => {
      if (!tok) return;
      if (/^Rejourney\.\w+$/.test(tok)) {
        const [obj, method] = tok.split('.');
        nodes.push(
          <span key={`${keyPrefix}-rj-${i}`} className="text-pink-400">
            {obj}
          </span>,
          <span key={`${keyPrefix}-dot-${i}`} className="text-gray-400">
            .
          </span>,
          <span key={`${keyPrefix}-m-${i}`} className="text-[#38bdf8]">
            {method}
          </span>,
        );
        return;
      }
      if (/^(@main|struct|class|enum|extension|init|var|let|func|await|Task|some|Scene|App|WindowGroup|ContentView|Bool|body)$/.test(tok)) {
        nodes.push(
          <span key={`${keyPrefix}-kw-${i}`} className="text-[#c084fc]">
            {tok}
          </span>,
        );
        return;
      }
      nodes.push(
        <span key={`${keyPrefix}-t-${i}`} className="text-gray-300">
          {tok}
        </span>,
      );
    });
    return nodes;
  };

  return lines.map((line, i) => highlightLine(line, i));
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'javascript' }) => {
  if (language === 'swift') {
    const highlightedLines = highlightSwift(code);
    return (
      <div className="overflow-hidden">
        <pre className="text-sm sm:text-base font-mono leading-7 m-0 break-words whitespace-pre-wrap">
          <code className="block">
            {highlightedLines.map((line, idx) => (
              <div key={idx} className="min-h-[1.75rem] break-words">
                {line}
              </div>
            ))}
          </code>
        </pre>
      </div>
    );
  }

  // Simple syntax highlighting for JavaScript/TypeScript with premium dark theme colors
  const highlightCode = (code: string): React.ReactNode[] => {
    const lines = code.split('\n');
    return lines.map((line, lineIndex) => {
      // Match import statements: import { initRejourney } from 'rejourney';
      const importMatch = line.match(/^(import\s+)(\{[^}]+\})(\s+from\s+)('[^']+'|"[^"]+");?$/);
      if (importMatch) {
        return (
          <React.Fragment key={lineIndex}>
            <span className="text-[#818cf8]">{importMatch[1]}</span>
            <span className="text-gray-100">{importMatch[2]}</span>
            <span className="text-[#818cf8]">{importMatch[3]}</span>
            <span className="text-[#34d399]">{importMatch[4]}</span>
            {importMatch[0].endsWith(';') && <span className="text-gray-500">;</span>}
          </React.Fragment>
        );
      }

      // Match function calls with string argument: initRejourney('pk_live_public_route_key')
      const funcMatch = line.match(/^(\w+)(\()('[^']+'|"[^"]+")(\));?$/);
      if (funcMatch) {
        return (
          <React.Fragment key={lineIndex}>
            <span className="text-[#38bdf8]">{funcMatch[1]}</span>
            <span className="text-gray-400">{funcMatch[2]}</span>
            <span className="text-[#34d399]">{funcMatch[3]}</span>
            <span className="text-gray-400">{funcMatch[4]}</span>
            {funcMatch[0].endsWith(';') && <span className="text-gray-500">;</span>}
          </React.Fragment>
        );
      }

      // Match function calls with no arguments: startRejourney();
      const noArgFuncMatch = line.match(/^(\w+)(\(\));?$/);
      if (noArgFuncMatch) {
        return (
          <React.Fragment key={lineIndex}>
            <span className="text-[#38bdf8]">{noArgFuncMatch[1]}</span>
            <span className="text-gray-400">{noArgFuncMatch[2]}</span>
            {noArgFuncMatch[0].endsWith(';') && <span className="text-gray-500">;</span>}
          </React.Fragment>
        );
      }

      // Match method calls: Rejourney.setUserIdentity('user_id')
      const methodMatch = line.match(/^(\w+)(\.)([\w.]+)(\()('[^']+'|"[^"]+"|[^)]*)?(\));?$/);
      if (methodMatch) {
        return (
          <React.Fragment key={lineIndex}>
            <span className="text-pink-400">{methodMatch[1]}</span>
            <span className="text-gray-400">{methodMatch[2]}</span>
            <span className="text-[#38bdf8]">{methodMatch[3]}</span>
            <span className="text-gray-400">{methodMatch[4]}</span>
            {methodMatch[5] && (
              methodMatch[5].startsWith("'") || methodMatch[5].startsWith('"')
                ? <span className="text-[#34d399]">{methodMatch[5]}</span>
                : <span className="text-gray-200">{methodMatch[5]}</span>
            )}
            <span className="text-gray-400">{methodMatch[6]}</span>
            {methodMatch[0].endsWith(';') && <span className="text-gray-500">;</span>}
          </React.Fragment>
        );
      }

      // Match comments: // ...
      if (line.trim().startsWith('//')) {
        return (
          <span key={lineIndex} className="text-[#94a3b8] italic">
            {line}
          </span>
        );
      }

      // Fallback: return line as-is
      return (
        <span key={lineIndex} className="text-gray-300">
          {line}
        </span>
      );
    });
  };

  const highlightedLines = highlightCode(code);

  return (
    <div className="overflow-hidden">
      <pre className="text-sm sm:text-base font-mono leading-7 m-0 break-words whitespace-pre-wrap">
        <code className="block">
          {highlightedLines.map((line, idx) => (
            <div key={idx} className="min-h-[1.75rem] break-words">
              {line}
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
};
