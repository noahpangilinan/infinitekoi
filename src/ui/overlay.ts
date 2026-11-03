import { clear, h } from "./dom";

// Things that float over the pond: toasts, "+N" numbers, tooltips, dialogs.

const toasts = h("div", { id: "toasts" });
const floaters = h("div", { id: "floaters" });
const tip = h("div", { id: "tip" });
const modal = h("div", { id: "modal" });
document.body.append(toasts, floaters, tip, modal);

export function toast(title: string, body: string, iconUrl?: string, tone = ""): void {
  const t = h("div", { class: `toast ${tone}` },
    iconUrl ? h("img", { src: iconUrl, alt: "" }) : null,
    h("div", {}, h("b", {}, title), h("span", {}, body)));
  toasts.append(t);
  while (toasts.children.length > 5) toasts.firstChild!.remove();
  setTimeout(() => t.classList.add("gone"), 4500);
  setTimeout(() => t.remove(), 5200);
}

export function floatText(text: string, clientX: number, clientY: number, tone = ""): void {
  const f = h("div", { class: `floater ${tone}` }, text);
  f.style.left = `${clientX}px`;
  f.style.top = `${clientY}px`;
  floaters.append(f);
  setTimeout(() => f.remove(), 1100);
}

export function showTip(html: string, x: number, y: number): void {
  tip.innerHTML = html;
  tip.style.display = "block";
  const r = tip.getBoundingClientRect();
  tip.style.left = `${Math.max(8, Math.min(x - r.width - 16, window.innerWidth - r.width - 8))}px`;
  tip.style.top = `${Math.max(8, Math.min(y - 10, window.innerHeight - r.height - 8))}px`;
}

export function hideTip(): void {
  tip.style.display = "none";
}

export interface DialogButton {
  label: string;
  tone?: string;
  action?: () => void;
}

export function dialog(title: string, body: Node | string, buttons: DialogButton[]): void {
  clear(modal);
  const close = () => modal.classList.remove("open");
  const box = h("div", { class: "dialog" },
    h("h2", {}, title),
    typeof body === "string" ? h("p", { html: body }) : body,
    h("div", { class: "buttons" }, ...buttons.map((b) =>
      h("button", { class: b.tone ?? "", onclick: () => { close(); b.action?.(); } }, b.label))));
  modal.append(box);
  modal.classList.add("open");
}
