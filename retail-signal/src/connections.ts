export interface Connections {
  googleMapsKey: string;
  googleMapId: string;
  s4FioriUrl: string;
  commerceUrl: string;
  ibpUrl: string;
}
export const emptyConnections: Connections = {
  googleMapsKey: "",
  googleMapId: "",
  s4FioriUrl: "",
  commerceUrl: "",
  ibpUrl: "",
};
export function readConnections(): Connections {
  try {
    return {
      ...emptyConnections,
      ...JSON.parse(localStorage.getItem("retail-signal-connections") || "{}"),
    };
  } catch {
    return emptyConnections;
  }
}
export function saveConnections(c: Connections) {
  for (const value of [c.s4FioriUrl, c.commerceUrl, c.ibpUrl]) {
    if (value && new URL(value).protocol !== "https:")
      throw new Error("SAP application links must use HTTPS.");
  }
  localStorage.setItem("retail-signal-connections", JSON.stringify(c));
}
