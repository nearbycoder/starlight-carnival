const performers = [...document.querySelectorAll("[data-act]")];
const portraits = [...document.querySelectorAll(".act")];
const rooms = [...document.querySelectorAll("main > section")];
function showPerformer(number) {
  performers.forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.act === number)),
  );
  portraits.forEach((card) => {
    card.hidden = card.id !== "act-" + number;
  });
}
for (const [i, button] of performers.entries()) {
  button.addEventListener("click", () => showPerformer(button.dataset.act));
  button.addEventListener("keydown", (event) => {
    const next = {
      ArrowLeft: (i + 7) % 8,
      ArrowRight: (i + 1) % 8,
      Home: 0,
      End: 7,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    showPerformer(performers[next].dataset.act);
    performers[next].focus();
  });
}
for (const host of document.querySelectorAll("[data-host]"))
  host.addEventListener("click", () => showPerformer(host.dataset.host));
let lastDoor;
document.querySelector(".gate").addEventListener("click", (event) => {
  const a = event.target.closest('a[href^="#"]');
  if (a) lastDoor = a;
});
function visit(focus = false) {
  const room = rooms.find((r) => "#" + r.id === location.hash) || rooms[0];
  rooms.forEach((r) => (r.hidden = r !== room));
  document.body.dataset.room = room.id;
  if (focus)
    (room === rooms[0] && lastDoor
      ? lastDoor
      : room.querySelector("h1,h2")
    ).focus({ preventScroll: true });
  scrollTo(0, 0);
}
window.addEventListener("hashchange", () => visit(true));
window.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    !event.repeat &&
    !event.altKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    document.body.dataset.room === "entrance" &&
    (event.target === document.body ||
      event.target === document.querySelector("h1"))
  ) {
    event.preventDefault();
    document.querySelector(".admit").click();
    return;
  }
  if (event.key === "Escape" && document.body.dataset.room !== "entrance")
    location.hash = "entrance";
});
function stampTicket() {
  try {
    const data = JSON.parse(localStorage.getItem("starlight.v1"));
    if (!Array.isArray(data?.stars)) return;
    const complete = data.stars
      .slice(0, 40)
      .filter((n) => Number.isInteger(n) && n > 0 && n <= 3).length;
    if (complete > 0) {
      document.querySelector("#adventure-label").textContent =
        complete === 40 ? "Revisit Adventure" : "Continue Adventure";
      document.querySelector("#progress").textContent =
        complete + " of 40 missions complete";
    }
  } catch {}
}
showPerformer("1");
visit();
stampTicket();
window.addEventListener("pageshow", stampTicket);
