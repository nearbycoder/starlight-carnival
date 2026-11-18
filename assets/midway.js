const picker = document.querySelector(".act-picker");
const performers = [...picker.querySelectorAll("button")];
const cards = [...document.querySelectorAll(".act")];
function showPerformer(button) {
  performers.forEach((item) =>
    item.setAttribute("aria-pressed", String(item === button)),
  );
  cards.forEach((card) => {
    card.hidden = card.id !== button.getAttribute("aria-controls");
  });
}
for (const [i, button] of performers.entries()) {
  button.addEventListener("click", () => showPerformer(button));
  button.addEventListener("keydown", (event) => {
    const next = {
      ArrowLeft: (i + 7) % 8,
      ArrowRight: (i + 1) % 8,
      Home: 0,
      End: 7,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    showPerformer(performers[next]);
    performers[next].focus();
  });
}
showPerformer(performers[0]);
picker.hidden = false;
