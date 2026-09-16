export interface DialogAction {
  label: string;
  secondary?: boolean;
  onClick: () => void;
}

/** Small helper to build dialog content without innerHTML (keeps translated text safe). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children);
  return element;
}

export class Dialog {
  private readonly dialog: HTMLDialogElement;
  private onCancel: (() => void) | null = null;

  constructor(dialog: HTMLDialogElement) {
    this.dialog = dialog;
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.onCancel?.();
    });
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  show(title: string, body: (Node | string)[], actions: DialogAction[], onCancel: (() => void) | null = null): void {
    const buttons = actions.map((action) =>
      el('button', { type: 'button', className: action.secondary ? 'secondary' : '', textContent: action.label, onclick: action.onClick }),
    );
    this.dialog.replaceChildren(el('h2', { textContent: title }), ...body, el('div', { className: 'dialog-actions' }, buttons));
    this.onCancel = onCancel;
    if (!this.dialog.open) this.dialog.showModal();
    buttons[0]?.focus();
  }

  close(): void {
    this.onCancel = null;
    if (this.dialog.open) this.dialog.close();
  }
}
