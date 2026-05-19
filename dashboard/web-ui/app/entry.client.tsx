/**
 * Rejourney Dashboard - Client Entry
 * 
 * This file hydrates the React application on the client side.
 */

import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

for (const node of Array.from(document.documentElement.childNodes)) {
    if (node !== document.head && node !== document.body) {
        node.parentNode?.removeChild(node);
    }
}

startTransition(() => {
    hydrateRoot(
        document,
        <StrictMode>
            <HydratedRouter />
        </StrictMode>
    );
});
