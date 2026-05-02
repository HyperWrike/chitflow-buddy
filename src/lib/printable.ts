// Browser-based "print to PDF" — opens print dialog with the printable region styled for A4.
export function printElement(elementId: string, title = "Document") {
  const el = document.getElementById(elementId);
  if (!el) return;
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) return;
  const doc = win.document;
  doc.title = title;

  Array.from(document.querySelectorAll("style, link[rel='stylesheet']")).forEach((n) => {
    doc.head.appendChild(n.cloneNode(true));
  });

  const printStyle = doc.createElement("style");
  printStyle.textContent = `
    @page { size: A4; margin: 0; }
    body { margin: 0; background: white; font-family: 'Inter', system-ui, sans-serif; }
    .printable { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 0; }
  `;
  doc.head.appendChild(printStyle);

  const wrapper = doc.createElement("div");
  wrapper.appendChild(el.cloneNode(true));
  doc.body.appendChild(wrapper);

  win.focus();
  setTimeout(() => {
    win.print();
    setTimeout(() => win.close(), 300);
  }, 100);
}
