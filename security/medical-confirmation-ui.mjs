// Accessible, minimal Brazilian Portuguese medical identity confirmation UI.
// NOT wired into Lumi. Only mount once server-side WebAuthn and grants are tested.
// No medical information is displayed or requested by this component.
export function createMedicalConfirmation({ onConfirm, onHelp } = {}) {
  if (typeof onConfirm !== "function") throw new TypeError("onConfirm is required");
  const section = document.createElement("section");
  section.setAttribute("aria-label", "Proteção das informações de saúde");
  const heading = document.createElement("h2");
  heading.textContent = "Suas informações de saúde";
  const description = document.createElement("p");
  description.textContent = "Para proteger seus dados, confirme que é você. Use a opção de segurança que seu aparelho oferecer.";
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.textContent = "Confirmar minha identidade";
  confirm.style.minHeight = "48px";
  const help = document.createElement("button");
  help.type = "button";
  help.textContent = "Preciso de ajuda";
  help.style.minHeight = "48px";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  async function run() {
    confirm.disabled = true;
    status.textContent = "Aguardando confirmação no seu aparelho…";
    try {
      await onConfirm();
      status.textContent = "Identidade confirmada.";
    } catch (error) {
      // Avoid exposing server details or secrets to end users.
      status.textContent = error?.name === "NotAllowedError"
        ? "Confirmação cancelada. Você pode tentar novamente."
        : "Não foi possível confirmar. Tente novamente ou peça ajuda.";
    } finally {
      confirm.disabled = false;
    }
  }
  confirm.addEventListener("click", run);
  help.addEventListener("click", () => {
    if (typeof onHelp === "function") onHelp();
    else status.textContent = "Peça ajuda a alguém de confiança ou ao suporte da Lumi. Nunca compartilhe sua senha.";
  });
  section.append(heading, description, confirm, help, status);
  return section;
}
