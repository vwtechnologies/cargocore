import type { QueryClient } from "@tanstack/react-query";

const changeEvent = "cargocore-records-changed";
const channelName = "cargocore-records";

export function notifyRecordsChanged() {
    window.dispatchEvent(new Event(changeEvent));
}

export function subscribeToRecordChanges(client: QueryClient) {
    const channel =
        typeof BroadcastChannel === "undefined"
            ? null
            : new BroadcastChannel(channelName);
    const refresh = () => {
        client.removeQueries({ type: "inactive" });
        void client.invalidateQueries();
    };
    const localChange = () => {
        refresh();
        channel?.postMessage("changed");
    };
    window.addEventListener(changeEvent, localChange);
    if (channel)
        channel.onmessage = (event) => {
            if (event.data === "changed") refresh();
        };
    return () => {
        window.removeEventListener(changeEvent, localChange);
        channel?.close();
    };
}
