export function splitMarkdown(
  text: string,
  maxLength: number = 4000
): string[] {
  const lines = text.split("\n");
  const parts: string[] = [];
  let currentPart: string[] = [];

  for (const line of lines) {
    if ((currentPart.join("\n") + "\n" + line).length > maxLength) {
      if (currentPart.length > 0) parts.push(currentPart.join("\n"));
      else if (line.length < maxLength) parts.push(line);
      else parts.push(...splitString(line, maxLength));
      currentPart = [];
    }
    currentPart.push(line);
  }

  if (currentPart.length > 0) {
    parts.push(currentPart.join("\n"));
  }

  return parts;
}

function splitString(text: string, maxLength: number): string[] {
  const lines = text.split(" ");
  const parts: string[] = [];
  let currentPart: string[] = [];

  for (const line of lines) {
    if ((currentPart.join(" ") + " " + line).length > maxLength) {
      parts.push(currentPart.join(" "));
      currentPart = [];
    }
    let newLine = line;
    while (newLine.length > maxLength) {
      currentPart.push(newLine.slice(0, maxLength));
      newLine = newLine.slice(maxLength);
    }
    currentPart.push(newLine);
  }

  if (currentPart.length > 0) {
    parts.push(currentPart.join(" "));
  }

  return parts;
}
