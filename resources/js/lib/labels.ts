const abbreviations = new Set([
    "IBAN",
    "CNIC",
    "NTN",
    "STRN",
    "UAN",
    "NIFT",
    "PKR",
    "ERP",
    "URL",
    "ID",
    "TP",
    "TPI",
    "TT",
    "RTT",
    "DOB",
]);

export function titleCaseLabel(value: string): string {
    return value.replace(/[A-Za-z][A-Za-z0-9]*/g, (word) => {
        if (abbreviations.has(word.toUpperCase())) return word.toUpperCase();
        if (word.toLowerCase() === "cargocore") return "CargoCore";
        return word[0].toUpperCase() + word.slice(1).toLowerCase();
    });
}
