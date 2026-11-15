(() => {
  const script = document.currentScript;
  if (!script || document.getElementById("clinicflow-reception-launcher"))
    return;
  const origin = new URL(script.src).origin;
  const requestedColor = script.getAttribute("data-color") || "#123f38";
  const color = /^#[0-9a-fA-F]{6}$/.test(requestedColor)
    ? requestedColor
    : "#123f38";
  const button = document.createElement("button");
  button.id = "clinicflow-reception-launcher";
  button.type = "button";
  button.textContent = "Chat with reception";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "clinicflow-reception-frame");
  button.style.cssText = `position:fixed;right:16px;bottom:20px;z-index:2147483000;padding:15px 20px;border:0;border-radius:30px;background:${color};color:white;cursor:pointer;font:600 14px Arial,sans-serif;box-shadow:0 6px 24px #0002`;
  const frame = document.createElement("iframe");
  frame.id = "clinicflow-reception-frame";
  frame.title = "Business reception chat and appointment requests";
  frame.src = new URL("/widget", origin).href;
  frame.referrerPolicy = "no-referrer";
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  frame.style.cssText =
    "display:none;position:fixed;right:16px;bottom:84px;width:min(380px,calc(100vw - 32px));height:620px;max-height:calc(100dvh - 110px);border:1px solid #d8e5dd;border-radius:16px;box-shadow:0 12px 40px #0002;background:white;z-index:2147482999";
  button.addEventListener("click", () => {
    const open = frame.style.display === "none";
    frame.style.display = open ? "block" : "none";
    button.setAttribute("aria-expanded", String(open));
    button.textContent = open ? "Close reception" : "Chat with reception";
  });
  document.body.append(frame, button);
})();
