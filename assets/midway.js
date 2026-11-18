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
  const shot = document.querySelector(".game-card video");
  if (room.id === "how") {
    if (!shot.poster) shot.poster = shot.dataset.poster;
  } else shot.pause();
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
  if (
    event.key === "Escape" &&
    !document.querySelector("dialog[open]") &&
    document.body.dataset.room !== "entrance"
  )
    location.hash = "entrance";
});
function stampTicket() {
  const label = document.querySelector("#adventure-label");
  const progress = document.querySelector("#progress");
  label.textContent = "Play Adventure";
  progress.textContent = "40 missions  ✦  8 worlds";
  try {
    const data = JSON.parse(localStorage.getItem("starlight.v1"));
    const stars = Array.isArray(data?.stars) ? data.stars.slice(0, 40) : [];
    const earned = (n) => Number.isInteger(n) && n > 0 && n <= 3;
    const complete = stars.filter(earned).length;
    if (complete) {
      label.textContent =
        complete === 40 ? "Revisit Adventure" : "Continue Adventure";
      progress.textContent = complete + " of 40 missions complete";
    }
    const ticket = JSON.parse(
      localStorage.getItem("starlight.intermission.v1"),
    );
    const next = Array.from({ length: 40 }, (_, i) => i).find(
      (i) => !earned(stars[i]),
    );
    if (
      ticket?.version === 1 &&
      ticket.n === next &&
      Number.isInteger(ticket.shots) &&
      ticket.shots > 0 &&
      Number.isInteger(ticket.stock) &&
      ticket.stock > 0 &&
      ticket.stock < 1000 &&
      typeof ticket.pegs === "string" &&
      /^[bogs-]{1,110}$/.test(ticket.pegs) &&
      ticket.pegs.includes("o")
    ) {
      label.textContent = "Resume Adventure";
      progress.textContent =
        "Mission " +
        String(next + 1).padStart(2, "0") +
        "  ·  " +
        ticket.stock +
        (ticket.stock === 1 ? " pearl left" : " pearls left");
    }
  } catch {}
}
showPerformer("1");
visit();
stampTicket();
window.addEventListener("pageshow", stampTicket);

window.addEventListener("storage", (event) => {
  if (
    !event.key ||
    ["starlight.v1", "starlight.intermission.v1"].includes(event.key)
  )
    stampTicket();
});

const screening = document.querySelector("#screening");
const trailer = document.querySelector("#trailer");
document.querySelector("#watch-film").addEventListener("click", (event) => {
  if (!screening.showModal) return;
  event.preventDefault();
  if (!trailer.poster) trailer.poster = trailer.dataset.poster;
  screening.showModal();
  trailer.currentTime = 0;
  trailer.play().catch(() => {});
});
function closeScreening() {
  trailer.pause();
  screening.close();
  document.querySelector("#watch-film").focus({ preventScroll: true });
}
document.querySelector("#close-film").addEventListener("click", closeScreening);
screening.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeScreening();
});
screening.addEventListener("close", () => trailer.pause());
screening.addEventListener("click", (event) => {
  if (event.target !== screening) return;
  const bounds = screening.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    closeScreening();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden)
    document.querySelectorAll("video").forEach((video) => video.pause());
});
