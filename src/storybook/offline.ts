/** Story-scoped browser state, restored before the next story. No app implementation is mocked. */
export function offline() {
  const original = Object.getOwnPropertyDescriptor(navigator, "onLine");
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  window.dispatchEvent(new Event("offline"));

  return () => {
    if (original) Object.defineProperty(navigator, "onLine", original);
    else Reflect.deleteProperty(navigator, "onLine");
    window.dispatchEvent(new Event("online"));
  };
}
