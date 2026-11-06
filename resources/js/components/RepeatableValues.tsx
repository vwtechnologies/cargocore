import { Plus, Trash2 } from "./icons";

export function RepeatableValues({
    label,
    values,
    onChange,
}: {
    label: string;
    values: string[];
    onChange: (values: string[]) => void;
}) {
    return (
        <div className="repeatable" role="group" aria-label={label}>
            {values.map((value, index) => (
                <div className="repeatable-row" key={index}>
                    <input
                        aria-label={`${label} ${index + 1}`}
                        value={value}
                        onChange={(event) =>
                            onChange(
                                values.map((item, position) =>
                                    position === index
                                        ? event.target.value
                                        : item,
                                ),
                            )
                        }
                    />
                    <button
                        type="button"
                        className="btn subtle small repeatable-remove"
                        aria-label={`Remove ${label} Row ${index + 1}`}
                        onClick={() =>
                            onChange(
                                values.filter(
                                    (_, position) => position !== index,
                                ),
                            )
                        }
                    >
                        <Trash2 size={15} />
                        <span>Remove</span>
                    </button>
                </div>
            ))}
            <button
                type="button"
                className="btn subtle small"
                onClick={() => onChange([...values, ""])}
            >
                <Plus size={15} />
                <span>Add Row</span>
            </button>
        </div>
    );
}
