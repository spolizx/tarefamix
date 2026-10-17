import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.TAREFAMIX_AUTH || {};
const statusEl = document.querySelector("#authStatus");
const authPanel = document.querySelector("#authPanel");
const recoveryPanel = document.querySelector("#passwordRecoveryPanel");
const profileSetup = document.querySelector("#profileSetup");
const introScreen = document.querySelector("#introScreen");
const logoutButton = document.querySelector("#signOutAccount");
const currentUserKey = "tarefamix-auth-uid";
const status = (message, error = false) => {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", error);
};

if (!cfg.supabaseUrl || !cfg.publishableKey || cfg.supabaseUrl.startsWith("COLE_") || cfg.publishableKey.startsWith("COLE_")) {
  status("A autenticação ainda precisa ser conectada a um projeto Supabase.", true);
  for (const button of document.querySelectorAll("#authEmailForm button, #googleSignIn, #resetPassword")) button.disabled = true;
} else {
  const supabase = createClient(cfg.supabaseUrl, cfg.publishableKey);
  const accountDataKey = (uid, key) => `tarefamix:${uid}:${key}`;
  const emailField = document.querySelector("#authEmail");
  const passwordField = document.querySelector("#authPassword");
  const submitButton = document.querySelector("#authEmailForm [type=submit]");
  let authMode = "login";

  function useAccount(session) {
    const uid = session.user.id;
    if (localStorage.getItem(currentUserKey) !== uid) {
      const migrationKey = "tarefamix-guest-data-migrated";
      if (!localStorage.getItem(migrationKey)) {
        const guestPrefix = "tarefamix:guest:";
        const accountPrefix = `tarefamix:${uid}:`;
        const guestEntries = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(guestPrefix)) guestEntries.push([key, localStorage.getItem(key)]);
        }
        for (const [key, value] of guestEntries) {
          const destination = accountPrefix + key.slice(guestPrefix.length);
          if (localStorage.getItem(destination) === null) localStorage.setItem(destination, value);
        }
        localStorage.setItem(migrationKey, "yes");
      }
      localStorage.setItem(currentUserKey, uid);
      location.reload();
      return;
    }
    logoutButton.hidden = false;
    authPanel.hidden = true;
    recoveryPanel.hidden = true;
    const hasProfile = Boolean(localStorage.getItem(accountDataKey(uid, "orgest-nome")));
    profileSetup.hidden = hasProfile;
    if (hasProfile) introScreen.classList.add("hidden");
    else introScreen.classList.remove("hidden");
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) status("Não consegui conferir sua sessão. Tente recarregar a página.", true);
  const recoveringPassword = location.hash.includes("type=recovery");
  if (session && recoveringPassword) {
    authPanel.hidden = true;
    profileSetup.hidden = true;
    recoveryPanel.hidden = false;
    introScreen.classList.remove("hidden");
  } else if (session) {
    useAccount(session);
  } else {
    localStorage.removeItem(currentUserKey);
    authPanel.hidden = false;
    profileSetup.hidden = true;
    recoveryPanel.hidden = true;
    logoutButton.hidden = true;
  }

  document.querySelector("#authEmailForm").addEventListener("submit", async event => {
    event.preventDefault();
    const email = emailField.value.trim();
    const password = passwordField.value;
    status(authMode === "signup" ? "Criando sua conta..." : "Entrando...");
    const result = authMode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) { status(result.error.message, true); return; }
    if (result.data.session) { useAccount(result.data.session); return; }
    status(`Enviamos um e-mail de confirmação para ${email}. Abra sua caixa de entrada e clique no link para ativar a conta.`);
  });

  document.querySelector("#createAccount").addEventListener("click", () => {
    authMode = authMode === "login" ? "signup" : "login";
    submitButton.textContent = authMode === "signup" ? "Criar conta" : "Entrar";
    document.querySelector("#createAccount").textContent = authMode === "signup" ? "Voltar para entrar" : "Criar conta";
    passwordField.autocomplete = authMode === "signup" ? "new-password" : "current-password";
    status(authMode === "signup" ? "Informe seu e-mail e crie uma senha com pelo menos 8 caracteres." : "Entre com sua conta existente.");
  });

  document.querySelector("#updatePasswordForm").addEventListener("submit", async event => {
    event.preventDefault();
    const password = document.querySelector("#newPassword").value;
    const recoveryStatus = document.querySelector("#passwordStatus");
    const { data, error } = await supabase.auth.updateUser({ password });
    recoveryStatus.textContent = error ? error.message : "Senha atualizada. Entrando no TarefaMix...";
    recoveryStatus.classList.toggle("error", Boolean(error));
    if (!error && data.user) {
      history.replaceState(null, "", location.pathname + location.search);
      const { data: { session: updatedSession } } = await supabase.auth.getSession();
      if (updatedSession) useAccount(updatedSession);
    }
  });

  document.querySelector("#googleSignIn").addEventListener("click", async () => {
    status("Abrindo o acesso do Google...");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
    if (error) status(error.message, true);
  });

  document.querySelector("#resetPassword").addEventListener("click", async () => {
    const email = emailField.value.trim();
    if (!email) { status("Digite seu e-mail primeiro para receber o link de recuperação.", true); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    status(error ? error.message : "Se esse e-mail estiver cadastrado, você receberá um link para redefinir a senha.", Boolean(error));
  });

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) { logoutButton.disabled = false; status(error.message, true); return; }
    localStorage.removeItem(currentUserKey);
    location.reload();
  });
  supabase.auth.onAuthStateChange((event, nextSession) => {
    if (event === "SIGNED_OUT") {
      localStorage.removeItem(currentUserKey);
      location.reload();
    } else if (event === "SIGNED_IN" && nextSession) {
      useAccount(nextSession);
    }
  });
}
