/** Pista inicial con el nombre del invitado */
const hintEl = () => document.getElementById("hint")

export function showHint(guest) {
  const hint = hintEl()
  hint.querySelector(".hint__guest").textContent = guest.name
  hint.hidden = false
  requestAnimationFrame(() => hint.classList.add("is-visible"))
}

export function hideHint() {
  const hint = hintEl()
  hint.classList.remove("is-visible")
  setTimeout(() => {
    hint.hidden = true
  }, 700)
}
