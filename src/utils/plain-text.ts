/** Strip common markdown so coach replies stay readable as plain text. */
export function toPlainText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/```[\s\S]*?```/g, (block) =>
      block
        .replace(/^```[a-zA-Z0-9_-]*\n?/, '')
        .replace(/```$/, '')
        .trim(),
    )
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, (match) => match.trimStart())
    .replace(/^(-{3,}|\*{3,}|_{3,})\s*$/gm, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
