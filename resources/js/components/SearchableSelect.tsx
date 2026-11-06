import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, X, Check } from "./icons";
import { SelectPopover } from "./SelectPopover";

export interface SearchableOption {
    value: string | number;
    label: string;
    sublabel?: string;
    code?: string;
}

export interface SearchableSelectProps {
    id?: string;
    name?: string;
    value: string | number | null | undefined;
    onChange: (value: string | number) => void;
    options: SearchableOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    clearable?: boolean;
    compact?: boolean;
    className?: string;
    ariaLabel?: string;
    autoFocus?: boolean;
    onNextField?: () => void;
}

export function SearchableSelect({
    id,
    name,
    value,
    onChange,
    options,
    placeholder = "Select an option…",
    searchPlaceholder = "Type to search…",
    disabled = false,
    readOnly = false,
    required = false,
    clearable = false,
    compact = false,
    className = "",
    ariaLabel,
    autoFocus = false,
    onNextField,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    const selectedOption = useMemo(() => {
        if (value === null || value === undefined || value === "") return null;
        return (
            options.find((opt) => String(opt.value) === String(value)) || null
        );
    }, [options, value]);

    // Filter options based on search query
    const filteredOptions = useMemo(() => {
        if (!search.trim()) return options;
        const q = search.toLowerCase();
        return options.filter((opt) => {
            const labelMatch = opt.label.toLowerCase().includes(q);
            const sublabelMatch = opt.sublabel
                ? opt.sublabel.toLowerCase().includes(q)
                : false;
            const codeMatch = opt.code
                ? opt.code.toLowerCase().includes(q)
                : false;
            return labelMatch || sublabelMatch || codeMatch;
        });
    }, [options, search]);

    // Reset highlighted index when filtered list changes
    useEffect(() => {
        setHighlightedIndex(0);
    }, [filteredOptions.length, search]);

    // Focus search input when popover opens
    useEffect(() => {
        if (isOpen) {
            setSearch("");
            setHighlightedIndex(0);
        }
    }, [isOpen]);

    // Keep keyboard navigation inside the options scroller without moving the page.
    useEffect(() => {
        const list = listRef.current;
        const item = itemRefs.current[highlightedIndex];
        if (!isOpen || !list || !item) return;
        const listBounds = list.getBoundingClientRect();
        const itemBounds = item.getBoundingClientRect();
        if (itemBounds.top < listBounds.top)
            list.scrollTop += itemBounds.top - listBounds.top;
        else if (itemBounds.bottom > listBounds.bottom)
            list.scrollTop += itemBounds.bottom - listBounds.bottom;
    }, [highlightedIndex, isOpen]);

    const handleSelect = (option: SearchableOption) => {
        onChange(option.value);
        setIsOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange("");
        setIsOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
    };

    // Keyboard navigation when search input is focused
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                Math.min(filteredOptions.length - 1, prev + 1),
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) => Math.max(0, prev - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (filteredOptions[highlightedIndex]) {
                handleSelect(filteredOptions[highlightedIndex]);
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            setIsOpen(false);
            triggerRef.current?.focus({ preventScroll: true });
        } else if (e.key === "Tab") {
            setIsOpen(false);
        }
    };

    // Keyboard navigation on trigger button
    const handleTriggerKeyDown = (
        e: React.KeyboardEvent<HTMLButtonElement>,
    ) => {
        if (readOnly || disabled) return;

        if (e.key === "ArrowDown" || e.key === " " || e.key === "ArrowUp") {
            e.preventDefault();
            setIsOpen(true);
        } else if (e.key === "Enter") {
            // If user presses Enter while closed, let the container's Enter navigation proceed to next field!
            if (!isOpen) {
                if (onNextField) {
                    e.preventDefault();
                    onNextField();
                }
            }
        }
    };

    const isInteractive = !disabled && !readOnly;

    return (
        <div
            ref={containerRef}
            className={`searchable-select-container ${compact ? "compact" : ""} ${className}`}
            style={{ position: "relative", width: "100%" }}
            data-combobox-open={isOpen ? "true" : "false"}
        >
            {/* Hidden native input for form compatibility */}
            {name && (
                <input
                    type="hidden"
                    name={name}
                    value={
                        value !== null && value !== undefined
                            ? String(value)
                            : ""
                    }
                    required={required}
                />
            )}

            {/* Trigger Button */}
            <button
                ref={triggerRef}
                type="button"
                id={id}
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-label={ariaLabel || placeholder}
                disabled={disabled}
                autoFocus={autoFocus}
                data-enter-field="true"
                onClick={() => {
                    if (isInteractive) {
                        setIsOpen(!isOpen);
                    }
                }}
                onKeyDown={handleTriggerKeyDown}
                className={`searchable-select-trigger ${compact ? "searchable-select-compact" : ""} ${
                    readOnly ? "is-readonly" : ""
                } ${disabled ? "is-disabled" : ""} ${isOpen ? "is-open" : ""}`}
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    background: readOnly || disabled ? "#f8faf9" : "#ffffff",
                    border: isOpen ? "1px solid #18362d" : "1px solid #cfdad4",
                    borderRadius: compact ? "6px" : "8px",
                    padding: compact ? "6px 10px" : "9px 12px",
                    minHeight: compact ? "34px" : "42px",
                    fontSize: compact ? "13px" : "14px",
                    color: selectedOption ? "#1a2a22" : "#9ca3af",
                    cursor: isInteractive ? "pointer" : "default",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                    boxShadow: isOpen
                        ? "0 0 0 2px rgba(0, 72, 40, 0.12)"
                        : "none",
                }}
            >
                <span
                    style={{
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontWeight: selectedOption ? 500 : 400,
                        color: selectedOption ? "#111827" : "#889990",
                    }}
                >
                    {selectedOption ? (
                        <>
                            <span>{selectedOption.label}</span>
                            {selectedOption.code && (
                                <span
                                    style={{
                                        marginLeft: "8px",
                                        fontSize: "11.5px",
                                        fontWeight: 600,
                                        padding: "1px 6px",
                                        borderRadius: "4px",
                                        background: "#e8f5ee",
                                        color: "#18362d",
                                    }}
                                >
                                    {selectedOption.code}
                                </span>
                            )}
                        </>
                    ) : (
                        placeholder
                    )}
                </span>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                    }}
                >
                    {clearable && isInteractive && selectedOption && (
                        <span
                            role="button"
                            tabIndex={-1}
                            title="Clear Selection"
                            onClick={handleClear}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "2px",
                                borderRadius: "4px",
                                color: "#9ca3af",
                                cursor: "pointer",
                            }}
                        >
                            <X size={14} />
                        </span>
                    )}

                    {isInteractive && (
                        <ChevronDown
                            size={16}
                            style={{
                                color: "#6b7280",
                                transform: isOpen ? "rotate(180deg)" : "none",
                                transition: "transform 0.15s ease",
                            }}
                        />
                    )}
                </div>
            </button>

            {/* Popover Dropdown */}
            {isOpen && isInteractive && (
                <SelectPopover
                    anchorRef={triggerRef}
                    onClose={() => setIsOpen(false)}
                    className="searchable-select-popover"
                    style={{
                        zIndex: 9999,
                        background: "#ffffff",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        boxShadow:
                            "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                        overflow: "hidden",
                    }}
                >
                    {/* Live Search Box */}
                    <div
                        style={{
                            padding: "8px 10px",
                            borderBottom: "1px solid #f1f5f3",
                            background: "#f9fafb",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                        }}
                    >
                        <Search
                            size={15}
                            style={{ color: "#6b7280", flexShrink: 0 }}
                        />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={searchPlaceholder}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            style={{
                                width: "100%",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                fontSize: "13px",
                                color: "#111827",
                                padding: "4px 0",
                            }}
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    padding: "2px",
                                    cursor: "pointer",
                                    color: "#9ca3af",
                                }}
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Options List */}
                    <div
                        ref={listRef}
                        role="listbox"
                        style={{
                            minHeight: 0,
                            maxHeight: "220px",
                            overflowY: "auto",
                            padding: "4px",
                        }}
                    >
                        {filteredOptions.length === 0 ? (
                            <div
                                style={{
                                    padding: "16px 12px",
                                    fontSize: "13px",
                                    color: "#6b7280",
                                    textAlign: "center",
                                }}
                            >
                                No matching options found
                            </div>
                        ) : (
                            filteredOptions.map((opt, idx) => {
                                const isSelected =
                                    selectedOption &&
                                    String(selectedOption.value) ===
                                        String(opt.value);
                                const isHighlighted = idx === highlightedIndex;

                                return (
                                    <div
                                        key={opt.value}
                                        ref={(el) => {
                                            itemRefs.current[idx] = el;
                                        }}
                                        role="option"
                                        aria-selected={Boolean(isSelected)}
                                        onClick={() => handleSelect(opt)}
                                        onMouseEnter={() =>
                                            setHighlightedIndex(idx)
                                        }
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "8px 10px",
                                            borderRadius: "6px",
                                            fontSize: "13.5px",
                                            cursor: "pointer",
                                            background: isHighlighted
                                                ? "#e8f5ee"
                                                : isSelected
                                                  ? "#f0fdf4"
                                                  : "transparent",
                                            color:
                                                isHighlighted || isSelected
                                                    ? "#18362d"
                                                    : "#1f2937",
                                            fontWeight: isSelected ? 600 : 400,
                                            transition:
                                                "background-color 0.1s ease",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "2px",
                                                overflow: "hidden",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        overflow: "hidden",
                                                        textOverflow:
                                                            "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {opt.label}
                                                </span>
                                                {opt.code && (
                                                    <span
                                                        style={{
                                                            fontSize: "11px",
                                                            padding: "1px 5px",
                                                            borderRadius: "4px",
                                                            background:
                                                                isHighlighted
                                                                    ? "#ffffff"
                                                                    : "#f3f4f6",
                                                            color: "#374151",
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {opt.code}
                                                    </span>
                                                )}
                                            </div>
                                            {opt.sublabel && (
                                                <span
                                                    style={{
                                                        fontSize: "11.5px",
                                                        color: "#6b7280",
                                                    }}
                                                >
                                                    {opt.sublabel}
                                                </span>
                                            )}
                                        </div>

                                        {isSelected && (
                                            <Check
                                                size={15}
                                                style={{
                                                    color: "#18362d",
                                                    flexShrink: 0,
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </SelectPopover>
            )}
        </div>
    );
}
