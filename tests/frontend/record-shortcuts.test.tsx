import { useRef, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRecordShortcuts } from "../../resources/js/lib/record-shortcuts";

afterEach(cleanup);

function Scope({
    label,
    page = false,
    allowed = true,
    onNew,
    onEdit,
    onSave,
    children,
}: {
    label: string;
    page?: boolean;
    allowed?: boolean;
    onNew?: () => void;
    onEdit?: () => void;
    onSave?: () => void;
    children?: ReactNode;
}) {
    const scope = useRef<HTMLDivElement>(null);
    useRecordShortcuts({
        scope,
        page,
        canCreate: allowed,
        canUpdate: allowed,
        canSave: allowed,
        onNew,
        onEdit,
        onSave,
    });
    return (
        <div ref={scope}>
            <input aria-label={label} />
            {children}
        </div>
    );
}

it("supports Control and Command shortcuts while keeping unsupported modifier combinations untouched", () => {
    const onNew = vi.fn(),
        onEdit = vi.fn(),
        onSave = vi.fn();
    render(
        <Scope
            label="Record"
            page
            onNew={onNew}
            onEdit={onEdit}
            onSave={onSave}
        />,
    );
    const input = screen.getByLabelText("Record");
    expect(fireEvent.keyDown(input, { key: "e", ctrlKey: true })).toBe(false);
    fireEvent.keyDown(input, { key: "n", metaKey: true });
    fireEvent.keyDown(input, { key: "s", ctrlKey: true });
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: "n", ctrlKey: true, repeat: true });
    fireEvent.keyDown(input, { key: "n", ctrlKey: true, isComposing: true });
    fireEvent.keyDown(input, { key: "n", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(input, { key: "n", ctrlKey: true, altKey: true });
    expect(onNew).toHaveBeenCalledTimes(1);
});

it("targets the focused child record and never falls back to a permitted parent when child editing is denied", () => {
    const parentNew = vi.fn(),
        childNew = vi.fn(),
        childEdit = vi.fn();
    const view = render(
        <Scope label="Parent" page onNew={parentNew}>
            <Scope label="Child" onNew={childNew} onEdit={childEdit} />
        </Scope>,
    );
    fireEvent.keyDown(screen.getByLabelText("Child"), {
        key: "n",
        ctrlKey: true,
    });
    expect(childNew).toHaveBeenCalledOnce();
    expect(parentNew).not.toHaveBeenCalled();
    view.rerender(
        <Scope label="Parent" page onNew={parentNew}>
            <Scope
                label="Child"
                allowed={false}
                onNew={childNew}
                onEdit={childEdit}
            />
        </Scope>,
    );
    expect(
        fireEvent.keyDown(screen.getByLabelText("Child"), {
            key: "n",
            ctrlKey: true,
        }),
    ).toBe(false);
    fireEvent.keyDown(screen.getByLabelText("Child"), {
        key: "e",
        ctrlKey: true,
    });
    expect(childNew).toHaveBeenCalledOnce();
    expect(childEdit).not.toHaveBeenCalled();
    expect(parentNew).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "n", ctrlKey: true });
    expect(parentNew).toHaveBeenCalledOnce();
});

it("delegates New from an inline form to its page but keeps Save scoped to the form", () => {
    const onNew = vi.fn(),
        pageSave = vi.fn(),
        formSave = vi.fn();
    render(
        <Scope label="Page" page onNew={onNew} onSave={pageSave}>
            <Scope label="Form" onSave={formSave} />
        </Scope>,
    );
    fireEvent.keyDown(screen.getByLabelText("Form"), {
        key: "n",
        ctrlKey: true,
    });
    fireEvent.keyDown(screen.getByLabelText("Form"), {
        key: "s",
        ctrlKey: true,
    });
    expect(onNew).toHaveBeenCalledOnce();
    expect(formSave).toHaveBeenCalledOnce();
    expect(pageSave).not.toHaveBeenCalled();
});

it("blocks background record actions while a dialog is open and allows the dialog form to save", () => {
    const onNew = vi.fn(),
        onEdit = vi.fn(),
        modalSave = vi.fn();
    render(
        <>
            <Scope label="Page" page onNew={onNew} onEdit={onEdit} />
            <div role="dialog" data-state="open">
                <Scope label="Modal form" onSave={modalSave} />
            </div>
        </>,
    );
    const input = screen.getByLabelText("Modal form");
    fireEvent.keyDown(input, { key: "n", ctrlKey: true });
    fireEvent.keyDown(input, { key: "e", ctrlKey: true });
    fireEvent.keyDown(input, { key: "s", ctrlKey: true });
    expect(onNew).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
    expect(modalSave).toHaveBeenCalledOnce();
});
