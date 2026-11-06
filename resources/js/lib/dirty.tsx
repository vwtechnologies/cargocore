import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useState,
    type ReactNode,
} from "react";
const Context = createContext<{
    dirty: boolean;
    mark: (key: string, value: boolean) => void;
    clear: () => void;
    discard: () => boolean;
}>({ dirty: false, mark: () => {}, clear: () => {}, discard: () => true });
export function DirtyProvider({ children }: { children: ReactNode }) {
    const [forms, setForms] = useState<Record<string, boolean>>({});
    const dirty = Object.values(forms).some(Boolean);
    const mark = useCallback(
        (key: string, value: boolean) =>
            setForms((previous) => {
                if (previous[key] === value) return previous;
                const next = { ...previous };
                if (value) next[key] = true;
                else delete next[key];
                return next;
            }),
        [],
    );
    const clear = useCallback(() => setForms({}), []);
    const discard = useCallback(() => {
        if (dirty && !window.confirm("Discard unsaved changes?")) return false;
        clear();
        return true;
    }, [dirty, clear]);
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (dirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [dirty]);
    return (
        <Context.Provider value={{ dirty, mark, clear, discard }}>
            {children}
        </Context.Provider>
    );
}
export function useDirty() {
    return useContext(Context);
}
export function useDirtyForm(dirty: boolean) {
    const id = useId();
    const { mark } = useDirty();
    useEffect(() => {
        mark(id, dirty);
        return () => mark(id, false);
    }, [id, dirty, mark]);
}
